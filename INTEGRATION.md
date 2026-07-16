# Integración frontend, Decision Engine y proveedor de identidad

Los tres procesos son independientes:

| Servicio              | Puerto de desarrollo | Responsabilidad                                    |
| --------------------- | -------------------: | -------------------------------------------------- |
| AtlasBackend externo  |               `3001` | Usuarios, roles, permisos, login, refresh y logout |
| ATLAS Decision Engine |               `3000` | BFF de sesión y API funcional de las 25 vistas     |
| Frontend React        |               `5173` | Interfaz Stitch; no contiene código del backend    |

## Configuración local

En el Decision Engine:

```dotenv
NODE_ENV=development
AUTH_MODE=IDENTITY_PROVIDER
IDENTITY_PROVIDER_URL=http://localhost:3001/api/v1
IDENTITY_PROVIDER_TIMEOUT_MS=3000
IDENTITY_REFRESH_COOKIE_NAME=atlas_refresh
IDENTITY_REFRESH_COOKIE_MAX_AGE_SECONDS=2592000
IDENTITY_SESSION_RATE_LIMIT=20
CORS_ALLOWED_ORIGINS=http://localhost:5173
RATE_LIMIT_ENABLED=true
```

En el frontend se mantiene `VITE_API_BASE_URL=/`. Vite reenvía `/v1`, `/health` y `/metrics` al Decision Engine. Así, el navegador nunca recibe el refresh token ni necesita llamar directamente al proveedor externo.

## Flujo de sesión

1. El frontend envía tenant, email y contraseña a `POST /v1/session/login`.
2. El Decision Engine llama a `POST /internal/auth/login` del AtlasBackend externo.
3. El Decision Engine devuelve el access token en el body y guarda el refresh token en una cookie `HttpOnly`, `SameSite=Strict` y `Secure` en producción.
4. El access token permanece exclusivamente en memoria.
5. En un `401`, el cliente ejecuta una sola rotación mediante `POST /v1/session/refresh` y reintenta la petición una vez.
6. Si la rotación falla, la sesión se limpia y la ruta protegida redirige inmediatamente a `/login`.
7. Para autorizar una petición, el Decision Engine consulta `GET /internal/auth/me`; no comparte ni replica el secreto HS256 del proveedor.

## Producción

El frontend debe publicarse detrás de HTTPS. Su Nginx integrado funciona como proxy de mismo origen y recibe la dirección interna del Decision Engine mediante `BACKEND_URL`:

```bash
docker build -t atlas-decision-frontend:2.0.0 .
docker run --rm -p 5173:8080 \
  -e BACKEND_URL=http://atlas-decision-backend:3000 \
  atlas-decision-frontend:2.0.0
```

En producción, `IDENTITY_PROVIDER_URL` debe ser HTTPS y `CORS_ALLOWED_ORIGINS` debe contener únicamente el origen real del portal.

## Verificación

```bash
npm ci
npm run verify
```

El inventario de rutas está en `VIEW_INVENTORY.md` y las 25 capturas originales usadas como referencia están en `docs/stitch-reference`.

## Resultados configurables

El editor de grafo permite crear o elegir variables versionadas del catálogo y declararlas como
`OUTPUT` u `OUTPUT_PRIMARY`. El nodo `RESULT` asigna esas salidas visualmente (literal, variable,
plantilla o expresión JSON AST) y, de forma opcional, mediante JavaScript o Python controlado por
la configuración segura del Decision Engine. El simulador consume `primaryResult` y `output`
dinámicamente; `outcome`, `score`, `riskBand` y `limit` se conservan como compatibilidad legacy.

La autoría manual usa el mismo AST que consume el backend. Al crear un nodo `CONDITION`, el
frontend crea su `GraphCondition` asociada y permite elegir variable, operador y valor. La primera
conexión saliente se crea como rama `DEFAULT`; la segunda se crea como rama `CONDITIONAL` ligada
a esa condición. Las aristas se seleccionan en el canvas para cambiar condición, prioridad o
intercambiar cuál es la rama default sin editar JSON.

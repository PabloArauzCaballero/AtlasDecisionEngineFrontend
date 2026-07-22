# ATLAS Decision Frontend

Portal Next.js del Motor de Decisión ATLAS. Consume el backend mediante un proxy del servidor para conservar la sesión HttpOnly bajo el mismo origen visible para el navegador.

## Requisitos

- Node.js 22.
- Decision Engine disponible en `http://localhost:3000`.
- Proveedor de identidad configurado en el Decision Engine.

## Desarrollo

```bash
corepack enable
cp .env.example .env
yarn install --frozen-lockfile
yarn dev
```

Next.js publica el portal en `http://localhost:5173`. Los route handlers reenvían `/v1`, `/health` y `/metrics` al valor de `DECISION_ENGINE_URL`; el navegador nunca recibe esa dirección interna.

## Verificación

```bash
yarn verify
```

El comando valida formato, ESLint, contratos de fuente, TypeScript, Vitest y el build de producción.

## Producción

```bash
docker build -t atlas-decision-frontend:3.0.0 .
docker run --rm -p 5173:3000 \
  -e DECISION_ENGINE_URL=http://atlas-decision-backend:3000 \
  atlas-decision-frontend:3.0.0
```

`DECISION_ENGINE_URL` se lee en cada solicitud del servidor y puede cambiarse al iniciar el contenedor sin recompilar el bundle. En producción, expón el portal mediante HTTPS; las llamadas del navegador permanecen bajo ese mismo origen.

## Pruebas y simulación

- El simulador usa `/v1/simulations/:artifactCode`: ejecuta un dry-run sobre un despliegue no productivo, devuelve traza y no crea decisiones, auditoría ni métricas de runtime.
- Las suites se encolan con `POST /v1/test-suites/:suiteId/runs` y responden `202`; las vistas del run y de cobertura consultan el estado hasta que el worker termina.
- Los casos pueden crearse en la interfaz o importarse por CSV con las columnas `caseCode`, `testName`, `inputJson`, `expectedResultJson` y, opcionalmente, `tagsJson` e `isActive`.

## Arquitectura interna

- `src/auth`: sesión, expiración, roles y rutas protegidas.
- `src/api`: cliente HTTP, validación Zod y un único retry después de `401`.
- `src/app`: rutas Next.js, límites de error y proxy server-side.
- `src/layout`: navegación y shell corporativo compartido.
- `src/components`: tablas, paneles, métricas, estados y formularios reutilizables.
- `src/features`: componentes especializados como el editor de grafo.
- `src/pages`: composición de las vistas del portal.
- `src/testing`: contratos, formularios e importación de casos de prueba.

La correspondencia completa de pantallas está en [`VIEW_INVENTORY.md`](VIEW_INVENTORY.md).

# ATLAS Decision Frontend

Frontend independiente del Motor de Decisión ATLAS. Implementa las 25 vistas entregadas en los dos paquetes Stitch y consume el Decision Engine mediante HTTP; este repositorio no contiene código del backend.

## Requisitos

- Node.js 22
- Decision Engine en `http://localhost:3000`
- AtlasBackend de identidad disponible para el Decision Engine

## Desarrollo

```bash
cp .env.example .env
npm ci
npm run dev
```

Vite publica el portal en `http://localhost:5173` y reenvía `/v1`, `/health` y `/metrics` al backend en `http://localhost:3000`. Esto mantiene la cookie HttpOnly bajo el mismo origen visible para el navegador.

## Verificación

```bash
npm run verify
```

El comando ejecuta ESLint, typecheck, Vitest y build de producción.

## Producción

```bash
docker build -t atlas-decision-frontend:2.0.0 .
docker run --rm -p 5173:8080 \
  -e BACKEND_URL=http://atlas-decision-backend:3000 \
  atlas-decision-frontend:2.0.0
```

El frontend y el proxy del backend deben compartir el mismo origen HTTPS. `BACKEND_URL` es una dirección interna del servidor Nginx; nunca se expone al bundle React.

## Arquitectura interna

- `src/auth`: sesión, expiración, roles y rutas protegidas.
- `src/api`: cliente HTTP y retry único después de `401`.
- `src/layout`: navegación y shell corporativo compartido.
- `src/components`: tablas, paneles, métricas, estados y formularios reutilizables.
- `src/features`: componentes especializados como el editor de grafo.
- `src/pages`: composición de cada vista Stitch.
- `src/resources`: configuración de inventarios paginados.

La correspondencia completa de pantallas está en [`VIEW_INVENTORY.md`](VIEW_INVENTORY.md).

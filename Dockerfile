# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS dependencies
COPY package.json yarn.lock ./
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
  yarn install --frozen-lockfile

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# `public/` no está versionado: lo llenan `yarn setup:interpretes` (pyodide y webR pesan cientos de
# megas y no tienen sitio en git). En un clon limpio el directorio NO existe, así que el `COPY` de
# más abajo hacía fallar la construccion entera con «/app/public: not found» — una imagen que solo
# se podía construir en la máquina que ya tenía los intérpretes bajados.
# Se garantiza aquí; si están, el desplegador los copia al contexto y viajan dentro.
RUN mkdir -p public
# Y se TRAEN aquí. Sin este paso Coolify (que construye desde un clon limpio) publicaba una imagen sin
# intérpretes: `/pyodide/pyodide.js` y `/webr/*` respondían 404 con la página HTML de Next, el
# navegador la «cargaba» como script y el cuaderno decía «El intérprete se descargó pero no se
# registró» (Python) y «R no está disponible en este ambiente» (R). Medido en TEST el 2026-10-08.
# Los dos scripts son idempotentes: si el contexto ya trae `public/pyodide` o `public/webr`, no
# vuelven a descargar. Si fallan, falla el build: mejor un despliegue que no sale que uno sin Python.
RUN node scripts/setup-pyodide.mjs && node scripts/setup-webr.mjs \
  && test -s public/pyodide/pyodide.js && test -s public/webr/webr-worker.js
# PLAT-03: la identidad del artefacto se escribe AQUÍ, dentro de la imagen, y `/version` la lee de este
# archivo. `SOURCE_COMMIT` (build-arg de Coolify) manda; si llega vacío se lee `.git/HEAD` del contexto
# (el .dockerignore lo deja pasar). Sin ninguno queda `commit: null`: no se inventa, y el smoke lo rechaza.
ARG SOURCE_COMMIT=""
RUN SOURCE_COMMIT="$SOURCE_COMMIT" node scripts/write-build-info.mjs build-info.json
RUN yarn build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  HOSTNAME=0.0.0.0 \
  PORT=3000 \
  DECISION_ENGINE_URL=http://atlas-decision-backend:3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/build-info.json ./build-info.json
# `public/` NO viaja dentro de `standalone`: Next lo deja fuera a proposito y su documentacion
# pide copiarlo aparte, igual que `.next/static`. Sin esta linea la imagen no servia NADA de
# `public/`, y el fallo era invisible mientras el directorio estuvo vacio. Dejo de serlo con el
# cuaderno de datos: su interprete de Python vive en `public/pyodide/`, y en el contenedor la
# pestana respondia «no se encontro el interprete» mientras en el servidor de desarrollo iba bien
# — la peor forma de encontrarse un fallo, porque solo aparece en el artefacto que se despliega.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  # `${PORT}`, no 3000 fijo. La imagen se arranca en el puerto que le toque a cada despliegue (aquí,
  # el 5173 que tiene apuntado el dev tunnel), y con el puerto incrustado la sonda interrogaba a un
  # puerto donde no había nada: el contenedor servía perfectamente y Docker lo daba por `unhealthy`.
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/login" || exit 1
CMD ["node", "server.js"]

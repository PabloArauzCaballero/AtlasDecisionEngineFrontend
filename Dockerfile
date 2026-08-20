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

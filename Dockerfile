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

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/login || exit 1
CMD ["node", "server.js"]

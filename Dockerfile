# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN pnpm --filter @palcenter/api build && pnpm --filter web build

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @palcenter/api

FROM node:22-bookworm-slim AS runtime
ARG PALCENTER_VERSION=development
ENV NODE_ENV="production" \
    PALCENTER_VERSION="${PALCENTER_VERSION}" \
    API_PORT="3001" \
    WEB_PORT="3000" \
    CONFIG_DIR="/app/data" \
    HISTORY_INTERVAL_SECONDS="30"
WORKDIR /app

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=production-dependencies /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/frontend/.next/standalone ./frontend
COPY --from=build /app/apps/frontend/.next/static ./frontend/apps/frontend/.next/static
COPY --from=build /app/apps/frontend/public ./frontend/apps/frontend/public
COPY --chown=node:node scripts/start-production.mjs ./scripts/start-production.mjs

RUN mkdir -p /app/data && chown node:node /app/data && chmod 700 /app/data

USER node
VOLUME ["/app/data"]
EXPOSE 3000 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.API_PORT + '/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "/app/scripts/start-production.mjs"]

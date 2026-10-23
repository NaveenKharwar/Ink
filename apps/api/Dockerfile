# The API. Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:20-slim AS base
RUN npm install -g pnpm@12.6.0
WORKDIR /app
# Every workspace manifest, so the lockfile matches the workspace it was made for.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/schemas/package.json packages/schemas/

# Compiles the shared schemas and the API.
FROM base AS build
RUN pnpm install --frozen-lockfile --filter @ink/api...
COPY tsconfig.base.json ./
COPY packages/schemas packages/schemas
COPY apps/api apps/api
RUN pnpm --filter @ink/schemas build && pnpm --filter @ink/api build

# Only what the API needs to run.
FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod --filter @ink/api...

FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules node_modules
COPY --from=prod-deps /app/packages/schemas/node_modules packages/schemas/node_modules
COPY --from=prod-deps /app/apps/api/node_modules apps/api/node_modules
COPY packages/schemas/package.json packages/schemas/
COPY --from=build /app/packages/schemas/dist packages/schemas/dist
COPY apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/db/migrations apps/api/db/migrations
WORKDIR /app/apps/api
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# Migrations: docker compose run --rm api node dist/scripts/migrate.js
CMD ["node", "dist/server.js"]

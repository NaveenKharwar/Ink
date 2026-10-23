# The web app, served by Caddy, which also passes /api to the API.
# Build from the repo root: docker build -f apps/web/Dockerfile --build-arg SUPABASE_URL=... --build-arg SUPABASE_ANON_KEY=... .
FROM node:20-slim AS build
RUN npm install -g pnpm@12.6.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/schemas/package.json packages/schemas/
RUN pnpm install --frozen-lockfile --filter @ink/web...
COPY tsconfig.base.json ./
COPY packages/schemas packages/schemas
COPY apps/web apps/web
# The two public Supabase values go into the page (and its security policy) at build time.
ARG SUPABASE_URL
ARG SUPABASE_ANON_KEY
RUN test -n "$SUPABASE_URL" && test -n "$SUPABASE_ANON_KEY" \
 && pnpm --filter @ink/schemas build && pnpm --filter @ink/web build

FROM caddy:2.10-alpine
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
ENV SITE_ADDRESS=:8080 \
    API_UPSTREAM=api:3001
EXPOSE 8080

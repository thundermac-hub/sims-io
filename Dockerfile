FROM node:22.21.1-alpine AS base

# Stage 1: Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS npm-updated

RUN npm pack --silent npm@11.14.1 --pack-destination /tmp && \
    rm -rf /usr/local/lib/node_modules/npm && \
    mkdir -p /usr/local/lib/node_modules/npm && \
    tar -xzf /tmp/npm-11.14.1.tgz -C /usr/local/lib/node_modules/npm --strip-components=1 && \
    rm -f /tmp/npm-11.14.1.tgz && \
    ln -sf ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -sf ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx && \
    npm --version

# Stage: dependencies for the migration runner. Next.js bundles mysql2 into
# the app's server chunks, so it never appears in the standalone
# node_modules — the runner needs its own copy, scoped under scripts/ so it
# can't collide with the traced server tree.
FROM npm-updated AS migration-deps
WORKDIR /migration-deps
RUN npm init -y >/dev/null 2>&1 && npm install --no-audit --no-fund mysql2@^3.16.1

# Stage 2: Build the application
FROM npm-updated AS build
WORKDIR /app

# Declare build-time args for NEXT_PUBLIC_* vars so Coolify can pass them
# via --build-arg. These get baked into the JS bundle by next build.
ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY
ARG NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
ENV NEXT_PUBLIC_RECAPTCHA_SITE_KEY=$NEXT_PUBLIC_RECAPTCHA_SITE_KEY
ENV NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=$NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production runner
FROM npm-updated AS runner
WORKDIR /app

RUN apk add --no-cache curl

# Run as non-root for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
# Default port — Coolify overrides this at runtime via its env injection
ENV PORT=3000

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migration runner + SQL: Coolify's POST-deployment command runs
# `node scripts/migrate.mjs up` in this image once it is deployed. It must not
# be the pre-deployment command — that runs in the OLD container, which cannot
# see a migration or runner change shipping in this release (see README).
# CI asserts these files made it into the image, so a .dockerignore regression
# cannot silently drop them.
COPY --chown=nextjs:nodejs ./migrations ./migrations
COPY --chown=nextjs:nodejs ./scripts/migrate.mjs ./scripts/migrate.mjs
COPY --chown=nextjs:nodejs ./scripts/sql-split.mjs ./scripts/sql-split.mjs
COPY --from=migration-deps --chown=nextjs:nodejs /migration-deps/node_modules ./scripts/node_modules

USER nextjs

EXPOSE 3000

# Probes readiness, not "/". Curling "/" passed whenever Node accepted a TCP
# connection: middleware 302s it to /login and `curl -fsS` without -L treats a
# 3xx as success, so the container reported healthy with MySQL, Redis and MinIO
# all down. /api/health/ready 503s only when MySQL is unreachable.
#
# timeout 10s clears the endpoint's own 2s-per-dependency budget; 3 retries at
# 30s means ~90s of sustained failure before the container is marked unhealthy.
# Use $PORT so the check respects Coolify's runtime PORT override.
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT:-3000}/api/health/ready" >/dev/null || exit 1

CMD ["node", "server.js"]

FROM node:24-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN npm install --global pnpm@11.25.0

FROM base AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm test && pnpm typecheck && pnpm lint && pnpm build
RUN pnpm prune --prod && rm -rf .next/cache

FROM base AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 DATABASE_PATH=/app/data/auctus.db
COPY --from=build --chown=node:node /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/migrations ./migrations
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/next.config.ts ./next.config.ts
RUN mkdir -p /app/data /app/.next/cache && chown -R node:node /app/data /app/.next/cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["sh","-c","node --import tsx scripts/migrate.ts && exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0"]

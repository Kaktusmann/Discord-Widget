FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate

# next build imports every route module (including lib/env.ts) while collecting
# page data, even though none of it actually runs. These are throwaway values
# just to satisfy that env validation at build time — the real secrets are
# injected as container environment variables at runtime (see docker-compose.yml)
# and take over as soon as the process starts.
ENV DATABASE_URL="file:./build-placeholder.db" \
    NEXTAUTH_URL="http://localhost:3000" \
    NEXTAUTH_SECRET="build-placeholder" \
    DISCORD_CLIENT_ID="build-placeholder" \
    DISCORD_CLIENT_SECRET="build-placeholder" \
    DISCORD_BOT_TOKEN="build-placeholder" \
    DISCORD_APPLICATION_ID="build-placeholder" \
    DISCORD_WIDGET_CONFIG_ID="build-placeholder" \
    ENCRYPTION_KEY="build-placeholder"
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# better-sqlite3 is a native addon; alpine needs libstdc++ at runtime
RUN apk add --no-cache libstdc++

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x docker-entrypoint.sh \
  && addgroup -S app && adduser -S app -G app \
  && mkdir -p /app/data && chown -R app:app /app

USER app
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]

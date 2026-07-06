# syntax=docker/dockerfile:1

# ============================================================
# build stage — устанавливает зависимости и собирает весь monorepo
# ============================================================
FROM node:22 AS build
WORKDIR /repo
RUN corepack enable

# Манифесты сначала — для кэширования слоя установки зависимостей.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/telegram/package.json packages/telegram/
COPY apps/api/package.json apps/api/
COPY apps/bot/package.json apps/bot/
COPY apps/webapp/package.json apps/webapp/

RUN pnpm install --frozen-lockfile

# Исходники и сборка.
COPY . .

# Для same-origin (webapp + API на одном домене через Caddy) оставляем пустым —
# клиент будет ходить на относительный /api. Для поддоменов переопределите аргумент.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN pnpm -r build

# Самодостаточные prod-бандлы (со своими node_modules) для api и bot.
RUN pnpm --filter @smartfood/api --legacy deploy --prod /prod/api \
 && pnpm --filter @smartfood/bot --legacy deploy --prod /prod/bot

# ============================================================
# api runtime
# ============================================================
FROM node:22-slim AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /prod/api ./
EXPOSE 3000
CMD ["node", "dist/index.js"]

# ============================================================
# bot runtime
# ============================================================
FROM node:22-slim AS bot
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /prod/bot ./
EXPOSE 8081
CMD ["node", "dist/index.js"]

# ============================================================
# caddy — статика webapp + reverse proxy (+ авто-HTTPS)
# ============================================================
FROM caddy:2-alpine AS caddy
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/webapp/dist /srv

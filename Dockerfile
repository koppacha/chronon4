ARG NEXT_PUBLIC_BASE_URL

# ---- 依存取得 & ビルド用ステージ ----
FROM node:20-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_BASE_URL
RUN test -n "${NEXT_PUBLIC_BASE_URL}"
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}

# パッケージを先にコピーして install
COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

# Prisma generate
COPY prisma ./prisma
RUN npx prisma generate

# 残りのソースをコピーしてビルド
COPY . .
ENV NODE_ENV=production
RUN rm -rf .next && yarn build

# ---- 実行用ステージ (軽量) ----
FROM node:20-alpine AS runner
WORKDIR /app

ARG NEXT_PUBLIC_BASE_URL
ENV BUILD_NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}

RUN apk add --no-cache tini

# 実行に必要なファイルだけコピー
COPY --from=builder /app/node_modules     ./node_modules
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder /app/prisma/migrations    ./prisma/migrations
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static
COPY --from=builder /app/.next/server     ./.next/server
COPY --from=builder /app/package.json     ./
COPY --from=builder /app/public           ./public
COPY --from=builder /app/scripts/start-runner.mjs ./scripts/start-runner.mjs
COPY --from=builder /app/scripts/update-post-stats.mjs ./scripts/update-post-stats.mjs
RUN chown -R node:node /app
ENV NODE_ENV=production
# start-runner.mjs は server.js の起動前に `prisma migrate deploy` を実行する。
# 明示的に0を指定した場合だけ、障害調査などのため自動migrationを停止できる。
ENV PRISMA_MIGRATE_ON_START=1
EXPOSE 3004
ENTRYPOINT ["tini", "--"]
CMD ["node", "scripts/start-runner.mjs"]

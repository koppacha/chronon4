# ---- 依存取得 & ビルド用ステージ ----
FROM node:20-alpine AS builder
WORKDIR /app

# パッケージを先にコピーして install
COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

# Prisma generate
COPY prisma ./prisma
RUN npx prisma generate

# 残りのソースをコピーしてビルド
COPY . .
ENV NODE_ENV=production
RUN yarn build

# ---- 実行用ステージ (軽量) ----
FROM node:20-alpine AS runner
WORKDIR /app

# 実行に必要なファイルだけコピー
COPY --from=builder /app/node_modules     ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static
COPY --from=builder /app/package.json     ./
COPY --from=builder /app/public           ./public
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
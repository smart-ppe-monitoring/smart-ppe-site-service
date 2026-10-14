# ── Stage 1: deps ──
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl git
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json ./
COPY prisma ./prisma/
RUN pnpm install

# ── Stage 2: builder ──
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl git
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm exec prisma generate
RUN pnpm build

# ── Stage 3: runner ──
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app
USER node
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

EXPOSE 8891
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]

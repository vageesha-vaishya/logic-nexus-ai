# Phase 6 Step 17 — finance-api container image (same shape as comms-api).
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --progress=false --include=dev

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --progress=false \
 && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 3301

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --fail --silent --show-error http://localhost:3301/health > /dev/null || exit 1

USER node

CMD ["node", "dist/index.js"]

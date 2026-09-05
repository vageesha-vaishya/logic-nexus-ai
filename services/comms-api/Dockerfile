# Phase 6 Step 16 — comms-api container image.
# Multi-stage to strip dev deps + ts sources from the final layer.
# tsc runs in stage 1; stage 2 only carries production node_modules + dist/.
# Node 22 LTS — needed for native WebSocket (supabase-js realtime client
# crashes on Node <22 without the `ws` package).

FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --progress=false --include=dev

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim

WORKDIR /app

# curl is needed for the HEALTHCHECK below. ca-certificates is needed
# for the Resend API call + auth.users.getUser TLS calls.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --progress=false \
 && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 3601

# Coolify reads container HEALTHCHECK to route traffic; same /health
# endpoint the orchestrator polls in dev (returns 200 even when the
# dispatcher + worker can't start, so deployment isn't blocked on
# missing secrets — operator can flip env keys mid-flight).
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --fail --silent --show-error http://localhost:3601/health > /dev/null || exit 1

# Run as non-root for defense in depth.
USER node

CMD ["node", "dist/index.js"]

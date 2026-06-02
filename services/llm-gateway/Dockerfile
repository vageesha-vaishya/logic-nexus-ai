# LLM Gateway container image.
# Multi-stage Node 22 LTS build. Same shape as the other phase-6 services
# (comms-api, compliance-api, logistics-api, amro-api): tsc runs in
# stage 1; stage 2 only carries production node_modules + dist/.
#
# Build:   docker build -t llm-gateway:latest .
# Run:     docker run -p 3020:3020 -e ANTHROPIC_API_KEY=… llm-gateway:latest
# Coolify: point the service at this Dockerfile; expose port 3020.

FROM node:22-bullseye-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --progress=false

COPY tsconfig.json ./
COPY src ./src
COPY openapi.yaml ./openapi.yaml
RUN npm run build

# ── Stage 2: lean runtime layer ──────────────────────────────────────
FROM node:22-bullseye-slim

WORKDIR /app

# curl is needed for the HEALTHCHECK; ca-certificates for outbound TLS
# to Anthropic / OpenAI / Gemini / Mistral / Supabase APIs.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --progress=false \
 && npm cache clean --force

# Carry the fixtures + openapi spec alongside the compiled JS.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/openapi.yaml ./openapi.yaml
COPY fixtures ./fixtures

EXPOSE 3020

# Coolify routes traffic on HEALTHCHECK pass. /healthz returns 200
# whenever the process is up even with no providers configured —
# enforced auth + missing API keys do NOT block container readiness.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --fail --silent --show-error http://localhost:3020/healthz > /dev/null || exit 1

# Defense in depth.
USER node

CMD ["node", "dist/index.js"]

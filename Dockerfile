# Stage 1: Build the application
# FROM node:20-alpine as builder
FROM node:20-bullseye-slim AS builder

WORKDIR /app

# System dependencies required for building certain npm packages on Alpine
# RUN apk add --no-cache python3 make g++ git libc6-compat
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ git \
  && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
# Phase 6 cutover build fix: redis-memory-server is a TEST dependency whose
# postinstall downloads a Redis binary and, when that download fails, falls back
# to compiling Redis from source - which needs pkg-config, absent from this slim
# image. The production build only runs `vite build` and never needs the binary.
ENV REDISMS_DISABLE_POSTINSTALL=1
RUN npm ci --no-audit --progress=false --legacy-peer-deps

# Copy source code
COPY . .

# Environment variables must be passed as build args or available at build time
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_MARKETS_WORKER_URL=/api/markets
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_MARKETS_WORKER_URL=$VITE_MARKETS_WORKER_URL

# Build for production
RUN npm run build

# Stage 2: Serve with Nginx
# FROM nginx:alpine
FROM nginx:stable

# Copy build artifacts
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx template for runtime env substitution
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Expose port 4173 (Coolify hardcodes this in Traefik labels for this app)
EXPOSE 4173

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]

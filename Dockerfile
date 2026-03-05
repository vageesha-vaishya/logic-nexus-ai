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
RUN npm ci --no-audit --progress=false --legacy-peer-deps

# Copy source code
COPY . .

# Environment variables must be passed as build args or available at build time
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

# Build for production
RUN npm run build

# Stage 2: Serve with Nginx
# FROM nginx:alpine
FROM nginx:stable

# Copy build artifacts
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]

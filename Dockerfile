# Stage 1: Build the application
FROM node:20-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Environment variables must be passed as build args or available at build time
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Build for production
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy build artifacts
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]

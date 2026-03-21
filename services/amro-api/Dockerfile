FROM node:20-bullseye-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --progress=false

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-bullseye-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --progress=false

COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/index.js"]

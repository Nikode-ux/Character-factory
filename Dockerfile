# Multi-stage image that builds frontend + server and serves both from the Node backend.
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps for all workspaces
COPY package.json ./
COPY package-lock.json ./ 2>/dev/null || true
RUN npm install --workspaces

# Copy sources
COPY server ./server
COPY frontend ./frontend

# Build frontend and server
RUN npm run build --workspace frontend && npm run build --workspace server

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    WEB_DIST=/app/frontend/dist

# Bring built artifacts and node_modules
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/.env.example ./server/.env.example

EXPOSE 4000
CMD ["node", "server/dist/index.js"]

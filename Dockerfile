# ============================================================
# MetricRoom — Dockerfile para Railway
# ============================================================

# ---- Etapa 1: Compilar better-sqlite3 (necesita python3/make/g++) ----
FROM node:20-bullseye AS deps-builder

WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev

# ---- Etapa 2: Build Frontend ----
FROM node:20-bullseye AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Etapa 3: Runtime final (imagen slim) ----
FROM node:20-bullseye-slim AS runtime

WORKDIR /app

COPY --from=deps-builder /app/node_modules ./node_modules
COPY --from=deps-builder /app/package.json ./
COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist ./public

RUN mkdir -p /data

EXPOSE 3001

HEALTHCHECK --interval=20s --timeout=10s --start-period=60s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3001/api/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]

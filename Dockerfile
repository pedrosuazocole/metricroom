# ============================================================
# MetricRoom — Dockerfile definitivo para Railway
# Usa node:20-bullseye-slim con todas las herramientas
# ============================================================

# ---- Etapa 1: Compilar better-sqlite3 y dependencias ----
FROM node:20-bullseye-slim AS deps-builder

RUN apt-get update && apt-get install -y \
    python3 make g++ \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/package.json ./

# npm install compila mejor-sqlite3 desde source en este entorno correcto
RUN npm install

# ---- Etapa 2: Build Frontend ----
FROM node:20-bullseye-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --silent
COPY frontend/ ./
RUN npm run build

# ---- Etapa 3: Runtime final ----
FROM node:20-bullseye-slim AS runtime

WORKDIR /app

# Copiar node_modules ya compilados (incluye better-sqlite3 compilado)
COPY --from=deps-builder /app/node_modules ./node_modules
COPY --from=deps-builder /app/package.json ./

# Copiar código del backend
COPY backend/ ./

# Copiar build del frontend
COPY --from=frontend-builder /app/frontend/dist ./public

# Directorio para SQLite persistente
RUN mkdir -p /data

EXPOSE 3001

HEALTHCHECK --interval=20s --timeout=10s --start-period=60s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3001/api/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]

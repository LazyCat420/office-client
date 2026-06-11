# ============================================================
# Office Client — Multi-stage Docker Build
# ============================================================
# Pure Next.js frontend (port 3035) — no Python backend.
# Visualizes trading agents via API proxied to trading-service.
# ============================================================

# ── Stage 1: Node dependencies ─────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# ── Stage 2: Build Next.js ─────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ .
RUN npm run build

# ── Stage 3: Production runner ─────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3035
ENV HOSTNAME=0.0.0.0

# Create non-root user
RUN groupadd --system --gid 1001 appgrp \
    && useradd --system --uid 1001 --gid appgrp -m -d /home/appusr appusr

# ── Copy Next.js standalone build ─────────────────────────────
COPY --from=builder /app/public ./public
COPY --from=builder --chown=appusr:appgrp /app/.next/standalone ./
COPY --from=builder --chown=appusr:appgrp /app/.next/static ./.next/static

USER appusr

EXPOSE 3035

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "const h=require('http');h.get('http://127.0.0.1:3035/',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]

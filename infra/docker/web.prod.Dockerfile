# ============================================================
# Web Frontend — Production Dockerfile (multi-stage)
# Stage 1: build Next.js static assets
# Stage 2: minimal runtime image
# NEXT_PUBLIC_* vars must be passed as build-args (baked at build time)
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Build args — Vercel/Railway inject these at image-build time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_NAME=CADVisor
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_MAX_FILE_SIZE_MB=500

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_MAX_FILE_SIZE_MB=$NEXT_PUBLIC_MAX_FILE_SIZE_MB
ENV NODE_ENV=production

COPY apps/web/package*.json ./
RUN npm ci --omit=dev

COPY apps/web/ .
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Only copy the built output + runtime deps
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

# Next.js standalone server; Railway injects $PORT
CMD ["node", "server.js"]

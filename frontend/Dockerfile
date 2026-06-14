# =============================================================================
# VerbaFlow AI — Frontend Dockerfile
# =============================================================================
# Multi-stage build:
#   Stage 1 (deps)     — install Node dependencies
#   Stage 2 (builder)  — compile Next.js standalone output
#   Stage 3 (runner)   — minimal production runtime, non-root user
# =============================================================================

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Dependencies — install & cache node_modules
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

LABEL stage="deps"

# Install OS dependencies needed for some native npm packages
RUN apk update && apk add --no-cache libc6-compat python3 make g++ || \
    (sleep 5 && apk update && apk add --no-cache libc6-compat python3 make g++)

WORKDIR /app

# Copy package manifests first for layer caching
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# Install dependencies using the lockfile that exists
RUN \
  if [ -f yarn.lock ]; then \
    yarn install --frozen-lockfile --non-interactive; \
  elif [ -f package-lock.json ]; then \
    npm ci --prefer-offline; \
  elif [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm install --frozen-lockfile; \
  else \
    npm install; \
  fi

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Builder — compile the Next.js application
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

LABEL stage="builder"

# Build-time arguments (baked into the static output)
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_WS_URL=ws://localhost:8000
ARG NEXT_PUBLIC_APP_NAME="VerbaFlow AI"
ARG NEXT_PUBLIC_APP_VERSION=1.0.0
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

WORKDIR /app

# Copy installed dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy all source files
COPY . .

# Build Next.js with standalone output mode
# next.config.js must have: output: 'standalone'
RUN \
  if [ -f yarn.lock ]; then \
    yarn build; \
  elif [ -f package-lock.json ]; then \
    npm run build; \
  elif [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm run build; \
  else \
    npm run build; \
  fi

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: Runner — minimal production image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

LABEL maintainer="VerbaFlow AI Team <team@verbaflow.ai>"
LABEL org.opencontainers.image.title="VerbaFlow AI Frontend"
LABEL org.opencontainers.image.description="Next.js frontend for VerbaFlow AI"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/your-org/verbaflow-ai"

# Install wget for health check
RUN apk add --no-cache wget

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# ── Non-root user ─────────────────────────────────────────────────────────────
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs

WORKDIR /app

# Copy Next.js public assets
COPY --from=builder /app/public ./public

# Copy standalone build output (Next.js standalone mode)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# ── Health check ──────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# ── Start server ──────────────────────────────────────────────────────────────
CMD ["node", "server.js"]

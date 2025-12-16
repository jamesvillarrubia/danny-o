# Multi-stage Dockerfile for Danny Tasks API (NestJS)
# Optimized for production deployment with PGlite embedded database

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY .npmrc* .nvmrc* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY . .

# Build the application
RUN pnpm build

# Remove dev dependencies
RUN pnpm prune --prod

# Stage 3: Runner (Production)
FROM node:22-alpine AS runner
WORKDIR /app

# Install dumb-init and curl for health checks
RUN apk add --no-cache dumb-init curl

# Add image metadata
LABEL org.opencontainers.image.title="Danny Tasks API"
LABEL org.opencontainers.image.description="AI-powered task management with PGlite embedded database"
LABEL org.opencontainers.image.version="2.0.0"
LABEL org.opencontainers.image.source="https://github.com/yourusername/danny-tasks"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy necessary files from builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/config ./config
COPY --from=builder --chown=nestjs:nodejs /app/scripts ./scripts

# Create data directory for PGlite database and backups
RUN mkdir -p /app/data/backups && chown -R nestjs:nodejs /app/data

# Switch to non-root user
USER nestjs

# Environment variables (can be overridden)
ENV NODE_ENV=production \
    RUN_MODE=http \
    PORT=8080 \
    PGLITE_PATH=/app/data/tasks.db \
    AUTO_UPDATE=true \
    BACKUP_BEFORE_UPDATE=true

# Declare data volume for persistence
VOLUME /app/data

# Expose port (Fly.io uses PORT env var)
EXPOSE 8080

# Health check (Fly.io will use its own health checks)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command
CMD ["node", "dist/main"]

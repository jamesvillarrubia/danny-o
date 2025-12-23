# Multi-stage Dockerfile for Todoist AI Agent (NestJS)
# Optimized for production deployment with minimal image size

# Stage 1: Dependencies
FROM node:24-alpine AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace config and shared package (from root context)
COPY pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared

# Copy API package files
COPY api/package.json ./

# Install dependencies
RUN pnpm install

# Stage 2: Builder
FROM node:24-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

# Copy API source files
COPY api/. .

# Build the application
RUN pnpm build

# Remove dev dependencies
RUN pnpm prune --prod

# Stage 3: Runner (Production)
FROM node:24-alpine AS runner
WORKDIR /app

# Install dumb-init and curl for cron jobs
RUN apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy necessary files from builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/config ./config
COPY --from=builder --chown=nestjs:nodejs /app/scripts ./scripts

# Create data directory for PGlite (if used)
RUN mkdir -p /app/data && chown -R nestjs:nodejs /app/data

# Switch to non-root user
USER nestjs

# Environment variables (can be overridden)
ENV NODE_ENV=production \
    RUN_MODE=http \
    PORT=8080

# Expose port (Fly.io uses PORT env var)
EXPOSE 8080

# Health check (Fly.io will use its own health checks)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command
CMD ["node", "dist/main"]

# Docker Deployment Guide

## Overview

This application is packaged as a multi-stage Docker container optimized for production deployment. It supports both MCP server mode and CLI mode.

## Quick Start

### 1. Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- `.env` file with your API keys

```bash
cp .env.example .env
# Edit .env with your TODOIST_API_KEY and CLAUDE_API_KEY
```

### 2. Production Deployment

```bash
# Build and start services (MCP server + PostgreSQL)
docker-compose up -d

# View logs
docker-compose logs -f mcp-server

# Stop services
docker-compose down
```

### 3. Run CLI Commands

```bash
# Sync tasks
docker-compose run --rm cli node dist/main sync

# List tasks
docker-compose run --rm cli node dist/main list

# Classify tasks
docker-compose run --rm cli node dist/main classify

# Generate daily plan
docker-compose run --rm cli node dist/main plan today
```

## Docker Compose Services

### Default Services (Always Running)

**`mcp-server`** - Main MCP server process
- **Port:** None (uses stdio for MCP protocol)
- **Database:** PostgreSQL
- **Restart:** unless-stopped

**`postgres`** - PostgreSQL database
- **Port:** 5432 (exposed)
- **Volume:** `postgres-data` (persistent)
- **Health check:** Enabled

### Optional Services (Profiles)

**`cli`** - CLI commands (profile: `cli`)
```bash
docker-compose --profile cli run cli node dist/main sync
```

**`pgadmin`** - Database admin UI (profile: `tools`)
```bash
docker-compose --profile tools up pgadmin
```
Access at: http://localhost:5050
- Email: admin@tasks.local
- Password: admin

## Environment Variables

### Required

```bash
TODOIST_API_KEY=your_todoist_api_key
CLAUDE_API_KEY=your_claude_api_key
```

### Optional

```bash
# Run mode
RUN_MODE=mcp              # or 'cli'

# Database
DATABASE_TYPE=postgres    # or 'sqlite'
DATABASE_URL=postgresql://tasks:tasks@postgres:5432/tasks

# Sync interval (ms)
SYNC_INTERVAL=300000      # 5 minutes

# Node environment
NODE_ENV=production
```

## Build & Run

### Build Image

```bash
# Build production image
docker build -t todoist-ai:latest .

# Build with specific tag
docker build -t todoist-ai:v2.0.0 .

# Build specific stage
docker build --target builder -t todoist-ai:builder .
```

### Run Container

```bash
# MCP server mode
docker run -d \
  --name todoist-ai-mcp \
  -e DATABASE_TYPE=sqlite \
  -e TODOIST_API_KEY=your_key \
  -e CLAUDE_API_KEY=your_key \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/config:/app/config:ro \
  todoist-ai:latest

# CLI mode
docker run --rm \
  -e RUN_MODE=cli \
  -e DATABASE_TYPE=sqlite \
  -e TODOIST_API_KEY=your_key \
  -e CLAUDE_API_KEY=your_key \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/config:/app/config:ro \
  todoist-ai:latest \
  node dist/main sync
```

## Development

### Development Compose

Use the development compose file for hot-reload:

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# The app will watch for changes and reload
```

### Development Features

- Source code mounted as volume
- Hot reload enabled
- Debug port exposed (9229)
- SQLite for faster startup

## Database Options

### 1. SQLite (Development)

```yaml
environment:
  - DATABASE_TYPE=sqlite
  - DATABASE_URL=/app/data/tasks.db
volumes:
  - ./data:/app/data
```

### 2. PostgreSQL (Docker)

```yaml
environment:
  - DATABASE_TYPE=postgres
  - DATABASE_URL=postgresql://tasks:tasks@postgres:5432/tasks
depends_on:
  - postgres
```

### 3. Neon PostgreSQL (Cloud)

```yaml
environment:
  - DATABASE_TYPE=postgres
  - DATABASE_URL=postgres://user:pass@ep-example.neon.tech/dbname?sslmode=require
# No depends_on needed
```

## Multi-Stage Build Details

### Stage 1: Dependencies (`deps`)
- Installs production + dev dependencies
- Uses pnpm for efficient caching
- Base: `node:22-alpine`

### Stage 2: Builder (`builder`)
- Copies dependencies from `deps`
- Builds TypeScript to JavaScript
- Prunes dev dependencies
- Output: `dist/` folder

### Stage 3: Runner (`runner`)
- Minimal production image
- Only runtime dependencies
- Non-root user (nestjs:nodejs)
- Health check enabled
- Image size: ~200MB

## Health Checks

### Container Health Check

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' todoist-ai-mcp

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' todoist-ai-mcp
```

### Application Health (Future)

Once health endpoints are added:

```bash
# HTTP health check
curl http://localhost:3000/health

# Database connectivity
curl http://localhost:3000/health/db

# External APIs
curl http://localhost:3000/health/todoist
curl http://localhost:3000/health/claude
```

## Volumes & Persistence

### Data Volume (SQLite)

```bash
# Backup SQLite database
docker cp todoist-ai-mcp:/app/data/tasks.db ./backup/tasks-$(date +%Y%m%d).db

# Restore database
docker cp ./backup/tasks-20240101.db todoist-ai-mcp:/app/data/tasks.db
```

### PostgreSQL Volume

```bash
# Backup PostgreSQL
docker-compose exec postgres pg_dump -U tasks tasks > backup.sql

# Restore PostgreSQL
docker-compose exec -T postgres psql -U tasks tasks < backup.sql

# Access PostgreSQL shell
docker-compose exec postgres psql -U tasks
```

## Logs

```bash
# Follow logs
docker-compose logs -f

# Logs for specific service
docker-compose logs -f mcp-server

# Last 100 lines
docker-compose logs --tail=100 mcp-server

# Since timestamp
docker-compose logs --since="2024-01-01T12:00:00" mcp-server
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs mcp-server

# Check environment variables
docker-compose exec mcp-server env

# Interactive shell
docker-compose exec mcp-server sh
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
docker-compose exec postgres psql -U tasks -c "SELECT 1"

# Check database logs
docker-compose logs postgres
```

### Permission Issues

```bash
# Fix data directory permissions
sudo chown -R 1001:1001 ./data

# Or run container as root (not recommended)
docker-compose run --user root mcp-server sh
```

### Clean Rebuild

```bash
# Remove everything and rebuild
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## Production Best Practices

1. **Use PostgreSQL in production** (not SQLite)
2. **Set resource limits:**
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '1'
         memory: 512M
       reservations:
         cpus: '0.5'
         memory: 256M
   ```

3. **Use secrets for API keys** (Docker secrets or env files)
4. **Enable logging driver:**
   ```yaml
   logging:
     driver: "json-file"
     options:
       max-size: "10m"
       max-file: "3"
   ```

5. **Run behind reverse proxy** (nginx, Traefik)
6. **Monitor with health checks**
7. **Backup database regularly**

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Push Docker Image

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build image
        run: docker build -t ghcr.io/${{ github.repository }}:${{ github.ref_name }} .
      
      - name: Push image
        run: docker push ghcr.io/${{ github.repository }}:${{ github.ref_name }}
```

## Cloud Deployment

### GCP Cloud Run

See [PULUMI.md](./PULUMI.md) for Infrastructure as Code deployment.

```bash
# Build for Cloud Run
gcloud builds submit --tag gcr.io/PROJECT_ID/todoist-ai

# Deploy to Cloud Run
gcloud run deploy todoist-ai \
  --image gcr.io/PROJECT_ID/todoist-ai \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_TYPE=postgres \
  --set-env-vars DATABASE_URL=secret \
  --set-secrets TODOIST_API_KEY=todoist-key:latest \
  --set-secrets CLAUDE_API_KEY=claude-key:latest
```

### AWS ECS / Fargate

```bash
# Push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin ECR_URL
docker tag todoist-ai:latest ECR_URL/todoist-ai:latest
docker push ECR_URL/todoist-ai:latest

# Create task definition and service via AWS Console or Terraform
```

## Security

- Container runs as non-root user (`nestjs:nodejs`, UID 1001)
- Minimal base image (`node:22-alpine`)
- No unnecessary packages
- Health checks enabled
- Secrets via environment variables (never in image)
- Read-only config volume mount

## Image Size Optimization

**Current image size:** ~200MB (compressed)

- Base image: `node:22-alpine` (50MB)
- Node.js runtime: ~70MB
- Production dependencies: ~60MB
- Application code: ~10MB
- Layers: ~10MB

## Next Steps

1. Set up health check endpoints (see TODO)
2. Configure monitoring (Prometheus, Datadog, etc.)
3. Set up log aggregation (Loki, CloudWatch, etc.)
4. Implement CI/CD pipeline
5. Deploy to production (GCP Cloud Run, AWS ECS, etc.)


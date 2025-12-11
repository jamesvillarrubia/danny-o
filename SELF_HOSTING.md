# Self-Hosting Guide

This guide covers everything you need to self-host Danny Tasks, from quick deployment to advanced configuration.

## Quick Start Options

### Option 1: Docker Compose (Recommended)

**Easiest way to run the full stack:**

```bash
# Clone repository
git clone https://github.com/yourusername/danny-tasks.git
cd danny-tasks

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Visit **http://localhost** and complete the setup wizard.

### Option 2: Single Docker Container (API Only)

**Run just the API with embedded database:**

```bash
docker run -d \
  -p 3000:8080 \
  -v danny-data:/app/data \
  --name danny-tasks-api \
  ghcr.io/yourusername/danny-tasks-api:latest
```

### Option 3: Manual Installation

**Requirements:**
- Node.js 22+
- pnpm 9+

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run production
cd api
NODE_ENV=production RUN_MODE=http node dist/main.js
```

## Setup Wizard

On first run, you'll see a setup wizard that collects:

1. **Claude API Key** - Get from [console.anthropic.com](https://console.anthropic.com/)
2. **Todoist API Key** - Get from [Todoist Settings → Integrations](https://todoist.com/app/settings/integrations)
3. **Database Choice**:
   - **Embedded (Recommended)** - Zero config, perfect for personal use
   - **Cloud PostgreSQL** - For production/teams (requires external DB)

All configuration is stored encrypted in the database.

## Database Architecture

### Embedded PGlite (Default)

Danny Tasks uses [PGlite](https://github.com/electric-sql/pglite) - **real PostgreSQL** running embedded in your app.

**Benefits:**
- ✅ Zero configuration required
- ✅ Perfect Postgres compatibility
- ✅ No separate database server
- ✅ Portable - all data in one directory
- ✅ Automatic backups before updates

**Data Location:**
- Docker: `/app/data/tasks.db` (mounted volume)
- Manual: `./data/tasks.db` (relative to API)

### Cloud PostgreSQL (Optional)

For production or team use, upgrade to cloud Postgres:

**Free Options:**
- [Neon](https://neon.tech) - Serverless Postgres with 0.5GB free
- [Supabase](https://supabase.com) - 500MB free + realtime features
- [Railway](https://railway.app) - Integrated if you deploy there

**Configure via:**
1. Setup wizard → Choose "Cloud PostgreSQL"
2. Or set environment variable: `PROD_DATABASE_URL=postgresql://...`

## Configuration

### Environment Variables

All configuration can be set via:
1. **Setup wizard** (stored encrypted in database)
2. **Environment variables** (for advanced users)
3. **Docker environment** (in docker-compose.yml)

**Core Variables:**

```bash
# API Keys (required)
CLAUDE_API_KEY=sk-ant-...
TODOIST_API_KEY=...

# Database (optional - defaults to embedded PGlite)
DATABASE_ENV=prod                    # Use 'prod' or 'dev' for remote Postgres
PROD_DATABASE_URL=postgresql://...   # Production database URL
DEV_DATABASE_URL=postgresql://...    # Development database URL
PGLITE_PATH=./data/tasks.db         # Path for embedded database

# Updates (optional)
AUTO_UPDATE=true                     # Auto-run migrations on startup
BACKUP_BEFORE_UPDATE=true            # Create backup before migrations
BACKUP_RETENTION_DAYS=30             # How long to keep backups

# Security (optional but recommended)
ENCRYPTION_SECRET=your-secret-key    # For encrypting stored API keys
DANNY_API_KEY=...                    # Optional API key for web dashboard
```

### Docker Compose Configuration

Edit `docker-compose.yml`:

```yaml
services:
  api:
    environment:
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - TODOIST_API_KEY=${TODOIST_API_KEY}
      # Or use external .env file:
    env_file:
      - .env
```

## Updates & Migrations

### Automatic Updates (Default)

When `AUTO_UPDATE=true` (default):

1. App checks version on startup
2. Creates backup if version changed
3. Runs database migrations
4. Updates version in config
5. Starts normally

**For Docker users:**

```bash
# Pull latest image
docker pull ghcr.io/yourusername/danny-tasks-api:latest

# Restart container
docker-compose restart api
```

Data persists in volumes, migrations run automatically.

### Manual Updates (Disabled AUTO_UPDATE)

```bash
# Set in environment
AUTO_UPDATE=false

# Then manually:
# 1. Backup your data
docker-compose exec api node -e "require('./dist/backups/backup.service').createBackup()"

# 2. Pull new version
docker pull ghcr.io/yourusername/danny-tasks-api:latest

# 3. Restart
docker-compose up -d
```

### Rolling Back

If an update fails:

```bash
# List backups
docker-compose exec api ls -lh /app/data/backups

# Restore from backup
docker-compose exec api cp /app/data/backups/backup-TIMESTAMP.db /app/data/tasks.db

# Restart
docker-compose restart api
```

## Backup Strategy

### Automatic Backups

- Created before each update
- Stored in `/app/data/backups/`
- Retained for 30 days (configurable)

### Manual Backups

**PGlite (embedded):**

```bash
# Docker
docker cp danny-tasks-api:/app/data/tasks.db ./backup-$(date +%Y%m%d).db

# Manual installation
cp data/tasks.db backup-$(date +%Y%m%d).db
```

**Remote Postgres:**

```bash
pg_dump $PROD_DATABASE_URL > backup-$(date +%Y%m%d).sql
```

### Scheduled Backups

Add to cron or GitHub Actions (see `.github/workflows/backup-database.yml`):

```bash
# Daily backup at 2 AM
0 2 * * * docker cp danny-tasks-api:/app/data/tasks.db /backups/danny-$(date +\%Y\%m\%d).db
```

## Upgrading Database

### From Embedded to Cloud Postgres

If you start with embedded PGlite and want to upgrade:

**Option 1: Via Settings (Coming Soon)**
- Settings → Database → Upgrade to Cloud
- Enter PostgreSQL URL
- Automatic migration

**Option 2: Manual Migration**

```bash
# 1. Export current data
docker-compose exec api node dist/main.js # Wait for boot
# Data is in /app/data/tasks.db

# 2. Set up cloud Postgres
# Create database on Neon/Supabase

# 3. Update environment
DATABASE_ENV=prod
PROD_DATABASE_URL=postgresql://...

# 4. Restart - migrations run automatically
docker-compose up -d
```

## Platform-Specific Guides

### Railway

1. Click "Deploy on Railway" button in README
2. Set environment variables in Railway dashboard:
   - `CLAUDE_API_KEY`
   - `TODOIST_API_KEY`
   - `ENCRYPTION_SECRET` (optional, auto-generated)
3. Deploy automatically updates on git push

**Using Railway Postgres:**

```bash
# Railway dashboard → Add Database → PostgreSQL
# Copy DATABASE_URL
# Set as PROD_DATABASE_URL
# Set DATABASE_ENV=prod
```

### Render

1. Click "Deploy to Render" button
2. Configure via `render.yaml` (included in repo)
3. Persistent disk automatically attached for PGlite
4. Auto-deploys on git push

**Using Render Postgres:**

```bash
# Render dashboard → New → PostgreSQL
# Copy connection string
# Add to environment: PROD_DATABASE_URL
# Set DATABASE_ENV=prod
```

### Fly.io (Current Production Setup)

```bash
# One-time setup
fly launch --config api/fly.toml

# Create Postgres
fly postgres create --name danny-db
fly postgres attach danny-db --app danny-tasks-api

# Deploy
fly deploy --config api/fly.toml

# Set secrets
fly secrets set CLAUDE_API_KEY=sk-ant-...
fly secrets set TODOIST_API_KEY=...
fly secrets set DATABASE_ENV=prod
```

## Monitoring & Maintenance

### Health Checks

- **API**: `http://localhost:3000/health`
- **Detailed**: `http://localhost:3000/health/ready`

```bash
# Check status
curl http://localhost:3000/health

# Response:
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "todoist": { "status": "up" },
    "claude": { "status": "up" }
  }
}
```

### Logs

**Docker:**

```bash
# Follow logs
docker-compose logs -f api

# Last 100 lines
docker-compose logs --tail=100 api
```

**Manual:**

```bash
# Logs are written to stdout
# Redirect to file:
NODE_ENV=production node dist/main.js > logs/danny.log 2>&1
```

### Performance Tuning

**For high load:**

```yaml
# docker-compose.yml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

**Database optimization:**

```bash
# Switch to cloud Postgres for better performance
DATABASE_ENV=prod
PROD_DATABASE_URL=postgresql://...  # Use connection pooling service
```

## Troubleshooting

### App won't start

**Check logs:**

```bash
docker-compose logs api
```

**Common issues:**
- Missing API keys → Check setup wizard or environment
- Port conflict → Change port in docker-compose.yml
- Database error → Check volume permissions

### Setup wizard not appearing

Setup wizard shows only if `setup_completed` is false in database.

**Force reset:**

```bash
# Access PGlite database
docker-compose exec api node -e "
const { PGlite } = require('@electric-sql/pglite');
const db = new PGlite('/app/data/tasks.db');
db.exec('UPDATE app_config SET value = \"false\" WHERE key = \"setup_completed\"');
"
```

### Migration failures

If migrations fail:

1. Check logs for error details
2. Restore from automatic backup
3. Report issue with logs

**Restore backup:**

```bash
# Find backups
docker-compose exec api ls -lh /app/data/backups/

# Restore
docker-compose exec api cp /app/data/backups/backup-TIMESTAMP.db /app/data/tasks.db
docker-compose restart api
```

### Performance issues

**Embedded PGlite:**
- Fine for personal use (< 10,000 tasks)
- Consider cloud Postgres for teams

**Upgrade path:**
1. Set up Neon/Supabase Postgres
2. Update `PROD_DATABASE_URL`
3. Set `DATABASE_ENV=prod`
4. Restart - data migrates automatically

## Security Considerations

### API Keys

- Stored encrypted in database using AES-256-GCM
- Encryption key from `ENCRYPTION_SECRET` env var
- **Set a strong ENCRYPTION_SECRET in production!**

### Network Security

**Recommended setup:**

```yaml
# docker-compose.yml
services:
  api:
    networks:
      - internal
  
  web:
    networks:
      - internal
      - external

networks:
  internal:
    internal: true  # No external access
  external:
```

### Backup Security

Backups contain unencrypted data. Protect them:

```bash
# Encrypt backups at rest
gpg --encrypt backup.db

# Secure backup location
chmod 700 /app/data/backups
```

## Support

- **Documentation**: [api/README.md](./api/README.md)
- **Deployment**: [api/DEPLOYMENT.md](./api/DEPLOYMENT.md)
- **Issues**: [GitHub Issues](https://github.com/yourusername/danny-tasks/issues)


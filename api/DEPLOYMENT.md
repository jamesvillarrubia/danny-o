# Danny Tasks - Deployment Guide

## Overview

Danny Tasks uses a **hybrid deployment strategy**:
- **API**: Deployed to [Fly.io](https://fly.io) as a persistent container (better for NestJS, cron jobs, and long-running operations)
- **Frontend**: Deployed to [Vercel](https://vercel.com) (optimized for static/SSR sites)

This approach gives you:
- ✅ No cold starts for the API
- ✅ Native cron job support (every 5/15 minutes)
- ✅ No execution time limits
- ✅ Better database connection handling
- ✅ Fast global CDN for frontend
- ✅ Cost-effective for low traffic

## Prerequisites

1. [Fly.io account](https://fly.io) (free tier available)
2. [Vercel account](https://vercel.com) (free tier available)
3. [Neon account](https://neon.tech) or [Supabase](https://supabase.com) for PostgreSQL (free tier available)
4. [Anthropic API key](https://console.anthropic.com/)
5. [Todoist API key](https://todoist.com/prefs/integrations)
6. [Sentry account](https://sentry.io/) (optional, free tier available)

---

## Part 1: API Deployment (Fly.io)

### Initial Setup

1. **Install Fly.io CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly.io**:
   ```bash
   fly auth login
   ```

3. **Initialize your app** (from `api/` directory):
   ```bash
   cd api
   fly launch
   ```
   
   This will:
   - Detect your Dockerfile
   - Generate `fly.toml` (already created, but will verify)
   - Ask to create a PostgreSQL database (recommended: yes)
   - Deploy your app

### Environment Variables

Set secrets in Fly.io:

```bash
# Required
fly secrets set DATABASE_URL="postgresql://user:pass@host:5432/dbname"
fly secrets set TODOIST_API_KEY="your_todoist_key"
fly secrets set CLAUDE_API_KEY="your_claude_key"

# Optional
fly secrets set CLAUDE_MODEL="claude-3-5-sonnet-20240620"
fly secrets set SENTRY_DSN="your_sentry_dsn"
fly secrets set CRON_SECRET="$(openssl rand -hex 32)"
fly secrets set TODOIST_WEBHOOK_SECRET="your_webhook_secret"
```

**Note**: If you created a Fly Postgres database, `DATABASE_URL` is automatically set. You can verify with:
```bash
fly secrets list
```

### Database Setup

#### Option A: Fly Postgres (Recommended)

If you created a Fly Postgres database during `fly launch`:
- Connection string is automatically set as `DATABASE_URL`
- Database is in the same region as your app
- Free tier: 3GB storage, shared CPU

To create manually:
```bash
fly postgres create --name danny-tasks-db
fly postgres attach danny-tasks-db --app danny-tasks-api
```

#### Option B: External Database (Neon/Supabase)

1. Create a project in [Neon](https://neon.tech) or [Supabase](https://supabase.com)
2. Copy the connection string
3. Set as secret:
   ```bash
   fly secrets set DATABASE_URL="postgresql://user:pass@host:5432/dbname"
   ```

The database schema will be created automatically on first deployment.

### Deploy the API

```bash
# From api/ directory
fly deploy
```

Your API will be available at: `https://danny-tasks-api.fly.dev`

### Setup Cron Jobs

Cron jobs run as scheduled Fly Machines that call your API endpoints.

1. **Make the setup script executable**:
   ```bash
   chmod +x scripts/setup-fly-cron.sh
   ```

2. **Run the setup script**:
   ```bash
   export FLY_APP_NAME="danny-tasks-api"
   export CRON_SECRET="your-cron-secret"  # Same as set in fly secrets
   ./scripts/setup-fly-cron.sh
   ```

This creates two scheduled machines:
- **Sync cron**: Runs every 5 minutes (`/api/cron/sync`)
- **Classify cron**: Runs every 15 minutes (`/api/cron/classify`)

**Alternative: Manual Setup**

If the script doesn't work, create machines manually:

```bash
# Sync cron (every 5 minutes)
fly machines create \
  --name danny-tasks-api-cron-sync \
  --region iad \
  --vm-size shared-cpu-1x \
  --vm-memory 256 \
  --schedule "*/5 * * * *" \
  --env "FLY_APP_NAME=danny-tasks-api" \
  --command "sh -c 'curl -H \"Authorization: Bearer $CRON_SECRET\" https://danny-tasks-api.fly.dev/api/cron/sync'" \
  --image curlimages/curl:latest

# Classify cron (every 15 minutes)
fly machines create \
  --name danny-tasks-api-cron-classify \
  --region iad \
  --vm-size shared-cpu-1x \
  --vm-memory 256 \
  --schedule "*/15 * * * *" \
  --env "FLY_APP_NAME=danny-tasks-api" \
  --command "sh -c 'curl -H \"Authorization: Bearer $CRON_SECRET\" https://danny-tasks-api.fly.dev/api/cron/classify'" \
  --image curlimages/curl:latest
```

**Note**: Fly.io scheduled machines are in beta. If they're not available, use an external cron service like [cron-job.org](https://cron-job.org) or [EasyCron](https://www.easycron.com) to call your endpoints.

### Verify Deployment

```bash
# Check app status
fly status

# View logs
fly logs

# Test health endpoint
curl https://danny-tasks-api.fly.dev/health

# Test API endpoint
curl https://danny-tasks-api.fly.dev/api/v1/stats/productivity
```

---

## Part 2: Frontend Deployment (Vercel)

The frontend lives in the `web/` directory at the project root.

### Setup

1. **Deploy to Vercel** (from `web/` directory):
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Deploy
   cd web
   vercel --prod
   ```

2. **Configure API endpoint**:
   
   Set environment variable in Vercel dashboard or CLI:
   ```bash
   vercel env add VITE_API_URL
   # Enter: https://danny-tasks-api.fly.dev
   ```

   The frontend's `src/api/client.ts` already uses this environment variable.

### CORS Configuration

Your NestJS app already has CORS enabled for all origins. If you need to restrict it:

1. Update `src/main.ts`:
   ```typescript
   app.enableCors({
     origin: process.env.FRONTEND_URL || true,
     credentials: true,
   });
   ```

2. Set in Fly.io:
   ```bash
   fly secrets set FRONTEND_URL="https://your-frontend.vercel.app"
   ```

---

## API Endpoints

All endpoints are prefixed with `/api`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sync` | POST | Trigger task sync |
| `/api/sync/status` | GET | Get sync status |
| `/api/respond` | POST | Respond to @danny mentions |
| `/api/classify` | POST | Classify tasks |
| `/api/webhook/todoist` | POST | Todoist webhook receiver |
| `/api/cron/sync` | GET | Cron: sync tasks |
| `/api/cron/classify` | GET | Cron: classify tasks |
| `/api/cron/health` | GET | Cron: health check |
| `/api/v1/stats/productivity` | GET | Productivity statistics |
| `/api/v1/stats/enrichment` | GET | Enrichment statistics |
| `/api/v1/stats/history` | GET | Task completion history |
| `/api/ai-logs` | GET | Get AI interaction logs |
| `/api/ai-logs/summary` | GET | Get AI logs summary |
| `/health` | GET | Health check (no /api prefix) |

---

## Todoist Webhook Setup

To receive real-time updates from Todoist:

1. Go to [Todoist Developer Console](https://developer.todoist.com/)
2. Create a new app or use existing
3. Add webhook URL: `https://danny-tasks-api.fly.dev/api/webhook/todoist`
4. Subscribe to events: `item:added`, `item:updated`, `item:completed`, `note:added`
5. Copy the webhook secret and set in Fly.io:
   ```bash
   fly secrets set TODOIST_WEBHOOK_SECRET="your_webhook_secret"
   ```

---

## Local Development

### API

For local development, the app uses SQLite by default:

```bash
# Run API locally (uses SQLite)
cd api
pnpm install
pnpm start:http

# Or with hot reload
pnpm start:dev
```

To use PostgreSQL locally:
```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/danny"
pnpm start:http
```

### Frontend

```bash
cd web
pnpm install
pnpm dev
```

The frontend dev server proxies `/api` requests to `http://localhost:3000` (the API).

---

## Monitoring

### Fly.io Logs

```bash
# View all logs
fly logs

# Follow logs in real-time
fly logs -f

# View logs for specific machine
fly logs -a danny-tasks-api-cron-sync
```

### Sentry

Error tracking is available via Sentry:

1. Create a project in [Sentry](https://sentry.io/)
2. Copy the DSN
3. Set in Fly.io:
   ```bash
   fly secrets set SENTRY_DSN="your_sentry_dsn"
   ```

### AI Logs

View AI interaction logs for prompt optimization:

```bash
# Get recent logs
curl https://danny-tasks-api.fly.dev/api/ai-logs?limit=50

# Get summary
curl https://danny-tasks-api.fly.dev/api/ai-logs/summary
```

---

## Database Management

Danny Tasks includes CLI tools for managing database backups, migrations, and syncing data between environments.

### Quick Reference

```bash
# Export current database to JSON
pnpm db:export [--output backup.json]

# Import JSON backup into current database
pnpm db:import --input backup.json [--mode merge|replace] [--force]

# Push local SQLite data to production PostgreSQL
pnpm db:push [--target prod|dev] [--yes]

# Pull production PostgreSQL data to local SQLite
pnpm db:pull [--source prod|dev] [--yes]
```

### Configuration Setup

Configure database URLs once in `api/.env.local` (gitignored, not committed):

```bash
# Create or edit api/.env.local
cd api

# Add your database URLs:
cat >> .env.local << 'EOF'
# Production database (required for db:push/db:pull)
PROD_DATABASE_URL="postgresql://user:password@your-neon-host/database"

# Development database (optional)
DEV_DATABASE_URL="postgresql://user:password@dev-host/database-dev"
EOF
```

**Why `.env.local`?**
- Automatically loaded by the scripts (via dotenv)
- Already gitignored (safe for credentials)
- Configure once, use forever
- See `api/.env.example` for the full template

The default local SQLite path (`~/.danny/data/tasks.db`) works automatically - no configuration needed.

### Common Workflows

#### 1. Push Local Data to Production

When you want to migrate your local SQLite data to production PostgreSQL:

```bash
cd api

# First time: configure .env.local (one-time setup)
# echo 'PROD_DATABASE_URL="postgresql://..."' >> .env.local

# Push with confirmation prompt
pnpm db:push --target prod

# Or skip confirmation
pnpm db:push --target prod --yes
```

**⚠️ Warning**: This replaces all data in production. The command will:
- Export your local SQLite database
- Verify schema compatibility (checks migrations)
- Replace all data in production PostgreSQL
- Preserve sync tokens and AI interactions

#### 2. Pull Production Data Locally

When you want to test with production data locally:

```bash
cd api

# Pull with confirmation prompt (uses PROD_DATABASE_URL from .env.local)
pnpm db:pull --source prod

# Or skip confirmation
pnpm db:pull --source prod --yes
```

This replaces your local SQLite database with production data, useful for:
- Debugging production issues locally
- Testing new features with real data
- Refreshing local development environment

#### 3. Create Manual Backups

Create timestamped JSON backups:

```bash
cd api

# Backup local SQLite (automatic)
pnpm db:export --output ./backups/backup-$(date +%Y%m%d).json

# Backup production PostgreSQL
# Set DATABASE_URL temporarily to target production
DATABASE_URL="$PROD_DATABASE_URL" pnpm db:export --output ./backups/prod-backup.json

# Or read PROD_DATABASE_URL from .env.local and use it
pnpm db:export --output ./backups/prod-backup.json
# (Note: export reads current DATABASE_URL or falls back to SQLite)
```

Backups include:
- All tasks, metadata, history
- Projects and labels
- Dashboard views
- Sync state and AI interactions
- Cached insights
- Migration compatibility info

#### 4. Restore from Backup

Restore a JSON backup into any database:

```bash
cd api

# Restore to local SQLite (merge mode - keeps existing data)
pnpm db:import --input ./backups/backup-20240101.json --mode merge

# Restore to production (replace mode - clears first)
# Temporarily override DATABASE_URL to target production
DATABASE_URL="$(grep PROD_DATABASE_URL .env.local | cut -d= -f2-)" \
  pnpm db:import --input backup.json --mode replace

# Force import even if migrations differ
pnpm db:import --input backup.json --mode replace --force
```

**Import Modes:**
- `merge` (default): Upserts records, keeps existing data
- `replace`: Clears all tables first, then imports

### Automated Backups

Production database is automatically backed up daily via GitHub Actions:

- **Schedule**: Daily at 2 AM UTC
- **Retention**: 30 days
- **Location**: GitHub Actions artifacts
- **Manual trigger**: Run from Actions tab

To download a backup:
1. Go to GitHub Actions → "Backup Production Database"
2. Select a workflow run
3. Download the artifact
4. Extract and use `pnpm db:import`

### Schema Migration Safety

The tools check migration compatibility before importing:

```bash
# If schemas differ, you'll see:
⚠️  Migration mismatch detected:
  Source has migrations not in target: add_scheduling_fields
  Target has migrations not in source: add_insights_cache

# Options:
1. Run migrations on both databases first
2. Use --force to override (risky!)
```

**Best Practice**: Always ensure both databases have the same migrations applied before syncing data.

The schema migrations run automatically when the app starts (`KyselyAdapter.runMigrations()`). For future enhancement, consider:
- Adopting Kysely's native migration system
- Using Neon's database branching for schema changes

### Syncing Between Environments

For dev → prod workflow (ensure `.env.local` has both DEV_DATABASE_URL and PROD_DATABASE_URL):

```bash
cd api

# 1. Test locally with SQLite
pnpm start:dev

# 2. When ready, push to dev environment
pnpm db:push --target dev --yes

# 3. Test in dev, then promote to prod
pnpm db:pull --source dev  # Get dev data locally first (optional)
pnpm db:push --target prod
```

### Troubleshooting Database Operations

**"Schema mismatch" error**:
- Run migrations on both databases: restart the app in both environments
- Check `fly logs` for migration errors
- Use `--force` only if you understand the risk

**"Connection timeout"**:
- Verify `DATABASE_URL` is correct
- Check database is not paused (Neon auto-pauses)
- Test with: `fly ssh console` then try connecting

**Large backup files**:
- AI interactions table can be large
- Consider excluding it: modify `DATA_TABLES` in `scripts/db-tools.ts`
- Compress backups: `gzip backup.json`

---

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is correct: `fly secrets list`
- Ensure database is active (not paused)
- Check Fly.io logs: `fly logs`
- Test connection: `fly ssh console -C "node -e \"console.log(process.env.DATABASE_URL)\""`

### Cron Jobs Not Running

- Check if scheduled machines exist: `fly machines list`
- View cron logs: `fly logs -a danny-tasks-api-cron-sync`
- Verify `CRON_SECRET` is set: `fly secrets list`
- If scheduled machines aren't available, use external cron service

### App Not Starting

- Check logs: `fly logs`
- Verify environment variables: `fly secrets list`
- Test locally with same env vars
- Check health endpoint: `curl https://danny-tasks-api.fly.dev/health`

### AI Classification Failing

- Verify `CLAUDE_API_KEY` is valid: `fly secrets list`
- Check AI logs: `curl https://danny-tasks-api.fly.dev/api/ai-logs?success=false`
- Review rate limits on your Anthropic account
- Check Fly.io logs for errors: `fly logs`

---

## Cost Estimation

### Fly.io (API)

- **Free tier**: 3 shared-cpu VMs, 3GB storage
- **Hobby plan**: $5.70/mo for 1 VM (256MB RAM)
- **For low traffic**: Free tier is usually sufficient

### Vercel (Frontend)

- **Free tier**: 100GB bandwidth, unlimited requests
- **Pro plan**: $20/mo (usually not needed for personal projects)

### Database

- **Fly Postgres**: Free tier (3GB storage)
- **Neon**: Free tier (0.5GB storage, auto-pause)
- **Supabase**: Free tier (500MB storage)

**Total estimated cost**: $0-6/month for low traffic personal use.

---

## Migration from Vercel-Only

If you're migrating from Vercel-only deployment:

1. Deploy to Fly.io following Part 1 above
2. Update your frontend to point to Fly.io API URL
3. Set up cron jobs (they won't work on Vercel free tier)
4. Update webhook URLs in Todoist to point to Fly.io
5. Remove `vercel.json` or keep it for future frontend use

---

## Additional Resources

- [Fly.io Documentation](https://fly.io/docs/)
- [Vercel Documentation](https://vercel.com/docs)
- [NestJS Deployment Guide](https://docs.nestjs.com/recipes/deployment)

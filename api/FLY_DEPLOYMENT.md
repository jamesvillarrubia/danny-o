# Quick Fly.io Deployment Guide

## First Time Setup

```bash
# 1. Install Fly.io CLI
curl -L https://fly.io/install.sh | sh

# 2. Login
fly auth login

# 3. Deploy (from nest/ directory)
cd nest
fly launch

# 4. Set secrets
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set TODOIST_API_KEY="your_key"
fly secrets set CLAUDE_API_KEY="your_key"
fly secrets set CRON_SECRET="$(openssl rand -hex 32)"

# 5. Deploy
fly deploy

# 6. Setup cron jobs
export FLY_APP_NAME="danny-tasks-api"
export CRON_SECRET="your_secret_from_step_4"
./scripts/setup-fly-cron.sh
```

## Common Commands

```bash
# View logs
fly logs

# Check status
fly status

# SSH into machine
fly ssh console

# View secrets
fly secrets list

# Scale app
fly scale count 1

# Restart app
fly apps restart danny-tasks-api
```

## Your API URL

After deployment, your API will be at:
```
https://danny-tasks-api.fly.dev
```

Update your frontend to use this URL.

## Cron Jobs

Cron jobs run as scheduled machines:
- **Sync**: Every 5 minutes → `/api/cron/sync`
- **Classify**: Every 15 minutes → `/api/cron/classify`

To check cron status:
```bash
fly machines list
fly logs -a danny-tasks-api-cron-sync
```

## Troubleshooting

**App won't start?**
```bash
fly logs  # Check what's wrong
fly secrets list  # Verify secrets are set
```

**Cron jobs not running?**
- Check if machines exist: `fly machines list`
- View logs: `fly logs -a danny-tasks-api-cron-sync`
- If scheduled machines aren't available, use external cron service

**Database issues?**
```bash
fly postgres connect -a danny-tasks-db
```

For full documentation, see [DEPLOYMENT.md](./DEPLOYMENT.md).

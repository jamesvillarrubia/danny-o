# Danny Tasks - Deployment Guide

## Overview

Danny Tasks can be deployed to Vercel with a Neon PostgreSQL database. This guide covers the setup process.

## Prerequisites

1. [Vercel account](https://vercel.com)
2. [Neon account](https://neon.tech) (free tier available)
3. [Anthropic API key](https://console.anthropic.com/)
4. [Todoist API key](https://todoist.com/prefs/integrations)
5. [Sentry account](https://sentry.io/) (optional, free tier available)

## Environment Variables

Set these in Vercel dashboard under Project Settings → Environment Variables:

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `TODOIST_API_KEY` | Your Todoist API key |
| `CLAUDE_API_KEY` | Your Anthropic Claude API key |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_MODEL` | Claude model to use | `claude-3-5-sonnet-20240620` |
| `SENTRY_DSN` | Sentry DSN for error tracking | (disabled) |
| `CRON_SECRET` | Secret for cron job authentication | (none) |
| `TODOIST_WEBHOOK_SECRET` | Secret for webhook verification | (none) |

## Neon Database Setup

1. Create a new project in [Neon Console](https://console.neon.tech)
2. Copy the connection string (starts with `postgresql://` or `postgres://`)
3. Add as `DATABASE_URL` in Vercel environment variables

The database schema will be created automatically on first deployment.

## Vercel Deployment

### Option 1: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (from nest/ directory)
cd nest
vercel --prod
```

### Option 2: Deploy via GitHub

1. Push your code to GitHub
2. Import the repository in Vercel
3. Set the root directory to `nest`
4. Configure environment variables
5. Deploy

## Cron Jobs

The following cron jobs are configured in `vercel.json`:

| Endpoint | Schedule | Description |
|----------|----------|-------------|
| `/api/cron/sync` | Every 5 minutes | Sync tasks from Todoist |
| `/api/cron/classify` | Every 15 minutes | Classify unclassified tasks |

To secure cron jobs:
1. Generate a secret: `openssl rand -hex 32`
2. Set `CRON_SECRET` in Vercel environment variables
3. Vercel will automatically include the secret in cron requests

## API Endpoints

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
| `/api/ai-logs` | GET | Get AI interaction logs |
| `/api/ai-logs/summary` | GET | Get AI logs summary |

## Todoist Webhook Setup

To receive real-time updates from Todoist:

1. Go to Todoist Developer Console
2. Create a new app or use existing
3. Add webhook URL: `https://your-domain.vercel.app/api/webhook/todoist`
4. Subscribe to events: `item:added`, `item:updated`, `item:completed`, `note:added`
5. Copy the webhook secret and set as `TODOIST_WEBHOOK_SECRET`

## Local Development

For local development, the app uses SQLite by default:

```bash
# Run locally (uses SQLite)
cd nest
pnpm install
pnpm tsx src/main.ts sync

# Or with hot reload
pnpm dev
```

To use PostgreSQL locally:
```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/danny"
pnpm tsx src/main.ts sync
```

## Monitoring

### Sentry

Error tracking is available via Sentry:

1. Create a project in [Sentry](https://sentry.io/)
2. Copy the DSN
3. Set `SENTRY_DSN` in Vercel environment variables

### AI Logs

View AI interaction logs for prompt optimization:

```bash
# Get recent logs
curl https://your-domain.vercel.app/api/ai-logs?limit=50

# Get summary
curl https://your-domain.vercel.app/api/ai-logs/summary
```

## Troubleshooting

### Database connection issues

- Verify `DATABASE_URL` is correct
- Ensure Neon project is active (not paused)
- Check Vercel function logs for connection errors

### Cron jobs not running

- Verify `vercel.json` is in the root of the deployed directory
- Check that cron jobs are enabled for your Vercel plan
- Review cron execution logs in Vercel dashboard

### AI classification failing

- Verify `CLAUDE_API_KEY` is valid
- Check AI logs for error patterns: `/api/ai-logs?success=false`
- Review rate limits on your Anthropic account


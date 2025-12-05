# Vercel API Deployment (Deprecated)

⚠️ **This API is now deployed to Fly.io. This file is kept for reference.**

The API was previously deployed to Vercel as serverless functions, but has been moved to Fly.io for:
- Better NestJS support (no cold starts)
- Native cron job support (every 5/15 minutes)
- No execution time limits
- Better database connection handling

## Migration

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the current deployment strategy:
- **API**: Fly.io (`fly.toml`)
- **Frontend**: Vercel (this `vercel.json` is for frontend use)

## Old Vercel API Setup

The old `api/index.ts` serverless adapter is no longer used. If you need to reference it, see git history.

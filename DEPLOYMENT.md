# Deployment Guide

Complete guide for deploying Danny Tasks across all environments.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        GitHub Actions                        │
│  Tests → Gate → Deploy (Develop) → Promote → Deploy (Prod)  │
└─────────────────────────────────────────────────────────────┘
                              ↓
        ┌────────────────────┴────────────────────┐
        │                                         │
    ┌───▼────┐                               ┌───▼────┐
    │  API   │                               │  Web   │
    │ Fly.io │                               │ Vercel │
    └────────┘                               └────────┘
```

## Environments

| Environment | API | Web | Database |
|------------|-----|-----|----------|
| **Local** | `localhost:3000` | `localhost:3001` | Local Postgres |
| **Develop** | `danny-tasks-api-dev.fly.dev` | `danny-web-dev.vercel.app` | Neon |
| **Production** | `danny-tasks-api-prod.fly.dev` | `danny-web.vercel.app` | Neon |

## Prerequisites

### 1. Vercel Setup

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link your project (do this in the web/ directory)
cd web
vercel link
```

After linking, Vercel will create a `.vercel` directory with project configuration. You'll need to add these secrets to GitHub:

- `VERCEL_TOKEN` - Get from https://vercel.com/account/tokens
- `VERCEL_ORG_ID` - Found in `.vercel/project.json` after linking
- `VERCEL_PROJECT_ID` - Found in `.vercel/project.json` after linking

### 2. Fly.io Setup

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Verify your API apps exist
fly apps list
```

Ensure you have:
- `danny-tasks-api-dev` - Development API
- `danny-tasks-api-prod` - Production API

Add to GitHub secrets:
- `FLY_API_TOKEN` - Get with `fly auth token`

### 3. GitHub Secrets Configuration

Go to your GitHub repo → Settings → Secrets and variables → Actions

Add these secrets:
```
FLY_API_TOKEN=<your-fly-token>
VERCEL_TOKEN=<your-vercel-token>
VERCEL_ORG_ID=<from-.vercel/project.json>
VERCEL_PROJECT_ID=<from-.vercel/project.json>
```

## Deployment Flow

### Automatic Deployments (Recommended)

The GitHub Actions pipeline handles everything automatically:

**Develop Branch (Staging):**
```bash
git checkout develop
git pull origin develop

# Make changes, commit, push
git add .
git commit -m "feat: your changes"
git push origin develop
```

This triggers:
1. ✅ Run tests (API, Web, Extension)
2. ✅ Deploy API to `danny-tasks-api-dev.fly.dev`
3. ✅ Deploy Web to `danny-web-dev.vercel.app`
4. ✅ Create version tag
5. ✅ Create PR to `main` (auto-promote)

**Main Branch (Production):**

When PR from develop → main is merged:
1. ✅ Run tests (API, Web, Extension)
2. ✅ Deploy API to `danny-tasks-api-prod.fly.dev`
3. ✅ Deploy Web to `danny-web.vercel.app`
4. ✅ Create GitHub release

### Manual Deployments

**API (Fly.io):**
```bash
cd api

# Deploy to develop
fly deploy --app danny-tasks-api-dev

# Deploy to production
fly deploy --app danny-tasks-api-prod
```

**Web (Vercel):**
```bash
cd web

# Deploy preview (develop)
vercel

# Deploy production
vercel --prod
```

## Vercel Configuration

### Disable Auto-Deploy

The `web/vercel.json` already has:
```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

This ensures Vercel only deploys when triggered by GitHub Actions (after tests pass).

### Custom Domains

To use custom domains on Vercel:

1. Go to your Vercel project → Settings → Domains
2. Add your domains:
   - `danny-web.yourdomain.com` (production)
   - `danny-web-dev.yourdomain.com` (preview/develop)
3. Update DNS records as instructed
4. Update `extension/sidepanel.js` with your custom domains

## Testing Deployments

### After Develop Deployment

```bash
# Test API
curl https://danny-tasks-api-dev.fly.dev/health

# Test Web
open https://danny-web-dev.vercel.app

# Test Extension
# 1. Open Chrome extension
# 2. Switch to "Develop" environment
# 3. Verify it loads the develop deployment
```

### After Production Deployment

```bash
# Test API
curl https://danny-tasks-api-prod.fly.dev/health

# Test Web
open https://danny-web.vercel.app

# Test Extension
# 1. Open Chrome extension
# 2. Switch to "Production" environment
# 3. Verify it loads the production deployment
```

## Monitoring & Logs

### Fly.io (API)

```bash
# View status
fly status --app danny-tasks-api-dev
fly status --app danny-tasks-api-prod

# View logs
fly logs --app danny-tasks-api-dev
fly logs --app danny-tasks-api-prod

# View metrics
fly dashboard metrics --app danny-tasks-api-prod
```

### Vercel (Web)

```bash
# View deployments
vercel ls

# View logs for specific deployment
vercel logs <deployment-url>
```

Or use the Vercel Dashboard:
- https://vercel.com/dashboard

## Rollback Procedures

### Rollback API (Fly.io)

```bash
# List recent releases
fly releases --app danny-tasks-api-prod

# Rollback to previous version
fly releases rollback --app danny-tasks-api-prod
```

### Rollback Web (Vercel)

1. Go to Vercel Dashboard → Your Project → Deployments
2. Find the last known good deployment
3. Click "..." → "Promote to Production"

Or via CLI:
```bash
vercel rollback
```

## Troubleshooting

### GitHub Actions Failing

**Tests not passing:**
```bash
# Run tests locally first
cd api && pnpm test
cd web && pnpm test
```

**Vercel deployment fails:**
- Check `VERCEL_TOKEN` is valid
- Verify `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` match your project
- Ensure `web/vercel.json` is valid

**Fly.io deployment fails:**
- Check `FLY_API_TOKEN` is valid
- Verify apps exist: `fly apps list`
- Check Fly.io status: https://status.flyio.net

### Vercel Not Deploying

If Vercel auto-deploys despite `deploymentEnabled: false`:
1. Go to Vercel Dashboard → Project Settings → Git
2. Disable "Production Branch" and "Preview Branches"
3. This ensures only GitHub Actions can trigger deploys

### Extension Can't Connect

1. Check extension environment dropdown matches your intent
2. Verify URLs in `extension/sidepanel.js` are correct
3. Check browser console for CORS errors
4. Ensure API is running and accessible

## Environment Variables

### API Environment Variables (Fly.io)

Set via Fly.io secrets:
```bash
# Set for develop
fly secrets set TODOIST_API_KEY="your-key" --app danny-tasks-api-dev
fly secrets set ANTHROPIC_API_KEY="your-key" --app danny-tasks-api-dev

# Set for production
fly secrets set TODOIST_API_KEY="your-key" --app danny-tasks-api-prod
fly secrets set ANTHROPIC_API_KEY="your-key" --app danny-tasks-api-prod
```

### Web Environment Variables (Vercel)

The web app is a static SPA and doesn't use environment variables at build time. All configuration (API URLs, keys) is set at runtime via the web UI's settings panel.

## Cost Optimization

**Fly.io:**
- API apps are configured with `auto_stop_machines = 'stop'`
- They stop when idle and start on first request (~1s cold start)
- Minimal: 512MB RAM, 1 shared CPU

**Vercel:**
- Free tier supports up to 100GB bandwidth/month
- Unlimited deployments
- Global CDN included

## Further Reading

- [Fly.io Documentation](https://fly.io/docs/)
- [Vercel Documentation](https://vercel.com/docs)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [API Deployment Details](./api/DEPLOYMENT.md)

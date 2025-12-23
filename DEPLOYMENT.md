# Deployment Guide

## Overview

Danny Tasks uses a monorepo structure with automated deployments via GitHub Actions + Pipecraft:

- **API** → Fly.io (containerized NestJS backend)
- **Web** → Vercel (static React frontend)
- **Extension** → Manual Chrome Web Store upload

## Deployment Flow

```
develop → main (via automated PR)
   ↓         ↓
  dev      prod
```

### Branch Strategy

- **`develop`**: Development branch
  - Triggers deployment to **dev** environments
  - API deploys to `danny-tasks-api-dev`
  - Web deploys to Vercel preview
  
- **`main`**: Production branch
  - Triggers deployment to **prod** environments
  - API deploys to `danny-tasks-api-prod`
  - Web deploys to Vercel production
  - Only versioned commits (via Pipecraft) get promoted

## Automated Deployments

### Pipeline Stages

1. **Type Check** (Fast Fail)
   - Runs `tsc --noEmit` across all packages
   - Catches TypeScript errors before tests run
   - **Blocks all downstream jobs if fails**

2. **Tests** (Parallel)
   - API: lint + unit tests
   - Web: lint + build
   - Extension: manifest validation

3. **Gate**
   - Requires: typecheck ✅ + at least one test job ✅
   - No test failures allowed
   - Blocks deployments if any check fails

4. **Version** (only on push to develop)
   - Calculates semantic version from conventional commits
   - Creates git tag
   - Triggers promotion PR to main

5. **Deploy**
   - Conditional based on:
     - Branch (`develop` vs `main`)
     - Domain changed (only deploy what changed)
     - All gates passed

### What Triggers Deployment?

| Event | Branch | API Changed | Web Changed | Result |
|-------|--------|-------------|-------------|--------|
| Push | `develop` | ✅ | ❌ | Deploy API to dev |
| Push | `develop` | ❌ | ✅ | Deploy Web to preview |
| Push | `develop` | ✅ | ✅ | Deploy both to dev/preview |
| Push | `main` | ✅ | ❌ | Deploy API to prod |
| Push | `main` | ❌ | ✅ | Deploy Web to prod |
| Push | `main` | ✅ | ✅ | Deploy both to prod |
| PR | any | any | any | Run tests only (no deploy) |

## Manual Deployments

### Pre-Flight Check

Before any manual deployment, run:

```bash
# From project root
pnpm predeploy
```

This runs:
- TypeScript type checks
- Linting
- Ensures code quality

Or use the comprehensive check script:

```bash
./scripts/pre-deploy-check.sh
```

### Deploy API to Fly.io

```bash
# Development
cd api
flyctl deploy --app danny-tasks-api-dev --config fly.toml

# Production
cd api
flyctl deploy --app danny-tasks-api-prod --config fly.toml
```

Or from root:

```bash
# Production (uses wrapper script)
pnpm deploy:fly
```

### Deploy Web to Vercel

Vercel deployments are automatic via GitHub integration:
- Push to `develop` → Preview deployment
- Push to `main` → Production deployment

For manual deployment:

```bash
cd web
vercel --prod  # Production
vercel         # Preview
```

## Required Secrets

Add these to GitHub Actions secrets:

### Fly.io
- `FLY_API_TOKEN` - Get from https://fly.io/dashboard/personal/tokens

### Vercel
- `VERCEL_TOKEN` - Get from https://vercel.com/account/tokens
- `VERCEL_ORG_ID` - From `.vercel/project.json` (orgId)
- `VERCEL_PROJECT_ID` - From `.vercel/project.json` (projectId)

## Environment Variables

### API (Fly.io Secrets)

```bash
# Set secrets via Fly.io CLI
flyctl secrets set -a danny-tasks-api-prod \
  TODOIST_API_KEY="your_key" \
  ANTHROPIC_API_KEY="your_key" \
  DATABASE_URL="postgres://..."
```

### Web (Vercel Environment Variables)

**CRITICAL**: You must configure the API URL in Vercel for the frontend to work:

Set in Vercel dashboard under Project Settings → Environment Variables:
- `VITE_API_URL` - **REQUIRED** - API base URL
  - Production: `https://danny-tasks-api-prod.fly.dev`
  - Preview: `https://danny-tasks-api-dev.fly.dev`

**After setting this variable, you must redeploy your Vercel application.**

See `web/VERCEL_SETUP.md` for detailed step-by-step instructions.

## Deployment Optimization

### Build Context Optimization

The monorepo is optimized for fast deployments:

**Fly.io (API)**:
- Build context: ~667KB (down from 595MB)
- Excludes: `web/`, `docs/`, `extension/`, tests, `.pnpm-store/`
- See `.dockerignore` and `api/.dockerignore`

**Vercel (Web)**:
- Build context: Filtered by `.vercelignore`
- Excludes: `/api/`, `/docs/`, `/extension/`
- Prevents serverless function limit issues

### Build Speed

- **API**: ~30-45 seconds (multi-stage Docker build)
- **Web**: ~10-20 seconds (Vite build)

## Troubleshooting

### TypeScript Errors Block Deployment

**Symptom**: Pipeline fails at typecheck stage

**Solution**:
```bash
# Run locally to see errors
pnpm typecheck

# Or check specific package
pnpm typecheck:api
pnpm typecheck:web
```

### Fly.io Build Context Too Large

**Symptom**: Upload takes >2 minutes

**Solution**: Check `.dockerignore` files exclude unnecessary directories

### Vercel "Too Many Functions" Error

**Symptom**: `No more than 12 Serverless Functions...`

**Solution**: Verify `.vercelignore` excludes `/api/` directory

### Fly.io Crash Loop

**Symptom**: Machines restart repeatedly

**Solution**: 
1. Check logs: `flyctl logs --app danny-tasks-api-prod`
2. Common issues:
   - Missing environment variables
   - Database connection failure
   - Port binding issues (ensure PORT=8080)
   - Dependency injection errors (missing `@Inject()` decorators)

## Rollback

### Roll Back API

```bash
# List recent deployments
flyctl releases --app danny-tasks-api-prod

# Rollback to specific version
flyctl releases rollback v123 --app danny-tasks-api-prod
```

### Roll Back Web

1. Go to Vercel dashboard
2. Find previous deployment
3. Click "Promote to Production"

Or use CLI:
```bash
vercel rollback [deployment-url]
```

## CI/CD Architecture

```
develop branch push
    ↓
┌───────────────────┐
│  Type Check       │ ← Fast fail (30s)
└─────────┬─────────┘
          ↓
┌───────────────────┐
│  Tests (parallel) │
│  - api            │
│  - web            │
│  - extension      │
└─────────┬─────────┘
          ↓
┌───────────────────┐
│  Gate             │ ← All checks must pass
└─────────┬─────────┘
          ↓
┌───────────────────┐
│  Version & Tag    │ ← Only if conventional commit
└─────────┬─────────┘
          ↓
┌───────────────────┐
│  Deploy to Dev    │
│  - Fly.io (API)   │
│  - Vercel (Web)   │
└─────────┬─────────┘
          ↓
┌───────────────────┐
│  Promote PR       │ ← Auto PR to main
└───────────────────┘

(Merge PR to main)
    ↓
┌───────────────────┐
│  Deploy to Prod   │
│  - Fly.io (API)   │
│  - Vercel (Web)   │
└───────────────────┘
```

## Performance

- **Type Check**: ~30s (catches errors early)
- **Tests**: ~2-5min (parallel execution)
- **API Deploy**: ~45s (optimized Docker context)
- **Web Deploy**: ~15s (Vercel edge network)
- **Total Pipeline**: ~5-7min (develop → deployed to dev)

## Best Practices

1. **Always use conventional commits** - Enables automatic versioning
2. **Run `pnpm predeploy` locally** - Catch errors before pushing
3. **Test on develop first** - Never push directly to main
4. **Monitor health checks** - API has `/health` endpoints
5. **Review logs after deployment** - Check for startup errors


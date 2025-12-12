# ✅ Deployment Automation Setup Complete

## What Was Done

I've fully automated your deployment pipeline with test-gated CI/CD for both API and Web.

### 1. Architecture Changes

**Before:**
- Manual deployments
- Extension pointed to unspecified URLs
- Web was being set up for Fly.io (wrong choice for SPA)

**After:**
- Automated deployments from Git
- API → Fly.io (makes sense for backend)
- Web → Vercel (perfect for SPA with global CDN)
- Extension → Environment switcher (Local/Develop/Production)

### 2. GitHub Actions Pipeline

Updated `.github/workflows/pipeline.yml` to:
- Run tests for API, Web, and Extension
- Deploy to staging (develop branch) after tests pass
- Deploy to production (main branch) after tests pass
- Coordinate API (Fly.io) and Web (Vercel) deployments
- Auto-create PR from develop → main after successful staging deploy

### 3. Vercel Configuration

- Disabled auto-deploy in `web/vercel.json`
- Deployments only happen via GitHub Actions
- Ensures tests always run before deployment

### 4. Chrome Extension Updates

- Added environment dropdown (Local/Develop/Production)
- Updated URLs to use Vercel domains
- Persists environment choice in Chrome storage
- Visual badges for current environment

### 5. Documentation

Created comprehensive guides:
- `DEPLOYMENT.md` - Complete deployment setup guide
- Updated `README.md` - Architecture and workflow
- Updated `extension/README.md` - Environment switching guide

## What You Need to Do

### Step 1: Set Up Vercel Project

```bash
cd web
vercel link  # This creates .vercel/project.json with your IDs
```

Follow prompts to link your existing Vercel project or create a new one.

### Step 2: Add GitHub Secrets

Go to: https://github.com/jamesvillarrubia/danny-o/settings/secrets/actions

Add these secrets:

**Vercel (from .vercel/project.json):**
```
VERCEL_TOKEN=<from https://vercel.com/account/tokens>
VERCEL_ORG_ID=<from .vercel/project.json>
VERCEL_PROJECT_ID=<from .vercel/project.json>
```

**Fly.io (you probably already have this):**
```
FLY_API_TOKEN=<from `fly auth token`>
```

### Step 3: Update Extension URLs (if using custom domains)

If you set up custom Vercel domains, update `extension/sidepanel.js`:

```javascript
const ENVIRONMENTS = {
  local: 'http://localhost:3001',
  develop: 'https://your-custom-dev-domain.com',
  production: 'https://your-custom-prod-domain.com'
};
```

### Step 4: Merge the PR

Once secrets are added:

1. Go to: https://github.com/jamesvillarrubia/danny-o/pull/4
2. Review the changes
3. Merge to `develop` branch
4. GitHub Actions will:
   - Run all tests
   - Deploy API to Fly.io (develop)
   - Deploy Web to Vercel (preview)
   - Create auto-PR to `main`
5. Merge that PR to deploy to production

## How It Works Now

### Daily Workflow

```bash
# Work on a feature branch
git checkout -b feature/my-feature
git add .
git commit -m "feat: my awesome feature"
git push origin feature/my-feature

# Create PR to develop
# After review and merge to develop:
# → Tests run automatically
# → Deploys to staging (API + Web)
# → Auto-PR created to main

# Merge to main:
# → Tests run automatically
# → Deploys to production (API + Web)
# → Release created
```

### Environments

| Environment | API URL | Web URL |
|------------|---------|---------|
| **Local** | localhost:3000 | localhost:3001 |
| **Develop** | danny-tasks-api-dev.fly.dev | danny-web-dev.vercel.app |
| **Production** | danny-tasks-api-prod.fly.dev | danny-web.vercel.app |

### Extension Usage

1. Open Chrome extension
2. Use dropdown at top to select environment:
   - **Local** - Your dev server
   - **Develop** - Staging environment
   - **Production** - Live environment
3. Selection persists across browser restarts

## Benefits

✅ **No manual deployments** - Git push is all you need
✅ **Test-gated** - Bad code never reaches production
✅ **Fast CDN** - Vercel's global network for web
✅ **Cost optimized** - Free Vercel tier + minimal Fly.io usage
✅ **Consistent** - Same workflow every time
✅ **Safe** - Easy rollbacks if needed

## Troubleshooting

### If GitHub Actions fail:

1. Check secrets are set correctly
2. Run tests locally: `cd api && pnpm test`
3. Check workflow logs in GitHub Actions tab

### If Vercel won't deploy:

1. Verify you ran `vercel link` in web/ directory
2. Check VERCEL_TOKEN is valid
3. Ensure project isn't set to auto-deploy in Vercel dashboard

### If extension can't connect:

1. Check environment dropdown matches what you want
2. Verify URLs in `extension/sidepanel.js`
3. Check browser console for errors

## Next Steps

1. Set up Vercel (run `vercel link` in web/)
2. Add GitHub secrets
3. Merge PR #4
4. Test staging deployment
5. Merge to main for production deployment
6. Update extension URLs if needed

## Questions?

Check `DEPLOYMENT.md` for full details on:
- Vercel setup
- Fly.io configuration
- GitHub Actions workflow
- Rollback procedures
- Monitoring and logs

Everything is set up to "just work" once you add the secrets!

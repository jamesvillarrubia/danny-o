# Quick Start: Automated Deployment Setup

I just opened 3 browser tabs for you. Follow these steps in order:

## Step 1: Get Fly.io Token (5 min)

**Tab**: https://fly.io/dashboard/personal/tokens

1. Click "Create Token"
2. Name: `GitHub Actions - Danny Tasks`
3. Click "Create"
4. **Copy the token** (you won't see it again!)

## Step 2: Get Vercel Token (5 min)

**Tab**: https://vercel.com/account/tokens

1. Click "Create Token"
2. Name: `GitHub Actions - Danny Tasks`
3. Scope: **Full Account**
4. Expiration: **No expiration**
5. Click "Create"
6. **Copy the token**

## Step 3: Get Vercel Project IDs (2 min)

### Option A: If you've deployed to Vercel before

```bash
cd web
pnpm exec vercel link
# Follow prompts to link to your existing project

# Then get the IDs:
cat .vercel/project.json
```

You'll see:
```json
{
  "orgId": "team_abc123...",
  "projectId": "prj_xyz789..."
}
```

### Option B: From Vercel Dashboard

1. Go to your project in Vercel
2. Settings → General
3. Find "Project ID" (starts with `prj_`)
4. Go to your account/team settings
5. Find "Team ID" or "User ID" (starts with `team_` or similar)

## Step 4: Add All Secrets to GitHub (5 min)

**Tab**: https://github.com/jamesvillarrubia/danny-o/settings/secrets/actions

Click "New repository secret" and add each one:

| Secret Name | Value | Where You Got It |
|-------------|-------|------------------|
| `FLY_API_TOKEN` | `FlyV1_...` | Step 1 |
| `VERCEL_TOKEN` | `vercel_token_...` | Step 2 |
| `VERCEL_ORG_ID` | `team_...` | Step 3 |
| `VERCEL_PROJECT_ID` | `prj_...` | Step 3 |

## Step 5: Configure Vercel Environment Variable (3 min)

**Important**: The frontend needs to know where your API is!

1. Go to https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Add:
   - Name: `VITE_API_URL`
   - Value: `https://danny-tasks-api-prod.fly.dev`
   - Environment: **Production**
5. Click Save
6. Add again with:
   - Name: `VITE_API_URL`
   - Value: `https://danny-tasks-api-dev.fly.dev`
   - Environment: **Preview**

See `web/VERCEL_SETUP.md` for detailed instructions.

## Step 6: Test It! (2 min)

```bash
# On develop branch
echo "test" >> README.md
git add README.md
git commit -m "test: verify deployment pipeline"
git push origin develop
```

Watch the magic happen:
- https://github.com/jamesvillarrubia/danny-o/actions

You should see:
1. ✅ Type check passes
2. ✅ Tests pass
3. ✅ Deploys to dev environments (API to Fly.io, Web to Vercel preview)
4. 🎉 Auto PR created to `main`

## What Happens Next?

### On `develop` branch push:
- Type checks → Tests → Deploy to:
  - API: `danny-tasks-api-dev.fly.dev`
  - Web: Vercel preview URL
- Creates auto PR to `main`

### On `main` branch push (merge PR):
- Type checks → Tests → Version bump → Deploy to:
  - API: `danny-tasks-api-prod.fly.dev`
  - Web: Production (your Vercel domain)

## Troubleshooting

### Pipeline fails at "Type Check"
```bash
# Run locally to see errors:
pnpm typecheck
```

### "Missing required env variable VERCEL_TOKEN"
- Double-check secret name is exactly `VERCEL_TOKEN` (case-sensitive)
- Verify you added it to **Repository secrets**, not Environment secrets

### Fly.io deployment fails
```bash
# Check if apps exist:
flyctl apps list

# If missing, create them:
flyctl apps create danny-tasks-api-dev
flyctl apps create danny-tasks-api-prod
```

### Web app can't connect to API
- Check you added `VITE_API_URL` to Vercel (Step 5)
- Redeploy after adding: Go to Deployments → latest → Redeploy

## Total Time: ~20 minutes

After this one-time setup, every `git push` will automatically:
- Type check your code
- Run tests
- Deploy changed components
- Create version tags
- Promote to production (when you merge PRs)

## Need More Help?

- Full deployment guide: `DEPLOYMENT.md`
- Secrets setup details: `GITHUB_SECRETS_SETUP.md`
- Vercel config: `web/VERCEL_SETUP.md`
- Pipeline architecture: `.github/workflows/pipeline.yml`

# GitHub Secrets Setup Guide

This guide will walk you through setting up the required secrets for automated deployments.

## Where to Add Secrets

Add all secrets at: **https://github.com/jamesvillarrubia/danny-o/settings/secrets/actions**

Click "New repository secret" for each one.

---

## Required Secrets

### 1. FLY_API_TOKEN

**Purpose**: Deploy API to Fly.io

**How to get it**:
1. Visit: https://fly.io/dashboard/personal/tokens
2. Click "Create Token"
3. Name: `GitHub Actions - Danny Tasks`
4. Scope: Leave default (full access)
5. Copy the token (you won't see it again!)

**Add to GitHub**:
- Name: `FLY_API_TOKEN`
- Value: `[your token from Fly.io]`

---

### 2. VERCEL_TOKEN

**Purpose**: Authenticate GitHub Actions with Vercel

**How to get it**:
1. Visit: https://vercel.com/account/tokens
2. Click "Create Token"
3. Name: `GitHub Actions - Danny Tasks`
4. Scope: Full Account
5. Expiration: No expiration (or set to your preference)
6. Copy the token

**Add to GitHub**:
- Name: `VERCEL_TOKEN`
- Value: `[your token from Vercel]`

---

### 3. VERCEL_ORG_ID

**Purpose**: Identify your Vercel team/account

**How to get it**:

#### Option A: From Vercel CLI (if linked)
```bash
cd web
cat .vercel/project.json | grep orgId
```

#### Option B: From Vercel Dashboard
1. Go to your Vercel dashboard
2. Click your profile icon → Settings
3. Under "General" you'll see your Team ID or Personal Account ID
4. It starts with `team_` (for teams) or a different format for personal accounts

**Add to GitHub**:
- Name: `VERCEL_ORG_ID`
- Value: `team_HAvukd3hh3lpRqfysX0hzDjK` (or your org ID)

---

### 4. VERCEL_PROJECT_ID

**Purpose**: Identify your specific Vercel project

**How to get it**:

#### Option A: Link the project first
```bash
cd web
pnpm exec vercel link

# Then extract the ID:
cat .vercel/project.json | grep projectId
```

#### Option B: From Vercel Dashboard
1. Go to your project in Vercel: https://vercel.com/dashboard
2. Select your project
3. Go to Settings → General
4. Find "Project ID" (starts with `prj_`)

**Add to GitHub**:
- Name: `VERCEL_PROJECT_ID`
- Value: `prj_[your-project-id]`

---

## Quick Setup Commands

### 1. Link Vercel Project (if not already done)

```bash
cd web
pnpm exec vercel link
```

Follow the prompts:
- Link to existing project? **Yes**
- What's your project's name? **danny-o** (or whatever you named it)

### 2. Extract Vercel IDs

```bash
cd web
cat .vercel/project.json
```

You'll see something like:
```json
{
  "orgId": "team_HAvukd3hh3lpRqfysX0hzDjK",
  "projectId": "prj_abc123xyz"
}
```

Use these values for `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`.

---

## Verification Checklist

After adding all secrets, verify:

- [ ] `FLY_API_TOKEN` is set
- [ ] `VERCEL_TOKEN` is set
- [ ] `VERCEL_ORG_ID` is set (starts with `team_` or similar)
- [ ] `VERCEL_PROJECT_ID` is set (starts with `prj_`)

## Test the Pipeline

Once secrets are added:

```bash
git checkout develop
git pull
echo "test" >> README.md
git add README.md
git commit -m "test: verify deployment pipeline"
git push
```

Watch the deployment at: https://github.com/jamesvillarrubia/danny-o/actions

---

## Troubleshooting

### "Error: Missing required env variable VERCEL_TOKEN"
- Check that the secret name is exactly `VERCEL_TOKEN` (case-sensitive)
- Verify the token hasn't expired

### "Error: Could not find project"
- Verify `VERCEL_PROJECT_ID` is correct
- Make sure the project exists in Vercel dashboard
- Check that `VERCEL_ORG_ID` matches the team/account owning the project

### Fly.io deployment fails
- Verify `FLY_API_TOKEN` is valid
- Check that both `danny-tasks-api-dev` and `danny-tasks-api-prod` apps exist in Fly.io
- Run `flyctl apps list` to see your apps

---

## Security Notes

⚠️ **IMPORTANT**:
- Never commit these tokens to git
- Don't share them in Slack, Discord, etc.
- Rotate tokens if they're ever exposed
- Use different tokens for different projects if possible

The GitHub Actions secrets are encrypted and only visible to repository owners/admins.

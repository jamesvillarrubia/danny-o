# Vercel Setup Instructions

## Required Environment Variables

To connect the frontend to your API backend, you must configure the following environment variable in your Vercel project settings:

### Production Environment

1. Go to your Vercel project: https://vercel.com/dashboard
2. Navigate to: **Settings** → **Environment Variables**
3. Add the following variable:

```
Name: VITE_API_URL
Value: https://danny-tasks-api-prod.fly.dev
Environment: Production
```

### Preview/Development Environment (optional)

For preview deployments (from `develop` branch), add:

```
Name: VITE_API_URL
Value: https://danny-tasks-api-dev.fly.dev
Environment: Preview
```

## How to Add Environment Variables in Vercel

### Via Dashboard:
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Enter name: `VITE_API_URL`
6. Enter value: `https://danny-tasks-api-prod.fly.dev`
7. Select environment: **Production** (or **Preview** for dev)
8. Click **Save**
9. **Redeploy** your application for changes to take effect

### Via Vercel CLI:
```bash
vercel env add VITE_API_URL production
# When prompted, enter: https://danny-tasks-api-prod.fly.dev
```

## Triggering a Redeploy

After adding the environment variable, you need to trigger a redeploy:

### Option 1: Via Dashboard
1. Go to **Deployments**
2. Click the three dots menu on the latest deployment
3. Click **Redeploy**

### Option 2: Force Push
```bash
git commit --allow-empty -m "chore: trigger redeploy for env var update"
git push origin main
```

### Option 3: Via CLI
```bash
vercel --prod
```

## Verifying the Configuration

After redeployment, open your Vercel frontend. You should see:
- The API key generation screen
- Ability to create and manage tasks
- No CORS or connection errors in the browser console

If you see connection errors, check:
1. The environment variable is set correctly
2. The Fly.io API is running: `curl https://danny-tasks-api-prod.fly.dev/health`
3. CORS is configured in the API to allow your Vercel domain


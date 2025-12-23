# Deployment Overview

Danny Tasks can be deployed to various platforms. We recommend using our [deployment wizard](/deployment) to generate the necessary configuration files.

## Supported Platforms

### Railway (Recommended)
- One-click deployment from GitHub
- Built-in PostgreSQL database
- Free tier: $5/month credit
- Auto-detects Docker/Node.js

### Render
- One-click deployment from GitHub
- Managed PostgreSQL database
- Free tier available
- Auto-deploy on push

### Fly.io
- Container-based deployment
- Fly Postgres addon
- Free tier: 3 shared-cpu VMs
- Good for long-running processes

### Local
- Docker Compose setup
- Perfect for development
- Full control over environment

## Database Options

### Managed Postgres
- **Railway**: Auto-provisioned, connection string injected as `DATABASE_URL`
- **Render**: Add `type: pg` service in `render.yaml`
- **Fly.io**: Use `fly postgres create` command

### External Postgres
- **Neon**: Serverless Postgres with generous free tier
- **Supabase**: Open source Firebase alternative with Postgres

## Prerequisites

Before deploying, you'll need:

1. **Todoist API Key** - Get from [Todoist Settings](https://todoist.com/prefs/integrations)
2. **Claude API Key** - Get from [Anthropic Console](https://console.anthropic.com/)
3. **GitHub Account** - For repository access
4. **Platform Account** - Railway, Render, or Fly.io account

## Next Steps

Use our [interactive deployment wizard](/deployment) to generate configuration files and get step-by-step instructions for your chosen platform.

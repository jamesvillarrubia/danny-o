# Danny Tasks

AI-powered task management system with intelligent categorization, prioritization, and time estimation.

## 🚀 Quick Deploy

**Automated Deployments (Recommended):**

Push to GitHub and let CI/CD handle everything:

```bash
# Deploy to develop (staging)
git push origin develop

# Deploy to production (merge PR from develop → main)
# GitHub Actions will:
# 1. Run all tests
# 2. Deploy API to Fly.io
# 3. Deploy Web to Vercel
# 4. Create release
```

**Local Development:**

Run locally with Docker:

```bash
docker-compose up -d
```

Visit http://localhost:3001 to complete the setup wizard.

## Environments

Danny Tasks supports a three-environment workflow:

| Environment | API | Web | Database | Use Case |
|------------|-----|-----|----------|----------|
| **Local** | `localhost:3000` | `localhost:3001` | Local Postgres | Development |
| **Develop** | `danny-tasks-api-dev.fly.dev` | `danny-web-dev.vercel.app` | Neon | Staging/Testing |
| **Production** | `danny-tasks-api-prod.fly.dev` | `danny-web.vercel.app` | Neon | Live |

## Project Structure

```
tasks/
├── api/              # Backend (NestJS) → Deploys to Fly.io
│   ├── src/
│   │   ├── cli/      # CLI interface
│   │   ├── mcp/      # MCP server interface
│   │   └── api/      # HTTP REST interface
│   ├── fly.toml
│   └── Dockerfile
│
├── web/              # Frontend (React + Vite) → Deploys to Vercel
│   ├── src/
│   └── vercel.json
│
├── extension/        # Browser extension (Chrome)
│   └── Supports environment switching (Local/Develop/Production)
│
└── legacy/           # Original JS prototype (archived)
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    API (Backend)                         │
│                                                          │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐              │
│  │   CLI   │    │   MCP   │    │  HTTP   │              │
│  └────┬────┘    └────┬────┘    └────┬────┘              │
│       │              │              │                    │
└───────┼──────────────┼──────────────┼────────────────────┘
        │              │              │
        │              │              ├── Web (React)
        │              │              └── Extension
        │              │
        │              └── AI Agents (Claude, Cursor, etc.)
        │
        └── Terminal (you)
```

## Quick Start

### For End Users (Self-Hosting)

**Docker Compose (Recommended)**

```bash
# Clone the repository
git clone https://github.com/yourusername/danny-tasks.git
cd danny-tasks

# Start the stack
docker-compose up -d

# Visit http://localhost and complete the setup wizard
```

**Single Docker Image**

```bash
docker run -d \
  -p 3000:8080 \
  -v $(pwd)/data:/app/data \
  --name danny-tasks \
  ghcr.io/yourusername/danny-tasks-api:latest
```

### For Developers

**Prerequisites**

- Node.js 22+
- pnpm 9+
- [Todoist API key](https://todoist.com/prefs/integrations)
- [Claude API key](https://console.anthropic.com/)

**Local Development**

```bash
# Install dependencies
pnpm install

# Start both API and Web in dev mode
pnpm dev

# Or run separately:
pnpm dev:api  # API on port 3000
pnpm dev:web  # Web on port 3001
```

The app uses **embedded PGlite** by default (zero config). To use remote PostgreSQL:

```bash
# Set in api/.env
DATABASE_ENV=dev
DEV_DATABASE_URL=postgresql://user:pass@localhost:5432/danny
```

### CLI Commands

```bash
# From root directory
pnpm cli sync          # Sync tasks from Todoist
pnpm cli list          # List tasks
pnpm cli classify      # AI classification
pnpm cli plan today    # Generate daily plan

# Or from api directory
cd api && pnpm cli <command>
```

### MCP Server (for AI agents)

```bash
# From root directory
pnpm mcp

# Or from api directory
cd api && pnpm mcp
```

### Chrome Extension

The extension provides a side panel with environment switching:

**Installation:**
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → Select `extension/` folder

**Environment Switching:**
- Use the dropdown at the top to switch between Local/Develop/Production
- Your selection persists across browser restarts
- Each environment maintains its own API keys and settings

See [extension/README.md](./extension/README.md) for detailed setup instructions.

### Build & Test

```bash
# Build both API and Web
pnpm build

# Run all tests
pnpm test

# Or individually
pnpm build:api / pnpm build:web
pnpm test:api / pnpm test:web
```

## CI/CD

The project uses GitHub Actions for continuous integration and deployment, configured with [Pipecraft](https://www.npmjs.com/package/pipecraft).

### Workflow Overview

The CI pipeline (`.github/workflows/ci.yml`) runs on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Manual workflow dispatch
- Scheduled daily runs at 2 AM UTC (for contract validation)

### Test Jobs

1. **API Unit & Integration Tests** (`api-unit-tests`)
   - Runs Vitest unit tests
   - Runs integration tests
   - Runs E2E tests
   - Generates coverage reports

2. **API Contract Tests** (`api-contract-tests`)
   - Uses Step-CI to run contract tests
   - Tests user flow sequences:
     - `sync-classify-complete.yaml`
     - `ai-workflow.yaml`
     - `task-lifecycle.yaml`

3. **API Blueprint Tests** (`api-blueprint-tests`)
   - Uses Step-CI to run blueprint tests
   - Tests all API endpoints:
     - Health, Tasks, Projects, Labels, AI, Stats, Errors

4. **Web Domain Tests** (`web-tests`)
   - Linting with ESLint
   - Type checking with TypeScript
   - Build validation

5. **Extension Validation** (`extension-validation`)
   - Validates `manifest.json` structure
   - Checks required files exist
   - Validates icon files

### Environment Variables

The CI workflow uses mocked external APIs for testing. No secrets are required for the standard CI runs.

For optional real API testing (not enabled by default), you would need:
- `TODOIST_API_TOKEN` - Todoist API key
- `ANTHROPIC_API_KEY` - Anthropic/Claude API key

These can be added as GitHub Secrets if needed for contract validation against real APIs.

### Artifacts

The workflow uploads the following artifacts:
- API test coverage reports (30 day retention)
- Step-CI test results (30 day retention)
- Web build artifacts (7 day retention)

### Local Testing

To run the same tests locally:

```bash
# API tests
cd api
pnpm test                    # Unit tests
pnpm test:integration        # Integration tests
pnpm test:e2e                # E2E tests
pnpm test:step-ci            # Step-CI tests (requires Docker)

# Web tests
cd web
pnpm lint                    # Linting
pnpm build                   # Build validation
npx tsc --noEmit            # Type checking
```

## Deployment

### Automated CI/CD (Recommended)

Deployments happen automatically via GitHub Actions when you push to `develop` or `main`:

**Workflow:**
1. Push to `develop` → Tests run → Deploy to staging (Fly.io + Vercel)
2. Merge PR to `main` → Tests run → Deploy to production (Fly.io + Vercel)

**Setup:**
- API deploys to Fly.io (both develop and production)
- Web deploys to Vercel (both develop and production)
- All deployments are test-gated (must pass tests first)
- No manual deployment needed

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment setup guide.

### Manual Deployment (if needed)

**API (Fly.io):**
```bash
cd api
fly deploy --app danny-tasks-api-prod   # Production
fly deploy --app danny-tasks-api-dev    # Develop
```

**Web (Vercel):**
```bash
cd web
vercel --prod                           # Production
vercel                                  # Preview/Develop
```

### Self-Hosted

- **Docker** → `docker-compose up` for full stack
- **Manual** → Build and run on any Node.js 22+ server

See [SELF_HOSTING.md](./SELF_HOSTING.md) for detailed self-hosting guide.

## Documentation

| Document | Description |
|----------|-------------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | **Complete deployment guide (Fly.io + Vercel + CI/CD)** |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Development guide & troubleshooting |
| [api/README.md](./api/README.md) | API documentation |
| [api/DEPLOYMENT.md](./api/DEPLOYMENT.md) | API deployment details (Fly.io) |
| [api/ARCHITECTURE.md](./api/ARCHITECTURE.md) | Architecture details |
| [api/DOCKER.md](./api/DOCKER.md) | Docker setup |
| [extension/README.md](./extension/README.md) | Chrome extension setup & usage |

## Features

- **AI-Powered Classification** — Automatically categorizes tasks using Claude AI
- **Model Context Protocol (MCP)** — 17 MCP tools for AI agent integration
- **Intelligent Enrichment** — Estimates time, energy level, and supplies needed
- **Embedded Database** — PGlite (embedded Postgres) with optional cloud upgrade
- **Auto-Updates** — Automatic migrations with backup-first strategy
- **Setup Wizard** — Easy first-run configuration via web UI
- **CLI & HTTP & MCP Modes** — Three interfaces to the same business logic

## Update Strategy

Danny Tasks automatically updates when deployed:

- **Cloud Platforms** (Railway/Render): Git push → auto-deploy → backup → migrate
- **Docker Self-Host**: `docker pull` + restart → backup → migrate  
- **Manual Mode**: Set `AUTO_UPDATE=false` for full control

All updates create backups before running migrations. See [SELF_HOSTING.md](./SELF_HOSTING.md) for details.

## License

MIT

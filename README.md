# Danny Tasks

AI-powered task management system with intelligent categorization, prioritization, and time estimation.

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

### Prerequisites

- Node.js 22+
- pnpm
- [Todoist API key](https://todoist.com/prefs/integrations)
- [Claude API key](https://console.anthropic.com/)

### Run the Full Stack

```bash
# Install all dependencies
pnpm install

# Set up API environment variables
cp api/.env.example api/.env
# Edit api/.env with your API keys (TODOIST_API_KEY, CLAUDE_API_KEY)

# Run everything (API + Web)
pnpm dev
```

This will start:
- **API** on `http://localhost:3000`
- **Web** on `http://localhost:5173` (or next available port)

### Run Individual Services

```bash
# API only
pnpm dev:api

# Web only
pnpm dev:web

# Documentation site
pnpm dev:docs
```

### CLI Commands

```bash
cd api
pnpm cli sync          # Sync tasks from Todoist
pnpm cli list          # List tasks
pnpm cli classify      # AI classification
pnpm cli plan today    # Generate daily plan
```

### MCP Server (for AI agents)

```bash
cd api
pnpm mcp
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

- **API** → [Fly.io](https://fly.io) (container deployment)
- **Web** → [Vercel](https://vercel.com) (static frontend)

### Automated Pipeline

Deployments are automatic via GitHub Actions + Pipecraft:

```bash
git push origin develop  # → Deploys to dev/preview
# (Auto PR created to main)
git push origin main     # → Deploys to production
```

### Manual Deployment

```bash
# Pre-flight checks (run first!)
pnpm predeploy

# Deploy API to Fly.io
pnpm deploy:fly

# Deploy Web to Vercel (handled by Git push + Vercel integration)
```

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for complete deployment guide including:
- Pipeline architecture and flow
- Required secrets setup
- Troubleshooting
- Rollback procedures

## Documentation

- **[📚 Full Documentation](https://yourusername.github.io/tasks)** - Complete docs with deployment wizard
- **[🚀 Deployment Wizard](https://yourusername.github.io/tasks/deployment)** - Interactive deployment guide

### Local Documentation

| Document | Description |
|----------|-------------|
| [api/README.md](./api/README.md) | API documentation |
| [api/DEPLOYMENT.md](./api/DEPLOYMENT.md) | Deployment guide |
| [api/ARCHITECTURE.md](./api/ARCHITECTURE.md) | Architecture details |
| [api/DOCKER.md](./api/DOCKER.md) | Docker setup |

## Features

- **AI-Powered Classification** — Automatically categorizes tasks using Claude AI
- **Model Context Protocol (MCP)** — 17 MCP tools for AI agent integration
- **Intelligent Enrichment** — Estimates time, energy level, and supplies needed
- **Multi-Database Support** — SQLite (local), PostgreSQL (production)
- **CLI & HTTP & MCP Modes** — Three interfaces to the same business logic

## License

MIT

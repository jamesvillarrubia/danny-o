# Development Guide

This is a lightweight monorepo using **pnpm workspaces** for coordinated development.

## Architecture

```
danny-tasks/                    # Root workspace
├── package.json               # Workspace scripts and shared dev deps
├── pnpm-workspace.yaml        # Workspace configuration
│
├── api/                       # Backend (NestJS)
│   ├── package.json          # API-specific dependencies
│   └── src/                  # API source code
│
├── web/                       # Frontend (React + Vite)
│   ├── package.json          # Web-specific dependencies
│   └── src/                  # Web source code
│
├── extension/                 # Browser extension
└── legacy/                    # Archived prototype
```

## How It Works

### Workspace Configuration

The `pnpm-workspace.yaml` file declares which directories are workspace packages:

```yaml
packages:
  - 'api'
  - 'web'
  - 'extension'
  - 'legacy'
```

### Root Scripts

The root `package.json` provides convenience scripts that coordinate across workspaces:

```bash
pnpm dev        # Runs both API and Web in parallel
pnpm build      # Builds both API and Web
pnpm test       # Tests both API and Web
```

These use `pnpm --filter <package-name>` to target specific workspaces.

### Separate Services

**Important:** The API and Web are **separate services** that run independently:

- **API** (port 3000): NestJS HTTP server
- **Web** (port 3001): Vite dev server with HMR

When you run `pnpm dev`:
1. API starts in HTTP mode on port 3000
2. Web starts Vite dev server on port 3001
3. Web makes API calls to `http://localhost:3000`

## Development Workflow

### First Time Setup

```bash
# Clone repo
git clone <repo-url>
cd danny-tasks

# Install all workspace dependencies
pnpm install

# Configure API environment
cp api/.env.example api/.env
# Edit api/.env with your API keys

# Start development
pnpm dev
```

### Daily Development

```bash
# Start both services
pnpm dev

# Or start individually
pnpm dev:api    # API only (port 3000)
pnpm dev:web    # Web only (port 3001)
```

### Common Tasks

```bash
# Build for production
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# CLI commands (from root)
pnpm cli sync
pnpm cli list
pnpm cli classify

# MCP server (from root)
pnpm mcp
```

## Port Configuration

| Service | Port | URL |
|---------|------|-----|
| API | 3000 | http://localhost:3000 |
| Web | 3001 | http://localhost:3001 |

The Web app is configured to proxy API requests to port 3000.

## Troubleshooting

### Port Already in Use

If you see "address already in use" errors:

```bash
# Find process using port 3000 (API)
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or for port 3001 (Web)
lsof -i :3001
kill -9 <PID>
```

### API Not Starting

1. Check if `.env` file exists in `api/` directory
2. Verify API keys are set in `.env`
3. Check for errors in the console output
4. Try starting manually: `cd api && pnpm start:http`

### HTTP 413 Error (Payload Too Large)

This has been fixed in `api/src/main.ts` with a 10MB body size limit. If you still see this:
1. Make sure your API server is using the latest code
2. Restart the API server
3. Check that the body parser middleware is configured

### Dependencies Out of Sync

If you see "Cannot find module" errors:

```bash
# Reinstall all workspace dependencies
pnpm install

# Or clean install
rm -rf node_modules api/node_modules web/node_modules
pnpm install
```

### Database Issues

The API uses different databases for different environments:
- **Development:** SQLite (`:memory:` or file-based)
- **Production:** PostgreSQL (via Neon)

If you see database errors, check your `DATABASE_URL` in `.env`.

## Why Not NX or Turborepo?

We evaluated heavyweight monorepo tools but chose a lightweight approach because:

**✅ Advantages:**
- Simple and maintainable
- No additional complexity or abstractions
- Standard pnpm workspaces (well-documented)
- Easy to understand for new contributors
- No lock-in to specific tooling

**❌ When you might need more:**
- Shared TypeScript types between API and Web → Consider a `@danny/shared` package
- Complex build orchestration → Consider Turborepo
- Advanced caching strategies → Consider Turborepo or NX
- Generated code/scaffolding → Consider NX

For now, the lightweight approach is sufficient. If we add shared packages or need advanced caching, we can migrate to Turborepo with minimal changes.

## Package Management

### Adding Dependencies

```bash
# Add to specific workspace
pnpm add <package> --filter api
pnpm add <package> --filter web

# Add dev dependency to root (for tooling)
pnpm add -D <package> -w

# Add to all workspaces
pnpm add <package> -r
```

### Updating Dependencies

```bash
# Update specific package in workspace
pnpm update <package> --filter api

# Update all dependencies
pnpm update -r
```

## CI/CD

The GitHub Actions workflow runs tests for all workspaces:
- API unit, integration, and contract tests
- Web linting and build validation
- Extension manifest validation

See `.github/workflows/pipeline.yml` for details.

## Deployment

Each workspace deploys independently:

- **API** → Fly.io (Docker container)
- **Web** → Vercel (static build)
- **Extension** → Chrome Web Store (manual)

See `api/DEPLOYMENT.md` for deployment details.

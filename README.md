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

### Development

```bash
# API (backend)
cd api
pnpm install
cp .env.example .env  # Edit with your API keys
pnpm start:http

# Web (frontend) - in another terminal
cd web
pnpm install
pnpm dev
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

## Deployment

- **API** → [Fly.io](https://fly.io) (container deployment)
- **Web** → [Vercel](https://vercel.com) (static/SSR)

See [api/DEPLOYMENT.md](./api/DEPLOYMENT.md) for full deployment guide.

## Documentation

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

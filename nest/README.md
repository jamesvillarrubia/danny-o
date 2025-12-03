# Todoist AI Agent - NestJS TypeScript Edition

> AI-powered task management system built on NestJS with Claude AI, featuring Model Context Protocol (MCP) integration and intelligent task classification.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.1-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.0-red.svg)](https://nestjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-22-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

- **AI-Powered Classification** - Automatically categorizes tasks using Claude AI
- **Model Context Protocol (MCP)** - 17 MCP tools for AI agent integration
- **Intelligent Enrichment** - Estimates time, energy level, and supplies needed
- **Multi-Database Support** - SQLite (local), PostgreSQL, Neon (cloud)
- **Provider Abstraction** - Swappable task providers (currently Todoist)
- **CLI & MCP Modes** - Run as interactive CLI or MCP server
- **Production Ready** - Docker, health checks, comprehensive testing
- **Type Safe** - Full TypeScript with strict typing, no `any` types

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
- [Architecture](#architecture)
- [Development](#development)
- [Testing](#testing)
- [Docker Deployment](#docker-deployment)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [Migration from Legacy](#migration-from-legacy)

## ⚡ Quick Start

### Prerequisites

- Node.js 22+
- pnpm (recommended) or npm
- Todoist API key ([Get one here](https://todoist.com/app/settings/integrations))
- Claude API key ([Get one here](https://console.anthropic.com/))

### 1. Clone and Install

```bash
git clone <repository-url>
cd tasks/nest
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Build and Run

```bash
# Build the project
pnpm build

# Run CLI
pnpm start

# Run MCP server
pnpm mcp
```

### 4. First Sync

```bash
# Sync tasks from Todoist
node dist/main sync

# List tasks
node dist/main list

# Classify tasks with AI
node dist/main classify
```

## 📦 Installation

### Local Development

```bash
# Install dependencies
pnpm install

# Create .env file
cp .env.example .env

# Build TypeScript
pnpm build

# Run in development mode with hot-reload
pnpm start:dev
```

### Docker

```bash
# Quick start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Run CLI commands
docker-compose run --rm cli node dist/main sync
```

See [DOCKER.md](./DOCKER.md) for detailed Docker documentation.

## 🎯 Usage

### CLI Mode

The application provides a comprehensive command-line interface:

```bash
# Sync tasks with Todoist
node dist/main sync

# List tasks
node dist/main list
node dist/main list --category work
node dist/main list --priority 4

# Classify unclassified tasks
node dist/main classify

# Prioritize tasks
node dist/main prioritize

# Complete a task
node dist/main complete <task-id> --time 30

# Generate daily plan
node dist/main plan today

# Get productivity insights
node dist/main insights
```

### MCP Server Mode

Run as an MCP server for AI agent integration:

```bash
# Start MCP server
RUN_MODE=mcp node dist/main

# Or use npm script
pnpm mcp
```

**Available MCP Tools:**

1. **Task Management**
   - `list_todoist_tasks` - List and filter tasks
   - `get_task` - Get task details
   - `sync_todoist` - Sync with Todoist
   - `update_task` - Update task properties
   - `complete_task` - Mark task complete
   - `get_recently_completed` - View completion history
   - `get_productivity_stats` - Get productivity metrics

2. **AI Operations**
   - `ai_classify_tasks` - Classify tasks by category
   - `ai_estimate_time` - Estimate task duration
   - `ai_prioritize_tasks` - Intelligently prioritize
   - `ai_suggest_daily_plan` - Generate daily plan
   - `ai_breakdown_task` - Break into subtasks
   - `ai_search_tasks` - Natural language search
   - `ai_generate_insights` - Productivity insights

3. **Agentic Tools**
   - `process_text_agent` - Process natural language input
   - `get_enrichment_stats` - Metadata statistics
   - `get_unclassified_tasks` - Find tasks needing classification
   - `analyze_task_supply_needs` - Shopping list generator

## 🏗️ Architecture

### Module Structure

```
nest/
├── src/
│   ├── main.ts                    # Bootstrap (CLI or MCP mode)
│   ├── app.module.ts              # Root module
│   ├── common/
│   │   └── interfaces/            # Shared TypeScript interfaces
│   ├── config/
│   │   ├── config.module.ts       # Environment & taxonomy
│   │   ├── schemas/
│   │   │   └── env.schema.ts      # Environment validation
│   │   └── taxonomy/
│   │       └── taxonomy.service.ts # Task taxonomy loader
│   ├── storage/
│   │   ├── storage.module.ts
│   │   └── adapters/
│   │       ├── sqlite.adapter.ts  # SQLite implementation
│   │       └── postgres.adapter.ts # PostgreSQL implementation
│   ├── task-provider/
│   │   ├── task-provider.module.ts
│   │   └── todoist/
│   │       ├── todoist.module.ts
│   │       ├── todoist.provider.ts # ITaskProvider implementation
│   │       └── todoist.client.ts
│   ├── task/
│   │   ├── task.module.ts
│   │   ├── services/
│   │   │   ├── sync.service.ts         # Todoist sync
│   │   │   ├── enrichment.service.ts   # Metadata enrichment
│   │   │   └── reconciliation.service.ts # Conflict detection
│   │   └── dto/                        # Data transfer objects
│   ├── ai/
│   │   ├── ai.module.ts
│   │   ├── services/
│   │   │   ├── claude.service.ts       # Claude API wrapper
│   │   │   ├── operations.service.ts   # AI operations
│   │   │   └── learning.service.ts     # Pattern learning
│   │   └── prompts/
│   │       └── prompts.service.ts      # AI prompts
│   ├── mcp/
│   │   ├── mcp.module.ts
│   │   ├── services/
│   │   │   └── mcp-server.service.ts   # MCP server
│   │   ├── decorators/
│   │   │   └── mcp-tool.decorator.ts   # Tool decorators
│   │   └── tools/
│   │       ├── task.tools.ts           # Task MCP tools
│   │       ├── ai.tools.ts             # AI MCP tools
│   │       └── agent.tools.ts          # Agentic processor
│   └── cli/
│       ├── cli.module.ts
│       └── commands/
│           ├── sync.command.ts
│           ├── list.command.ts
│           ├── classify.command.ts
│           └── ... (7 commands total)
├── test/
│   ├── unit/                      # Unit tests
│   ├── integration/               # Integration tests
│   ├── e2e/                       # End-to-end tests
│   ├── mocks/                     # Mock implementations
│   ├── fixtures/                  # Test data
│   └── utils/                     # Test utilities
├── config/                        # Shared taxonomy YAML
├── data/                          # SQLite database (if used)
├── migrations/                    # Database migrations
├── Dockerfile                     # Production Docker image
├── docker-compose.yml             # Docker Compose setup
└── package.json
```

### Key Design Patterns

1. **Dependency Injection** - NestJS DI throughout
2. **Interface Abstraction** - `ITaskProvider`, `IStorageAdapter`
3. **Decorator Pattern** - MCP tools, CLI commands
4. **Factory Pattern** - Storage adapter selection
5. **Strategy Pattern** - AI operations
6. **Repository Pattern** - Data access layer

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation.

## 🛠️ Development

### Setup Development Environment

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Run in watch mode
pnpm start:dev

# Run tests in watch mode
pnpm test:watch

# Lint code
pnpm lint

# Format code
pnpm format
```

### Adding a New Feature

1. Create module structure: `nest g module feature`
2. Add service: `nest g service feature`
3. Define DTOs in `dto/` folder
4. Write unit tests
5. Update documentation

### Code Style

- **TypeScript Strict Mode** - All code must pass strict TypeScript checks
- **ESLint** - Follow configured ESLint rules
- **Prettier** - Auto-format on save
- **No `any` types** - Use proper typing throughout
- **Documentation** - JSDoc comments for all public APIs

## 🧪 Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run unit tests
pnpm test:unit

# Run integration tests
pnpm test:integration

# Run e2e tests
pnpm test:e2e

# Test coverage
pnpm test:cov

# Watch mode
pnpm test:watch
```

### Test Structure

```
test/
├── unit/                     # Isolated unit tests
│   ├── storage/
│   ├── task/
│   └── ai/
├── integration/              # Module boundary tests
│   ├── task-module.spec.ts
│   └── ai-module.spec.ts
├── e2e/                      # End-to-end workflows
│   ├── cli/
│   └── mcp/
├── mocks/                    # Mock implementations
│   ├── storage.mock.ts
│   ├── task-provider.mock.ts
│   └── claude.mock.ts
├── fixtures/                 # Test data
│   └── tasks.fixture.ts
└── utils/                    # Test helpers
    └── test-module.builder.ts
```

**Current Test Coverage:** ~40% (target: 80%+)

See [TEST_SUMMARY.md](./TEST_SUMMARY.md) for detailed test documentation.

## 🐳 Docker Deployment

### Quick Start

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f mcp-server

# Stop services
docker-compose down
```

### Docker Commands

```bash
# Build image
docker build -t todoist-ai:latest .

# Run MCP server
docker run -d \
  --name todoist-ai \
  -e TODOIST_API_KEY=your_key \
  -e CLAUDE_API_KEY=your_key \
  -v $(pwd)/data:/app/data \
  todoist-ai:latest

# Run CLI command
docker run --rm \
  -e RUN_MODE=cli \
  -e TODOIST_API_KEY=your_key \
  todoist-ai:latest \
  node dist/main sync
```

### Production Deployment

- **GCP Cloud Run** - See [PULUMI.md](./PULUMI.md)
- **AWS ECS/Fargate** - Standard ECS task definition
- **Kubernetes** - Helm chart (coming soon)

See [DOCKER.md](./DOCKER.md) for comprehensive Docker documentation.

## 📚 API Documentation

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Node environment |
| `RUN_MODE` | No | `cli` | `cli` or `mcp` |
| `DATABASE_TYPE` | Yes | `sqlite` | `sqlite` or `postgres` |
| `DATABASE_URL` | Yes | `./data/tasks.db` | Database connection string |
| `TODOIST_API_KEY` | Yes | - | Todoist API key |
| `CLAUDE_API_KEY` | Yes | - | Claude API key |
| `SYNC_INTERVAL` | No | `300000` | Sync interval (ms) |
| `LOG_LEVEL` | No | `info` | Logging level |

### Configuration Files

- **`config/task-taxonomy.yaml`** - Task classification taxonomy
- **`.env`** - Environment variables (not committed)
- **`nest-cli.json`** - NestJS CLI configuration
- **`tsconfig.json`** - TypeScript compiler options

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

### Quick Contribution Guide

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `pnpm test`
5. Commit: `git commit -m 'feat: add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test updates
- `chore:` - Build/tooling changes

## 📖 Migration from Legacy

Migrating from the JavaScript version? See [MIGRATION.md](./MIGRATION.md) for a step-by-step guide.

### Key Changes

- **Language**: JavaScript → TypeScript
- **Framework**: None → NestJS
- **Architecture**: Flat → Modular
- **Testing**: Vitest → Jest
- **Deployment**: None → Docker + Cloud Run

### Data Compatibility

The new version maintains 100% database compatibility with the legacy version. You can:

- Use the same SQLite database
- Run both versions side-by-side
- Migrate incrementally

## 📝 License

MIT License - see [LICENSE](../LICENSE) for details.

## 🙏 Acknowledgments

- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [Anthropic Claude](https://www.anthropic.com/) - AI capabilities
- [Todoist](https://todoist.com/) - Task management platform
- [Model Context Protocol](https://modelcontextprotocol.io/) - AI agent integration

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Email**: your-email@example.com

---

**Built with ❤️ using NestJS and Claude AI**

# Todoist AI Task Manager

An intelligent, AI-powered task management system for Todoist that automatically categorizes, prioritizes, and provides time estimates for your tasks. Built with Claude AI and designed for seamless integration with Cursor via MCP (Model Context Protocol).

## Features

- **🤖 AI-Powered Classification**: Automatically categorizes tasks into life areas (work, home, personal, etc.)
- **⏱️ Smart Time Estimation**: Learns from your history to provide realistic time estimates
- **📊 Intelligent Prioritization**: AI analyzes deadlines, dependencies, and context to suggest priorities
- **🔍 Fuzzy Search Completion**: Complete tasks by typing any part of the task name—no need to remember IDs!
- **📈 Productivity Tracking**: View recent completions and detailed statistics
- **🔄 Real-time Sync**: Background synchronization with Todoist
- **📚 Learning System**: Improves recommendations based on completion patterns
- **💻 CLI Interface**: Full-featured command-line interface
- **🔌 MCP Server**: Integrate with Cursor and other AI assistants (now with completion tools!)
- **☁️ Cloud-Ready**: Supports both SQLite (local) and PostgreSQL (cloud) storage

## Life Area Categories

The system organizes tasks across these life areas:

- **work**: Job-related tasks and projects
- **home-repair**: Aspirational home improvement projects
- **home-maintenance**: Regular home upkeep
- **personal-family**: Groceries, errands, family tasks
- **speaking-gig**: Conference talks and presentations
- **big-ideas**: Long-term personal goals (books, tools, podcasts)
- **inbox-ideas**: Uncategorized ideas waiting for classification

## Installation

### Prerequisites

- Node.js v22 or higher
- pnpm (or npm/yarn)
- Todoist account with API key
- Claude API key (Anthropic)

### Setup

1. **Clone and install**:
```bash
cd /path/to/tasks
pnpm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. **Set up environment variables**:
```bash
# .env
TODOIST_API_KEY=your_todoist_api_key
CLAUDE_API_KEY=your_claude_api_key
DATABASE_TYPE=sqlite
SQLITE_PATH=./data/tasks.db
SYNC_INTERVAL=300000
```

4. **Initialize database and sync**:
```bash
pnpm run cli sync
```

## Usage

### Command Line Interface

The CLI provides comprehensive task management:

```bash
# Sync with Todoist
tasks sync

# List tasks
tasks list
tasks list --category work
tasks list --priority 4

# Show unclassified tasks
tasks inbox

# AI classification
tasks classify --all
tasks classify <taskId>

# AI time estimation
tasks estimate <taskId>

# AI prioritization
tasks prioritize
tasks prioritize --category work

# Break down complex tasks
tasks breakdown <taskId>

# Get daily plan
tasks plan today
tasks plan week

# Search with natural language
tasks search "email tasks"

# Complete tasks
tasks complete <taskId>
tasks complete <taskId> --time 25

# View history and insights
tasks history
tasks history --category work
tasks insights
tasks stats
```

### MCP Server (Cursor Integration)

1. **Start the MCP server**:
```bash
pnpm run mcp
```

2. **Configure Cursor** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "todoist-ai": {
      "command": "node",
      "args": ["/absolute/path/to/tasks/src/mcp/server.js"],
      "env": {
        "TODOIST_API_KEY": "your_key",
        "CLAUDE_API_KEY": "your_key"
      }
    }
  }
}
```

3. **Use in Cursor**:
- The AI assistant can now access your tasks
- Ask: "What are my work tasks for today?"
- Ask: "Prioritize my tasks"
- Ask: "Classify my inbox tasks"

### Programmatic Use

```javascript
import { initialize } from './src/index.js';

const system = await initialize();

// Sync tasks
await system.sync.syncNow();

// Get tasks by category
const workTasks = await system.enrichment.getTasksByCategory('work');

// AI classify new tasks
const unclassified = await system.enrichment.getUnclassifiedTasks();
const results = await system.aiOps.classifyTasks(unclassified);

// Save classifications
for (const result of results) {
  await system.enrichment.enrichTask(result.taskId, {
    category: result.category,
    aiConfidence: result.confidence
  });
}

// Get daily plan
const tasks = await system.storage.getTasks({ completed: false });
const plan = await system.aiOps.suggestDailyPlan(tasks);

console.log('Today:', plan.today);
console.log('Supplies needed:', plan.needsSupplies);

// Cleanup
await system.close();
```

## Architecture

### Storage Layer
- **Abstract Interface**: Unified API for all storage operations
- **SQLite Adapter**: Local development and single-user scenarios
- **PostgreSQL Adapter**: Cloud deployment (GCP Cloud SQL ready)
- **Factory Pattern**: Environment-aware adapter selection

### Todoist Integration
- **Client**: API wrapper with rate limiting and error handling
- **Sync Engine**: Background synchronization with conflict resolution
- **Enrichment**: AI metadata management alongside Todoist data

### AI Layer
- **Agent**: Claude API wrapper with structured JSON parsing
- **Operations**: High-level AI operations (classify, prioritize, estimate)
- **Prompts**: Optimized prompts for task management scenarios
- **Learning**: Historical pattern analysis for improved recommendations

### Interfaces
- **CLI**: Full-featured command-line interface with Commander
- **MCP Server**: Model Context Protocol server for AI assistants

## Configuration

### Database

**SQLite (Local)**:
```env
DATABASE_TYPE=sqlite
SQLITE_PATH=./data/tasks.db
```

**PostgreSQL (Cloud)**:
```env
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://user:password@host:5432/database
```

### Sync Interval

```env
SYNC_INTERVAL=300000  # 5 minutes in milliseconds
```

## Cloud Deployment

### Google Cloud Platform

1. **Cloud SQL (PostgreSQL)**:
```bash
gcloud sql instances create todoist-ai \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1
```

2. **Cloud Run (MCP Server)**:
```bash
gcloud run deploy todoist-ai-mcp \
  --source . \
  --region us-central1 \
  --set-env-vars DATABASE_TYPE=postgres,DATABASE_URL=$DB_URL
```

3. **Cloud Scheduler (Background Sync)**:
```bash
gcloud scheduler jobs create http sync-todoist \
  --schedule="*/5 * * * *" \
  --uri="https://your-service.run.app/sync"
```

## Development

### Project Structure

```
tasks/
├── src/
│   ├── storage/         # Storage abstraction layer
│   │   ├── interface.js
│   │   ├── sqlite.js
│   │   ├── postgres.js
│   │   └── factory.js
│   ├── todoist/         # Todoist integration
│   │   ├── client.js
│   │   ├── sync.js
│   │   └── enrichment.js
│   ├── ai/              # AI operations
│   │   ├── agent.js
│   │   ├── prompts.js
│   │   ├── operations.js
│   │   └── learning.js
│   ├── cli/             # CLI interface
│   │   └── index.js
│   ├── mcp/             # MCP server
│   │   └── server.js
│   └── index.js         # Main entry point
├── data/                # Local SQLite storage
├── package.json
├── .env.example
└── README.md
```

### Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch
```

### Adding New Life Areas

Edit `src/todoist/enrichment.js`:

```javascript
export const LIFE_AREAS = {
  WORK: 'work',
  // ... existing areas ...
  YOUR_AREA: 'your-area'
};
```

Update AI prompts in `src/ai/prompts.js` to include the new category.

## Troubleshooting

### "TODOIST_API_KEY not found"
- Ensure `.env` file exists and contains your Todoist API key
- Get your API key from: https://todoist.com/app/settings/integrations/developer

### "AI operations require CLAUDE_API_KEY"
- Add your Claude API key to `.env`
- Get your API key from: https://console.anthropic.com/

### "Database locked" (SQLite)
- Only one process can write to SQLite at a time
- Stop any running CLI commands or MCP server
- Or use PostgreSQL for multi-process scenarios

### MCP Server not appearing in Cursor
- Check the path in `mcp.json` is absolute
- Restart Cursor after config changes
- Check server logs for errors

## Contributing

This is a personal project, but suggestions and improvements are welcome!

## License

ISC

## Future Enhancements

### Phase 2 Features (Planned)
- **📅 Calendar Integration**: Sync with Google Calendar for time blocking
- **📧 Email Integration**: Draft emails and create tasks from emails
- **🎤 Voice Interface**: Voice commands via Web Speech API
- **📱 Progressive Web App**: Mobile access and voice interaction
- **🔍 Advanced Learning**: Vector database (Pinecone) for semantic search
- **🌐 Chrome Extension**: Always-visible side panel with tasks

## Author

Built with ❤️ for personal productivity and AI-assisted task management.


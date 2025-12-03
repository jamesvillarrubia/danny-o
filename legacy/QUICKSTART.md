# Quick Start Guide

Get up and running with the Todoist AI Task Manager in 5 minutes.

## Step 1: Get API Keys

### Todoist API Key
1. Go to https://todoist.com/app/settings/integrations/developer
2. Scroll to "API token"
3. Copy your token

### Claude API Key
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new key

## Step 2: Configure

1. Create your `.env` file:
```bash
cp .env.example .env
```

2. Edit `.env` with your keys:
```env
TODOIST_API_KEY=your_todoist_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here
DATABASE_TYPE=sqlite
SQLITE_PATH=./data/tasks.db
SYNC_INTERVAL=300000
```

## Step 3: First Sync

Sync your Todoist tasks to the local database:

```bash
pnpm run cli sync
```

Expected output:
```
🔄 Syncing with Todoist...

✅ Sync complete!
   Tasks: 42
   Projects: 8
   Labels: 15
   New tasks: 42
```

## Step 4: See Your Tasks

```bash
pnpm run cli list
```

You'll see your tasks with any existing categories and time estimates.

## Step 5: Let AI Classify Your Tasks

```bash
pnpm run cli classify --all
```

The AI will analyze each task and assign it to a life area category (work, home, personal, etc.).

## Step 6: Get Time Estimates

```bash
pnpm run cli list
```

Now you'll see AI-generated time estimates next to each task!

## Step 7: Get Your Daily Plan

```bash
pnpm run cli plan today
```

The AI will suggest which tasks to do today, what needs supplies, what can be delegated, etc.

## Common Commands

### Daily Workflow

```bash
# Morning: Get your plan
pnpm run cli plan today

# Throughout the day: Complete tasks
pnpm run cli complete <task-id>

# Evening: Review insights
pnpm run cli insights
```

### Task Management

```bash
# See unclassified tasks
pnpm run cli inbox

# Search for something
pnpm run cli search "email to send"

# Get priorities
pnpm run cli prioritize --category work

# Break down a complex task
pnpm run cli breakdown <task-id>
```

### Analytics

```bash
# View completion history
pnpm run cli history

# See patterns and insights
pnpm run cli insights

# Check stats
pnpm run cli stats
```

## Using with Cursor

1. Add to `~/.cursor/mcp.json`:
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

2. Restart Cursor

3. In Cursor, ask the AI:
   - "What are my tasks for today?"
   - "Classify my unorganized tasks"
   - "What should I prioritize?"
   - "Show me my work tasks"

## Troubleshooting

### No tasks showing up?
Run `pnpm run cli sync` first to fetch from Todoist.

### "API key not found"?
Check that your `.env` file exists and has the correct keys.

### Want to reset everything?
```bash
rm -rf data/tasks.db
pnpm run cli sync
```

## Next Steps

- Read the full [README.md](README.md) for advanced features
- Set up background sync
- Deploy to the cloud (optional)
- Add calendar integration (Phase 2)

## Tips

1. **Run sync regularly**: Either manually or set up a cron job
2. **Use natural language search**: It's very powerful
3. **Track actual time**: Use `--time` when completing tasks to improve estimates
4. **Review insights weekly**: Learn your patterns and improve

Enjoy your AI-powered task management! 🚀


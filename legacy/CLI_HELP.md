# CLI Command Reference

## Getting Help

```bash
# Main help menu
pnpm run cli --help

# Help for specific command
pnpm run cli <command> --help

# Examples:
pnpm run cli taxonomy --help
pnpm run cli suggestions --help
pnpm run cli complete --help
```

## Common Commands

### Sync & View Tasks

```bash
# Sync with Todoist
pnpm run cli sync

# List all tasks
pnpm run cli list

# List with filters
pnpm run cli list --completed
pnpm run cli list --filter "meeting"
pnpm run cli list --limit 10

# Show unclassified tasks
pnpm run cli inbox
```

### AI Operations

```bash
# Classify all unclassified tasks
pnpm run cli classify --all

# Classify specific task
pnpm run cli classify <taskId>

# Get time estimate
pnpm run cli estimate <taskId>

# Prioritize tasks
pnpm run cli prioritize

# Break down complex task
pnpm run cli breakdown <taskId>

# Get daily/weekly plan
pnpm run cli plan today
pnpm run cli plan week

# Process raw text (paste task lists)
pnpm run cli process-text
pnpm run cli process-text --text "Call mom, Buy groceries"
pnpm run cli process-text --file tasks.txt
```

### Task Completion

```bash
# Complete by ID
pnpm run cli complete <taskId>

# Complete with fuzzy search
pnpm run cli complete "vendor reg"

# Complete with time tracking
pnpm run cli complete <taskId> --time 30

# View recent completions
pnpm run cli completed
pnpm run cli completed --limit 10

# View productivity stats
pnpm run cli productivity
pnpm run cli productivity --days 30
```

### Search & History

```bash
# Natural language search
pnpm run cli search "tasks about MIT"

# View completion history
pnpm run cli history
pnpm run cli history --limit 50

# Get AI insights
pnpm run cli insights

# Show enrichment statistics
pnpm run cli stats
```

### Taxonomy Management

```bash
# View taxonomy
pnpm run cli taxonomy              # Summary
pnpm run cli taxonomy --projects   # List projects
pnpm run cli taxonomy --labels     # List labels
pnpm run cli taxonomy --stats      # Statistics
pnpm run cli taxonomy --validate   # Validate YAML

# Sync to Todoist
pnpm run cli taxonomy --sync                 # Full sync (projects + labels)
pnpm run cli taxonomy --sync --dry-run       # Preview changes
pnpm run cli taxonomy --sync-projects        # Projects only
pnpm run cli taxonomy --sync-labels          # Labels only
pnpm run cli taxonomy --update-colors        # Update project colors
pnpm run cli taxonomy --update-colors --dry-run  # Preview color updates
```

### AI Suggestions

```bash
# View pending suggestions
pnpm run cli suggestions --list

# View approved suggestions
pnpm run cli suggestions --approved

# Show statistics
pnpm run cli suggestions --stats

# Review a suggestion
pnpm run cli suggestions --review <id> --type <project|label>

# Approve a suggestion
pnpm run cli suggestions --approve <id> --type <project|label>
pnpm run cli suggestions --approve <id> --type project --notes "Great idea!"

# Defer a suggestion
pnpm run cli suggestions --defer <id> --type <project|label>

# Ignore a suggestion
pnpm run cli suggestions --ignore <id> --type <project|label>

# Promote to YAML
pnpm run cli suggestions --promote <id> --type <project|label>
```

### Testing & Debugging

```bash
# Test available Claude models
pnpm run cli models

# Show AI classification prompt
pnpm run cli taxonomy --prompt
```

## Command Reference by Category

### 📥 Data Management

| Command | Description |
|---------|-------------|
| `sync` | Sync tasks from Todoist |
| `list` | List cached tasks with filters |
| `inbox` | Show unclassified tasks |

### 🤖 AI Operations

| Command | Description |
|---------|-------------|
| `classify` | AI classify tasks into projects |
| `estimate` | AI time estimation |
| `prioritize` | AI task prioritization |
| `breakdown` | Break down complex tasks |
| `plan` | Get daily/weekly plan |
| `process-text` | Process raw text (paste lists) |
| `search` | Natural language search |

### ✅ Task Actions

| Command | Description |
|---------|-------------|
| `complete` | Mark task complete (ID or fuzzy search) |
| `completed` | View recent completions |
| `productivity` | Show completion statistics |
| `history` | View completion history |
| `insights` | Get AI productivity insights |
| `stats` | Show enrichment statistics |

### 🏷️ Taxonomy

| Command | Description |
|---------|-------------|
| `taxonomy` | Inspect configuration |
| `taxonomy --projects` | List all projects |
| `taxonomy --labels` | List all labels |
| `taxonomy --validate` | Validate YAML |
| `taxonomy --sync` | Sync to Todoist |
| `taxonomy --update-colors` | Update project colors |

### 💡 AI Suggestions

| Command | Description |
|---------|-------------|
| `suggestions --list` | View pending suggestions |
| `suggestions --approved` | View approved suggestions |
| `suggestions --review <id>` | Review suggestion |
| `suggestions --approve <id>` | Approve suggestion |
| `suggestions --promote <id>` | Promote to YAML |

## Common Workflows

### Initial Setup

```bash
# 1. Edit your taxonomy
vim config/task-taxonomy.yaml

# 2. Validate it
pnpm run cli taxonomy --validate

# 3. Sync to Todoist (preview first)
pnpm run cli taxonomy --sync --dry-run
pnpm run cli taxonomy --sync

# 4. Sync tasks to local cache
pnpm run cli sync

# 5. Classify tasks
pnpm run cli classify --all
```

### Daily Task Review

```bash
# 1. Sync latest from Todoist
pnpm run cli sync

# 2. Check inbox (unclassified)
pnpm run cli inbox

# 3. Get AI plan for today
pnpm run cli plan today

# 4. View prioritized tasks
pnpm run cli prioritize

# 5. Complete tasks as you go
pnpm run cli complete "task name" --time 30
```

### End of Week Review

```bash
# 1. View what you completed
pnpm run cli completed --limit 20

# 2. Check productivity stats
pnpm run cli productivity --days 7

# 3. Get AI insights
pnpm run cli insights

# 4. Review AI suggestions
pnpm run cli suggestions --list
```

### Adding to Taxonomy

```bash
# Option 1: Let AI suggest (over time)
pnpm run cli suggestions --list
pnpm run cli suggestions --approve <id> --type project
pnpm run cli suggestions --promote <id> --type project

# Option 2: Manual addition
# 1. Edit YAML
vim config/task-taxonomy.yaml

# 2. Validate
pnpm run cli taxonomy --validate

# 3. Sync to Todoist
pnpm run cli taxonomy --sync
```

### Processing Bulk Input

```bash
# Paste or type multiple tasks
pnpm run cli process-text

# From a file
pnpm run cli process-text --file tasks.txt

# Direct text
pnpm run cli process-text --text "
- Call dentist
- Buy groceries
- Review PR #123
"

# AI will intelligently:
# - Create new tasks
# - Update existing tasks
# - Complete tasks
# - Ask questions if unclear
```

## Tips & Tricks

### Fuzzy Task Completion

```bash
# Don't remember exact task name?
pnpm run cli complete "vend"
# Finds: "Register with vendor portal"

# Multiple matches? Add more context
pnpm run cli complete "vendor reg"
```

### Quick Task Search

```bash
# Natural language
pnpm run cli search "tasks about MIT"
pnpm run cli search "urgent work tasks"
pnpm run cli search "things due this week"
```

### Time Tracking

```bash
# Track how long tasks actually take
pnpm run cli complete <id> --time 45
pnpm run cli complete <id> --time 30

# AI learns from this for better estimates!
```

### Dry Run Everything

```bash
# Always preview changes first
pnpm run cli taxonomy --sync --dry-run
pnpm run cli taxonomy --update-colors --dry-run

# Then apply
pnpm run cli taxonomy --sync
```

### Combine Filters

```bash
# List with multiple filters
pnpm run cli list --filter "meeting" --limit 5
pnpm run cli history --limit 20
pnpm run cli completed --limit 10
```

## Environment Variables

Set in `.env`:

```bash
TODOIST_API_KEY=your_key_here          # Required: Todoist API access
CLAUDE_API_KEY=your_key_here           # Required: Claude AI
CLAUDE_MODEL=claude-3-5-sonnet-20241022  # Optional: Specify model
SYNC_INTERVAL=300000                   # Optional: Auto-sync interval (ms)
CACHE_PATH=./data/tasks.db             # Optional: SQLite path
```

## Keyboard Shortcuts (Terminal)

When using interactive commands:
- `Ctrl+C` - Cancel/exit
- `Ctrl+D` - End input (for process-text)
- `q` - Quit (for long output with pagers)

## Getting More Help

```bash
# General help
pnpm run cli --help

# Command-specific help
pnpm run cli <command> --help

# Check documentation
cat ARCHITECTURE.md
cat SUGGESTION_WORKFLOW.md
cat TAXONOMY_SYNC.md
```

## Troubleshooting

### "Command not found"
```bash
# Make sure you're in the project directory
cd /Users/james/Sites/personal/tasks

# Check pnpm is installed
pnpm --version
```

### "API key not found"
```bash
# Check your .env file
cat .env

# Should have:
TODOIST_API_KEY=...
CLAUDE_API_KEY=...
```

### "No tasks found"
```bash
# Sync first
pnpm run cli sync

# Then try your command
pnpm run cli list
```

### "Invalid taxonomy"
```bash
# Validate your YAML
pnpm run cli taxonomy --validate

# Check for syntax errors in config/task-taxonomy.yaml
```

---

**Quick Reference Card**

```
Most Used Commands:
├─ pnpm run cli sync              # Sync with Todoist
├─ pnpm run cli list              # View tasks
├─ pnpm run cli inbox             # Unclassified tasks
├─ pnpm run cli classify --all    # AI classify all
├─ pnpm run cli plan today        # Get daily plan
├─ pnpm run cli complete "task"   # Complete task
├─ pnpm run cli completed         # Recent completions
├─ pnpm run cli productivity      # Stats
├─ pnpm run cli suggestions --list # AI suggestions
└─ pnpm run cli --help            # This help!
```


# Migration Guide: JavaScript → NestJS TypeScript

This guide helps you migrate from the legacy JavaScript version to the new NestJS TypeScript implementation.

## Table of Contents

- [Overview](#overview)
- [Why Migrate?](#why-migrate)
- [Pre-Migration Checklist](#pre-migration-checklist)
- [Migration Strategies](#migration-strategies)
- [Step-by-Step Migration](#step-by-step-migration)
- [Code Changes](#code-changes)
- [Troubleshooting](#troubleshooting)
- [Rollback Plan](#rollback-plan)

## Overview

### What's Changing

| Aspect | Legacy (JS) | New (NestJS + TS) |
|--------|-------------|-------------------|
| Language | JavaScript | TypeScript |
| Framework | None | NestJS 10+ |
| Package Manager | npm/yarn | pnpm (recommended) |
| Node Version | 18+ | 22+ |
| Testing | Vitest | Jest + @nestjs/testing |
| Module System | CommonJS | ES Modules |
| Configuration | Manual | ConfigModule + validation |
| CLI | Custom | nestjs-commander |
| MCP Server | Custom | Decorator-based |

### What's NOT Changing

✅ **Database schema** - 100% compatible  
✅ **Todoist API integration** - Same functionality  
✅ **Claude AI prompts** - Same logic  
✅ **Task taxonomy** - Same YAML file  
✅ **MCP tools** - Same interface  
✅ **CLI commands** - Same interface  

## Why Migrate?

### Benefits

1. **Type Safety** - Catch errors at compile time
2. **Better IDE Support** - Autocomplete, refactoring
3. **Scalability** - Modular architecture
4. **Testing** - Comprehensive test infrastructure
5. **Maintainability** - Clear module boundaries
6. **Performance** - Better optimization
7. **Production Ready** - Docker, health checks
8. **Future Proof** - Modern stack, active ecosystem

### Trade-offs

- **Learning Curve** - NestJS + TypeScript concepts
- **Build Step** - TypeScript compilation required
- **Complexity** - More files and structure
- **Dependencies** - Larger node_modules

## Pre-Migration Checklist

### 1. Backup Your Data

```bash
# Backup SQLite database
cp data/tasks.db data/tasks.db.backup-$(date +%Y%m%d)

# Backup config
cp -r config config.backup
```

### 2. Document Your Customizations

- [ ] Custom task categories in `task-taxonomy.yaml`
- [ ] Environment variable overrides
- [ ] Custom CLI commands
- [ ] Custom MCP tools
- [ ] Database migrations

### 3. Test Current Setup

```bash
# Verify legacy version works
cd legacy
npm run sync
npm run list
npm run classify
```

### 4. Check Node Version

```bash
# Upgrade to Node 22
nvm install 22
nvm use 22

# Verify
node --version  # Should be 22.x
```

### 5. Install pnpm

```bash
npm install -g pnpm
pnpm --version
```

## Migration Strategies

### Strategy 1: Side-by-Side (Recommended)

**Run both versions simultaneously during transition.**

**Pros:**
- Zero downtime
- Validate behavior matches
- Easy rollback
- Gradual transition

**Cons:**
- Both use same database (read-only mode for one)
- Slightly more resource usage

```bash
# Use shared database (read-only for legacy)
legacy/ → reads from data/tasks.db
nest/ → writes to data/tasks.db

# Or use separate databases during testing
legacy/ → data/tasks-legacy.db
nest/ → data/tasks-new.db
```

### Strategy 2: Clean Cutover

**Switch entirely to new version at once.**

**Pros:**
- Simpler
- No conflicts
- Clean break

**Cons:**
- Higher risk
- Requires thorough testing
- Harder to rollback

### Strategy 3: Feature-by-Feature

**Migrate one feature at a time.**

**Pros:**
- Lowest risk
- Easy to test each feature
- Can mix versions

**Cons:**
- Most time-consuming
- Complex coordination

## Step-by-Step Migration

### Phase 1: Setup (30 minutes)

#### 1.1 Clone and Install

```bash
# Already in tasks/ directory
cd nest

# Install dependencies
pnpm install

# Verify build works
pnpm build
```

#### 1.2 Configure Environment

```bash
# Copy your existing environment variables
cp ../legacy/.env .env

# Update for NestJS if needed
# DATABASE_TYPE, DATABASE_URL should work as-is
```

#### 1.3 Test Build

```bash
# Build TypeScript
pnpm build

# Verify output
ls -la dist/
```

### Phase 2: Data Migration (10 minutes)

#### 2.1 Use Existing Database

```bash
# Option A: Use same database (recommended)
# Just point DATABASE_URL to existing DB
DATABASE_URL=../legacy/data/tasks.db

# Option B: Copy database
cp ../legacy/data/tasks.db ./data/tasks.db
```

#### 2.2 Verify Data

```bash
# Test data access
node dist/main list

# Should show your existing tasks
```

### Phase 3: Feature Validation (1-2 hours)

#### 3.1 Test Core Features

```bash
# Sync with Todoist
node dist/main sync

# List tasks
node dist/main list
node dist/main list --category work

# Classify tasks
node dist/main classify

# Complete a task
node dist/main complete <task-id>

# Daily plan
node dist/main plan today
```

#### 3.2 Test MCP Server

```bash
# Start MCP server
RUN_MODE=mcp node dist/main

# Test with Cursor or Claude
# Add as MCP server in your IDE
```

#### 3.3 Compare Outputs

```bash
# Run same command in both versions
cd ../legacy && npm run list > /tmp/legacy-output.txt
cd ../nest && node dist/main list > /tmp/nest-output.txt

# Compare (should be identical except formatting)
diff /tmp/legacy-output.txt /tmp/nest-output.txt
```

### Phase 4: Transition (15 minutes)

#### 4.1 Update Scripts

If you have automation scripts, update paths:

```bash
# Old
cd tasks/legacy && npm run sync

# New
cd tasks/nest && node dist/main sync
```

#### 4.2 Update MCP Configuration

If using Cursor/IDE with MCP:

```json
// Old MCP config
{
  "mcpServers": {
    "todoist": {
      "command": "node",
      "args": ["legacy/src/mcp/server.js"]
    }
  }
}

// New MCP config
{
  "mcpServers": {
    "todoist": {
      "command": "node",
      "args": ["nest/dist/main.js"]
      "env": {
        "RUN_MODE": "mcp"
      }
    }
  }
}
```

#### 4.3 Archive Legacy

Once confident:

```bash
# Rename legacy folder
mv legacy legacy-archived-$(date +%Y%m%d)

# Or delete if you're brave
# rm -rf legacy
```

## Code Changes

### Importing Modules

```javascript
// Legacy (CommonJS)
const { syncWithTodoist } = require('./todoist/sync');

// New (ES Modules + TypeScript)
import { SyncService } from './task/services/sync.service';
```

### Environment Variables

```javascript
// Legacy
const apiKey = process.env.TODOIST_API_KEY;

// New (with validation)
import { ConfigService } from '@nestjs/config';

constructor(private config: ConfigService) {}

const apiKey = this.config.get<string>('TODOIST_API_KEY');
```

### Database Access

```javascript
// Legacy
const storage = require('./storage/sqlite');
const tasks = await storage.getTasks({ completed: false });

// New (with DI)
import { IStorageAdapter } from './common/interfaces';

constructor(
  @Inject('IStorageAdapter') 
  private storage: IStorageAdapter
) {}

const tasks = await this.storage.getTasks({ completed: false });
```

### AI Operations

```javascript
// Legacy
const { classifyTask } = require('./ai/operations');
const result = await classifyTask(task);

// New (with DI)
import { AIOperationsService } from './ai/services';

constructor(private aiOps: AIOperationsService) {}

const result = await this.aiOps.classifyTask(task);
```

### Custom MCP Tools

```javascript
// Legacy (manual registration)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      { name: 'my_tool', description: '...', inputSchema: {...} }
    ]
  };
});

// New (decorator-based)
import { MCPToolHandler } from './mcp/decorators';

@Injectable()
export class MyTool {
  @MCPToolHandler({
    name: 'my_tool',
    description: '...',
    inputSchema: MyToolDto
  })
  async execute(@Args('arg') arg: string) {
    // Implementation
  }
}
```

### Custom CLI Commands

```javascript
// Legacy (manual parsing)
if (process.argv[2] === 'mytask') {
  await doMyTask();
}

// New (decorator-based)
import { Command, CommandRunner } from 'nest-commander';

@Command({ name: 'mytask', description: 'My custom task' })
export class MyTaskCommand extends CommandRunner {
  async run() {
    await this.doMyTask();
  }
}
```

## Troubleshooting

### Issue: Module Not Found

```bash
Error: Cannot find module '@nestjs/common'
```

**Solution:**
```bash
pnpm install
pnpm build
```

### Issue: Database Locked

```
SqliteError: database is locked
```

**Solution:**
- Stop the legacy version
- Or use separate databases
- Or run legacy in read-only mode

### Issue: TypeScript Errors

```
TS2322: Type 'string' is not assignable to type 'number'
```

**Solution:**
- Check DTOs and interfaces
- Use proper types
- Don't use `any`

### Issue: Environment Variables Not Loaded

```
Error: TODOIST_API_KEY is required
```

**Solution:**
```bash
# Make sure .env exists in nest/
cp .env.example .env

# Or set directly
export TODOIST_API_KEY=your_key
```

### Issue: Tests Failing

```bash
# Clear cache
pnpm test --clearCache

# Rebuild
rm -rf dist
pnpm build

# Run tests
pnpm test
```

## Rollback Plan

If you need to rollback:

### 1. Stop New Version

```bash
# If running as service
docker-compose down

# If running in terminal
Ctrl+C
```

### 2. Restore Legacy

```bash
# If archived
mv legacy-archived-* legacy

# Verify
cd legacy
npm install
npm run sync
```

### 3. Restore Database (if needed)

```bash
# If you made a backup
cp data/tasks.db.backup-20240101 data/tasks.db
```

### 4. Report Issues

Open an issue on GitHub with:
- Error messages
- Steps to reproduce
- Environment details

## Post-Migration

### 1. Monitor Performance

```bash
# Check sync times
time node dist/main sync

# Check memory usage
docker stats todoist-ai-mcp

# Check logs
docker-compose logs -f
```

### 2. Validate Data Integrity

```bash
# Compare task counts
SELECT COUNT(*) FROM tasks;

# Check recent changes
SELECT * FROM tasks ORDER BY updated_at DESC LIMIT 10;
```

### 3. Clean Up

```bash
# Remove legacy backup (after 30 days)
rm -rf legacy-archived-*

# Remove old logs
rm -rf legacy/logs
```

## Getting Help

- **Documentation**: See [README.md](./README.md), [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)

## Next Steps

After successful migration:

1. ✅ Explore new features (health checks, metrics)
2. ✅ Set up Docker deployment
3. ✅ Configure CI/CD
4. ✅ Add custom features
5. ✅ Contribute back to the project

---

**Migration completed?** 🎉 Welcome to the NestJS TypeScript version!


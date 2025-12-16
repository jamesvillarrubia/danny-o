# Migration to PGlite - Summary

## What Changed

Danny Tasks has been migrated from SQLite to **PGlite** (embedded PostgreSQL), transforming it into a production-ready self-hosted SaaS application.

## Key Improvements

### 1. Database Architecture
- **Before**: SQLite (local) + PostgreSQL (prod) with type mismatches
- **After**: PGlite (embedded Postgres) OR PostgreSQL (remote) - perfect compatibility

### 2. Self-Hosting Ready
- **Setup Wizard**: First-run configuration via web UI
- **Zero Config**: Works out-of-box with embedded database
- **Easy Upgrade**: Can switch to cloud Postgres anytime

### 3. Auto-Update System
- Automatic migrations on startup
- Backup-before-update strategy
- Version tracking in database
- Configurable update behavior

### 4. One-Click Deployment
- **Railway**: `railway.json` config
- **Render**: `render.yaml` config  
- **Docker**: Single command (`docker-compose up`)
- **GitHub Packages**: Automated Docker image builds

## Architecture Changes

### Removed
- ❌ `better-sqlite3` dependency
- ❌ SQLite-specific code paths
- ❌ `api/scripts/db-tools.ts` (JSON export/import system)
- ❌ `db:push`, `db:pull`, `db:export`, `db:import` npm scripts
- ❌ SQLite/Postgres type conditionals (`isPg ? 'jsonb' : 'text'`)

### Added
- ✅ `@electric-sql/pglite` - Embedded Postgres
- ✅ `api/src/setup/` - Setup wizard backend
- ✅ `api/src/updates/` - Version management
- ✅ `api/src/backups/` - Backup service
- ✅ `web/src/pages/Setup.tsx` - Setup wizard UI
- ✅ `app_config` table - Application configuration storage
- ✅ Auto-backup and migration on startup
- ✅ Encryption utilities for sensitive config

### Modified
- 🔄 `api/src/storage/adapters/kysely.adapter.ts` - PGlite support
- 🔄 `api/src/storage/storage.module.ts` - PGlite detection
- 🔄 `api/src/main.ts` - Auto-update bootstrap
- 🔄 `api/Dockerfile` - Removed SQLite build deps
- 🔄 `web/src/App.tsx` - Setup check gate
- 🔄 All type conditionals - Now use Postgres syntax exclusively

## New Files

### Configuration
- `railway.json` - Railway deployment config
- `render.yaml` - Render deployment config
- `docker-compose.yml` - Full stack Docker setup
- `.github/workflows/docker-release.yml` - Automated Docker builds

### Code
- `api/src/setup/setup.service.ts` - Setup logic
- `api/src/setup/setup.controller.ts` - Setup API
- `api/src/setup/setup.module.ts` - Setup module
- `api/src/updates/version.service.ts` - Version management
- `api/src/updates/updates.module.ts` - Updates module
- `api/src/backups/backup.service.ts` - Backup logic
- `api/src/backups/backups.module.ts` - Backups module
- `api/src/common/utils/encryption.util.ts` - Encryption helpers
- `web/src/pages/Setup.tsx` - Setup wizard UI

### Docker
- `web/Dockerfile` - Web frontend container
- `web/nginx.conf` - Nginx configuration for SPA

### Documentation
- `SELF_HOSTING.md` - Comprehensive self-hosting guide
- Updated `README.md` - Deploy buttons and simplified instructions
- Updated `api/DEPLOYMENT.md` - PGlite architecture

## Breaking Changes

### For Existing Users

**If you're currently using SQLite:**

Your existing data is not automatically migrated. To migrate:

1. **Don't update yet** - Your current SQLite data is at `~/.danny/data/tasks.db`
2. **Option A**: Keep using SQLite
   - Don't pull these changes
   - Or revert to previous version
3. **Option B**: Migrate to PGlite
   - Backup your SQLite database
   - PGlite is Postgres-compatible, direct migration not trivial
   - Recommended: Sync fresh from Todoist after upgrade

**If you're already using PostgreSQL:**

No action needed! The migration is seamless. Just pull and restart.

### Environment Variables

**Renamed:**
- `SQLITE_PATH` → `PGLITE_PATH`
- `DATABASE_TYPE` → Removed (auto-detected)

**New:**
- `AUTO_UPDATE` - Enable/disable auto-migrations (default: true)
- `BACKUP_BEFORE_UPDATE` - Backup before migrations (default: true)
- `BACKUP_RETENTION_DAYS` - Backup retention (default: 30)
- `ENCRYPTION_SECRET` - For encrypting stored API keys

### npm Scripts

**Removed:**
- `pnpm migrate` - Migrations now auto-run on startup
- `pnpm db:export` - Use native pg_dump or file copy
- `pnpm db:import` - Use native psql or file copy
- `pnpm db:push` - No longer needed (same DB type everywhere)
- `pnpm db:pull` - No longer needed (same DB type everywhere)

**Kept:**
- `pnpm start:dev` - Start with embedded PGlite
- `pnpm start:dev:prod` - Start with remote Postgres (prod)
- `pnpm start:dev:dev` - Start with remote Postgres (dev)

## Benefits of This Migration

### 1. Dev/Prod Parity
- Same database everywhere (PostgreSQL)
- No more type conversion issues
- No more "works locally but fails in prod"

### 2. Simplified Architecture
- One database adapter, not two
- No dialect conditionals in queries
- Cleaner, more maintainable code

### 3. Better Self-Hosting
- Zero-config default (embedded PGlite)
- Setup wizard for non-technical users
- Easy upgrade path to cloud database

### 4. Professional Distribution
- Docker images on GitHub Packages
- One-click deploy buttons
- Auto-update mechanism

### 5. Security
- Encrypted API key storage
- Backup-before-update safety
- Configurable update behavior

## What's Next

### Required for Testing
1. Install new dependencies: `pnpm install`
2. Delete old SQLite database (optional fresh start)
3. Start app - setup wizard will appear
4. Complete setup with API keys

### Optional Enhancements
- Add setup wizard to Settings panel for reconfiguration
- Implement database upgrade UI (embedded → cloud)
- Add backup/restore UI in dashboard
- Create migration helper for existing SQLite users

## Technical Details

### PGlite Integration
- Uses PGlite's Pool-compatible interface
- PostgresDialect works with both PGlite and remote Postgres
- Data stored in directory structure (not single .db file)

### Interface Improvements
- Added config methods to `IStorageAdapter`
- No more `(storage as any).getDb()` hacks
- Proper abstraction maintained
- Services use interface methods only

### Encryption
- AES-256-GCM for API keys
- Key derived from `ENCRYPTION_SECRET`
- Format: `iv:authTag:encryptedData`

## Testing the Migration

```bash
# Clean install
rm -rf node_modules ~/.danny
pnpm install

# Start API
cd api && pnpm start:http

# Visit http://localhost:3000/api/setup/status
# Should return: { setupCompleted: false, appVersion: "2.0.0", databaseType: "pglite" }

# Start web
cd web && pnpm dev

# Visit http://localhost:5173
# Should show setup wizard
```

## Rollback Plan

If issues arise:

```bash
# Revert to previous commit
git revert HEAD

# Or checkout previous version
git checkout <previous-commit>

# Reinstall dependencies
pnpm install

# Your old SQLite data is still at ~/.danny/data/tasks.db
```


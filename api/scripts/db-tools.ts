#!/usr/bin/env tsx
/**
 * Database Tools CLI
 *
 * Provides utilities for exporting, importing, and syncing data between
 * local SQLite and production PostgreSQL databases.
 *
 * Commands:
 *   export  - Export database to JSON file
 *   import  - Import JSON file into database
 *   push    - Push local SQLite data to production PostgreSQL
 *   pull    - Pull production PostgreSQL data to local SQLite
 *
 * Usage:
 *   pnpm db:export [--output backup.json]
 *   pnpm db:import --input backup.json [--mode merge|replace] [--force]
 *   pnpm db:push [--target prod|dev]
 *   pnpm db:pull [--source prod|dev]
 */

import 'dotenv/config';
import { Kysely, SqliteDialect, PostgresDialect, sql } from 'kysely';
import BetterSqlite3 from 'better-sqlite3';
import { Pool } from 'pg';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';

import { Database } from '../src/storage/database.types';

// ============================================================================
// Types
// ============================================================================

type DatabaseDialect = 'sqlite' | 'postgres';

interface ConnectionConfig {
  dialect: DatabaseDialect;
  sqlitePath?: string;
  connectionString?: string;
}

interface ExportData {
  version: string;
  exportedAt: string;
  sourceDialect: DatabaseDialect;
  migrations: Array<{ id: string; applied_at: string }>;
  tables: {
    tasks: any[];
    task_metadata: any[];
    task_history: any[];
    projects: any[];
    labels: any[];
    views: any[];
    sync_state: any[];
    ai_interactions: any[];
    cached_insights: any[];
  };
}

// Tables to export/import (order matters for foreign key constraints)
const DATA_TABLES = [
  'projects',
  'labels',
  'tasks',
  'task_metadata',
  'task_history',
  'views',
  'sync_state',
  'ai_interactions',
  'cached_insights',
] as const;

// ============================================================================
// Database Connection
// ============================================================================

function getLocalConfig(): ConnectionConfig {
  const defaultPath = join(homedir(), '.danny', 'data', 'tasks.db');
  const sqlitePath = process.env.SQLITE_PATH || defaultPath;
  return { dialect: 'sqlite', sqlitePath };
}

function getProductionConfig(target: 'prod' | 'dev' = 'prod'): ConnectionConfig {
  // Check for explicit DATABASE_URL first
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && (envUrl.startsWith('postgres://') || envUrl.startsWith('postgresql://'))) {
    return { dialect: 'postgres', connectionString: envUrl };
  }

  // Check for target-specific env vars
  const targetUrl = target === 'prod' 
    ? process.env.PROD_DATABASE_URL 
    : process.env.DEV_DATABASE_URL;

  if (targetUrl) {
    return { dialect: 'postgres', connectionString: targetUrl };
  }

  throw new Error(
    `No database URL configured for ${target}. Set DATABASE_URL, PROD_DATABASE_URL, or DEV_DATABASE_URL.`
  );
}

async function createConnection(config: ConnectionConfig): Promise<Kysely<Database>> {
  if (config.dialect === 'sqlite') {
    if (!config.sqlitePath) {
      throw new Error('SQLite path required');
    }

    // Ensure directory exists
    const dir = dirname(config.sqlitePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const sqliteDb = new BetterSqlite3(config.sqlitePath);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');

    return new Kysely<Database>({
      dialect: new SqliteDialect({ database: sqliteDb }),
    });
  } else {
    if (!config.connectionString) {
      throw new Error('PostgreSQL connection string required');
    }

    const pool = new Pool({
      connectionString: config.connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    const db = new Kysely<Database>({
      dialect: new PostgresDialect({ pool }),
    });

    // Test connection
    await sql`SELECT 1`.execute(db);
    return db;
  }
}

// ============================================================================
// Export
// ============================================================================

async function exportDatabase(
  db: Kysely<Database>,
  dialect: DatabaseDialect
): Promise<ExportData> {
  console.log('📤 Exporting database...\n');

  // Get migrations for compatibility checking
  const migrations = await db
    .selectFrom('migrations')
    .selectAll()
    .orderBy('id', 'asc')
    .execute();

  console.log(`  Migrations: ${migrations.length} applied`);

  const tables: ExportData['tables'] = {
    tasks: [],
    task_metadata: [],
    task_history: [],
    projects: [],
    labels: [],
    views: [],
    sync_state: [],
    ai_interactions: [],
    cached_insights: [],
  };

  for (const table of DATA_TABLES) {
    const rows = await db.selectFrom(table as any).selectAll().execute();
    (tables as any)[table] = rows;
    console.log(`  ${table}: ${rows.length} rows`);
  }

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    sourceDialect: dialect,
    migrations: migrations.map((m) => ({ id: m.id, applied_at: m.applied_at })),
    tables,
  };
}

// ============================================================================
// Import
// ============================================================================

async function importDatabase(
  db: Kysely<Database>,
  data: ExportData,
  mode: 'merge' | 'replace',
  force: boolean
): Promise<void> {
  console.log('📥 Importing database...\n');

  // Check migration compatibility
  const currentMigrations = await db
    .selectFrom('migrations')
    .select('id')
    .orderBy('id', 'asc')
    .execute();

  const currentIds = currentMigrations.map((m) => m.id);
  const sourceIds = data.migrations.map((m) => m.id);

  // Check if migrations match
  const missingInTarget = sourceIds.filter((id) => !currentIds.includes(id));
  const missingInSource = currentIds.filter((id) => !sourceIds.includes(id));

  if (missingInTarget.length > 0 || missingInSource.length > 0) {
    console.log('\n⚠️  Migration mismatch detected:');
    if (missingInTarget.length > 0) {
      console.log(`  Source has migrations not in target: ${missingInTarget.join(', ')}`);
    }
    if (missingInSource.length > 0) {
      console.log(`  Target has migrations not in source: ${missingInSource.join(', ')}`);
    }

    if (!force) {
      throw new Error(
        'Schema mismatch. Run migrations on both databases first, or use --force to override.'
      );
    }
    console.log('  --force flag set, proceeding anyway...\n');
  } else {
    console.log(`  ✓ Migration compatibility verified (${currentIds.length} migrations)\n`);
  }

  if (mode === 'replace') {
    console.log('  Mode: REPLACE (clearing existing data)\n');

    // Delete in reverse order to respect foreign keys
    for (const table of [...DATA_TABLES].reverse()) {
      await db.deleteFrom(table as any).execute();
      console.log(`  Cleared: ${table}`);
    }
  } else {
    console.log('  Mode: MERGE (upserting data)\n');
  }

  // Import in order (respects foreign keys)
  for (const table of DATA_TABLES) {
    const rows = (data.tables as any)[table];
    if (!rows || rows.length === 0) {
      console.log(`  ${table}: 0 rows (skipped)`);
      continue;
    }

    let imported = 0;
    for (const row of rows) {
      try {
        if (mode === 'replace') {
          // Direct insert (table was cleared)
          await db.insertInto(table as any).values(row).execute();
        } else {
          // Upsert - try insert, on conflict update
          const primaryKey = getPrimaryKey(table);
          await db
            .insertInto(table as any)
            .values(row)
            .onConflict((oc) => oc.column(primaryKey as any).doUpdateSet(row))
            .execute();
        }
        imported++;
      } catch (err: any) {
        console.error(`  Error importing ${table} row:`, err.message);
      }
    }
    console.log(`  ${table}: ${imported}/${rows.length} rows imported`);
  }

  console.log('\n✅ Import complete');
}

function getPrimaryKey(table: string): string {
  switch (table) {
    case 'task_metadata':
      return 'task_id';
    case 'sync_state':
      return 'key';
    default:
      return 'id';
  }
}

// ============================================================================
// Push / Pull
// ============================================================================

async function pushToRemote(target: 'prod' | 'dev', force: boolean): Promise<void> {
  console.log(`\n🚀 Pushing local data to ${target}...\n`);

  // Connect to local SQLite
  const localConfig = getLocalConfig();
  console.log(`  Local: ${localConfig.sqlitePath}`);
  const localDb = await createConnection(localConfig);

  // Connect to remote PostgreSQL
  const remoteConfig = getProductionConfig(target);
  console.log(`  Remote: PostgreSQL (${target})\n`);
  const remoteDb = await createConnection(remoteConfig);

  try {
    // Export from local
    const data = await exportDatabase(localDb, 'sqlite');

    // Import to remote
    console.log('\n');
    await importDatabase(remoteDb, data, 'replace', force);
  } finally {
    await localDb.destroy();
    await remoteDb.destroy();
  }
}

async function pullFromRemote(source: 'prod' | 'dev', force: boolean): Promise<void> {
  console.log(`\n⬇️  Pulling data from ${source} to local...\n`);

  // Connect to remote PostgreSQL
  const remoteConfig = getProductionConfig(source);
  console.log(`  Remote: PostgreSQL (${source})`);
  const remoteDb = await createConnection(remoteConfig);

  // Connect to local SQLite
  const localConfig = getLocalConfig();
  console.log(`  Local: ${localConfig.sqlitePath}\n`);
  const localDb = await createConnection(localConfig);

  try {
    // Export from remote
    const data = await exportDatabase(remoteDb, 'postgres');

    // Import to local
    console.log('\n');
    await importDatabase(localDb, data, 'replace', force);
  } finally {
    await remoteDb.destroy();
    await localDb.destroy();
  }
}

// ============================================================================
// CLI Utilities
// ============================================================================

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        result[key] = nextArg;
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

function printUsage(): void {
  console.log(`
Database Tools CLI

Commands:
  export    Export database to JSON file
  import    Import JSON file into database
  push      Push local SQLite data to production PostgreSQL
  pull      Pull production PostgreSQL data to local SQLite

Usage:
  pnpm db:export [--output <file>]
      Export current database to JSON. Default: ./backups/backup-<timestamp>.json

  pnpm db:import --input <file> [--mode merge|replace] [--force]
      Import JSON file into current database.
      --mode merge   : Upsert records (default)
      --mode replace : Clear tables before import
      --force        : Ignore migration mismatches

  pnpm db:push [--target prod|dev] [--force] [--yes]
      Push local SQLite data to remote PostgreSQL.
      --target : prod (default) or dev
      --force  : Ignore migration mismatches
      --yes    : Skip confirmation prompt

  pnpm db:pull [--source prod|dev] [--force] [--yes]
      Pull remote PostgreSQL data to local SQLite.
      --source : prod (default) or dev
      --force  : Ignore migration mismatches
      --yes    : Skip confirmation prompt

Environment Variables:
  DATABASE_URL      : Primary database connection (used for export/import)
  PROD_DATABASE_URL : Production PostgreSQL URL (for push/pull)
  DEV_DATABASE_URL  : Development PostgreSQL URL (for push/pull)
  SQLITE_PATH       : Local SQLite path (default: ~/.danny/data/tasks.db)
`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;
  const args = parseArgs(rest);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printUsage();
    process.exit(0);
  }

  try {
    switch (command) {
      case 'export': {
        // Determine which database to export from
        const databaseUrl = process.env.DATABASE_URL;
        let config: ConnectionConfig;
        let dialect: DatabaseDialect;

        if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
          config = { dialect: 'postgres', connectionString: databaseUrl };
          dialect = 'postgres';
          console.log('Exporting from PostgreSQL...');
        } else {
          config = getLocalConfig();
          dialect = 'sqlite';
          console.log(`Exporting from SQLite: ${config.sqlitePath}`);
        }

        const db = await createConnection(config);

        try {
          const data = await exportDatabase(db, dialect);

          // Determine output path
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const defaultOutput = `./backups/backup-${timestamp}.json`;
          const output = (args.output as string) || defaultOutput;

          // Ensure directory exists
          const outputDir = dirname(output);
          if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true });
          }

          writeFileSync(output, JSON.stringify(data, null, 2));
          console.log(`\n✅ Exported to: ${output}`);
        } finally {
          await db.destroy();
        }
        break;
      }

      case 'import': {
        const input = args.input as string;
        if (!input) {
          console.error('Error: --input <file> is required');
          process.exit(1);
        }

        if (!existsSync(input)) {
          console.error(`Error: File not found: ${input}`);
          process.exit(1);
        }

        const mode = (args.mode as 'merge' | 'replace') || 'merge';
        const force = args.force === true;

        // Read export data
        const data: ExportData = JSON.parse(readFileSync(input, 'utf-8'));
        console.log(`\nImporting from: ${input}`);
        console.log(`  Exported at: ${data.exportedAt}`);
        console.log(`  Source: ${data.sourceDialect}`);

        // Determine target database
        const databaseUrl = process.env.DATABASE_URL;
        let config: ConnectionConfig;

        if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
          config = { dialect: 'postgres', connectionString: databaseUrl };
          console.log(`  Target: PostgreSQL\n`);
        } else {
          config = getLocalConfig();
          console.log(`  Target: SQLite (${config.sqlitePath})\n`);
        }

        const db = await createConnection(config);

        try {
          await importDatabase(db, data, mode, force);
        } finally {
          await db.destroy();
        }
        break;
      }

      case 'push': {
        const target = (args.target as 'prod' | 'dev') || 'prod';
        const force = args.force === true;
        const yes = args.yes === true;

        if (!yes) {
          const confirmed = await confirm(
            `⚠️  This will REPLACE all data in ${target} database. Continue?`
          );
          if (!confirmed) {
            console.log('Aborted.');
            process.exit(0);
          }
        }

        await pushToRemote(target, force);
        break;
      }

      case 'pull': {
        const source = (args.source as 'prod' | 'dev') || 'prod';
        const force = args.force === true;
        const yes = args.yes === true;

        if (!yes) {
          const confirmed = await confirm(
            `⚠️  This will REPLACE your local database with ${source} data. Continue?`
          );
          if (!confirmed) {
            console.log('Aborted.');
            process.exit(0);
          }
        }

        await pullFromRemote(source, force);
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (err: any) {
    console.error(`\n❌ Error: ${err.message}`);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

main();

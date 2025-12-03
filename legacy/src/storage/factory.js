/**
 * Storage Factory
 * 
 * Environment-aware factory that selects and initializes the appropriate
 * storage adapter based on configuration. Enables seamless switching between
 * SQLite (local development) and PostgreSQL (cloud deployment).
 * 
 * Usage:
 *   const storage = await createStorage();
 *   const tasks = await storage.getTasks();
 */

import { SQLiteAdapter } from './sqlite.js';
import { PostgresAdapter } from './postgres.js';
import { resolve } from 'path';

/**
 * Create and initialize a storage adapter based on environment configuration
 * @param {Object} config - Configuration object
 * @param {string} [config.type] - Database type ('sqlite' or 'postgres')
 * @param {string} [config.sqlitePath] - Path to SQLite database file
 * @param {string} [config.databaseUrl] - PostgreSQL connection string
 * @returns {Promise<StorageAdapter>} Initialized storage adapter
 * @throws {Error} If configuration is invalid or initialization fails
 */
export async function createStorage(config = {}) {
  // Determine database type from config or environment
  const dbType = config.type || process.env.DATABASE_TYPE || 'sqlite';

  let adapter;

  if (dbType === 'sqlite') {
    // SQLite configuration
    const sqlitePath = config.sqlitePath 
      || process.env.SQLITE_PATH 
      || resolve(process.cwd(), 'data', 'tasks.db');

    console.log(`[Storage] Initializing SQLite adapter at ${sqlitePath}`);
    adapter = new SQLiteAdapter(sqlitePath);
  } 
  else if (dbType === 'postgres' || dbType === 'postgresql') {
    // PostgreSQL configuration
    const databaseUrl = config.databaseUrl || process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error(
        'PostgreSQL selected but no DATABASE_URL provided. ' +
        'Set DATABASE_URL environment variable or pass databaseUrl in config.'
      );
    }

    console.log('[Storage] Initializing PostgreSQL adapter');
    adapter = new PostgresAdapter(databaseUrl);
  }
  else {
    throw new Error(
      `Unknown database type: ${dbType}. ` +
      'Supported types are "sqlite" and "postgres".'
    );
  }

  // Initialize the adapter (create schema, connect, etc.)
  try {
    await adapter.initialize();
    console.log('[Storage] Adapter initialized successfully');
    return adapter;
  } catch (error) {
    console.error('[Storage] Failed to initialize adapter:', error);
    throw new Error(`Storage initialization failed: ${error.message}`);
  }
}

/**
 * Validate storage configuration without initializing
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validation result
 * @returns {boolean} return.valid - Whether config is valid
 * @returns {string} [return.error] - Error message if invalid
 * @returns {string} return.type - Database type that would be used
 */
export function validateStorageConfig(config = {}) {
  const dbType = config.type || process.env.DATABASE_TYPE || 'sqlite';

  if (dbType !== 'sqlite' && dbType !== 'postgres' && dbType !== 'postgresql') {
    return {
      valid: false,
      error: `Invalid database type: ${dbType}`,
      type: dbType
    };
  }

  if ((dbType === 'postgres' || dbType === 'postgresql')) {
    const databaseUrl = config.databaseUrl || process.env.DATABASE_URL;
    if (!databaseUrl) {
      return {
        valid: false,
        error: 'PostgreSQL requires DATABASE_URL',
        type: dbType
      };
    }
  }

  return {
    valid: true,
    type: dbType
  };
}


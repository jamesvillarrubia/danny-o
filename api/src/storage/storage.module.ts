/**
 * Storage Module
 * 
 * Provides unified Kysely storage adapter that works with both SQLite (dev) and PostgreSQL (prod).
 */

import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { homedir } from 'os';
import { join } from 'path';
import { KyselyAdapter, DatabaseDialect } from './adapters/kysely.adapter';
import { IStorageAdapter } from '../common/interfaces/storage-adapter.interface';

const logger = new Logger('StorageModule');

@Global()
@Module({
  providers: [
    {
      provide: 'IStorageAdapter',
      useFactory: async (configService: ConfigService): Promise<IStorageAdapter> => {
        // Determine which database to use based on DATABASE_ENV
        // Values: 'prod', 'dev', or unset (defaults to SQLite)
        const databaseEnv = configService.get<string>('DATABASE_ENV');
        let databaseUrl: string | undefined;

        if (databaseEnv === 'prod') {
          databaseUrl = configService.get<string>('PROD_DATABASE_URL');
          logger.log('Using PRODUCTION database (PROD_DATABASE_URL)');
        } else if (databaseEnv === 'dev') {
          databaseUrl = configService.get<string>('DEV_DATABASE_URL');
          logger.log('Using DEVELOPMENT database (DEV_DATABASE_URL)');
        } else if (databaseEnv) {
          logger.warn(`Unknown DATABASE_ENV="${databaseEnv}", falling back to SQLite`);
        }

        // Determine dialect
        let dialect: DatabaseDialect;
        
        if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
          dialect = 'postgres';
        } else {
          dialect = 'sqlite';
          if (!databaseEnv) {
            logger.log('Using SQLite database (local)');
          }
        }

        let adapter: KyselyAdapter;

        if (dialect === 'postgres') {
          if (!databaseUrl) {
            throw new Error(`DATABASE_URL is required for PostgreSQL (DATABASE_ENV="${databaseEnv}")`);
          }
          adapter = new KyselyAdapter({
            dialect: 'postgres',
            connectionString: databaseUrl,
          });
        } else {
          // Default to user's home directory: ~/.danny/data/tasks.db
          const defaultPath = join(homedir(), '.danny', 'data', 'tasks.db');
          const sqlitePath = configService.get<string>('SQLITE_PATH', defaultPath);
          adapter = new KyselyAdapter({
            dialect: 'sqlite',
            sqlitePath,
          });
        }

        await adapter.initialize();
        return adapter;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['IStorageAdapter'],
})
export class StorageModule {}

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
        const databaseUrl = configService.get<string>('DATABASE_URL');
        
        // Determine dialect from DATABASE_URL or DATABASE_TYPE
        let dialect: DatabaseDialect;
        
        if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
          dialect = 'postgres';
          logger.log('Using PostgreSQL database (Neon)');
        } else {
          dialect = 'sqlite';
          logger.log('Using SQLite database (local)');
        }

        let adapter: KyselyAdapter;

        if (dialect === 'postgres') {
          if (!databaseUrl) {
            throw new Error('DATABASE_URL is required for PostgreSQL');
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

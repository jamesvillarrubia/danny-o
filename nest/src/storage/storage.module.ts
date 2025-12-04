/**
 * Storage Module
 * 
 * Provides storage adapter with factory pattern for SQLite or PostgreSQL.
 */

import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { homedir } from 'os';
import { join } from 'path';
import { SQLiteAdapter } from './adapters/sqlite.adapter';
import { PostgresAdapter } from './adapters/postgres.adapter';
import { IStorageAdapter } from '../common/interfaces/storage-adapter.interface';

@Global()
@Module({
  providers: [
    {
      provide: 'IStorageAdapter',
      useFactory: async (configService: ConfigService): Promise<IStorageAdapter> => {
        const databaseType = configService.get<string>('DATABASE_TYPE', 'sqlite');

        let adapter: IStorageAdapter;

        if (databaseType === 'postgres') {
          const databaseUrl = configService.get<string>('DATABASE_URL');
          if (!databaseUrl) {
            throw new Error('DATABASE_URL is required for PostgreSQL');
          }
          adapter = new PostgresAdapter(databaseUrl);
        } else {
          // Default to user's home directory: ~/.danny/data/tasks.db
          // This ensures danny CLI works from any directory
          const defaultPath = join(homedir(), '.danny', 'data', 'tasks.db');
          const sqlitePath = configService.get<string>('SQLITE_PATH', defaultPath);
          adapter = new SQLiteAdapter(sqlitePath);
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


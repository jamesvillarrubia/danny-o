/**
 * Storage Module
 * 
 * Provides unified Kysely storage adapter that works with both PGlite (embedded) and PostgreSQL (remote).
 */

import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
        
        // Determine dialect from DATABASE_URL
        let dialect: DatabaseDialect;
        
        if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
          dialect = 'postgres';
          logger.log('Using PostgreSQL database (remote)');
        } else {
          dialect = 'pglite';
          logger.log('Using embedded PGlite database (local)');
        }

        let adapter: KyselyAdapter;

        if (dialect === 'postgres') {
          if (!databaseUrl) {
            throw new Error('DATABASE_URL is required for remote PostgreSQL');
          }
          adapter = new KyselyAdapter({
            dialect: 'postgres',
            connectionString: databaseUrl,
          });
        } else {
          // Default to ./data/tasks.db (PGlite embedded Postgres)
          const defaultPath = './data/tasks.db';
          const pglitePath = configService.get<string>('PGLITE_PATH', defaultPath);
          adapter = new KyselyAdapter({
            dialect: 'pglite',
            pglitePath,
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

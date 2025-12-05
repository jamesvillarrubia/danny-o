/**
 * Task Provider Module
 * 
 * Provides access to task management providers for Todoist:
 * - ITaskProvider: REST API provider for write operations (create, update, delete)
 * - ITodoistSyncProvider: Sync API provider for efficient bulk reads
 * 
 * The Sync API dramatically reduces API calls by fetching all data in one request,
 * while the REST API is used for individual write operations.
 * 
 * @see https://developer.todoist.com/api/v1#tag/Sync
 */

import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TodoistProvider } from './todoist/todoist.provider';
import { TodoistSyncProvider } from './todoist/todoist-sync.provider';

const logger = new Logger('TaskProviderModule');

@Global()
@Module({
  providers: [
    /**
     * REST API provider for write operations
     * Used for: createTask, updateTask, closeTask, addComment, etc.
     */
    {
      provide: 'ITaskProvider',
      useFactory: (configService: ConfigService) => {
        const todoistApiKey = configService.get<string>('TODOIST_API_KEY');
        if (!todoistApiKey) {
          throw new Error('TODOIST_API_KEY is required');
        }
        return new TodoistProvider(todoistApiKey);
      },
      inject: [ConfigService],
    },
    /**
     * Sync API provider for efficient bulk read operations
     * Used for: fetching all tasks, projects, labels, and comments in a single request
     * 
     * Benefits:
     * - Single API call instead of 3+ separate calls
     * - Includes ALL comments (eliminates N+1 problem)
     * - Supports incremental sync via sync_token
     */
    {
      provide: 'ITodoistSyncProvider',
      useFactory: (configService: ConfigService) => {
        const todoistApiKey = configService.get<string>('TODOIST_API_KEY');
        if (!todoistApiKey) {
          logger.warn('TODOIST_API_KEY not set - Sync API provider disabled');
          return null;
        }
        logger.log('Todoist Sync API provider enabled for efficient bulk fetching');
        return new TodoistSyncProvider(todoistApiKey);
      },
      inject: [ConfigService],
    },
  ],
  exports: ['ITaskProvider', 'ITodoistSyncProvider'],
})
export class TaskProviderModule {}

/**
 * Task Provider Module
 * 
 * Provides access to task management provider (Todoist).
 * Can be extended to support multiple providers in the future.
 */

import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TodoistProvider } from './todoist/todoist.provider';

@Global()
@Module({
  providers: [
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
  ],
  exports: ['ITaskProvider'],
})
export class TaskProviderModule {}


/**
 * Complete Command
 * 
 * Mark a task as complete (supports fuzzy search).
 */

import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable, Inject } from '@nestjs/common';
import { IStorageAdapter } from '../../common/interfaces';
import { SyncService } from '../../task/services/sync.service';

interface CompleteOptions {
  time?: number;
}

@Injectable()
@Command({
  name: 'complete',
  description: 'Mark a task as complete',
  arguments: '<taskIdOrSearch>',
  argsDescription: {
    taskIdOrSearch: 'Task ID or search text to find task',
  },
})
export class CompleteCommand extends CommandRunner {
  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
    @Inject(SyncService) private readonly syncService: SyncService,
  ) {
    super();
  }

  async run(passedParams: string[], options?: CompleteOptions): Promise<void> {
    try {
      const searchTerm = passedParams[0];
      if (!searchTerm) {
        console.error('❌ Please provide a task ID or search term');
        process.exit(1);
      }

      // Try exact ID match first
      let task = await this.storage.getTask(searchTerm);

      // If not found by ID, fuzzy search
      if (!task) {
        const allTasks = await this.storage.getTasks({ completed: false });
        const matches = allTasks.filter(
          (t) =>
            t.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase())),
        );

        if (matches.length === 0) {
          console.error(`❌ No tasks found matching "${searchTerm}"`);
          process.exit(1);
        }

        if (matches.length === 1) {
          task = matches[0];
        } else {
          console.log(`❓ Multiple matches found for "${searchTerm}":\n`);
          for (let i = 0; i < matches.length; i++) {
            const t = matches[i];
            console.log(`${i + 1}. ${t.content}`);
            console.log(`   ID: ${t.id}`);
            console.log(`   Category: ${t.metadata?.category || 'inbox'}`);
            console.log('');
          }
          console.log('Please use a more specific search term or the exact task ID.');
          process.exit(0);
        }
      }

      // Complete the task
      const metadata: any = {};
      if (options?.time) {
        metadata.actualDuration = options.time;
      }

      await this.syncService.completeTask(task.id, metadata);

      console.log(`✅ Completed: ${task.content}`);
      if (options?.time) {
        console.log(`   Time: ${options.time} minutes`);
      }
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  @Option({
    flags: '-t, --time <minutes>',
    description: 'Actual time taken in minutes',
  })
  parseTime(val: string): number {
    return parseInt(val, 10);
  }
}


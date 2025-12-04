/**
 * Respond Command
 * 
 * Check for @danny mentions in task comments and respond to them.
 */

import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable, Inject } from '@nestjs/common';
import { IStorageAdapter, Task } from '../../common/interfaces';
import { AIOperationsService } from '../../ai/services/operations.service';
import { SyncService } from '../../task/services/sync.service';

interface RespondOptions {
  taskId?: string;
}

@Injectable()
@Command({
  name: 'respond',
  description: 'Check for @danny mentions in comments and respond',
})
export class RespondCommand extends CommandRunner {
  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
    @Inject(AIOperationsService) private readonly aiOps: AIOperationsService,
    @Inject(SyncService) private readonly sync: SyncService,
  ) {
    super();
  }

  async run(passedParams: string[], options?: RespondOptions): Promise<void> {
    try {
      console.log('💬 Checking for @danny mentions...\n');

      let tasks: Task[];
      
      // If specific task ID provided, only check that task
      if (options?.taskId) {
        const task = await this.storage.getTask(options.taskId);
        if (!task) {
          console.error(`❌ Task ${options.taskId} not found in local storage`);
          console.error('💡 Try running `danny sync` first');
          process.exit(1);
        }
        tasks = [task];
        console.log(`Checking task: "${task.content}"`);
      } else {
        // Get all active tasks
        tasks = await this.storage.getTasks({ completed: false });
        console.log(`Found ${tasks.length} active tasks`);
        console.log('⚠️  Warning: Checking all tasks may hit rate limits. Use --task-id for specific tasks.\n');
      }

      // Fetch comments for tasks
      console.log('📥 Fetching comments...');
      const tasksWithComments = await this.sync.fetchCommentsForTasks(tasks);
      
      // Count how many tasks have comments
      const tasksWithCommentCount = tasksWithComments.filter(t => t.comments && t.comments.length > 0).length;
      console.log(`${tasksWithCommentCount} tasks have comments`);

      // Find and respond to @danny mentions
      const mentionResults = await this.aiOps.respondToMentions(tasksWithComments);

      const responded = mentionResults.filter((r) => r.responded);

      if (responded.length === 0) {
        console.log('\n✅ No @danny mentions found in task comments');
        return;
      }

      console.log(`\n💬 Found ${responded.length} @danny mention(s). Responding...\n`);

      for (const result of responded) {
        const task = tasksWithComments.find((t) => t.id === result.taskId);
        if (task && result.comment) {
          console.log(`📝 Task: "${task.content}"`);
          console.log(`   Response: "${result.comment}"`);
          
          // Actually add the comment to Todoist
          await this.sync.addCommentToTask(task.id, result.comment);
          
          console.log('   ✅ Comment added\n');
        }
      }

      console.log(`\n✅ Complete! Responded to ${responded.length} mention(s)`);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  @Option({
    flags: '-t, --task-id <taskId>',
    description: 'Check a specific task by ID',
  })
  parseTaskId(val: string): string {
    return val;
  }
}


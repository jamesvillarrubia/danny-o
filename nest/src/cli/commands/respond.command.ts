/**
 * Respond Command
 * 
 * Check for @danny mentions in task comments and respond to them.
 */

import { Command, CommandRunner } from 'nest-commander';
import { Injectable, Inject } from '@nestjs/common';
import { IStorageAdapter } from '../../common/interfaces';
import { AIOperationsService } from '../../ai/services/operations.service';
import { SyncService } from '../../task/services/sync.service';

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

  async run(): Promise<void> {
    try {
      console.log('💬 Checking for @danny mentions...\n');

      // Get all active tasks
      const tasks = await this.storage.getTasks({ completed: false });
      console.log(`Found ${tasks.length} active tasks`);

      // Fetch comments for all tasks
      console.log('📥 Fetching comments...');
      const tasksWithComments = await this.sync.fetchCommentsForTasks(tasks);

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
}


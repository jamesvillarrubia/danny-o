/**
 * Prioritize Command
 * 
 * Get AI-powered prioritization recommendations.
 */

import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable, Inject } from '@nestjs/common';
import { IStorageAdapter, ITaskProvider } from '../../common/interfaces';
import { AIOperationsService } from '../../ai/services/operations.service';

interface PrioritizeOptions {
  category?: string;
  limit?: number;
  apply?: boolean; // Actually update priorities/dates in Todoist
}

@Injectable()
@Command({
  name: 'prioritize',
  description: 'Get AI prioritization recommendations',
})
export class PrioritizeCommand extends CommandRunner {
  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
    @Inject('ITaskProvider') private readonly taskProvider: ITaskProvider,
    @Inject(AIOperationsService) private readonly aiOps: AIOperationsService,
  ) {
    super();
  }

  async run(passedParams: string[], options?: PrioritizeOptions): Promise<void> {
    try {
      console.log('🎯 AI Prioritization\n');

      const tasks = await this.storage.getTasks({
        category: options?.category,
        limit: options?.limit || 20,
        completed: false,
      });

      if (tasks.length === 0) {
        console.log('📭 No tasks to prioritize.');
        return;
      }

      const result = await this.aiOps.prioritizeTasks(tasks);

      console.log('📊 Recommended Order:\n');

      for (let i = 0; i < result.prioritized.length; i++) {
        const item: any = result.prioritized[i];
        const task = item.task; // Extract the nested task object
        console.log(`${i + 1}. ${task.content}`);
        console.log(`   Category: ${task.metadata?.category || 'inbox'}`);
        console.log(`   Current Priority: P${task.priority || 1}`);
        if (item.priority) {
          console.log(`   Suggested Priority: ${item.priority}`);
        }
        if (item.reasoning) {
          console.log(`   ${item.reasoning}`);
        }
        console.log('');
      }

      if (result.recommendations) {
        console.log('\n💡 General Recommendations:\n');
        console.log(JSON.stringify(result.recommendations, null, 2));
      }

      // Apply changes to Todoist if --apply flag is set
      if (options?.apply) {
        console.log('\n🔄 Applying priorities to Todoist...\n');
        await this.applyPriorities(result.prioritized);
        console.log('\n✅ Priorities updated in Todoist!');
      } else {
        console.log('\n💡 Tip: Use --apply to actually update these priorities in Todoist');
      }
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Apply prioritization changes to Todoist
   */
  private async applyPriorities(prioritized: any[]): Promise<void> {
    for (const item of prioritized) {
      const task = item.task;
      const updates: any = {};

      // Skip archived tasks
      if (item.priority === 'archive') {
        console.log(`  🗄️  ${task.content} → Marked for archival`);
        continue;
      }

      // Update priority if different
      if (item.todoistPriority && task.priority !== item.todoistPriority) {
        updates.priority = item.todoistPriority;
        console.log(`  📌 ${task.content}`);
        console.log(`     Priority: P${5 - task.priority} → P${5 - item.todoistPriority}`);
      }

      // Update due date if suggested
      if (item.suggestedDueDate) {
        updates.dueString = item.suggestedDueDate;
        console.log(`     Due: ${item.suggestedDueDate}`);
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        try {
          await this.taskProvider.updateTask(task.id, updates);
          // Update local storage too
          await this.storage.updateTask(task.id, updates as any);
        } catch (error: any) {
          console.error(`     ❌ Failed: ${error.message}`);
        }
      }
    }
  }

  @Option({
    flags: '-c, --category <category>',
    description: 'Prioritize within category',
  })
  parseCategory(val: string): string {
    return val;
  }

  @Option({
    flags: '-l, --limit <limit>',
    description: 'Number of tasks to analyze',
  })
  parseLimit(val: string): number {
    return parseInt(val, 10);
  }

  @Option({
    flags: '--apply',
    description: 'Actually update priorities and due dates in Todoist',
  })
  parseApply(): boolean {
    return true;
  }
}


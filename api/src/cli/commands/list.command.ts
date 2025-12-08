/**
 * List Command
 * 
 * Lists tasks with optional filtering.
 */

import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable, Inject } from '@nestjs/common';
import { IStorageAdapter } from '../../common/interfaces';

interface ListOptions {
  category?: string;
  priority?: number;
  limit?: number;
}

@Injectable()
@Command({
  name: 'list',
  description: 'List tasks',
  aliases: ['ls'],
})
export class ListCommand extends CommandRunner {
  constructor(@Inject('IStorageAdapter') private readonly storage: IStorageAdapter) {
    super();
  }

  async run(passedParams: string[], options?: ListOptions): Promise<void> {
    try {
      const tasks = await this.storage.getTasks({
        category: options?.category,
        priority: options?.priority,
        limit: options?.limit || 1000,
        completed: false,
      });

      if (tasks.length === 0) {
        console.log('📭 No tasks found.');
        return;
      }

      console.log(`\n📋 ${tasks.length} Task(s):\n`);

      for (const task of tasks) {
        const category = task.metadata?.category || 'inbox';
        const priority = task.priority || 1;
        const priorityEmoji = ['', '🔹', '🔸', '🔺', '🔴'][priority];

        console.log(`${priorityEmoji} ${task.content}`);
        console.log(`   ID: ${task.id}`);
        console.log(`   Category: ${category}`);
        if (task.description) {
          console.log(`   ${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}`);
        }
        if (task.labels && task.labels.length > 0) {
          console.log(`   Labels: ${task.labels.join(', ')}`);
        }
        if (task.due) {
          console.log(`   Due: ${task.due.date}${task.due.string ? ` (${task.due.string})` : ''}`);
        }
        console.log('');
      }
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  @Option({
    flags: '-c, --category <category>',
    description: 'Filter by category',
  })
  parseCategory(val: string): string {
    return val;
  }

  @Option({
    flags: '-p, --priority <priority>',
    description: 'Filter by priority (1-4)',
  })
  parsePriority(val: string): number {
    return parseInt(val, 10);
  }

  @Option({
    flags: '-l, --limit <limit>',
    description: 'Maximum number of tasks',
  })
  parseLimit(val: string): number {
    return parseInt(val, 10);
  }
}


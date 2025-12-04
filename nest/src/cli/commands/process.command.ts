/**
 * Process Command
 * 
 * Process natural language commands and text with AI agent.
 * Examples:
 *   danny "archive the Minz Round task"
 *   danny "create a task to review PRs"
 *   danny process --text "mark all shopping tasks as complete"
 */

import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TaskProcessorAgent } from '../../ai/task-processor/task-processor.agent';

interface ProcessOptions {
  maxTurns?: number;
}

@Injectable()
@Command({
  name: 'process',
  description: 'Process natural language commands with AI',
  arguments: '[text]',
  argsDescription: {
    text: 'Natural language command to process',
  },
})
export class ProcessCommand extends CommandRunner {
  constructor(
    @Inject(TaskProcessorAgent)
    private readonly processor: TaskProcessorAgent,
    @Inject(ConfigService)
    private readonly config: ConfigService,
  ) {
    super();
  }

  async run(passedParams: string[], options?: ProcessOptions): Promise<void> {
    try {
      const text = passedParams.join(' ');

      if (!text || text.trim().length === 0) {
        console.error('❌ Please provide a command to process');
        console.error('\nExamples:');
        console.error('  danny "archive the Minz Round task"');
        console.error('  danny "create a task to review PRs"');
        console.error('  danny "mark all shopping tasks as complete"');
        console.error('  danny "list tasks" --max-turns 10');
        process.exit(1);
      }

      console.log('🤖 Processing with AI agent...\n');

      // Get max turns: CLI option > env var > default (5)
      const maxTurns = options?.maxTurns 
        || this.config.get<number>('TASK_PROCESSOR_MAX_TURNS') 
        || 5;

      const result = await this.processor.processText(text, { 
        context: 'cli',
        maxTurns,
      });

      if (result.success) {
        console.log('\n' + result.message);
        if (result.turns && result.turns > 1) {
          console.log(`\n(Processed in ${result.turns} AI turn(s))`);
        }
      } else {
        console.error('\n❌ ' + result.message);
        process.exit(1);
      }
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  @Option({
    flags: '--max-turns <number>',
    description: 'Maximum number of AI turns (default: from env or 5)',
  })
  parseMaxTurns(val: string): number {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1) {
      throw new Error('max-turns must be a positive integer');
    }
    return num;
  }
}


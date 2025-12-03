/**
 * Plan Command
 * 
 * Get AI-generated daily/weekly plan.
 */

import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable, Inject } from '@nestjs/common';
import { IStorageAdapter } from '../../common/interfaces';
import { AIOperationsService } from '../../ai/services/operations.service';

interface PlanOptions {
  hours?: number;
}

@Injectable()
@Command({
  name: 'plan',
  description: 'Get AI daily/weekly plan',
  arguments: '<timeframe>',
  argsDescription: {
    timeframe: 'Timeframe: today, tomorrow, week',
  },
})
export class PlanCommand extends CommandRunner {
  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
    @Inject(AIOperationsService) private readonly aiOps: AIOperationsService,
  ) {
    super();
  }

  async run(passedParams: string[], options?: PlanOptions): Promise<void> {
    try {
      const timeframe = passedParams[0] || 'today';

      console.log(`📅 AI Plan for ${timeframe}\n`);

      const tasks = await this.storage.getTasks({ completed: false, limit: 100 });

      const context: any = {};
      if (options?.hours) {
        context.hoursAvailable = options.hours;
      }

      const plan = await this.aiOps.suggestDailyPlan(tasks, context);

      if (plan.plan) {
        console.log('📋 Plan:\n');
        console.log(plan.plan);
      }

      if (plan.reasoning) {
        console.log('\n💡 Reasoning:\n');
        console.log(plan.reasoning);
      }
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  @Option({
    flags: '--hours <hours>',
    description: 'Hours available',
  })
  parseHours(val: string): number {
    return parseInt(val, 10);
  }
}


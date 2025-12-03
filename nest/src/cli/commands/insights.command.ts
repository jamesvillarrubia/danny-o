/**
 * Insights Command
 * 
 * Get AI-powered productivity insights.
 */

import { Command, CommandRunner } from 'nest-commander';
import { Injectable, Inject } from '@nestjs/common';
import { AIOperationsService } from '../../ai/services/operations.service';

@Injectable()
@Command({
  name: 'insights',
  description: 'Get AI productivity insights',
})
export class InsightsCommand extends CommandRunner {
  constructor(@Inject(AIOperationsService) private readonly aiOps: AIOperationsService) {
    super();
  }

  async run(): Promise<void> {
    try {
      console.log('🔍 Generating insights...\n');

      const insights = await this.aiOps.generateInsights();

      if (insights.insights) {
        console.log('📊 Insights:\n');
        console.log(insights.insights);
      }

      if (insights.recommendations && insights.recommendations.length > 0) {
        console.log('\n💡 Recommendations:\n');
        for (const rec of insights.recommendations) {
          console.log(`• ${rec}`);
        }
      }
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }
}


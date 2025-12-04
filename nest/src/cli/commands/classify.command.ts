/**
 * Classify Command
 * 
 * Uses AI to classify tasks into life area categories.
 */

import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable, Inject } from '@nestjs/common';
import { IStorageAdapter } from '../../common/interfaces';
import { AIOperationsService } from '../../ai/services/operations.service';
import { EnrichmentService } from '../../task/services/enrichment.service';
import { SyncService } from '../../task/services/sync.service';

interface ClassifyOptions {
  all?: boolean;
  force?: boolean;
  debug?: boolean;
}

@Injectable()
@Command({
  name: 'classify',
  description: 'AI classify unclassified tasks',
})
export class ClassifyCommand extends CommandRunner {
  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
    @Inject(AIOperationsService) private readonly aiOps: AIOperationsService,
    @Inject(EnrichmentService) private readonly enrichment: EnrichmentService,
    @Inject(SyncService) private readonly sync: SyncService,
  ) {
    super();
  }

  async run(passedParams: string[], options?: ClassifyOptions): Promise<void> {
    try {
      console.log('🧠 AI Classification\n');

      // Get unclassified tasks
      const unclassified = await this.enrichment.getUnclassifiedTasks({
        force: options?.force || false,
      });

      if (unclassified.length === 0) {
        console.log('✅ All tasks are classified!');
        return;
      }

      console.log(`Found ${unclassified.length} unclassified task(s)\n`);

      // Classify and enrich in batches
      const totalProcessed = await this.classifyAndEnrichBatches(
        unclassified,
        options?.debug || false,
      );

      console.log(`\n✅ Complete! Classified ${totalProcessed} task(s)`);

      // Check for @danny mentions and respond
      console.log('\n💬 Checking for @danny mentions...');
      const tasksWithComments = await this.sync.fetchCommentsForTasks(unclassified);
      const mentionResults = await this.aiOps.respondToMentions(tasksWithComments);
      
      const responded = mentionResults.filter((r) => r.responded);
      if (responded.length > 0) {
        console.log(`\n💬 Responded to ${responded.length} @danny mention(s):`);
        for (const result of responded) {
          const task = tasksWithComments.find((t) => t.id === result.taskId);
          if (task && result.comment) {
            console.log(`  • "${task.content}"`);
            console.log(`    → "${result.comment}"`);
            // Actually add the comment to Todoist
            await this.sync.addCommentToTask(task.id, result.comment);
          }
        }
      } else {
        console.log('  No @danny mentions found');
      }
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Classify and enrich tasks in batches
   */
  private async classifyAndEnrichBatches(tasks: any[], debugMode: boolean): Promise<number> {
    const batchSize = 10;
    let totalProcessed = 0;

    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(tasks.length / batchSize);

      console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} tasks)`);

      try {
        // Fetch comments for tasks before classification
        const batchWithComments = await this.sync.fetchCommentsForTasks(batch);
        
        const results = await this.aiOps.classifyTasks(batchWithComments);

        for (const result of results) {
          try {
            await this.enrichment.enrichTask(
              result.taskId,
              {
                category: result.category,
                aiConfidence: result.confidence,
                aiReasoning: result.reasoning,
                classification_source: 'ai',
              },
              { moveToProject: true }, // Actually move tasks to their category projects!
            );

            const task = batch.find((t) => t.id === result.taskId);
            console.log(`✅ ${task.content}`);
            console.log(`   Project: ${result.category}`);
            console.log(`   Confidence: ${Math.round((result.confidence || 0) * 100)}%`);
            if (result.reasoning && debugMode) {
              console.log(`   ${result.reasoning}`);
            }
            console.log('');

            totalProcessed++;
          } catch (error: any) {
            const task = batch.find((t) => t.id === result.taskId);
            console.error(`❌ Failed to enrich: ${task?.content || result.taskId}`);
            console.error(`   Error: ${error.message}`);
          }
        }

        console.log(`✓ Batch ${batchNum} complete: ${results.length}/${batch.length} tasks enriched`);
      } catch (error: any) {
        console.error(`❌ Batch ${batchNum} failed: ${error.message}`);
      }
    }

    return totalProcessed;
  }

  @Option({
    flags: '--all',
    description: 'Classify all tasks (including manually classified)',
  })
  parseAll(): boolean {
    return true;
  }

  @Option({
    flags: '--force',
    description: 'Force reclassification',
  })
  parseForce(): boolean {
    return true;
  }

  @Option({
    flags: '--debug',
    description: 'Show detailed AI reasoning',
  })
  parseDebug(): boolean {
    return true;
  }
}


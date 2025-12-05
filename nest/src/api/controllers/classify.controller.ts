/**
 * Classify Controller
 * 
 * HTTP endpoint for AI classification of tasks.
 */

import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { EnrichmentService } from '../../task/services/enrichment.service';
import { AIOperationsService } from '../../ai/services/operations.service';

interface ClassifyRequestDto {
  force?: boolean;
  batchSize?: number;
  maxBatches?: number;
}

@Controller('classify')
export class ClassifyController {
  private readonly logger = new Logger(ClassifyController.name);

  constructor(
    private readonly enrichmentService: EnrichmentService,
    private readonly aiOps: AIOperationsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async classify(@Body() body: ClassifyRequestDto = {}) {
    this.logger.log(`Classify requested (force: ${body.force || false})`);

    const startTime = Date.now();
    const batchSize = body.batchSize || 10;
    const maxBatches = body.maxBatches || 5; // Limit batches for API calls

    try {
      // Find unclassified tasks
      const unclassified = await this.enrichmentService.getUnclassifiedTasks({ force: body.force });

      if (unclassified.length === 0) {
        return {
          success: true,
          data: {
            tasksFound: 0,
            tasksClassified: 0,
            duration: Date.now() - startTime,
          },
        };
      }

      // Limit tasks for API calls
      const tasksToProcess = unclassified.slice(0, batchSize * maxBatches);
      
      // Classify in batches
      let totalClassified = 0;
      const results: Array<{ taskId: string; category?: string; error?: string }> = [];

      for (let i = 0; i < tasksToProcess.length; i += batchSize) {
        const batch = tasksToProcess.slice(i, i + batchSize);
        
        try {
          const batchResults = await this.aiOps.classifyTasks(batch);
          
          for (const result of batchResults) {
            if (result.category) {
              totalClassified++;
              results.push({
                taskId: result.taskId,
                category: result.category,
              });
            } else if ((result as any).error) {
              results.push({
                taskId: result.taskId,
                error: (result as any).error,
              });
            }
          }
        } catch (error: any) {
          this.logger.error(`Batch classification error: ${error.message}`);
        }
      }

      return {
        success: true,
        data: {
          tasksFound: unclassified.length,
          tasksProcessed: tasksToProcess.length,
          tasksClassified: totalClassified,
          results: results.slice(0, 20), // Limit response size
          duration: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      this.logger.error(`Classify failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }
}


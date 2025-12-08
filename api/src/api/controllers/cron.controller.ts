/**
 * Cron Controller
 * 
 * HTTP endpoints for Vercel cron jobs.
 * These endpoints are called on a schedule by Vercel.
 * 
 * @see https://vercel.com/docs/cron-jobs
 */

import { Controller, Get, Headers, HttpCode, HttpStatus, Logger, UnauthorizedException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncService } from '../../task/services/sync.service';
import { AIOperationsService } from '../../ai/services/operations.service';
import { EnrichmentService } from '../../task/services/enrichment.service';
import { UrlEnrichmentService } from '../../task/services/url-enrichment.service';

@Controller('cron')
export class CronController {
  private readonly logger = new Logger(CronController.name);
  private readonly cronSecret?: string;

  constructor(
    @Optional() private readonly configService: ConfigService,
    private readonly syncService: SyncService,
    private readonly aiOps: AIOperationsService,
    private readonly enrichmentService: EnrichmentService,
    private readonly urlEnrichmentService: UrlEnrichmentService,
  ) {
    this.cronSecret = this.configService?.get<string>('CRON_SECRET') || undefined;
  }

  /**
   * Verify the cron secret from Vercel
   * Vercel sends the secret in the Authorization header
   */
  private verifyCronSecret(authorization: string | undefined): boolean {
    if (!this.cronSecret) {
      // No secret configured - skip verification
      return true;
    }

    if (!authorization) {
      return false;
    }

    // Vercel sends: "Bearer <secret>"
    const [type, token] = authorization.split(' ');
    return type === 'Bearer' && token === this.cronSecret;
  }

  /**
   * Sync cron job - runs every 5 minutes
   * Syncs tasks from Todoist and checks for mentions
   */
  @Get('sync')
  @HttpCode(HttpStatus.OK)
  async cronSync(@Headers('authorization') authorization?: string) {
    if (!this.verifyCronSecret(authorization)) {
      this.logger.warn('Cron sync: Invalid or missing authorization');
      throw new UnauthorizedException('Invalid cron secret');
    }

    this.logger.log('Cron sync triggered');

    const startTime = Date.now();

    try {
      // Sync with Todoist
      const syncResult = await this.syncService.syncNow();

      // Get tasks with comments to check for mentions
      const tasks = await this.syncService.fetchCommentsForTasks(
        (await this.syncService.getLocalTasks()).filter(t => !t.isCompleted)
      );

      // Check for and respond to @danny mentions
      const mentionResults = await this.aiOps.respondToMentions(tasks);
      const responded = mentionResults.filter(r => r.responded);

      // Post responses
      for (const result of responded) {
        if (result.comment) {
          await this.syncService.addCommentToTask(result.taskId, result.comment);
        }
      }

      return {
        success: true,
        data: {
          sync: {
            tasks: syncResult.tasks,
            projects: syncResult.projects,
            newTasks: syncResult.newTasks,
          },
          mentions: {
            found: responded.length,
            responded: responded.map(r => r.taskId),
          },
          duration: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      this.logger.error(`Cron sync failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Classify cron job - runs every 15 minutes
   * Classifies unclassified tasks
   */
  @Get('classify')
  @HttpCode(HttpStatus.OK)
  async cronClassify(@Headers('authorization') authorization?: string) {
    if (!this.verifyCronSecret(authorization)) {
      this.logger.warn('Cron classify: Invalid or missing authorization');
      throw new UnauthorizedException('Invalid cron secret');
    }

    this.logger.log('Cron classify triggered');

    const startTime = Date.now();
    const batchSize = 10;
    const maxBatches = 3; // 30 tasks max per cron run

    try {
      // Find unclassified tasks
      const unclassified = await this.enrichmentService.getUnclassifiedTasks({ force: false });

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

      // Limit tasks for this cron run
      const tasksToProcess = unclassified.slice(0, batchSize * maxBatches);
      
      // Classify in batches
      let totalClassified = 0;

      for (let i = 0; i < tasksToProcess.length; i += batchSize) {
        const batch = tasksToProcess.slice(i, i + batchSize);
        
        try {
          const batchResults = await this.aiOps.classifyTasks(batch);
          totalClassified += batchResults.filter((r: any) => r.category).length;
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
          duration: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      this.logger.error(`Cron classify failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * URL Enrichment cron job - runs every 15 minutes
   * Enriches URL-heavy tasks with fetched content and AI context
   */
  @Get('enrich-urls')
  @HttpCode(HttpStatus.OK)
  async cronEnrichUrls(@Headers('authorization') authorization?: string) {
    if (!this.verifyCronSecret(authorization)) {
      this.logger.warn('Cron enrich-urls: Invalid or missing authorization');
      throw new UnauthorizedException('Invalid cron secret');
    }

    this.logger.log('Cron URL enrichment triggered');

    const startTime = Date.now();
    const batchSize = 5; // Fewer tasks since URL fetching is slow

    try {
      // Find tasks needing URL enrichment
      const tasksNeedingEnrichment = await this.urlEnrichmentService.findTasksNeedingEnrichment();

      if (tasksNeedingEnrichment.length === 0) {
        return {
          success: true,
          data: {
            tasksFound: 0,
            tasksEnriched: 0,
            duration: Date.now() - startTime,
          },
        };
      }

      // Limit tasks for this cron run
      const tasksToProcess = tasksNeedingEnrichment.slice(0, batchSize);
      
      // Enrich tasks
      const results = await this.urlEnrichmentService.enrichTasks(tasksToProcess, {
        applyChanges: true,
        includeQuestions: true,
      });

      const enrichedCount = results.filter(r => r.enriched).length;
      const failedCount = results.filter(r => !r.enriched && r.error).length;

      return {
        success: true,
        data: {
          tasksFound: tasksNeedingEnrichment.length,
          tasksProcessed: tasksToProcess.length,
          tasksEnriched: enrichedCount,
          tasksFailed: failedCount,
          duration: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      this.logger.error(`Cron URL enrichment failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Health check for cron - always returns 200
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async health() {
    return {
      success: true,
      timestamp: new Date().toISOString(),
    };
  }
}


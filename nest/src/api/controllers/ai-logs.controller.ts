/**
 * AI Logs Controller
 * 
 * HTTP endpoint for retrieving AI interaction logs for analysis and prompt optimization.
 */

import { Controller, Get, Query, HttpCode, HttpStatus, Logger, Inject } from '@nestjs/common';
import { IStorageAdapter } from '../../common/interfaces';

interface AILogsQueryDto {
  type?: string;
  taskId?: string;
  success?: string;
  startDate?: string;
  endDate?: string;
  limit?: string;
}

@Controller('api/ai-logs')
export class AILogsController {
  private readonly logger = new Logger(AILogsController.name);

  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getLogs(@Query() query: AILogsQueryDto) {
    this.logger.log(`AI logs requested (type: ${query.type || 'all'})`);

    try {
      const filters: any = {};

      if (query.type) {
        filters.interactionType = query.type;
      }
      if (query.taskId) {
        filters.taskId = query.taskId;
      }
      if (query.success !== undefined) {
        filters.success = query.success === 'true';
      }
      if (query.startDate) {
        filters.startDate = new Date(query.startDate);
      }
      if (query.endDate) {
        filters.endDate = new Date(query.endDate);
      }
      if (query.limit) {
        filters.limit = parseInt(query.limit, 10) || 100;
      } else {
        filters.limit = 100; // Default limit
      }

      const interactions = await this.storage.getAIInteractions(filters);

      // Calculate summary stats
      const stats = {
        total: interactions.length,
        successful: interactions.filter(i => i.success).length,
        failed: interactions.filter(i => !i.success).length,
        avgLatencyMs: interactions.length > 0
          ? Math.round(interactions.reduce((sum, i) => sum + (i.latencyMs || 0), 0) / interactions.length)
          : 0,
        byType: {} as Record<string, number>,
      };

      for (const interaction of interactions) {
        stats.byType[interaction.interactionType] = (stats.byType[interaction.interactionType] || 0) + 1;
      }

      return {
        success: true,
        data: {
          interactions,
          stats,
        },
      };
    } catch (error: any) {
      this.logger.error(`Failed to get AI logs: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  async getSummary() {
    this.logger.log('AI logs summary requested');

    try {
      // Get last 7 days of logs
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const interactions = await this.storage.getAIInteractions({
        startDate,
        limit: 1000,
      });

      // Calculate summary
      const summary = {
        period: '7 days',
        totalInteractions: interactions.length,
        successRate: interactions.length > 0
          ? Math.round((interactions.filter(i => i.success).length / interactions.length) * 100)
          : 0,
        avgLatencyMs: interactions.length > 0
          ? Math.round(interactions.reduce((sum, i) => sum + (i.latencyMs || 0), 0) / interactions.length)
          : 0,
        byType: {} as Record<string, { count: number; successRate: number; avgLatencyMs: number }>,
        commonErrors: [] as Array<{ message: string; count: number }>,
      };

      // Group by type
      const typeGroups = new Map<string, typeof interactions>();
      for (const interaction of interactions) {
        if (!typeGroups.has(interaction.interactionType)) {
          typeGroups.set(interaction.interactionType, []);
        }
        typeGroups.get(interaction.interactionType)!.push(interaction);
      }

      for (const [type, group] of typeGroups) {
        summary.byType[type] = {
          count: group.length,
          successRate: Math.round((group.filter(i => i.success).length / group.length) * 100),
          avgLatencyMs: Math.round(group.reduce((sum, i) => sum + (i.latencyMs || 0), 0) / group.length),
        };
      }

      // Find common errors
      const errorCounts = new Map<string, number>();
      for (const interaction of interactions) {
        if (!interaction.success && interaction.errorMessage) {
          errorCounts.set(
            interaction.errorMessage,
            (errorCounts.get(interaction.errorMessage) || 0) + 1
          );
        }
      }

      summary.commonErrors = Array.from(errorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([message, count]) => ({ message, count }));

      return {
        success: true,
        data: summary,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get AI logs summary: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}


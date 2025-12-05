/**
 * Stats Controller (v1)
 * 
 * Statistics and analytics API following Google API Design Guide.
 * 
 * Standard Methods:
 * - GET /v1/stats/productivity  - Productivity statistics
 * - GET /v1/stats/enrichment    - Enrichment statistics
 * - GET /v1/stats/history       - Task completion history
 */

import {
  Controller,
  Get,
  Query,
  Inject,
  Logger,
} from '@nestjs/common';
import { IStorageAdapter } from '../../../common/interfaces';
import { EnrichmentService } from '../../../task/services/enrichment.service';
import {
  ProductivityStatsQueryDto,
  TaskHistoryQueryDto,
  ProductivityStatsResponseDto,
  EnrichmentStatsResponseDto,
  TaskHistoryResponseDto,
} from '../../dto';

@Controller('v1/stats')
export class StatsController {
  private readonly logger = new Logger(StatsController.name);

  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
    private readonly enrichmentService: EnrichmentService,
  ) {}

  /**
   * Get productivity statistics
   * GET /v1/stats/productivity
   */
  @Get('productivity')
  async getProductivityStats(
    @Query() query: ProductivityStatsQueryDto,
  ): Promise<ProductivityStatsResponseDto> {
    this.logger.log(`Getting productivity stats (days: ${query.days})`);

    const days = query.days ?? 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get completion history
    const history = await this.storage.getTaskHistory();

    // Filter by date
    let filtered = history.filter(
      (h) => h.completedAt && new Date(h.completedAt) >= since,
    );

    // Filter by category if specified
    if (query.category) {
      filtered = filtered.filter((h) => h.category === query.category);
    }

    // Calculate stats
    const withTime = filtered.filter((h) => h.actualDuration);
    const averageMinutes = withTime.length > 0
      ? Math.round(
          withTime.reduce((sum, h) => sum + (h.actualDuration || 0), 0) / withTime.length,
        )
      : null;

    // Count by category
    const byCategory: Record<string, number> = {};
    for (const entry of filtered) {
      const cat = entry.category || 'unclassified';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    // Count by day
    const byDay: Record<string, number> = {};
    for (const entry of filtered) {
      const day = entry.completedAt
        ? new Date(entry.completedAt).toLocaleDateString()
        : 'unknown';
      byDay[day] = (byDay[day] || 0) + 1;
    }

    // Calculate trend (compare to previous period)
    const previousSince = new Date(since);
    previousSince.setDate(previousSince.getDate() - days);
    const previousFiltered = history.filter(
      (h) =>
        h.completedAt &&
        new Date(h.completedAt) >= previousSince &&
        new Date(h.completedAt) < since,
    );

    let trends: ProductivityStatsResponseDto['trends'] | undefined;
    if (previousFiltered.length > 0) {
      const percentageChange = Math.round(
        ((filtered.length - previousFiltered.length) / previousFiltered.length) * 100,
      );
      trends = {
        direction: percentageChange > 5 ? 'up' : percentageChange < -5 ? 'down' : 'stable',
        percentageChange: Math.abs(percentageChange),
        comparedTo: `Previous ${days} days`,
      };
    }

    return {
      period: `Last ${days} days`,
      totalCompleted: filtered.length,
      withTimeTracking: withTime.length,
      averageMinutes,
      byCategory,
      byDay,
      trends,
    };
  }

  /**
   * Get enrichment statistics
   * GET /v1/stats/enrichment
   */
  @Get('enrichment')
  async getEnrichmentStats(): Promise<EnrichmentStatsResponseDto> {
    this.logger.log('Getting enrichment stats');

    const stats = await this.enrichmentService.getEnrichmentStats();

    // Get all tasks to count by source
    const tasks = await this.storage.getTasks({ completed: false });
    let aiClassified = 0;
    let manuallyClassified = 0;

    for (const task of tasks) {
      if (task.metadata?.classificationSource === 'ai' || task.metadata?.classification_source === 'ai') {
        aiClassified++;
      } else if (task.metadata?.classificationSource === 'manual' || task.metadata?.classification_source === 'manual') {
        manuallyClassified++;
      }
    }

    return {
      total: stats.total || tasks.length,
      classified: stats.classified || 0,
      unclassified: stats.unclassified || 0,
      withTimeEstimate: stats.withTimeEstimate || 0,
      withPriority: stats.withPriority || 0,
      byCategory: stats.byCategory || {},
      classificationRate: stats.total > 0
        ? Math.round((stats.classified / stats.total) * 100)
        : 0,
      aiClassified,
      manuallyClassified,
    };
  }

  /**
   * Get task completion history
   * GET /v1/stats/history
   */
  @Get('history')
  async getTaskHistory(
    @Query() query: TaskHistoryQueryDto,
  ): Promise<TaskHistoryResponseDto> {
    this.logger.log(`Getting task history (limit: ${query.limit})`);

    let history = await this.storage.getTaskHistory({
      category: query.category,
      limit: (query.limit ?? 50) + 1, // Fetch one extra to check if there are more
    });

    // Apply offset
    const offset = query.offset ?? 0;
    if (offset > 0) {
      history = history.slice(offset);
    }

    // Check if there are more
    const hasMore = history.length > (query.limit ?? 50);
    if (hasMore) {
      history = history.slice(0, query.limit ?? 50);
    }

    const entries = history.map((entry) => ({
      id: entry.id || 0,
      taskId: entry.taskId || '',
      taskContent: entry.taskContent || 'Unknown task',
      completedAt: entry.completedAt
        ? new Date(entry.completedAt).toISOString()
        : new Date().toISOString(),
      category: entry.category,
      actualDuration: entry.actualDuration,
      timeAgo: this.getTimeAgo(
        entry.completedAt ? new Date(entry.completedAt) : new Date(),
      ),
    }));

    return {
      entries,
      totalCount: entries.length,
      nextPageToken: hasMore ? String(offset + entries.length) : undefined,
    };
  }

  /**
   * Helper to format time ago
   */
  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  }
}


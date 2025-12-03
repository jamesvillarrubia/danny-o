/**
 * AI Learning Service
 * 
 * Tracks task completion patterns and uses historical data to improve
 * AI recommendations over time. Analyzes:
 * - Actual completion times vs. estimates
 * - Category-specific patterns
 * - Successful task strategies
 * - User preferences and behaviors
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { IStorageAdapter } from '../../common/interfaces/storage-adapter.interface';
import { Task } from '../../common/interfaces';

interface PatternAnalysis {
  category: string;
  dataPoints: number;
  stats?: {
    count: number;
    avgDuration: number | null;
    minDuration: number | null;
    maxDuration: number | null;
    medianDuration: number | null;
  };
  patterns: Array<{
    type: string;
    observation: string;
    confidence: number;
  }>;
  recommendations: Array<{
    type: string;
    suggestion: string;
    reasoning: string;
  }>;
}

interface TaskContext {
  hasHistory: boolean;
  category?: string;
  avgDuration?: number;
  completedCount?: number;
  recommendations: string[];
}

interface EstimationAccuracy {
  dataPoints: number;
  accuracy: number | null;
  accurateCount?: number;
  biases: Array<{
    type: string;
    magnitude: number;
    description: string;
  }>;
  message?: string;
}

interface ProductivityInsights {
  totalCompleted: number;
  categories: Array<{
    category: string;
    count: number;
    totalTime: number;
    avgTime: number | null;
  }>;
  trends: Array<{
    type: string;
    category?: string;
    categories?: string[];
    description: string;
  }>;
  period: {
    daysBack: number;
    startDate: Date;
  };
}

@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(
    @Inject('IStorageAdapter')
    private readonly storage: IStorageAdapter,
  ) {}

  // ==================== Pattern Analysis ====================

  /**
   * Get completion patterns for a category
   */
  async getCompletionPatterns(options: { category: string }): Promise<{ count: number; avgDuration: number; commonPatterns: string[] }> {
    return await this.storage.getCompletionPatterns(options.category);
  }

  /**
   * Analyze completion patterns for a category
   */
  async analyzeCategoryPatterns(category: string, options: { daysBack?: number } = {}): Promise<PatternAnalysis> {
    this.logger.log(`Analyzing patterns for category: ${category}`);

    const daysBack = options.daysBack || 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const history = await this.storage.getTaskHistory({
      category,
      startDate,
      limit: 500,
    });

    if (history.length === 0) {
      return {
        category,
        dataPoints: 0,
        patterns: [],
        recommendations: [],
      };
    }

    // Calculate statistics
    const durations = history.filter((h) => h.actualDuration).map((h) => h.actualDuration!);

    const stats = {
      count: history.length,
      avgDuration:
        durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
      minDuration: durations.length > 0 ? Math.min(...durations) : null,
      maxDuration: durations.length > 0 ? Math.max(...durations) : null,
      medianDuration: this.calculateMedian(durations),
    };

    // Identify patterns
    const patterns = this.identifyPatterns(history, stats);

    // Generate recommendations
    const recommendations = this.generateRecommendations(stats, patterns);

    this.logger.log(`Found ${patterns.length} patterns from ${history.length} completions`);

    return {
      category,
      dataPoints: history.length,
      stats,
      patterns,
      recommendations,
    };
  }

  /**
   * Get learning context for a specific task type
   */
  async getTaskContext(task: Task): Promise<TaskContext> {
    const category = task.metadata?.category;

    if (!category) {
      return {
        hasHistory: false,
        recommendations: [],
      };
    }

    const patterns = await this.storage.getCompletionPatterns(category);

    return {
      hasHistory: patterns.count > 0,
      category,
      avgDuration: patterns.avgDuration,
      completedCount: patterns.count,
      recommendations: this.generateTaskRecommendations(task, patterns),
    };
  }

  /**
   * Get examples of similar completed tasks
   */
  async getSimilarTaskExamples(task: Task, limit = 5): Promise<any[]> {
    const category = task.metadata?.category;

    if (!category) {
      return [];
    }

    const history = await this.storage.getTaskHistory({
      category,
      limit: 100,
    });

    // Simple similarity based on content keywords
    const taskWords = task.content.toLowerCase().split(/\s+/);

    const scored = history.map((h) => {
      const historyWords = (h.taskContent || '').toLowerCase().split(/\s+/);
      const commonWords = taskWords.filter((w) => historyWords.includes(w)).length;
      return {
        ...h,
        similarity: commonWords / Math.max(taskWords.length, historyWords.length),
      };
    });

    return scored.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  // ==================== Performance Tracking ====================

  /**
   * Track estimation accuracy
   */
  async getEstimationAccuracy(): Promise<EstimationAccuracy> {
    this.logger.log('Calculating estimation accuracy...');

    const history = await this.storage.getTaskHistory({
      limit: 500,
    });

    const withEstimates = history.filter((h) => h.actualDuration && (h as any).estimatedDuration);

    if (withEstimates.length === 0) {
      return {
        dataPoints: 0,
        accuracy: null,
        biases: [],
        message: 'Not enough data yet',
      };
    }

    // Calculate accuracy (percentage within 20% of estimate)
    const accurate = withEstimates.filter((h) => {
      const diff = Math.abs(h.actualDuration! - (h as any).estimatedDuration);
      const threshold = (h as any).estimatedDuration * 0.2;
      return diff <= threshold;
    });

    const accuracy = accurate.length / withEstimates.length;

    // Identify systematic biases
    const biases = this.identifyEstimationBiases(withEstimates);

    return {
      dataPoints: withEstimates.length,
      accuracy,
      accurateCount: accurate.length,
      biases,
    };
  }

  /**
   * Get productivity insights
   */
  async getProductivityInsights(daysBack = 30): Promise<ProductivityInsights> {
    this.logger.log(`Analyzing productivity over last ${daysBack} days...`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const history = await this.storage.getTaskHistory({
      startDate,
      limit: 1000,
    });

    // Group by category
    const byCategory: Record<string, any[]> = {};
    for (const h of history) {
      if (!byCategory[h.category || 'unknown']) {
        byCategory[h.category || 'unknown'] = [];
      }
      byCategory[h.category || 'unknown'].push(h);
    }

    // Calculate per-category stats
    const categoryStats = Object.entries(byCategory).map(([category, items]) => {
      const durations = items.filter((i) => i.actualDuration).map((i) => i.actualDuration!);
      const totalTime = durations.reduce((a, b) => a + b, 0);

      return {
        category,
        count: items.length,
        totalTime,
        avgTime: durations.length > 0 ? totalTime / durations.length : null,
      };
    });

    // Sort by count
    categoryStats.sort((a, b) => b.count - a.count);

    // Identify trends
    const trends = this.identifyProductivityTrends(history, categoryStats);

    return {
      totalCompleted: history.length,
      categories: categoryStats,
      trends,
      period: { daysBack, startDate },
    };
  }

  // ==================== Private Helper Methods ====================

  /**
   * Identify patterns in completion history
   */
  private identifyPatterns(history: any[], stats: any): Array<any> {
    const patterns = [];

    // Pattern: Consistent duration
    if (stats.avgDuration && stats.minDuration && stats.maxDuration) {
      const variance = stats.maxDuration - stats.minDuration;
      if (variance < stats.avgDuration * 0.5) {
        patterns.push({
          type: 'consistent_duration',
          observation: 'Tasks in this category have consistent completion times',
          confidence: 0.8,
        });
      }
    }

    // Pattern: Quick completion
    if (stats.avgDuration && stats.avgDuration < 15) {
      patterns.push({
        type: 'quick_tasks',
        observation: 'These are typically quick tasks',
        confidence: 0.9,
      });
    }

    // Pattern: Time-intensive
    if (stats.avgDuration && stats.avgDuration > 60) {
      patterns.push({
        type: 'time_intensive',
        observation: 'These tasks typically require extended focus time',
        confidence: 0.9,
      });
    }

    // Pattern: High completion rate
    if (history.length > 20) {
      patterns.push({
        type: 'high_completion',
        observation: 'You complete these tasks regularly',
        confidence: 0.9,
      });
    }

    return patterns;
  }

  /**
   * Generate recommendations based on patterns
   */
  private generateRecommendations(stats: any, patterns: any[]): Array<any> {
    const recommendations = [];

    // Recommend based on patterns
    if (patterns.some((p) => p.type === 'time_intensive')) {
      recommendations.push({
        type: 'scheduling',
        suggestion: 'Schedule these during your peak focus hours',
        reasoning: 'These tasks require extended concentration',
      });
    }

    if (patterns.some((p) => p.type === 'quick_tasks')) {
      recommendations.push({
        type: 'batching',
        suggestion: 'Consider batching several of these together',
        reasoning: 'Quick tasks can be efficiently grouped',
      });
    }

    if (stats.count > 0 && stats.avgDuration) {
      recommendations.push({
        type: 'estimation',
        suggestion: `Budget approximately ${Math.round(stats.avgDuration)} minutes for these tasks`,
        reasoning: `Based on ${stats.count} completed tasks`,
      });
    }

    return recommendations;
  }

  /**
   * Generate task-specific recommendations
   */
  private generateTaskRecommendations(task: Task, patterns: any): string[] {
    const recommendations = [];

    if (patterns.avgDuration) {
      recommendations.push(
        `Similar tasks took an average of ${Math.round(patterns.avgDuration)} minutes`,
      );
    }

    if (patterns.count > 10) {
      recommendations.push(
        `You've completed ${patterns.count} similar tasks - you're experienced with these`,
      );
    }

    return recommendations;
  }

  /**
   * Identify estimation biases
   */
  private identifyEstimationBiases(withEstimates: any[]): Array<any> {
    const biases = [];

    // Calculate average over/under estimation
    const diffs = withEstimates.map((h) => h.actualDuration - h.estimatedDuration);

    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;

    if (avgDiff > 5) {
      biases.push({
        type: 'underestimation',
        magnitude: Math.round(avgDiff),
        description: `Tasks typically take ${Math.round(avgDiff)} minutes longer than estimated`,
      });
    } else if (avgDiff < -5) {
      biases.push({
        type: 'overestimation',
        magnitude: Math.round(Math.abs(avgDiff)),
        description: `Tasks typically take ${Math.round(Math.abs(avgDiff))} minutes less than estimated`,
      });
    }

    return biases;
  }

  /**
   * Identify productivity trends
   */
  private identifyProductivityTrends(history: any[], categoryStats: any[]): Array<any> {
    const trends = [];

    // Most active category
    if (categoryStats.length > 0) {
      trends.push({
        type: 'most_active',
        category: categoryStats[0].category,
        description: `Most focus on ${categoryStats[0].category} (${categoryStats[0].count} tasks)`,
      });
    }

    // Underutilized categories
    const lowActivity = categoryStats.filter((c) => c.count < 2);
    if (lowActivity.length > 0) {
      trends.push({
        type: 'underutilized',
        categories: lowActivity.map((c) => c.category),
        description: `Limited activity in: ${lowActivity.map((c) => c.category).join(', ')}`,
      });
    }

    return trends;
  }

  /**
   * Calculate median of an array
   */
  private calculateMedian(arr: number[]): number | null {
    if (arr.length === 0) return null;

    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }
}


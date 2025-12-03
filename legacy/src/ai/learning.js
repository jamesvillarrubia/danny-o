/**
 * AI Learning System
 * 
 * Tracks task completion patterns and uses historical data to improve
 * AI recommendations over time. This module analyzes:
 * - Actual completion times vs. estimates
 * - Category-specific patterns
 * - Successful task strategies
 * - User preferences and behaviors
 * 
 * The learning system provides context to the AI agent for better
 * classification, time estimation, and prioritization.
 */

export class LearningSystem {
  /**
   * @param {StorageAdapter} storage - Storage adapter
   */
  constructor(storage) {
    this.storage = storage;
  }

  // ==================== Pattern Analysis ====================

  /**
   * Analyze completion patterns for a category
   * @param {string} category - Life area category
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Pattern analysis
   */
  async analyzeCategoryPatterns(category, options = {}) {
    console.log(`[Learning] Analyzing patterns for category: ${category}`);

    const daysBack = options.daysBack || 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const history = await this.storage.getTaskHistory({
      category,
      startDate,
      limit: 500
    });

    if (history.length === 0) {
      return {
        category,
        dataPoints: 0,
        patterns: [],
        recommendations: []
      };
    }

    // Calculate statistics
    const durations = history
      .filter(h => h.actualDuration)
      .map(h => h.actualDuration);

    const stats = {
      count: history.length,
      avgDuration: durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : null,
      minDuration: durations.length > 0 ? Math.min(...durations) : null,
      maxDuration: durations.length > 0 ? Math.max(...durations) : null,
      medianDuration: this._calculateMedian(durations)
    };

    // Identify patterns
    const patterns = this._identifyPatterns(history, stats);

    // Generate recommendations
    const recommendations = this._generateRecommendations(stats, patterns);

    console.log(`[Learning] Found ${patterns.length} patterns from ${history.length} completions`);

    return {
      category,
      dataPoints: history.length,
      stats,
      patterns,
      recommendations
    };
  }

  /**
   * Get learning context for a specific task type
   * @param {Object} task - Task to get context for
   * @returns {Promise<Object>} Learning context
   */
  async getTaskContext(task) {
    const category = task.metadata?.category;
    
    if (!category) {
      return {
        hasHistory: false,
        recommendations: []
      };
    }

    const patterns = await this.storage.getCompletionPatterns(category);

    return {
      hasHistory: patterns.count > 0,
      category,
      avgDuration: patterns.avgDuration,
      completedCount: patterns.count,
      recommendations: this._generateTaskRecommendations(task, patterns)
    };
  }

  /**
   * Get examples of similar completed tasks
   * @param {Object} task - Task to find examples for
   * @param {number} limit - Max examples to return
   * @returns {Promise<Array>} Similar task examples
   */
  async getSimilarTaskExamples(task, limit = 5) {
    const category = task.metadata?.category;

    if (!category) {
      return [];
    }

    const history = await this.storage.getTaskHistory({
      category,
      limit: 100
    });

    // Simple similarity based on content keywords
    const taskWords = task.content.toLowerCase().split(/\s+/);
    
    const scored = history.map(h => {
      const historyWords = (h.taskContent || '').toLowerCase().split(/\s+/);
      const commonWords = taskWords.filter(w => historyWords.includes(w)).length;
      return {
        ...h,
        similarity: commonWords / Math.max(taskWords.length, historyWords.length)
      };
    });

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  // ==================== Performance Tracking ====================

  /**
   * Track estimation accuracy
   * @returns {Promise<Object>} Accuracy metrics
   */
  async getEstimationAccuracy() {
    console.log('[Learning] Calculating estimation accuracy...');

    const history = await this.storage.getTaskHistory({
      limit: 500
    });

    const withEstimates = history.filter(h => 
      h.actualDuration && h.estimatedDuration
    );

    if (withEstimates.length === 0) {
      return {
        dataPoints: 0,
        accuracy: null,
        message: 'Not enough data yet'
      };
    }

    // Calculate accuracy (percentage within 20% of estimate)
    const accurate = withEstimates.filter(h => {
      const diff = Math.abs(h.actualDuration - h.estimatedDuration);
      const threshold = h.estimatedDuration * 0.2;
      return diff <= threshold;
    });

    const accuracy = accurate.length / withEstimates.length;

    // Identify systematic biases
    const biases = this._identifyEstimationBiases(withEstimates);

    return {
      dataPoints: withEstimates.length,
      accuracy,
      accurateCount: accurate.length,
      biases
    };
  }

  /**
   * Get productivity insights
   * @param {number} daysBack - Days of history to analyze
   * @returns {Promise<Object>} Productivity insights
   */
  async getProductivityInsights(daysBack = 30) {
    console.log(`[Learning] Analyzing productivity over last ${daysBack} days...`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const history = await this.storage.getTaskHistory({
      startDate,
      limit: 1000
    });

    // Group by category
    const byCategory = {};
    for (const h of history) {
      if (!byCategory[h.category]) {
        byCategory[h.category] = [];
      }
      byCategory[h.category].push(h);
    }

    // Calculate per-category stats
    const categoryStats = Object.entries(byCategory).map(([category, items]) => {
      const durations = items.filter(i => i.actualDuration).map(i => i.actualDuration);
      const totalTime = durations.reduce((a, b) => a + b, 0);

      return {
        category,
        count: items.length,
        totalTime,
        avgTime: durations.length > 0 ? totalTime / durations.length : null
      };
    });

    // Sort by count
    categoryStats.sort((a, b) => b.count - a.count);

    // Identify trends
    const trends = this._identifyProductivityTrends(history, categoryStats);

    return {
      totalCompleted: history.length,
      categories: categoryStats,
      trends,
      period: { daysBack, startDate }
    };
  }

  // ==================== Private Helper Methods ====================

  /**
   * Identify patterns in completion history
   * @private
   */
  _identifyPatterns(history, stats) {
    const patterns = [];

    // Pattern: Consistent duration
    if (stats.avgDuration && stats.minDuration && stats.maxDuration) {
      const variance = stats.maxDuration - stats.minDuration;
      if (variance < stats.avgDuration * 0.5) {
        patterns.push({
          type: 'consistent_duration',
          observation: 'Tasks in this category have consistent completion times',
          confidence: 0.8
        });
      }
    }

    // Pattern: Quick completion
    if (stats.avgDuration && stats.avgDuration < 15) {
      patterns.push({
        type: 'quick_tasks',
        observation: 'These are typically quick tasks',
        confidence: 0.9
      });
    }

    // Pattern: Time-intensive
    if (stats.avgDuration && stats.avgDuration > 60) {
      patterns.push({
        type: 'time_intensive',
        observation: 'These tasks typically require extended focus time',
        confidence: 0.9
      });
    }

    // Pattern: High completion rate
    if (history.length > 20) {
      patterns.push({
        type: 'high_completion',
        observation: 'You complete these tasks regularly',
        confidence: 0.9
      });
    }

    return patterns;
  }

  /**
   * Generate recommendations based on patterns
   * @private
   */
  _generateRecommendations(stats, patterns) {
    const recommendations = [];

    // Recommend based on patterns
    if (patterns.some(p => p.type === 'time_intensive')) {
      recommendations.push({
        type: 'scheduling',
        suggestion: 'Schedule these during your peak focus hours',
        reasoning: 'These tasks require extended concentration'
      });
    }

    if (patterns.some(p => p.type === 'quick_tasks')) {
      recommendations.push({
        type: 'batching',
        suggestion: 'Consider batching several of these together',
        reasoning: 'Quick tasks can be efficiently grouped'
      });
    }

    if (stats.count > 0 && stats.avgDuration) {
      recommendations.push({
        type: 'estimation',
        suggestion: `Budget approximately ${Math.round(stats.avgDuration)} minutes for these tasks`,
        reasoning: `Based on ${stats.count} completed tasks`
      });
    }

    return recommendations;
  }

  /**
   * Generate task-specific recommendations
   * @private
   */
  _generateTaskRecommendations(task, patterns) {
    const recommendations = [];

    if (patterns.avgDuration) {
      recommendations.push(
        `Similar tasks took an average of ${Math.round(patterns.avgDuration)} minutes`
      );
    }

    if (patterns.count > 10) {
      recommendations.push(
        `You've completed ${patterns.count} similar tasks - you're experienced with these`
      );
    }

    return recommendations;
  }

  /**
   * Identify estimation biases
   * @private
   */
  _identifyEstimationBiases(withEstimates) {
    const biases = [];

    // Calculate average over/under estimation
    const diffs = withEstimates.map(h => 
      h.actualDuration - h.estimatedDuration
    );

    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;

    if (avgDiff > 5) {
      biases.push({
        type: 'underestimation',
        magnitude: Math.round(avgDiff),
        description: `Tasks typically take ${Math.round(avgDiff)} minutes longer than estimated`
      });
    } else if (avgDiff < -5) {
      biases.push({
        type: 'overestimation',
        magnitude: Math.round(Math.abs(avgDiff)),
        description: `Tasks typically take ${Math.round(Math.abs(avgDiff))} minutes less than estimated`
      });
    }

    return biases;
  }

  /**
   * Identify productivity trends
   * @private
   */
  _identifyProductivityTrends(history, categoryStats) {
    const trends = [];

    // Most active category
    if (categoryStats.length > 0) {
      trends.push({
        type: 'most_active',
        category: categoryStats[0].category,
        description: `Most focus on ${categoryStats[0].category} (${categoryStats[0].count} tasks)`
      });
    }

    // Underutilized categories
    const lowActivity = categoryStats.filter(c => c.count < 2);
    if (lowActivity.length > 0) {
      trends.push({
        type: 'underutilized',
        categories: lowActivity.map(c => c.category),
        description: `Limited activity in: ${lowActivity.map(c => c.category).join(', ')}`
      });
    }

    return trends;
  }

  /**
   * Calculate median of an array
   * @private
   */
  _calculateMedian(arr) {
    if (arr.length === 0) return null;
    
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
}


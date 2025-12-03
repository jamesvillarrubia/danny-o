/**
 * AI Operations
 * 
 * High-level AI-powered task management operations.
 * These functions combine the AI agent, prompts, and storage
 * to provide intelligent task classification, prioritization,
 * time estimation, and planning capabilities.
 */

import {
  getClassifyPrompt,
  getBatchClassifyPrompt,
  getTimeEstimatePrompt,
  getPrioritizePrompt,
  getBreakdownPrompt,
  getDailyPlanPrompt,
  getSupplyAnalysisPrompt,
  getSearchPrompt,
  getInsightsPrompt
} from './prompts.js';

export class AIOperations {
  /**
   * @param {AIAgent} agent - AI agent instance
   * @param {StorageAdapter} storage - Storage adapter
   */
  constructor(agent, storage) {
    this.agent = agent;
    this.storage = storage;
  }

  // ==================== Task Classification ====================

  /**
   * Classify a single task into a life area category
   * @param {Object} task - Task to classify
   * @returns {Promise<Object>} Classification result
   */
  async classifyTask(task) {
    console.log(`[AI Operations] Classifying task: ${task.content}`);

    // Get completion history for context
    const history = await this.storage.getTaskHistory({ limit: 20 });

    const prompt = getClassifyPrompt(task, history);
    const result = await this.agent.query(prompt);

    console.log(`[AI Operations] Classified as: ${result.category} (confidence: ${result.confidence})`);

    return {
      taskId: task.id,
      category: result.category,
      confidence: result.confidence,
      reasoning: result.reasoning
    };
  }

  /**
   * Classify multiple tasks in batch
   * @param {Array<Object>} tasks - Tasks to classify
   * @returns {Promise<Array>} Classification results
   */
  async classifyTasks(tasks) {
    console.log(`[AI Operations] Batch classifying ${tasks.length} tasks...`);

    if (tasks.length === 0) return [];

    // Get completion history for context
    const history = await this.storage.getTaskHistory({ limit: 50 });

    // Load available labels from taxonomy and approved suggestions
    const availableLabels = await this._getAvailableLabels();

    // Process in reasonable batches
    const batchSize = 10;
    const results = [];

    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const prompt = getBatchClassifyPrompt(batch, history, availableLabels);
      
      try {
        const batchResults = await this.agent.query(prompt);
        
        // Validate response format
        if (!Array.isArray(batchResults)) {
          console.warn(`[AI Operations] Invalid response format for batch ${i}, expected array`);
          continue;
        }
        
        // Map results back to tasks
        for (const result of batchResults) {
          if (!result || result.taskIndex === undefined) {
            console.warn('[AI Operations] Invalid result format:', result);
            continue;
          }
          
          const task = batch[result.taskIndex];
          if (!task) {
            console.warn(`[AI Operations] Task index ${result.taskIndex} out of range (batch size: ${batch.length})`);
            continue;
          }
          
          // Process labels: separate existing from new suggestions
          const { existingLabels, suggestedLabels } = await this._processLabels(result.labels || []);
          
          results.push({
            taskId: task.id,
            category: result.category,
            labels: existingLabels,
            suggestedLabels: suggestedLabels,
            confidence: result.confidence,
            reasoning: result.reasoning
          });
        }
      } catch (error) {
        console.error(`[AI Operations] Batch classification failed for batch starting at ${i}:`, error.message);
        // Continue with remaining batches
      }

      // Rate limit courtesy
      if (i + batchSize < tasks.length) {
        await this._delay(500);
      }
    }

    console.log(`[AI Operations] Classified ${results.length}/${tasks.length} tasks`);
    return results;
  }

  /**
   * Get available labels from taxonomy and approved suggestions
   * @private
   */
  async _getAvailableLabels() {
    const labels = [];
    
    // Load from taxonomy
    const { getActiveLabels } = await import('../config/taxonomy-loader.js');
    const activeLabels = getActiveLabels();
    
    for (const label of activeLabels) {
      labels.push({
        id: label.id,
        name: label.name,
        description: label.description
      });
    }
    
    // Load approved suggestions from DB
    if (this.storage.getSuggestedLabels) {
      try {
        const suggestions = await this.storage.getSuggestedLabels({ status: 'approved' });
        for (const suggestion of suggestions) {
          labels.push({
            id: suggestion.id,
            name: suggestion.name,
            description: suggestion.description
          });
        }
      } catch (error) {
        console.warn('[AI Operations] Failed to load suggested labels:', error.message);
      }
    }
    
    return labels;
  }

  /**
   * Process label results: separate existing from new suggestions
   * @private
   */
  async _processLabels(labelIds) {
    const existingLabels = [];
    const suggestedLabels = [];
    
    const availableLabels = await this._getAvailableLabels();
    const availableLabelIds = new Set(availableLabels.map(l => l.id));
    
    for (const labelId of labelIds) {
      if (labelId.startsWith('new:')) {
        // New label suggestion
        const suggestedId = labelId.substring(4).toLowerCase().replace(/\s+/g, '-');
        suggestedLabels.push({
          id: suggestedId,
          name: labelId.substring(4),
          reasoning: 'AI suggested during classification'
        });
      } else if (availableLabelIds.has(labelId)) {
        // Existing label
        existingLabels.push(labelId);
      } else {
        console.warn(`[AI Operations] Unknown label ID: ${labelId}, skipping`);
      }
    }
    
    // Save new suggestions to DB using SuggestionManager
    if (suggestedLabels.length > 0) {
      const { SuggestionManager } = await import('../config/suggestion-manager.js');
      const suggestionManager = new SuggestionManager(this.storage);
      
      for (const suggestion of suggestedLabels) {
        try {
          await suggestionManager.suggestLabel({
            id: suggestion.id,
            name: suggestion.name,
            reasoning: suggestion.reasoning,
            description: `AI-suggested label for classification`
          });
          console.log(`[AI Operations] Suggested new label: ${suggestion.name}`);
        } catch (error) {
          console.warn(`[AI Operations] Failed to save label suggestion: ${error.message}`);
        }
      }
    }
    
    return { existingLabels, suggestedLabels };
  }

  // ==================== Time Estimation ====================

  /**
   * Estimate time required for a task
   * @param {Object} task - Task to estimate
   * @returns {Promise<Object>} Time estimate
   */
  async estimateTaskDuration(task) {
    console.log(`[AI Operations] Estimating duration for: ${task.content}`);

    // Get historical patterns for this category if available
    let categoryHistory = null;
    if (task.metadata?.category) {
      categoryHistory = await this.storage.getCompletionPatterns(task.metadata.category);
    }

    const prompt = getTimeEstimatePrompt(task, categoryHistory);
    const result = await this.agent.query(prompt);

    console.log(`[AI Operations] Estimated: ${result.estimate} (${result.size})`);

    return {
      taskId: task.id,
      timeEstimate: result.estimate,
      size: result.size,
      confidence: result.confidence,
      reasoning: result.reasoning
    };
  }

  /**
   * Estimate time for multiple tasks
   * @param {Array<Object>} tasks - Tasks to estimate
   * @returns {Promise<Array>} Estimation results
   */
  async estimateTasksBatch(tasks) {
    console.log(`[AI Operations] Batch estimating ${tasks.length} tasks...`);

    const results = await Promise.allSettled(
      tasks.map(task => this.estimateTaskDuration(task))
    );

    return results.map((r, i) => 
      r.status === 'fulfilled' 
        ? r.value 
        : { taskId: tasks[i].id, error: r.reason.message }
    );
  }

  // ==================== Prioritization ====================

  /**
   * Intelligently prioritize a list of tasks
   * @param {Array<Object>} tasks - Tasks to prioritize
   * @param {Object} context - Context for prioritization
   * @returns {Promise<Object>} Prioritization result
   */
  async prioritizeTasks(tasks, context = {}) {
    console.log(`[AI Operations] Prioritizing ${tasks.length} tasks...`);

    if (tasks.length === 0) {
      return { prioritized: [], recommendations: {} };
    }

    const prompt = getPrioritizePrompt(tasks, context);
    const result = await this.agent.query(prompt);

    // Map priorities back to task IDs
    const prioritized = result.prioritized.map(p => ({
      taskId: tasks[p.taskIndex].id,
      task: tasks[p.taskIndex],
      priority: p.priority,
      reasoning: p.reasoning,
      suggestedOrder: p.suggestedOrder
    }));

    console.log(`[AI Operations] Prioritization complete`);

    return {
      prioritized: prioritized.sort((a, b) => a.suggestedOrder - b.suggestedOrder),
      recommendations: result.recommendations
    };
  }

  // ==================== Task Breakdown ====================

  /**
   * Break down a complex task into subtasks
   * @param {Object} task - Task to break down
   * @returns {Promise<Object>} Breakdown result
   */
  async createSubtasks(task) {
    console.log(`[AI Operations] Breaking down task: ${task.content}`);

    const prompt = getBreakdownPrompt(task);
    const result = await this.agent.query(prompt);

    console.log(`[AI Operations] Created ${result.subtasks.length} subtasks`);

    return {
      taskId: task.id,
      subtasks: result.subtasks,
      totalEstimate: result.totalEstimate,
      supplyList: result.supplyList,
      notes: result.notes
    };
  }

  // ==================== Daily Planning ====================

  /**
   * Suggest an optimized daily plan
   * @param {Array<Object>} tasks - Available tasks
   * @param {Object} context - Planning context
   * @returns {Promise<Object>} Daily plan
   */
  async suggestDailyPlan(tasks, context = {}) {
    console.log(`[AI Operations] Creating daily plan from ${tasks.length} tasks...`);

    if (tasks.length === 0) {
      return {
        today: { tasks: [], totalTime: '0min' },
        thisWeek: { tasks: [] },
        needsSupplies: { tasks: [] },
        delegateToSpouse: { tasks: [] }
      };
    }

    const prompt = getDailyPlanPrompt(tasks, context);
    const result = await this.agent.query(prompt);

    // Map indices back to task objects
    const mapTasks = (indices) => 
      indices.map(idx => tasks[idx]).filter(t => t);

    const plan = {
      today: {
        tasks: result.today.tasks.map(t => ({
          task: tasks[t.taskIndex],
          scheduledTime: t.scheduledTime,
          reasoning: t.reasoning
        })),
        totalTime: result.today.totalTime
      },
      thisWeek: {
        tasks: mapTasks(result.thisWeek.tasks),
        reasoning: result.thisWeek.reasoning
      },
      needsSupplies: {
        tasks: mapTasks(result.needsSupplies.tasks),
        shoppingList: result.needsSupplies.shoppingList,
        suggestion: result.needsSupplies.suggestion
      },
      delegateToSpouse: {
        tasks: mapTasks(result.delegateToSpouse.tasks),
        reasoning: result.delegateToSpouse.reasoning
      },
      notes: result.notes
    };

    console.log(`[AI Operations] Daily plan created: ${plan.today.tasks.length} tasks for today`);
    return plan;
  }

  // ==================== Supply Analysis ====================

  /**
   * Identify supply needs across tasks
   * @param {Array<Object>} tasks - Tasks to analyze
   * @returns {Promise<Object>} Supply analysis
   */
  async identifySupplyNeeds(tasks) {
    console.log(`[AI Operations] Analyzing supply needs for ${tasks.length} tasks...`);

    if (tasks.length === 0) {
      return { taskSupplies: [], shoppingTrips: [], recommendations: '' };
    }

    const prompt = getSupplyAnalysisPrompt(tasks);
    const result = await this.agent.query(prompt);

    // Map back to task objects
    result.taskSupplies = result.taskSupplies.map(ts => ({
      ...ts,
      task: tasks[ts.taskIndex]
    }));

    result.shoppingTrips = result.shoppingTrips.map(trip => ({
      ...trip,
      tasks: trip.tasks.map(idx => tasks[idx])
    }));

    console.log(`[AI Operations] Found ${result.shoppingTrips.length} shopping trips needed`);
    return result;
  }

  // ==================== Natural Language Search ====================

  /**
   * Search tasks using natural language
   * @param {string} query - Search query
   * @param {Array<Object>} tasks - Tasks to search
   * @returns {Promise<Object>} Search results
   */
  async filterTasksByIntent(query, tasks) {
    console.log(`[AI Operations] Searching for: "${query}"`);

    if (tasks.length === 0) {
      return { matches: [], interpretation: query };
    }

    const prompt = getSearchPrompt(query, tasks);
    const result = await this.agent.query(prompt);

    // Map back to task objects and sort by relevance
    const matches = result.matches
      .map(m => ({
        task: tasks[m.taskIndex],
        relevanceScore: m.relevanceScore,
        reasoning: m.reasoning
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    console.log(`[AI Operations] Found ${matches.length} matches`);

    return {
      matches,
      interpretation: result.interpretation
    };
  }

  // ==================== Insights & Analytics ====================

  /**
   * Analyze completion patterns and provide insights
   * @returns {Promise<Object>} Insights and recommendations
   */
  async generateInsights() {
    console.log('[AI Operations] Generating insights...');

    // Get recent history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const history = await this.storage.getTaskHistory({
      startDate: thirtyDaysAgo,
      limit: 1000
    });

    const currentTasks = await this.storage.getTasks({ completed: false });

    const prompt = getInsightsPrompt(history, currentTasks);
    const result = await this.agent.query(prompt);

    console.log('[AI Operations] Insights generated');
    return result;
  }

  // ==================== Helper Methods ====================

  /**
   * Classify and enrich new tasks automatically
   * @param {Array<Object>} tasks - New tasks
   * @returns {Promise<Array>} Enrichment results
   */
  async autoEnrichTasks(tasks) {
    console.log(`[AI Operations] Auto-enriching ${tasks.length} tasks...`);

    const results = [];

    for (const task of tasks) {
      try {
        // Classify
        const classification = await this.classifyTask(task);
        
        // Estimate time
        const estimate = await this.estimateTaskDuration(task);

        // Combine metadata
        const metadata = {
          category: classification.category,
          timeEstimate: estimate.timeEstimate,
          size: estimate.size,
          aiConfidence: (classification.confidence + estimate.confidence) / 2,
          aiReasoning: `Category: ${classification.reasoning}. Time: ${estimate.reasoning}`
        };

        results.push({
          taskId: task.id,
          metadata,
          success: true
        });

        // Rate limit courtesy
        await this._delay(500);

      } catch (error) {
        console.error(`[AI Operations] Failed to enrich task ${task.id}:`, error);
        results.push({
          taskId: task.id,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`[AI Operations] Auto-enrichment complete: ${results.filter(r => r.success).length}/${tasks.length} successful`);
    return results;
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


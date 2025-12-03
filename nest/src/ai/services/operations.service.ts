/**
 * AI Operations Service
 * 
 * High-level AI-powered task management operations.
 * Combines Claude, prompts, and storage for intelligent task classification,
 * prioritization, time estimation, and planning capabilities.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { IStorageAdapter } from '../../common/interfaces/storage-adapter.interface';
import { Task, TaskHistory } from '../../common/interfaces';
import { ClaudeService } from './claude.service';
import { PromptsService } from '../prompts/prompts.service';
import { TaxonomyService } from '../../config/taxonomy/taxonomy.service';
import {
  ClassificationResultDto,
  TimeEstimateDto,
  PrioritizationDto,
  SubtaskBreakdownDto,
  DailyPlanDto,
  SupplyAnalysisDto,
  SearchResultDto,
  InsightsDto,
} from '../dto';

interface Label {
  id: string;
  name: string;
  description?: string;
}

@Injectable()
export class AIOperationsService {
  private readonly logger = new Logger(AIOperationsService.name);

  constructor(
    @Inject(ClaudeService) private readonly claude: ClaudeService,
    @Inject(PromptsService) private readonly prompts: PromptsService,
    @Inject(TaxonomyService) private readonly taxonomy: TaxonomyService,
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
  ) {}

  // ==================== Task Classification ====================

  /**
   * Classify a single task into a life area category
   */
  async classifyTask(task: Task): Promise<ClassificationResultDto> {
    this.logger.log(`Classifying task: ${task.content}`);

    // Get completion history for context
    const history = await this.storage.getTaskHistory({ limit: 20 });

    const prompt = this.prompts.getClassifyPrompt(task, history);
    const result = await this.claude.query(prompt);

    this.logger.log(`Classified as: ${result.category} (confidence: ${result.confidence})`);

    return {
      taskId: task.id,
      category: result.category,
      confidence: result.confidence,
      reasoning: result.reasoning,
    };
  }

  /**
   * Classify multiple tasks in batch
   */
  async classifyTasks(tasks: Task[]): Promise<ClassificationResultDto[]> {
    this.logger.log(`Batch classifying ${tasks.length} tasks...`);

    if (tasks.length === 0) return [];

    // Get completion history for context
    const history = await this.storage.getTaskHistory({ limit: 50 });

    // Load available labels from taxonomy
    const availableLabels = await this.getAvailableLabels();

    // Process in reasonable batches
    const batchSize = 10;
    const results: ClassificationResultDto[] = [];

    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const prompt = this.prompts.getBatchClassifyPrompt(batch, history, availableLabels);

      try {
        const batchResults = await this.claude.query(prompt);

        // Validate response format
        if (!Array.isArray(batchResults)) {
          this.logger.warn(`Invalid response format for batch ${i}, expected array`);
          continue;
        }

        // Map results back to tasks
        for (const result of batchResults) {
          if (!result || result.taskIndex === undefined) {
            this.logger.warn('Invalid result format:', result);
            continue;
          }

          const task = batch[result.taskIndex];
          if (!task) {
            this.logger.warn(
              `Task index ${result.taskIndex} out of range (batch size: ${batch.length})`,
            );
            continue;
          }

          // Process labels: separate existing from new suggestions
          const { existingLabels, suggestedLabels } = await this.processLabels(
            result.labels || [],
          );

          results.push({
            taskId: task.id,
            category: result.category,
            labels: existingLabels,
            suggestedLabels: suggestedLabels,
            confidence: result.confidence,
            reasoning: result.reasoning,
          });
        }
      } catch (error: any) {
        this.logger.error(`Batch classification failed for batch starting at ${i}: ${error.message}`);
        // Continue with remaining batches
      }

      // Rate limit courtesy
      if (i + batchSize < tasks.length) {
        await this.delay(500);
      }
    }

    this.logger.log(`Classified ${results.length}/${tasks.length} tasks`);
    return results;
  }

  /**
   * Get available labels from taxonomy and approved suggestions
   */
  private async getAvailableLabels(): Promise<Label[]> {
    const labels: Label[] = [];

    // Load from taxonomy - for now return empty as we need to check taxonomy structure
    // TODO: Load labels from taxonomy once we confirm the structure
    // const taxonomyData = this.taxonomy.getTaxonomy();

    // TODO: Load approved suggestions from DB if the method exists
    // This would require adding a getSuggestedLabels method to IStorageAdapter

    return labels;
  }

  /**
   * Process label results: separate existing from new suggestions
   */
  private async processLabels(
    labelIds: string[],
  ): Promise<{ existingLabels: string[]; suggestedLabels: Array<{ id: string; name: string; reasoning: string }> }> {
    const existingLabels: string[] = [];
    const suggestedLabels: Array<{ id: string; name: string; reasoning: string }> = [];

    const availableLabels = await this.getAvailableLabels();
    const availableLabelIds = new Set(availableLabels.map((l) => l.id));

    for (const labelId of labelIds) {
      if (labelId.startsWith('new:')) {
        // New label suggestion
        const suggestedId = labelId.substring(4).toLowerCase().replace(/\s+/g, '-');
        suggestedLabels.push({
          id: suggestedId,
          name: labelId.substring(4),
          reasoning: 'AI suggested during classification',
        });
      } else if (availableLabelIds.has(labelId)) {
        // Existing label
        existingLabels.push(labelId);
      } else {
        this.logger.warn(`Unknown label ID: ${labelId}, skipping`);
      }
    }

    // TODO: Save new suggestions to DB using SuggestionManager
    // This would require migrating the SuggestionManager class

    return { existingLabels, suggestedLabels };
  }

  // ==================== Time Estimation ====================

  /**
   * Estimate time required for a task
   */
  async estimateTaskDuration(task: Task): Promise<TimeEstimateDto> {
    this.logger.log(`Estimating duration for: ${task.content}`);

    // Get historical patterns for this category if available
    let categoryHistory = null;
    if (task.metadata?.category) {
      categoryHistory = await this.storage.getCompletionPatterns(task.metadata.category);
    }

    const prompt = this.prompts.getTimeEstimatePrompt(task, categoryHistory);
    const result = await this.claude.query(prompt);

    this.logger.log(`Estimated: ${result.estimate} (${result.size})`);

    // Parse time estimate to minutes if not provided
    const timeEstimateMinutes = result.timeEstimateMinutes || this.parseTimeToMinutes(result.estimate);

    return {
      taskId: task.id,
      timeEstimate: result.estimate,
      timeEstimateMinutes,
      size: result.size,
      confidence: result.confidence,
      reasoning: result.reasoning,
    };
  }

  /**
   * Parse time estimate string to minutes
   */
  private parseTimeToMinutes(estimate: string): number {
    const hours = estimate.match(/(\d+(?:\.\d+)?)\s*h/i);
    const mins = estimate.match(/(\d+)\s*m/i);
    
    let total = 0;
    if (hours) total += parseFloat(hours[1]) * 60;
    if (mins) total += parseInt(mins[1]);
    
    return total || 0;
  }

  /**
   * Estimate time for multiple tasks
   */
  async estimateTasksBatch(tasks: Task[]): Promise<Array<TimeEstimateDto | { taskId: string; error: string }>> {
    this.logger.log(`Batch estimating ${tasks.length} tasks...`);

    const results = await Promise.allSettled(tasks.map((task) => this.estimateTaskDuration(task)));

    return results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { taskId: tasks[i].id, error: r.reason.message },
    );
  }

  // ==================== Prioritization ====================

  /**
   * Intelligently prioritize a list of tasks
   */
  async prioritizeTasks(tasks: Task[], context: any = {}): Promise<PrioritizationDto> {
    this.logger.log(`Prioritizing ${tasks.length} tasks...`);

    if (tasks.length === 0) {
      return {
        prioritized: [],
        recommendations: {
          startWith: '',
          defer: [],
          delegate: [],
        },
      };
    }

    const prompt = this.prompts.getPrioritizePrompt(tasks, context);
    const result = await this.claude.query(prompt);

    // Map priorities back to task IDs
    const prioritized = result.prioritized.map((p: any) => ({
      taskId: tasks[p.taskIndex].id,
      task: tasks[p.taskIndex],
      priority: p.priority,
      reasoning: p.reasoning,
      suggestedOrder: p.suggestedOrder,
      todoistPriority: p.todoistPriority || this.mapPriorityToTodoist(p.priority),
      suggestedDueDate: p.suggestedDueDate,
      scheduledTime: p.scheduledTime,
    }));

    this.logger.log('Prioritization complete');

    return {
      prioritized: prioritized.sort((a: any, b: any) => a.suggestedOrder - b.suggestedOrder),
      recommendations: result.recommendations,
    };
  }

  /**
   * Map AI priority string to Todoist priority number
   */
  private mapPriorityToTodoist(priority: string): number {
    const mapping: Record<string, number> = {
      critical: 4, // P1 (red)
      high: 3, // P2 (orange)
      medium: 2, // P3 (yellow)
      low: 1, // P4 (default)
      archive: 1, // P4 (will be marked for archival)
    };
    return mapping[priority.toLowerCase()] || 1;
  }

  // ==================== Task Breakdown ====================

  /**
   * Break down a complex task into subtasks
   */
  async createSubtasks(task: Task): Promise<SubtaskBreakdownDto> {
    this.logger.log(`Breaking down task: ${task.content}`);

    // For now, use a simple prompt (we can add getBreakdownPrompt to PromptsService later)
    const prompt = `Break down this task into actionable subtasks: "${task.content}"`;
    const result = await this.claude.query(prompt);

    this.logger.log(`Created ${result.subtasks.length} subtasks`);

    return {
      taskId: task.id,
      subtasks: result.subtasks,
      totalEstimate: result.totalEstimate,
      supplyList: result.supplyList,
      notes: result.notes,
    };
  }

  // ==================== Daily Planning ====================

  /**
   * Suggest an optimized daily plan
   */
  async suggestDailyPlan(tasks: Task[], context: any = {}): Promise<DailyPlanDto> {
    this.logger.log(`Creating daily plan from ${tasks.length} tasks...`);

    if (tasks.length === 0) {
      return {
        plan: 'No tasks available for planning.',
        today: { tasks: [], totalTime: '0min' },
        thisWeek: { tasks: [], reasoning: '' },
        needsSupplies: { tasks: [], shoppingList: [], suggestion: '' },
        delegateToSpouse: { tasks: [], reasoning: '' },
        notes: 'No tasks available to plan',
      };
    }

    // For now, use a simple prompt (we can add getDailyPlanPrompt to PromptsService later)
    const prompt = `Create a daily plan for these ${tasks.length} tasks`;
    const result = await this.claude.query(prompt);

    // Map indices back to task objects
    const mapTasks = (indices: number[]) => indices.map((idx) => tasks[idx]).filter((t) => t);

    const plan: DailyPlanDto = {
      plan: result.summary || result.notes || 'Daily plan created',
      reasoning: result.notes,
      today: {
        tasks: result.today.tasks.map((t: any) => ({
          task: tasks[t.taskIndex],
          scheduledTime: t.scheduledTime,
          reasoning: t.reasoning,
        })),
        totalTime: result.today.totalTime,
      },
      thisWeek: {
        tasks: mapTasks(result.thisWeek.tasks),
        reasoning: result.thisWeek.reasoning,
      },
      needsSupplies: {
        tasks: mapTasks(result.needsSupplies.tasks),
        shoppingList: result.needsSupplies.shoppingList,
        suggestion: result.needsSupplies.suggestion,
      },
      delegateToSpouse: {
        tasks: mapTasks(result.delegateToSpouse.tasks),
        reasoning: result.delegateToSpouse.reasoning,
      },
      notes: result.notes,
    };

    this.logger.log(`Daily plan created: ${plan.today?.tasks?.length || 0} tasks for today`);
    return plan;
  }

  // ==================== Supply Analysis ====================

  /**
   * Identify supply needs across tasks
   */
  async identifySupplyNeeds(tasks: Task[]): Promise<SupplyAnalysisDto> {
    this.logger.log(`Analyzing supply needs for ${tasks.length} tasks...`);

    if (tasks.length === 0) {
      return { taskSupplies: [], shoppingTrips: [], recommendations: '' };
    }

    // For now, use a simple prompt
    const prompt = `Analyze supply needs for these ${tasks.length} tasks`;
    const result = await this.claude.query(prompt);

    // Map back to task objects
    result.taskSupplies = result.taskSupplies.map((ts: any) => ({
      ...ts,
      task: tasks[ts.taskIndex],
    }));

    result.shoppingTrips = result.shoppingTrips.map((trip: any) => ({
      ...trip,
      tasks: trip.tasks.map((idx: number) => tasks[idx]),
    }));

    this.logger.log(`Found ${result.shoppingTrips.length} shopping trips needed`);
    return result;
  }

  // ==================== Natural Language Search ====================

  /**
   * Search tasks using natural language
   */
  async filterTasksByIntent(query: string, tasks: Task[]): Promise<SearchResultDto> {
    this.logger.log(`Searching for: "${query}"`);

    if (tasks.length === 0) {
      return { matches: [], interpretation: query };
    }

    // For now, use a simple prompt
    const prompt = `Search for tasks matching: "${query}"`;
    const result = await this.claude.query(prompt);

    // Map back to task objects and sort by relevance
    const matches = result.matches
      .map((m: any) => ({
        task: tasks[m.taskIndex],
        relevanceScore: m.relevanceScore,
        reasoning: m.reasoning,
      }))
      .sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);

    this.logger.log(`Found ${matches.length} matches`);

    return {
      matches,
      interpretation: result.interpretation,
    };
  }

  // ==================== Insights & Analytics ====================

  /**
   * Analyze completion patterns and provide insights
   */
  async generateInsights(): Promise<InsightsDto> {
    this.logger.log('Generating insights...');

    // Get recent history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const history = await this.storage.getTaskHistory({
      startDate: thirtyDaysAgo,
      limit: 1000,
    });

    const currentTasks = await this.storage.getTasks({ completed: false });

    // For now, use a simple prompt
    const prompt = `Analyze patterns from ${history.length} completed tasks and ${currentTasks.length} active tasks`;
    const result = await this.claude.query(prompt);

    this.logger.log('Insights generated');
    return result;
  }

  // ==================== Helper Methods ====================

  /**
   * Classify and enrich new tasks automatically
   */
  async autoEnrichTasks(
    tasks: Task[],
  ): Promise<Array<{ taskId: string; metadata?: any; success: boolean; error?: string }>> {
    this.logger.log(`Auto-enriching ${tasks.length} tasks...`);

    const results: Array<{ taskId: string; metadata?: any; success: boolean; error?: string }> = [];

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
          aiReasoning: `Category: ${classification.reasoning}. Time: ${estimate.reasoning}`,
        };

        results.push({
          taskId: task.id,
          metadata,
          success: true,
        });

        // Rate limit courtesy
        await this.delay(500);
      } catch (error: any) {
        this.logger.error(`Failed to enrich task ${task.id}: ${error.message}`);
        results.push({
          taskId: task.id,
          success: false,
          error: error.message,
        });
      }
    }

    this.logger.log(
      `Auto-enrichment complete: ${results.filter((r) => r.success).length}/${tasks.length} successful`,
    );
    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}


/**
 * AI Controller (v1)
 * 
 * RPC-style AI operations API following Google API Design Guide.
 * All operations are POST with :verb suffix pattern.
 * 
 * Custom Methods:
 * - POST /v1/ai/classify     - Classify tasks into categories
 * - POST /v1/ai/prioritize   - Get prioritization recommendations
 * - POST /v1/ai/estimateTime - Estimate task duration
 * - POST /v1/ai/dailyPlan    - Generate daily plan
 * - POST /v1/ai/breakdown    - Break task into subtasks
 * - POST /v1/ai/insights     - Get productivity insights
 */

import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { AIOperationsService } from '../../../ai/services/operations.service';
import { EnrichmentService } from '../../../task/services/enrichment.service';
import { IStorageAdapter, Task } from '../../../common/interfaces';
import {
  ClassifyTasksRequestDto,
  PrioritizeTasksRequestDto,
  EstimateTimeRequestDto,
  DailyPlanRequestDto,
  BreakdownTaskRequestDto,
  InsightsRequestDto,
  ClassifyTasksResponseDto,
  PrioritizeTasksResponseDto,
  EstimateTimeResponseDto,
  DailyPlanResponseDto,
  BreakdownTaskResponseDto,
  InsightsResponseDto,
} from '../../dto';

@Controller('v1/ai')
export class AIController {
  private readonly logger = new Logger(AIController.name);

  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
    @Inject(forwardRef(() => AIOperationsService)) private readonly aiOps: AIOperationsService,
    @Inject(forwardRef(() => EnrichmentService)) private readonly enrichmentService: EnrichmentService,
  ) {}

  /**
   * Get AI suggestions for a new task (project, priority, due date)
   * POST /v1/ai/suggest-task
   */
  @Post('suggest-task')
  @HttpCode(HttpStatus.OK)
  async suggestTask(@Body() body: { content: string; description?: string }): Promise<{
    priority?: number;
    projectId?: string;
    dueDate?: string;
    category?: string;
    timeEstimate?: string;
  }> {
    this.logger.log(`Getting AI suggestions for task: ${body.content}`);

    if (!body.content || !body.content.trim()) {
      throw new BadRequestException({
        error: {
          code: 400,
          message: 'Task content is required',
          status: 'INVALID_ARGUMENT',
        },
      });
    }

    // Create a temporary task object for AI analysis
    const tempTask: Task = {
      id: 'temp',
      content: body.content.trim(),
      description: body.description?.trim(),
      priority: 1,
      isCompleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // Get classification (category/project)
      const classifications = await this.aiOps.classifyTasks([tempTask]);
      const classification = classifications[0];

      // Get time estimate
      const timeEstimate = await this.aiOps.estimateTaskDuration(tempTask);

      // Determine priority based on keywords in content
      let priority = 1; // Default to P4 (low)
      const contentLower = body.content.toLowerCase();
      const urgentKeywords = ['urgent', 'asap', 'critical', 'emergency', 'immediately', 'deadline'];
      const highKeywords = ['important', 'soon', 'priority', 'today', 'tomorrow'];
      
      if (urgentKeywords.some(keyword => contentLower.includes(keyword))) {
        priority = 4; // P1 (urgent)
      } else if (highKeywords.some(keyword => contentLower.includes(keyword))) {
        priority = 3; // P2 (high)
      } else if (timeEstimate.timeEstimateMinutes && timeEstimate.timeEstimateMinutes < 30) {
        priority = 2; // P3 (medium) for quick tasks
      }

      // Find project ID by category
      const projects = await this.storage.getProjects();
      const project = projects.find((p) => 
        p.name.toLowerCase().includes(classification.category.toLowerCase()) ||
        classification.category.toLowerCase().includes(p.name.toLowerCase())
      );

      return {
        priority,
        projectId: project?.id,
        category: classification.category,
        timeEstimate: timeEstimate.timeEstimate,
        // We could add due date suggestion based on priority and time estimate
        // For now, leaving it empty to let user decide
      };
    } catch (error: any) {
      this.logger.error(`Failed to get AI suggestions: ${error.message}`);
      // Return empty suggestions rather than failing completely
      return {
        priority: 1,
      };
    }
  }

  /**
   * Classify tasks into life area categories
   * POST /v1/ai/classify
   */
  @Post('classify')
  @HttpCode(HttpStatus.OK)
  async classifyTasks(@Body() body: ClassifyTasksRequestDto): Promise<ClassifyTasksResponseDto> {
    this.logger.log(`Classifying tasks (taskIds: ${body.taskIds?.length || 'all'}, force: ${body.force})`);

    const startTime = Date.now();
    let tasks: Task[];

    if (body.taskIds && body.taskIds.length > 0) {
      // Classify specific tasks
      const taskResults = await Promise.all(
        body.taskIds.map((id) => this.storage.getTask(id)),
      );
      tasks = taskResults.filter((t): t is Task => t !== null);

      if (tasks.length === 0) {
        throw new NotFoundException({
          error: {
            code: 404,
            message: 'No valid tasks found for the provided IDs',
            status: 'NOT_FOUND',
          },
        });
      }
    } else {
      // Classify unclassified tasks
      tasks = await this.enrichmentService.getUnclassifiedTasks({ force: body.force });
    }

    if (tasks.length === 0) {
      return {
        results: [],
        tasksProcessed: 0,
        tasksClassified: 0,
        duration: Date.now() - startTime,
      };
    }

    // Limit batch size
    const batchSize = body.batchSize ?? 10;
    const tasksToProcess = tasks.slice(0, batchSize);

    // Classify with AI
    const results = await this.aiOps.classifyTasks(tasksToProcess);

    // Save classifications
    let classified = 0;
    for (const result of results) {
      if (result.category) {
        await this.enrichmentService.enrichTask(result.taskId, {
          category: result.category,
          aiConfidence: result.confidence,
          aiReasoning: result.reasoning,
          classificationSource: 'ai',
        });
        classified++;
      }
    }

    return {
      results: results.map((r) => ({
        taskId: r.taskId,
        taskContent: tasksToProcess.find((t) => t.id === r.taskId)?.content || '',
        category: r.category || 'unknown',
        confidence: r.confidence || 0,
        reasoning: r.reasoning,
      })),
      tasksProcessed: tasksToProcess.length,
      tasksClassified: classified,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Get AI prioritization recommendations
   * POST /v1/ai/prioritize
   */
  @Post('prioritize')
  @HttpCode(HttpStatus.OK)
  async prioritizeTasks(@Body() body: PrioritizeTasksRequestDto): Promise<PrioritizeTasksResponseDto> {
    this.logger.log(`Prioritizing tasks (category: ${body.category}, limit: ${body.limit})`);

    const tasks = await this.storage.getTasks({
      category: body.category,
      limit: body.limit ?? 20,
      completed: false,
    });

    if (tasks.length === 0) {
      return {
        recommendations: [],
        startWith: null,
        defer: [],
        delegate: [],
      };
    }

    const result = await this.aiOps.prioritizeTasks(tasks);

    return {
      recommendations: (result.prioritized || []).map((p: any) => {
        const task = tasks[p.taskIndex] || tasks.find((t) => t.id === p.taskId);
        return {
          taskId: p.taskId || task?.id || '',
          taskContent: task?.content || '',
          recommendedPriority: p.priority || 2,
          urgencyScore: p.urgencyScore || 0.5,
          impactScore: p.impactScore || 0.5,
          reasoning: p.reason || '',
        };
      }),
      startWith: result.recommendations?.startWith || null,
      defer: result.recommendations?.defer || [],
      delegate: result.recommendations?.delegate || [],
    };
  }

  /**
   * Estimate time for a task
   * POST /v1/ai/estimateTime
   */
  @Post('estimateTime')
  @HttpCode(HttpStatus.OK)
  async estimateTime(@Body() body: EstimateTimeRequestDto): Promise<EstimateTimeResponseDto> {
    this.logger.log(`Estimating time for task: ${body.taskId}`);

    const task = await this.storage.getTask(body.taskId);

    if (!task) {
      throw new NotFoundException({
        error: {
          code: 404,
          message: `Task ${body.taskId} not found`,
          status: 'NOT_FOUND',
        },
      });
    }

    const result = await this.aiOps.estimateTaskDuration(task);

    // Save estimate
    await this.enrichmentService.enrichTask(body.taskId, {
      timeEstimate: result.timeEstimate,
      timeEstimateMinutes: result.timeEstimateMinutes,
      size: result.size,
      aiConfidence: result.confidence,
      aiReasoning: result.reasoning,
    });

    return {
      taskId: body.taskId,
      taskContent: task.content,
      estimate: result.timeEstimate || 'Unknown',
      timeEstimateMinutes: result.timeEstimateMinutes || 0,
      size: result.size || 'M',
      confidence: result.confidence || 0,
      reasoning: result.reasoning || '',
    };
  }

  /**
   * Batch estimate time for multiple tasks
   * POST /v1/ai/estimateBatch
   */
  @Post('estimateBatch')
  @HttpCode(HttpStatus.OK)
  async estimateBatch(@Body() body: { taskIds?: string[]; batchSize?: number }): Promise<{
    results: Array<{
      taskId: string;
      taskContent: string;
      estimate: string;
      timeEstimateMinutes: number;
      size: string;
      confidence: number;
      reasoning: string;
      error?: string;
    }>;
    tasksProcessed: number;
    tasksEstimated: number;
    duration: number;
  }> {
    const startTime = Date.now();
    this.logger.log(`Batch estimating tasks (taskIds: ${body.taskIds?.length || 'all without estimates'})`);

    let tasks: Task[];

    if (body.taskIds && body.taskIds.length > 0) {
      // Estimate specific tasks
      const taskResults = await Promise.all(
        body.taskIds.map((id) => this.storage.getTask(id)),
      );
      tasks = taskResults.filter((t): t is Task => t !== null);

      if (tasks.length === 0) {
        throw new NotFoundException({
          error: {
            code: 404,
            message: 'No valid tasks found for the provided IDs',
            status: 'NOT_FOUND',
          },
        });
      }
    } else {
      // Get tasks without estimates
      const allTasks = await this.storage.getTasks({ completed: false, limit: 500 });
      tasks = allTasks.filter(t => !t.metadata?.timeEstimateMinutes || t.metadata.timeEstimateMinutes === 0);
    }

    if (tasks.length === 0) {
      return {
        results: [],
        tasksProcessed: 0,
        tasksEstimated: 0,
        duration: Date.now() - startTime,
      };
    }

    // Limit batch size
    const batchSize = body.batchSize ?? 10;
    const tasksToProcess = tasks.slice(0, batchSize);

    // Estimate with AI (uses batch method internally)
    const estimateResults = await this.aiOps.estimateTasksBatch(tasksToProcess);

    // Save estimates and build response
    const results: Array<{
      taskId: string;
      taskContent: string;
      estimate: string;
      timeEstimateMinutes: number;
      size: string;
      confidence: number;
      reasoning: string;
      error?: string;
    }> = [];
    
    let estimated = 0;
    for (const result of estimateResults) {
      if ('error' in result) {
        results.push({
          taskId: result.taskId,
          taskContent: tasksToProcess.find(t => t.id === result.taskId)?.content || '',
          estimate: 'Error',
          timeEstimateMinutes: 0,
          size: 'M',
          confidence: 0,
          reasoning: '',
          error: result.error,
        });
        continue;
      }

      // Save the estimate
      await this.enrichmentService.enrichTask(result.taskId, {
        timeEstimate: result.timeEstimate,
        timeEstimateMinutes: result.timeEstimateMinutes,
        size: result.size,
        aiConfidence: result.confidence,
        aiReasoning: result.reasoning,
      });

      results.push({
        taskId: result.taskId,
        taskContent: tasksToProcess.find(t => t.id === result.taskId)?.content || '',
        estimate: result.timeEstimate || 'Unknown',
        timeEstimateMinutes: result.timeEstimateMinutes || 0,
        size: result.size || 'M',
        confidence: result.confidence || 0,
        reasoning: result.reasoning || '',
      });
      estimated++;
    }

    return {
      results,
      tasksProcessed: tasksToProcess.length,
      tasksEstimated: estimated,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Generate a daily plan
   * POST /v1/ai/dailyPlan
   */
  @Post('dailyPlan')
  @HttpCode(HttpStatus.OK)
  async dailyPlan(@Body() body: DailyPlanRequestDto): Promise<DailyPlanResponseDto> {
    this.logger.log(`Generating daily plan (hours: ${body.hoursAvailable})`);

    const tasks = await this.storage.getTasks({ completed: false, limit: 100 });

    if (tasks.length === 0) {
      return {
        summary: 'No tasks available',
        notes: 'Sync tasks from Todoist first',
        today: { tasks: [], totalTime: '0min' },
        thisWeek: { tasks: [], reasoning: 'No tasks to plan' },
      };
    }

    const context: any = {};
    if (body.hoursAvailable) {
      context.hoursAvailable = body.hoursAvailable;
    }
    if (body.focusCategory) {
      context.focusCategory = body.focusCategory;
    }

    const plan = await this.aiOps.suggestDailyPlan(tasks, context);

    return {
      summary: plan.plan || 'Daily plan generated',
      notes: plan.notes || plan.reasoning || '',
      today: {
        tasks: (plan.today?.tasks || []).map((t: any) => ({
          taskId: t.task?.id || t.taskId || '',
          content: t.task?.content || t.content || '',
          estimatedMinutes: t.estimatedMinutes || 0,
          reason: t.reasoning || t.reason || '',
        })),
        totalTime: plan.today?.totalTime || '0min',
      },
      thisWeek: {
        tasks: (plan.thisWeek?.tasks || []).map((t: any) => ({
          taskId: t?.id || t.taskId || '',
          content: t?.content || '',
        })),
        reasoning: plan.thisWeek?.reasoning || '',
      },
      needsSupplies: plan.needsSupplies
        ? {
            tasks: (plan.needsSupplies.tasks || []).map((t: any) => ({
              taskId: t?.id || '',
              content: t?.content || '',
            })),
            shoppingList: plan.needsSupplies.shoppingList || [],
            suggestion: plan.needsSupplies.suggestion || '',
          }
        : undefined,
      delegateToSpouse: plan.delegateToSpouse
        ? {
            tasks: (plan.delegateToSpouse.tasks || []).map((t: any) => ({
              taskId: t?.id || '',
              content: t?.content || '',
            })),
            reasoning: plan.delegateToSpouse.reasoning || '',
          }
        : undefined,
    };
  }

  /**
   * Break down a task into subtasks
   * POST /v1/ai/breakdown
   */
  @Post('breakdown')
  @HttpCode(HttpStatus.OK)
  async breakdownTask(@Body() body: BreakdownTaskRequestDto): Promise<BreakdownTaskResponseDto> {
    this.logger.log(`Breaking down task: ${body.taskId}`);

    const task = await this.storage.getTask(body.taskId);

    if (!task) {
      throw new NotFoundException({
        error: {
          code: 404,
          message: `Task ${body.taskId} not found`,
          status: 'NOT_FOUND',
        },
      });
    }

    const result = await this.aiOps.createSubtasks(task);

    return {
      taskId: body.taskId,
      taskContent: task.content,
      subtasks: (result.subtasks || []).map((s: any, index: number) => ({
        content: s.content || s.title || '',
        estimatedMinutes: s.estimatedMinutes || s.estimate || 30,
        order: index + 1,
      })),
      totalEstimate: result.totalEstimate || 'Unknown',
      supplyList: result.supplyList || [],
      notes: result.notes || '',
    };
  }

  /**
   * Get productivity insights
   * POST /v1/ai/insights
   */
  @Post('insights')
  @HttpCode(HttpStatus.OK)
  async getInsights(@Body() body: InsightsRequestDto): Promise<InsightsResponseDto> {
    this.logger.log(`Getting insights (days: ${body.days})`);

    const days = body.days ?? 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get completion history
    const history = await this.storage.getTaskHistory();
    const filtered = history.filter(
      (h) => h.completedAt && new Date(h.completedAt) >= since,
    );

    // Calculate basic stats
    const withTime = filtered.filter((h) => h.actualDuration);
    const avgTime = withTime.length > 0
      ? Math.round(withTime.reduce((sum, h) => sum + (h.actualDuration || 0), 0) / withTime.length)
      : undefined;

    // Count by category
    const byCategory: Record<string, number> = {};
    for (const entry of filtered) {
      const cat = entry.category || 'unclassified';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    // Find most productive category
    const mostProductiveCategory = Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)[0]?.[0];

    // Get AI insights
    const aiInsights = await this.aiOps.generateInsights();

    // Map patterns to insights if available, otherwise parse insights string
    const insightsList: InsightsResponseDto['insights'] = [];
    
    if (aiInsights.patterns && Array.isArray(aiInsights.patterns)) {
      for (const p of aiInsights.patterns) {
        insightsList.push({
          type: 'pattern',
          title: p.observation?.slice(0, 50) || 'Pattern',
          description: p.observation || '',
          data: { category: p.category, significance: p.significance },
        });
      }
    }
    
    // Add the insights string as a single insight if no patterns
    if (insightsList.length === 0 && aiInsights.insights) {
      insightsList.push({
        type: 'pattern',
        title: 'AI Analysis',
        description: typeof aiInsights.insights === 'string' 
          ? aiInsights.insights 
          : JSON.stringify(aiInsights.insights),
      });
    }

    return {
      insights: insightsList,
      recommendations: aiInsights.recommendations || [],
      period: `Last ${days} days`,
      stats: {
        tasksCompleted: filtered.length,
        averageCompletionTime: avgTime,
        mostProductiveCategory,
      },
    };
  }

  /**
   * Get comprehensive productivity insights with full stats and AI analysis
   * GET /v1/ai/insights/comprehensive
   */
  @Get('insights/comprehensive')
  async getComprehensiveInsights() {
    this.logger.log('Getting comprehensive insights');
    return this.aiOps.generateComprehensiveInsights();
  }
}


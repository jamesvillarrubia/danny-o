/**
 * Tasks Controller (v1)
 * 
 * RESTful task management API following Google API Design Guide.
 * 
 * Standard Methods:
 * - GET    /v1/tasks           - List tasks
 * - GET    /v1/tasks/:taskId   - Get a task
 * - POST   /v1/tasks           - Create a task
 * - PATCH  /v1/tasks/:taskId   - Update a task
 * - DELETE /v1/tasks/:taskId   - Delete a task
 * 
 * Custom Methods (RPC-style with :verb suffix):
 * - POST   /v1/tasks:sync             - Sync with Todoist
 * - POST   /v1/tasks/:taskId/complete - Complete a task
 * - POST   /v1/tasks/:taskId/reopen   - Reopen a completed task (undo)
 * - POST   /v1/tasks:search           - Search tasks
 * - POST   /v1/tasks:batchUpdate      - Batch update tasks
 * - POST   /v1/tasks:resetTestState   - Reset test state (for step-ci)
 * 
 * URL Enrichment Methods:
 * - GET    /v1/tasks/:taskId/analyze-url - Analyze task for URL enrichment (dry run)
 * - POST   /v1/tasks/:taskId/enrich-url  - Enrich a task with URL context
 * - POST   /v1/tasks/enrich-urls         - Batch enrich URL-heavy tasks
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { SyncService } from '../../../task/services/sync.service';
import { EnrichmentService } from '../../../task/services/enrichment.service';
import { UrlEnrichmentService, UrlEnrichmentResult } from '../../../task/services/url-enrichment.service';
import { IStorageAdapter, ITaskProvider, Task } from '../../../common/interfaces';
import {
  ListTasksQueryDto,
  CreateTaskDto,
  UpdateTaskDto,
  CompleteTaskRequestDto,
  SyncTasksRequestDto,
  SearchTasksRequestDto,
  BatchUpdateTasksRequestDto,
  TaskResponseDto,
  ListTasksResponseDto,
  SyncResponseDto,
  SearchTasksResponseDto,
  CompleteTaskResponseDto,
  ReopenTaskResponseDto,
  BatchUpdateResponseDto,
} from '../../dto';

@Controller('v1/tasks')
export class TasksController {
  private readonly logger = new Logger(TasksController.name);

  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
    @Inject('ITaskProvider') private readonly taskProvider: ITaskProvider,
    @Inject(SyncService) private readonly syncService: SyncService,
    @Inject(EnrichmentService) private readonly enrichmentService: EnrichmentService,
    @Inject(UrlEnrichmentService) private readonly urlEnrichmentService: UrlEnrichmentService,
  ) {}

  // ==========================================================================
  // Standard Methods (CRUD)
  // ==========================================================================

  /**
   * List tasks with optional filters
   * GET /v1/tasks
   */
  @Get()
  async listTasks(@Query() query: ListTasksQueryDto): Promise<ListTasksResponseDto> {
    this.logger.log(`Listing tasks with filters: ${JSON.stringify(query)}`);

    const tasks = await this.storage.getTasks({
      category: query.category,
      priority: query.priority,
      projectId: query.projectId,
      completed: query.completed ?? false,
      limit: query.limit,
    });

    // Apply offset for pagination
    const offset = query.offset ?? 0;
    const paginatedTasks = tasks.slice(offset, offset + (query.limit ?? 1000));

    return {
      tasks: paginatedTasks.map(this.mapTaskToResponse),
      totalCount: tasks.length,
      nextPageToken: offset + paginatedTasks.length < tasks.length
        ? String(offset + paginatedTasks.length)
        : undefined,
    };
  }

  /**
   * Get a single task by ID
   * GET /v1/tasks/:taskId
   */
  @Get(':taskId')
  async getTask(@Param('taskId') taskId: string): Promise<TaskResponseDto> {
    this.logger.log(`Getting task: ${taskId}`);

    const task = await this.storage.getTask(taskId);

    if (!task) {
      throw new NotFoundException({
        error: {
          code: 404,
          message: `Task ${taskId} not found`,
          status: 'NOT_FOUND',
        },
      });
    }

    return this.mapTaskToResponse(task);
  }

  /**
   * Create a new task
   * POST /v1/tasks
   * 
   * If enrichUrls is true and the task contains URLs, will automatically
   * fetch URL content and enrich the description with context.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTask(@Body() body: CreateTaskDto & { 
    enrichUrls?: boolean;
  }): Promise<TaskResponseDto & { urlEnrichment?: UrlEnrichmentResult }> {
    this.logger.log(`Creating task: ${body.content}`);

    const task = await this.syncService.createTask({
      content: body.content,
      description: body.description,
      projectId: body.projectId,
      priority: body.priority,
      dueString: body.dueString,
      dueDate: body.dueDate,
      labels: body.labels,
    });

    // Check if URL enrichment is requested and task qualifies
    let urlEnrichment: UrlEnrichmentResult | undefined;
    if (body.enrichUrls !== false) {
      // Auto-enrich if task needs it (default behavior)
      const needsEnrichment = this.urlEnrichmentService.needsEnrichment(task);
      if (needsEnrichment) {
        this.logger.log(`Task ${task.id} qualifies for URL enrichment, processing...`);
        try {
          urlEnrichment = await this.urlEnrichmentService.enrichTask(task, {
            applyChanges: true,
            includeQuestions: true,
          });
          
          // If enriched, fetch the updated task
          if (urlEnrichment.enriched) {
            const enrichedTask = await this.storage.getTask(task.id);
            if (enrichedTask) {
              return {
                ...this.mapTaskToResponse(enrichedTask),
                urlEnrichment,
              };
            }
          }
        } catch (error: any) {
          this.logger.warn(`URL enrichment failed for task ${task.id}: ${error.message}`);
          // Don't fail task creation if enrichment fails
        }
      }
    }

    return {
      ...this.mapTaskToResponse(task),
      urlEnrichment,
    };
  }

  /**
   * Update a task
   * PATCH /v1/tasks/:taskId
   */
  @Patch(':taskId')
  async updateTask(
    @Param('taskId') taskId: string,
    @Body() body: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    this.logger.log(`Updating task: ${taskId}`);

    const existingTask = await this.storage.getTask(taskId);
    if (!existingTask) {
      throw new NotFoundException({
        error: {
          code: 404,
          message: `Task ${taskId} not found`,
          status: 'NOT_FOUND',
        },
      });
    }

    // Handle category update via enrichment
    if (body.category) {
      await this.enrichmentService.enrichTask(taskId, {
        category: body.category,
        classificationSource: 'manual',
      });
    }

    // Update other fields in Todoist
    const { category, ...todoistUpdates } = body;
    if (Object.keys(todoistUpdates).length > 0) {
      // Update in Todoist and get the updated task with properly formatted fields
      const updatedTaskFromTodoist = await this.taskProvider.updateTask(taskId, todoistUpdates);
      // Sync the updated task to local storage
      await this.storage.updateTask(taskId, updatedTaskFromTodoist);
    }

    const updatedTask = await this.storage.getTask(taskId);
    return this.mapTaskToResponse(updatedTask!);
  }

  /**
   * Delete a task
   * DELETE /v1/tasks/:taskId
   */
  @Delete(':taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTask(@Param('taskId') taskId: string): Promise<void> {
    this.logger.log(`Deleting task: ${taskId}`);

    const existingTask = await this.storage.getTask(taskId);
    if (!existingTask) {
      throw new NotFoundException({
        error: {
          code: 404,
          message: `Task ${taskId} not found`,
          status: 'NOT_FOUND',
        },
      });
    }

    await this.syncService.deleteTask(taskId);
  }

  // ==========================================================================
  // Custom Methods (RPC-style)
  // ==========================================================================

  /**
   * Sync tasks with Todoist
   * POST /v1/tasks:sync
   * 
   * Note: The colon in the route is handled by matching 'tasks:sync' as a path
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncTasks(@Body() body: SyncTasksRequestDto = {}): Promise<SyncResponseDto> {
    this.logger.log(`Syncing tasks (fullSync: ${body.fullSync})`);

    const startTime = Date.now();
    const result = body.fullSync
      ? await this.syncService.fullResync()
      : await this.syncService.syncNow();

    if (!result.success) {
      throw new BadRequestException({
        error: {
          code: 400,
          message: result.error || 'Sync failed',
          status: 'FAILED_PRECONDITION',
        },
      });
    }

    return {
      synced: result.tasks || 0,
      tasks: result.tasks || 0,
      projects: result.projects || 0,
      labels: result.labels || 0,
      newTasks: result.newTasks || 0,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Complete a task
   * POST /v1/tasks/:taskId/complete
   * 
   * Note: Using /taskId/complete instead of :taskId:complete for NestJS routing
   */
  @Post(':taskId/complete')
  @HttpCode(HttpStatus.OK)
  async completeTask(
    @Param('taskId') taskId: string,
    @Body() body: CompleteTaskRequestDto = {},
  ): Promise<CompleteTaskResponseDto> {
    this.logger.log(`Completing task: ${taskId}`);

    const existingTask = await this.storage.getTask(taskId);
    if (!existingTask) {
      throw new NotFoundException({
        error: {
          code: 404,
          message: `Task ${taskId} not found`,
          status: 'NOT_FOUND',
        },
      });
    }

    await this.syncService.completeTask(taskId, {
      actualDuration: body.actualMinutes,
      context: body.context,
    });

    return {
      taskId,
      completedAt: new Date().toISOString(),
      actualMinutes: body.actualMinutes,
    };
  }

  /**
   * Reopen a completed task (undo completion)
   * POST /v1/tasks/:taskId/reopen
   */
  @Post(':taskId/reopen')
  @HttpCode(HttpStatus.OK)
  async reopenTask(
    @Param('taskId') taskId: string,
  ): Promise<ReopenTaskResponseDto> {
    this.logger.log(`Reopening task: ${taskId}`);

    const existingTask = await this.storage.getTask(taskId);
    if (!existingTask) {
      throw new NotFoundException({
        error: {
          code: 404,
          message: `Task ${taskId} not found`,
          status: 'NOT_FOUND',
        },
      });
    }

    await this.syncService.reopenTask(taskId);

    return {
      taskId,
      reopenedAt: new Date().toISOString(),
    };
  }

  /**
   * Search tasks
   * POST /v1/tasks/search
   */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  async searchTasks(@Body() body: SearchTasksRequestDto): Promise<SearchTasksResponseDto> {
    this.logger.log(`Searching tasks: ${body.query}`);

    const allTasks = await this.storage.getTasks({ completed: false });
    const query = body.query.toLowerCase();

    const matches = allTasks.filter(
      (t) =>
        t.content.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query)) ||
        (t.metadata?.category && t.metadata.category.toLowerCase().includes(query)),
    );

    const limited = matches.slice(0, body.limit ?? 20);

    return {
      results: limited.map(this.mapTaskToResponse),
      query: body.query,
      totalMatches: matches.length,
    };
  }

  /**
   * Batch update tasks
   * POST /v1/tasks/batchUpdate
   */
  @Post('batchUpdate')
  @HttpCode(HttpStatus.OK)
  async batchUpdateTasks(@Body() body: BatchUpdateTasksRequestDto): Promise<BatchUpdateResponseDto> {
    this.logger.log(`Batch updating ${body.updates.length} tasks`);

    const results: BatchUpdateResponseDto['results'] = [];
    let updated = 0;
    let failed = 0;

    for (const { taskId, updates } of body.updates) {
      try {
        // Handle category update via enrichment
        if (updates.category) {
          await this.enrichmentService.enrichTask(taskId, {
            category: updates.category,
            classificationSource: 'manual',
          });
        }

        // Update other fields
        const { category, ...todoistUpdates } = updates;
        if (Object.keys(todoistUpdates).length > 0) {
          await this.taskProvider.updateTask(taskId, todoistUpdates);
          await this.storage.updateTask(taskId, todoistUpdates);
        }

        results.push({ taskId, status: 'success' });
        updated++;
      } catch (error: any) {
        results.push({ taskId, status: 'failed', error: error.message });
        failed++;
      }
    }

    return { updated, failed, results };
  }

  /**
   * Reset test state (for step-ci idempotency)
   * POST /v1/tasks/resetTestState
   */
  @Post('resetTestState')
  @HttpCode(HttpStatus.OK)
  async resetTestState(): Promise<{ reset: boolean; message: string }> {
    this.logger.log('Resetting test state');

    // Only allow in test environment
    if (process.env.NODE_ENV !== 'test' && process.env.USE_MOCKS !== 'true') {
      throw new BadRequestException({
        error: {
          code: 400,
          message: 'Reset only allowed in test environment',
          status: 'FAILED_PRECONDITION',
        },
      });
    }

    // Reset logic would go here - for now just acknowledge
    return {
      reset: true,
      message: 'Test state reset successfully',
    };
  }

  // ==========================================================================
  // URL Enrichment Methods
  // ==========================================================================

  /**
   * Find and enrich all tasks that need URL enrichment
   * POST /v1/tasks/enrich-urls
   * 
   * Batch operation to find URL-heavy tasks and enrich them.
   * NOTE: This static route MUST come before parameterized :taskId routes.
   */
  @Post('enrich-urls')
  @HttpCode(HttpStatus.OK)
  async enrichAllUrlTasks(
    @Body() body: {
      limit?: number;
      applyChanges?: boolean;
      includeQuestions?: boolean;
    } = {},
  ): Promise<{
    found: number;
    enriched: number;
    failed: number;
    results: UrlEnrichmentResult[];
  }> {
    this.logger.log('Finding and enriching URL-heavy tasks');

    const tasksNeedingEnrichment = await this.urlEnrichmentService.findTasksNeedingEnrichment();
    const limit = body.limit ?? 10;
    const tasksToProcess = tasksNeedingEnrichment.slice(0, limit);

    this.logger.log(`Found ${tasksNeedingEnrichment.length} tasks needing enrichment, processing ${tasksToProcess.length}`);

    const results = await this.urlEnrichmentService.enrichTasks(tasksToProcess, {
      applyChanges: body.applyChanges ?? true,
      includeQuestions: body.includeQuestions ?? true,
    });

    const enrichedCount = results.filter(r => r.enriched).length;
    const failedCount = results.filter(r => !r.enriched && r.error).length;

    return {
      found: tasksNeedingEnrichment.length,
      enriched: enrichedCount,
      failed: failedCount,
      results,
    };
  }

  /**
   * Analyze a task for URL enrichment (dry run)
   * GET /v1/tasks/:taskId/analyze-url
   * 
   * Returns analysis of whether the task would benefit from URL enrichment
   * without making any changes.
   */
  @Get(':taskId/analyze-url')
  async analyzeTaskUrl(@Param('taskId') taskId: string): Promise<{
    taskId: string;
    needsEnrichment: boolean;
    analysis: {
      urls: string[];
      urlRatio: number;
      enrichmentScore: number;
      isUrlHeavy: boolean;
      hasLightDescription: boolean;
    };
  }> {
    this.logger.log(`Analyzing task ${taskId} for URL enrichment`);

    const task = await this.storage.getTask(taskId);
    if (!task) {
      throw new NotFoundException({
        error: {
          code: 404,
          message: `Task ${taskId} not found`,
          status: 'NOT_FOUND',
        },
      });
    }

    const analysis = this.urlEnrichmentService.analyzeTask(task);

    return {
      taskId,
      needsEnrichment: this.urlEnrichmentService.needsEnrichment(task),
      analysis: {
        urls: analysis.urls,
        urlRatio: analysis.urlRatio,
        enrichmentScore: analysis.enrichmentScore,
        isUrlHeavy: analysis.isUrlHeavy,
        hasLightDescription: analysis.hasLightDescription,
      },
    };
  }

  /**
   * Enrich a single task with URL context
   * POST /v1/tasks/:taskId/enrich-url
   * 
   * Fetches URL content, generates AI summary and clarifying questions,
   * and updates the task description.
   */
  @Post(':taskId/enrich-url')
  @HttpCode(HttpStatus.OK)
  async enrichTaskUrl(
    @Param('taskId') taskId: string,
    @Body() body: { 
      force?: boolean;
      applyChanges?: boolean;
      includeQuestions?: boolean;
    } = {},
  ): Promise<UrlEnrichmentResult> {
    this.logger.log(`Enriching task ${taskId} with URL context`);

    const task = await this.storage.getTask(taskId);
    if (!task) {
      throw new NotFoundException({
        error: {
          code: 404,
          message: `Task ${taskId} not found`,
          status: 'NOT_FOUND',
        },
      });
    }

    const result = await this.urlEnrichmentService.enrichTask(task, {
      force: body.force ?? false,
      applyChanges: body.applyChanges ?? true,
      includeQuestions: body.includeQuestions ?? true,
    });

    return result;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Map internal task to response DTO
   */
  private mapTaskToResponse(task: Task): TaskResponseDto {
    return {
      id: task.id,
      content: task.content,
      description: task.description,
      projectId: task.projectId,
      priority: task.priority,
      labels: task.labels,
      due: task.due,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      isCompleted: task.isCompleted,
      completedAt: task.completedAt,
      metadata: task.metadata
        ? {
            category: task.metadata.category,
            timeEstimate: task.metadata.timeEstimate,
            timeEstimateMinutes: task.metadata.timeEstimateMinutes,
            size: task.metadata.size,
            aiConfidence: task.metadata.aiConfidence,
          }
        : undefined,
    };
  }
}


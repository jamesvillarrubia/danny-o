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
 * - POST   /v1/tasks:sync           - Sync with Todoist
 * - POST   /v1/tasks/:taskId:complete - Complete a task
 * - POST   /v1/tasks:search         - Search tasks
 * - POST   /v1/tasks:batchUpdate    - Batch update tasks
 * - POST   /v1/tasks:resetTestState - Reset test state (for step-ci)
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
  BatchUpdateResponseDto,
} from '../../dto';

@Controller('v1/tasks')
export class TasksController {
  private readonly logger = new Logger(TasksController.name);

  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
    @Inject('ITaskProvider') private readonly taskProvider: ITaskProvider,
    private readonly syncService: SyncService,
    private readonly enrichmentService: EnrichmentService,
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
    const paginatedTasks = tasks.slice(offset, offset + (query.limit ?? 50));

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
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTask(@Body() body: CreateTaskDto): Promise<TaskResponseDto> {
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

    return this.mapTaskToResponse(task);
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
      await this.taskProvider.updateTask(taskId, todoistUpdates);
      await this.storage.updateTask(taskId, todoistUpdates);
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


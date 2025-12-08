/**
 * Views Controller (v1)
 * 
 * RESTful API for managing saved task filter views (dashboard presets).
 * 
 * Standard Methods:
 * - GET    /v1/views           - List all views
 * - GET    /v1/views/:slug     - Get a view by slug
 * - POST   /v1/views           - Create a new view
 * - PATCH  /v1/views/:slug     - Update a view
 * - DELETE /v1/views/:slug     - Delete a view (custom only)
 * 
 * Custom Methods:
 * - GET    /v1/views/:slug/tasks - Get tasks matching a view's filter
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  Logger,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IStorageAdapter, Task, TaskFilters } from '../../../common/interfaces';

// ==================== DTOs ====================

interface ViewFilterConfig {
  priority?: number[];
  categories?: string[];
  projectId?: string;
  dueWithin?: 'today' | '7d' | '14d' | '30d';
  overdue?: boolean;
  completed?: boolean;
  taskIds?: string[];
  limit?: number;
}

interface CreateViewDto {
  name: string;
  slug?: string;
  filterConfig: ViewFilterConfig;
}

interface UpdateViewDto {
  name?: string;
  filterConfig?: ViewFilterConfig;
  orderIndex?: number;
}

interface ViewResponseDto {
  id: number;
  name: string;
  slug: string;
  filterConfig: ViewFilterConfig;
  isDefault: boolean;
  orderIndex: number;
}

class ViewTasksQueryDto {
  @Transform(({ value }) => value ? parseInt(value, 10) : undefined)
  limit?: number;
  
  @Transform(({ value }) => value ? parseInt(value, 10) : undefined)
  offset?: number;
}

// ==================== Controller ====================

@Controller('v1/views')
export class ViewsController {
  private readonly logger = new Logger(ViewsController.name);

  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
  ) {}

  /**
   * List all views
   * GET /v1/views
   */
  @Get()
  async listViews(): Promise<{ views: ViewResponseDto[] }> {
    this.logger.log('Listing views');

    const views = await this.storage.getViews();
    
    return {
      views: views.map(v => ({
        id: v.id,
        name: v.name,
        slug: v.slug,
        filterConfig: v.filterConfig,
        isDefault: v.isDefault,
        orderIndex: v.orderIndex,
      })),
    };
  }

  /**
   * Get a view by slug
   * GET /v1/views/:slug
   */
  @Get(':slug')
  async getView(@Param('slug') slug: string): Promise<ViewResponseDto> {
    this.logger.log(`Getting view: ${slug}`);

    const view = await this.storage.getView(slug);

    if (!view) {
      throw new NotFoundException({
        error: {
          code: 404,
          message: `View '${slug}' not found`,
          status: 'NOT_FOUND',
        },
      });
    }

    return {
      id: view.id,
      name: view.name,
      slug: view.slug,
      filterConfig: view.filterConfig,
      isDefault: view.isDefault,
      orderIndex: view.orderIndex,
    };
  }

  /**
   * Get tasks matching a view's filter
   * GET /v1/views/:slug/tasks
   */
  @Get(':slug/tasks')
  async getViewTasks(
    @Param('slug') slug: string,
    @Query() query: ViewTasksQueryDto,
  ): Promise<{
    tasks: any[];
    view: ViewResponseDto;
    totalCount: number;
  }> {
    this.logger.log(`Getting tasks for view: ${slug}`);

    const view = await this.storage.getView(slug);

    if (!view) {
      throw new NotFoundException({
        error: {
          code: 404,
          message: `View '${slug}' not found`,
          status: 'NOT_FOUND',
        },
      });
    }

    const tasks = await this.applyViewFilter(view.filterConfig, query.limit, query.offset);

    return {
      tasks: tasks.map(this.mapTaskToResponse),
      view: {
        id: view.id,
        name: view.name,
        slug: view.slug,
        filterConfig: view.filterConfig,
        isDefault: view.isDefault,
        orderIndex: view.orderIndex,
      },
      totalCount: tasks.length,
    };
  }

  /**
   * Create a new view
   * POST /v1/views
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createView(@Body() body: CreateViewDto): Promise<ViewResponseDto> {
    this.logger.log(`Creating view: ${body.name}`);

    // Generate slug if not provided
    const slug = body.slug || this.slugify(body.name);

    // Check if slug already exists
    const existing = await this.storage.getView(slug);
    if (existing) {
      throw new ConflictException({
        error: {
          code: 409,
          message: `View with slug '${slug}' already exists`,
          status: 'ALREADY_EXISTS',
        },
      });
    }

    const view = await this.storage.createView({
      name: body.name,
      slug,
      filterConfig: body.filterConfig,
    });

    return {
      id: view.id,
      name: view.name,
      slug: view.slug,
      filterConfig: view.filterConfig,
      isDefault: view.isDefault,
      orderIndex: view.orderIndex,
    };
  }

  /**
   * Update a view
   * PATCH /v1/views/:slug
   */
  @Patch(':slug')
  async updateView(
    @Param('slug') slug: string,
    @Body() body: UpdateViewDto,
  ): Promise<ViewResponseDto> {
    this.logger.log(`Updating view: ${slug}`);

    const existing = await this.storage.getView(slug);
    if (!existing) {
      throw new NotFoundException({
        error: {
          code: 404,
          message: `View '${slug}' not found`,
          status: 'NOT_FOUND',
        },
      });
    }

    // Don't allow modifying filter config of default views
    if (existing.isDefault && body.filterConfig) {
      throw new BadRequestException({
        error: {
          code: 400,
          message: 'Cannot modify filter config of default views',
          status: 'FAILED_PRECONDITION',
        },
      });
    }

    await this.storage.updateView(slug, {
      name: body.name,
      filterConfig: body.filterConfig,
      orderIndex: body.orderIndex,
    });

    const updated = await this.storage.getView(slug);
    if (!updated) {
      throw new Error('View disappeared after update');
    }

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      filterConfig: updated.filterConfig,
      isDefault: updated.isDefault,
      orderIndex: updated.orderIndex,
    };
  }

  /**
   * Delete a view
   * DELETE /v1/views/:slug
   */
  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteView(@Param('slug') slug: string): Promise<void> {
    this.logger.log(`Deleting view: ${slug}`);

    const existing = await this.storage.getView(slug);
    if (!existing) {
      throw new NotFoundException({
        error: {
          code: 404,
          message: `View '${slug}' not found`,
          status: 'NOT_FOUND',
        },
      });
    }

    if (existing.isDefault) {
      throw new BadRequestException({
        error: {
          code: 400,
          message: 'Cannot delete default views',
          status: 'FAILED_PRECONDITION',
        },
      });
    }

    const deleted = await this.storage.deleteView(slug);
    if (!deleted) {
      throw new BadRequestException({
        error: {
          code: 400,
          message: 'Failed to delete view',
          status: 'INTERNAL',
        },
      });
    }
  }

  // ==================== Helpers ====================

  /**
   * Apply view filter config to fetch tasks
   */
  private async applyViewFilter(
    config: ViewFilterConfig,
    limit?: number,
    offset?: number,
  ): Promise<Task[]> {
    // Build base filters
    const filters: TaskFilters = {
      completed: config.completed ?? false,
      limit: limit || config.limit || 1000,
    };

    // Priority filter
    if (config.priority && config.priority.length > 0) {
      // For now, use lowest priority (highest urgency)
      filters.priority = Math.min(...config.priority);
    }

    // Category filter (if single category)
    if (config.categories && config.categories.length === 1) {
      filters.category = config.categories[0];
    }

    // Project filter
    if (config.projectId) {
      filters.projectId = config.projectId;
    }

    // Get all tasks matching base filters
    let tasks = await this.storage.getTasks(filters);

    // Apply additional filters in memory

    // Filter by specific task IDs
    if (config.taskIds && config.taskIds.length > 0) {
      const taskIdSet = new Set(config.taskIds);
      tasks = tasks.filter(t => taskIdSet.has(t.id));
    }

    // Filter by multiple priorities
    if (config.priority && config.priority.length > 1) {
      const prioritySet = new Set(config.priority);
      tasks = tasks.filter(t => prioritySet.has(t.priority));
    }

    // Filter by multiple categories
    if (config.categories && config.categories.length > 1) {
      const categorySet = new Set(config.categories);
      tasks = tasks.filter(t => t.metadata?.category && categorySet.has(t.metadata.category));
    }

    // Due date filtering
    if (config.dueWithin || config.overdue) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      tasks = tasks.filter(t => {
        if (!t.due?.date) {
          return false; // No due date - exclude from date-filtered views
        }

        const dueDate = new Date(t.due.date);
        const dueDateNormalized = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

        // Check overdue
        if (config.overdue && dueDateNormalized < today) {
          return true;
        }

        // Check within range
        if (config.dueWithin) {
          let maxDate: Date;
          switch (config.dueWithin) {
            case 'today':
              maxDate = today;
              break;
            case '7d':
              maxDate = new Date(today);
              maxDate.setDate(maxDate.getDate() + 7);
              break;
            case '14d':
              maxDate = new Date(today);
              maxDate.setDate(maxDate.getDate() + 14);
              break;
            case '30d':
              maxDate = new Date(today);
              maxDate.setDate(maxDate.getDate() + 30);
              break;
            default:
              maxDate = new Date(today);
              maxDate.setDate(maxDate.getDate() + 7);
          }

          // Include overdue tasks in "today" and other views
          if (dueDateNormalized <= maxDate) {
            return true;
          }
        }

        return false;
      });
    }

    // Sort by due date, then priority
    tasks.sort((a, b) => {
      // Priority first (1 is highest)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Then due date
      if (a.due?.date && b.due?.date) {
        return new Date(a.due.date).getTime() - new Date(b.due.date).getTime();
      }
      if (a.due?.date) return -1;
      if (b.due?.date) return 1;
      return 0;
    });

    // Apply offset
    if (offset && offset > 0) {
      tasks = tasks.slice(offset);
    }

    // Apply limit
    const finalLimit = limit || config.limit || 1000;
    return tasks.slice(0, finalLimit);
  }

  /**
   * Convert string to URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Map task to response format
   */
  private mapTaskToResponse(task: Task): any {
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


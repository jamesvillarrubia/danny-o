/**
 * Task Management MCP Tools
 * 
 * Basic task CRUD operations exposed as MCP tools.
 */

import { Injectable, Inject } from '@nestjs/common';
import { MCPTool, MCPToolHandler } from '../decorators';
import { IStorageAdapter, ITaskProvider } from '../../common/interfaces';
import { SyncService } from '../../task/services/sync.service';
import {
  ListTasksInputDto,
  GetTaskInputDto,
  UpdateTaskInputDto,
  CompleteTaskInputDto,
  TaskHistoryInputDto,
  CompleteTaskBySearchInputDto,
  RecentlyCompletedInputDto,
  ProductivityStatsInputDto,
} from '../dto';

@Injectable()
@MCPTool()
export class TaskTools {
  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
    @Inject('ITaskProvider') private readonly taskProvider: ITaskProvider,
    private readonly syncService: SyncService,
  ) {}

  @MCPToolHandler({
    name: 'list_todoist_tasks',
    description: 'List tasks from Todoist with optional filters (category, priority, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by life area category',
          enum: ['work', 'home-repair', 'home-maintenance', 'personal-family', 'speaking-gig', 'big-ideas', 'inbox-ideas'],
        },
        priority: {
          type: 'number',
          description: 'Filter by priority (1=lowest, 4=highest)',
          enum: [1, 2, 3, 4],
        },
        limit: {
          type: 'number',
          description: 'Maximum number of tasks to return',
          default: 50,
        },
      },
    },
  })
  async listTasks(args: ListTasksInputDto) {
    const tasks = await this.storage.getTasks({
      category: args.category,
      priority: args.priority,
      limit: args.limit || 50,
      completed: false,
    });

    return tasks;
  }

  @MCPToolHandler({
    name: 'get_todoist_task',
    description: 'Get details for a specific task by ID',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Todoist task ID',
        },
      },
      required: ['taskId'],
    },
  })
  async getTask(args: GetTaskInputDto) {
    const task = await this.storage.getTask(args.taskId);

    if (!task) {
      throw new Error(`Task ${args.taskId} not found`);
    }

    return task;
  }

  @MCPToolHandler({
    name: 'sync_todoist',
    description: 'Sync tasks with Todoist API (fetch latest)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  })
  async syncTodoist() {
    const result = await this.syncService.syncNow();
    return result;
  }

  @MCPToolHandler({
    name: 'update_task',
    description: 'Update a task (content, category, priority, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task ID to update',
        },
        content: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'number' },
        category: { type: 'string' },
      },
      required: ['taskId'],
    },
  })
  async updateTask(args: UpdateTaskInputDto) {
    const { taskId, category, ...updates } = args;

    // Handle category update via enrichment service would be better
    // For now, just update the task metadata
    if (category) {
      await this.storage.saveFieldMetadata(taskId, 'category', category, new Date());
    }

    // Update task in Todoist
    if (Object.keys(updates).length > 0) {
      await this.taskProvider.updateTask(taskId, updates);
    }

    const updatedTask = await this.storage.getTask(taskId);
    return updatedTask;
  }

  @MCPToolHandler({
    name: 'complete_task',
    description: 'Mark a task as complete',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task ID to complete',
        },
        actualMinutes: {
          type: 'number',
          description: 'Actual time taken in minutes (for learning)',
        },
      },
      required: ['taskId'],
    },
  })
  async completeTask(args: CompleteTaskInputDto) {
    const metadata: any = {};
    if (args.actualMinutes) {
      metadata.actualDuration = args.actualMinutes;
    }

    await this.syncService.completeTask(args.taskId, metadata);

    return { success: true, taskId: args.taskId };
  }

  @MCPToolHandler({
    name: 'get_task_history',
    description: 'Get completion history for analysis',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by category',
        },
        limit: {
          type: 'number',
          description: 'Number of results',
          default: 50,
        },
      },
    },
  })
  async getTaskHistory(args: TaskHistoryInputDto) {
    const history = await this.storage.getTaskHistory({
      category: args.category,
      limit: args.limit || 50,
    });

    return history;
  }

  @MCPToolHandler({
    name: 'complete_task_by_search',
    description: 'Complete a task by ID or fuzzy search text. Searches task content/description for matches.',
    inputSchema: {
      type: 'object',
      properties: {
        searchTerm: {
          type: 'string',
          description: 'Task ID or search text to find task (e.g., "vendor registration")',
        },
        actualMinutes: {
          type: 'number',
          description: 'Actual time taken in minutes (for learning)',
        },
      },
      required: ['searchTerm'],
    },
  })
  async completeTaskBySearch(args: CompleteTaskBySearchInputDto) {
    const searchTerm = args.searchTerm;

    // Try exact ID match first
    let task = await this.storage.getTask(searchTerm);

    // If not found by ID, fuzzy search
    if (!task) {
      const allTasks = await this.storage.getTasks({ completed: false });
      const matches = allTasks.filter(
        (t) =>
          t.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase())),
      );

      if (matches.length === 0) {
        throw new Error(`No tasks found matching "${searchTerm}"`);
      }

      if (matches.length === 1) {
        task = matches[0];
      } else {
        // Multiple matches - return them for user to disambiguate
        const matchList = matches.map((t) => ({
          id: t.id,
          content: t.content,
          category: t.metadata?.category || 'unclassified',
          priority: t.priority,
        }));

        return {
          multipleMatches: true,
          count: matches.length,
          matches: matchList,
          message: 'Multiple tasks found. Please use a specific task ID or more specific search term.',
        };
      }
    }

    // Complete the task
    const metadata: any = {};
    if (args.actualMinutes) {
      metadata.actualDuration = args.actualMinutes;
    }

    await this.syncService.completeTask(task.id, metadata);

    return {
      success: true,
      taskId: task.id,
      taskContent: task.content,
      actualMinutes: args.actualMinutes,
    };
  }

  @MCPToolHandler({
    name: 'get_recently_completed',
    description: 'View recently completed tasks with timestamps',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of completed tasks to return',
          default: 10,
        },
      },
    },
  })
  async getRecentlyCompleted(args: RecentlyCompletedInputDto) {
    const limit = args.limit || 10;
    const history = await this.storage.getTaskHistory({
      limit,
    });

    const formatted = history.map((entry) => {
      const date = entry.completedAt ? new Date(entry.completedAt) : new Date();
      const timeAgo = this.getTimeAgo(date);

      return {
        taskId: entry.taskId,
        content: entry.taskContent || 'Unknown task',
        completedAt: entry.completedAt,
        timeAgo,
        actualMinutes: entry.actualDuration || null,
        category: entry.category || 'unclassified',
      };
    });

    return {
      count: formatted.length,
      tasks: formatted,
    };
  }

  @MCPToolHandler({
    name: 'get_productivity_stats',
    description: 'Get productivity statistics (completed tasks, time tracking, by category)',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to analyze',
          default: 7,
        },
      },
    },
  })
  async getProductivityStats(args: ProductivityStatsInputDto) {
    const days = args.days || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const history = await this.storage.getTaskHistory();

    // Filter by date
    const filtered = history.filter((h) => h.completedAt && new Date(h.completedAt) >= since);

    const stats: any = {
      period: `Last ${days} days`,
      totalCompleted: filtered.length,
      withTimeTracking: 0,
      averageMinutes: 0,
      byCategory: {},
      byDay: {},
    };

    // Calculate stats
    const withTime = filtered.filter((h) => h.actualDuration);
    stats.withTimeTracking = withTime.length;

    if (withTime.length > 0) {
      const totalTime = withTime.reduce((sum, h) => sum + (h.actualDuration || 0), 0);
      stats.averageMinutes = Math.round(totalTime / withTime.length);
    }

    // By category
    for (const entry of filtered) {
      const cat = entry.category || 'unclassified';
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
    }

    // By day
    for (const entry of filtered) {
      const day = entry.completedAt ? new Date(entry.completedAt).toLocaleDateString() : 'unknown';
      stats.byDay[day] = (stats.byDay[day] || 0) + 1;
    }

    return stats;
  }

  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  }
}


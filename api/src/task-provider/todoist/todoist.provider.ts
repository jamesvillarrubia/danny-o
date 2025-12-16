/**
 * Todoist Provider
 * 
 * Implementation of ITaskProvider for Todoist API.
 * Wraps the @doist/todoist-api-typescript SDK with type conversions.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TodoistApi } from '@doist/todoist-api-typescript';
import { ITaskProvider } from '../../common/interfaces/task-provider.interface';
import {
  Task,
  Project,
  Label,
  TaskFilters,
  CreateTaskDto,
  UpdateTaskDto,
  Comment,
} from '../../common/interfaces/task.interface';

@Injectable()
export class TodoistProvider implements ITaskProvider {
  private readonly logger = new Logger(TodoistProvider.name);
  private api: TodoistApi;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Todoist API key is required');
    }
    this.api = new TodoistApi(apiKey);
    this.logger.log('Todoist provider initialized');
  }

  async getTasks(filters?: TaskFilters): Promise<Task[]> {
    try {
      this.logger.log('Fetching all tasks with pagination...');

      const params: any = {};
      if (filters?.projectId) params.projectId = filters.projectId;
      if (filters?.labelId) params.labelId = filters.labelId;
      if (filters?.filter) params.filter = filters.filter;

      let allTasks: any[] = [];
      let cursor: string | null = null;
      let pageCount = 0;

      do {
        if (cursor) {
          params.cursor = cursor;
        }

        const response = await this.api.getTasks(params);
        const tasks = (response as any)?.results || response || [];

        if (!Array.isArray(tasks)) {
          this.logger.warn('API returned invalid tasks response');
          break;
        }

        allTasks = allTasks.concat(tasks);
        cursor = (response as any)?.nextCursor || null;
        pageCount++;

        if (cursor) {
          this.logger.log(
            `Fetched page ${pageCount}: ${tasks.length} tasks (total: ${allTasks.length})`,
          );
        }
      } while (cursor);

      this.logger.log(`Fetched ${allTasks.length} total tasks across ${pageCount} page(s)`);

      return allTasks.map((t) => this.convertToTask(t));
    } catch (error) {
      this.logger.error(`Error fetching tasks: ${error.message}`);
      throw this.handleError(error);
    }
  }

  async getTask(taskId: string): Promise<Task> {
    try {
      this.logger.log(`Fetching task ${taskId}...`);
      const task = await this.api.getTask(taskId);
      return this.convertToTask(task);
    } catch (error) {
      this.logger.error(`Error fetching task ${taskId}: ${error.message}`);
      throw this.handleError(error);
    }
  }

  async createTask(data: CreateTaskDto): Promise<Task> {
    try {
      this.logger.log(`Creating task: ${data.content}`);
      
      // Build task data - dueString and dueDate are mutually exclusive
      const taskData: any = {
        content: data.content,
        description: data.description,
        projectId: data.projectId,
        parentId: data.parentId,
        priority: data.priority || 1,
        labels: data.labels || [],
      };

      // Add due date (prefer dueString over dueDate)
      if (data.dueString) {
        taskData.dueString = data.dueString;
      } else if (data.dueDate) {
        taskData.dueString = data.dueDate; // Use dueString for date
      }

      const task = await this.api.addTask(taskData);

      this.logger.log(`Created task ${task.id}`);
      return this.convertToTask(task);
    } catch (error) {
      this.logger.error(`Error creating task: ${error.message}`);
      throw this.handleError(error);
    }
  }

  async updateTask(taskId: string, updates: UpdateTaskDto): Promise<Task> {
    try {
      this.logger.log(`Updating task ${taskId}`);
      
      // Build update data - dueString and dueDate are mutually exclusive
      const updateData: any = { ...updates };
      
      // Handle due date conversion
      if (updateData.dueDate) {
        updateData.dueString = updateData.dueDate;
        delete updateData.dueDate;
      }
      
      // Handle duration - Todoist API uses duration and duration_unit
      if (updateData.duration !== undefined) {
        updateData.duration = updateData.duration;
        updateData.durationUnit = updateData.durationUnit || 'minute';
      }
      
      const task = await this.api.updateTask(taskId, updateData);
      this.logger.log(`Updated task ${taskId}`);
      return this.convertToTask(task);
    } catch (error) {
      this.logger.error(`Error updating task ${taskId}: ${error.message}`);
      throw this.handleError(error);
    }
  }

  /**
   * Update task duration in Todoist (for time blocking)
   * @param taskId The task ID
   * @param durationMinutes Duration in minutes
   */
  async updateTaskDuration(taskId: string, durationMinutes: number): Promise<Task> {
    try {
      this.logger.log(`Updating task ${taskId} duration to ${durationMinutes} minutes`);
      
      const task = await this.api.updateTask(taskId, {
        duration: durationMinutes,
        durationUnit: 'minute',
      });
      
      this.logger.log(`Updated task ${taskId} duration`);
      return this.convertToTask(task);
    } catch (error) {
      this.logger.error(`Error updating task ${taskId} duration: ${error.message}`);
      throw this.handleError(error);
    }
  }

  async moveTask(taskId: string, projectId: string): Promise<Task> {
    try {
      this.logger.log(`Moving task ${taskId} to project ${projectId}`);
      const task = await this.api.moveTask(taskId, { projectId });
      return this.convertToTask(task);
    } catch (error) {
      this.logger.error(`Error moving task ${taskId}: ${error.message}`);
      throw this.handleError(error);
    }
  }

  async closeTask(taskId: string): Promise<boolean> {
    try {
      this.logger.log(`Closing task ${taskId}`);
      await this.api.closeTask(taskId);
      this.logger.log(`Closed task ${taskId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error closing task ${taskId}: ${error.message}`);
      throw this.handleError(error);
    }
  }

  async reopenTask(taskId: string): Promise<boolean> {
    try {
      this.logger.log(`Reopening task ${taskId}`);
      await this.api.reopenTask(taskId);
      this.logger.log(`Reopened task ${taskId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error reopening task ${taskId}: ${error.message}`);
      throw this.handleError(error);
    }
  }

  async deleteTask(taskId: string): Promise<boolean> {
    try {
      this.logger.log(`Deleting task ${taskId}`);
      await this.api.deleteTask(taskId);
      this.logger.log(`Deleted task ${taskId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting task ${taskId}: ${error.message}`);
      throw this.handleError(error);
    }
  }

  async batchUpdateTasks(
    updates: Array<{ taskId: string; updates: UpdateTaskDto }>,
  ): Promise<Array<{ status: string; value?: Task; reason?: Error }>> {
    this.logger.log(`Batch updating ${updates.length} tasks...`);

    const results: Array<{ status: string; value?: Task; reason?: Error }> = [];

    // Process in batches to respect rate limits
    const batchSize = 10;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(({ taskId, updates }) => this.updateTask(taskId, updates)),
      );

      results.push(...batchResults);

      // Rate limit courtesy delay
      if (i + batchSize < updates.length) {
        await this.delay(100);
      }
    }

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    this.logger.log(`Batch update complete: ${successful} success, ${failed} failed`);

    return results;
  }

  async getProjects(): Promise<Project[]> {
    try {
      this.logger.log('Fetching all projects with pagination...');

      let allProjects: any[] = [];
      let cursor: string | null = null;
      let pageCount = 0;

      do {
        const params: any = cursor ? { cursor } : {};
        const response = await this.api.getProjects(params);
        const projects = (response as any)?.results || response || [];

        if (!Array.isArray(projects)) {
          this.logger.warn('API returned invalid projects response');
          break;
        }

        allProjects = allProjects.concat(projects);
        cursor = (response as any)?.nextCursor || null;
        pageCount++;
      } while (cursor);

      this.logger.log(`Fetched ${allProjects.length} total projects across ${pageCount} page(s)`);

      return allProjects.map((p) => this.convertToProject(p));
    } catch (error) {
      this.logger.error(`Error fetching projects: ${error.message}`);
      throw this.handleError(error);
    }
  }

  async getProject(projectId: string): Promise<Project> {
    try {
      const project = await this.api.getProject(projectId);
      return this.convertToProject(project);
    } catch (error) {
      this.logger.error(`Error fetching project ${projectId}: ${error.message}`);
      throw this.handleError(error);
    }
  }

  async getLabels(): Promise<Label[]> {
    try {
      this.logger.log('Fetching all labels with pagination...');

      let allLabels: any[] = [];
      let cursor: string | null = null;
      let pageCount = 0;

      do {
        const params: any = cursor ? { cursor } : {};
        const response = await this.api.getLabels(params);
        const labels = (response as any)?.results || response || [];

        if (!Array.isArray(labels)) {
          this.logger.warn('API returned invalid labels response');
          break;
        }

        allLabels = allLabels.concat(labels);
        cursor = (response as any)?.nextCursor || null;
        pageCount++;
      } while (cursor);

      this.logger.log(`Fetched ${allLabels.length} total labels across ${pageCount} page(s)`);

      return allLabels.map((l) => this.convertToLabel(l));
    } catch (error) {
      this.logger.error(`Error fetching labels: ${error.message}`);
      throw this.handleError(error);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.api.getProjects();
      this.logger.log('Connection test successful');
      return true;
    } catch (error) {
      this.logger.error(`Connection test failed: ${error.message}`);
      return false;
    }
  }

  // ==================== Helper Methods ====================

  private convertToTask(todoistTask: any): Task {
    return {
      id: todoistTask.id,
      content: todoistTask.content,
      description: todoistTask.description || '',
      projectId: todoistTask.projectId || todoistTask.project_id,
      parentId: todoistTask.parentId || null,
      priority: todoistTask.priority || 1,
      labels: todoistTask.labels || [],
      due: todoistTask.due
        ? {
            date: todoistTask.due.date,
            datetime: todoistTask.due.datetime || null,
            string: todoistTask.due.string || null,
            timezone: todoistTask.due.timezone || null,
            isRecurring: todoistTask.due.is_recurring || false,
          }
        : null,
      createdAt: todoistTask.createdAt || todoistTask.created_at,
      updatedAt: new Date().toISOString(),
      isCompleted: todoistTask.isCompleted || false,
      completedAt: todoistTask.completedAt || null,
    };
  }

  private convertToProject(todoistProject: any): Project {
    return {
      id: todoistProject.id,
      name: todoistProject.name,
      color: todoistProject.color,
      parentId: todoistProject.parentId || null,
      order: todoistProject.order,
      commentCount: todoistProject.commentCount,
      isShared: todoistProject.isShared || false,
      isFavorite: todoistProject.isFavorite || false,
      isInboxProject: todoistProject.isInboxProject || false,
      isTeamInbox: todoistProject.isTeamInbox || false,
      url: todoistProject.url,
    };
  }

  private convertToLabel(todoistLabel: any): Label {
    return {
      id: todoistLabel.id,
      name: todoistLabel.name,
      color: todoistLabel.color,
      order: todoistLabel.order,
      isFavorite: todoistLabel.isFavorite || false,
    };
  }

  private handleError(error: any): Error {
    if (error.httpStatusCode === 429) {
      return new Error('Rate limit exceeded. Please try again later.');
    }

    if (error.httpStatusCode === 401) {
      return new Error('Invalid Todoist API key. Please check your configuration.');
    }

    if (error.httpStatusCode === 403) {
      return new Error('Access forbidden. Check API key permissions.');
    }

    if (error.httpStatusCode === 404) {
      return new Error('Resource not found. It may have been deleted.');
    }

    if (error.httpStatusCode >= 500) {
      return new Error('Todoist service error. Please try again later.');
    }

    return error;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get comments for a task
   */
  async getComments(taskId: string): Promise<Comment[]> {
    try {
      this.logger.log(`Fetching comments for task ${taskId}`);
      
      const response = await this.api.getComments({ taskId });
      
      // The API returns an array directly, not an object with 'items'
      const comments = Array.isArray(response) ? response : [];
      
      return comments.map((comment: any) => ({
        id: comment.id,
        taskId: comment.taskId,
        projectId: comment.projectId,
        content: comment.content,
        postedAt: comment.postedAt,
        attachment: comment.fileAttachment ? {
          fileName: comment.fileAttachment.fileName || '',
          fileType: comment.fileAttachment.fileType || '',
          fileUrl: comment.fileAttachment.fileUrl || '',
          resourceType: comment.fileAttachment.resourceType,
        } : undefined,
      }));
    } catch (error: any) {
      this.logger.error(`Failed to fetch comments for task ${taskId}: ${error.message}`);
      // Return empty array instead of throwing to prevent blocking other operations
      return [];
    }
  }

  /**
   * Add a comment to a task
   */
  async addComment(taskId: string, content: string): Promise<Comment> {
    try {
      this.logger.log(`Adding comment to task ${taskId}`);
      
      const comment = await this.api.addComment({
        taskId,
        content,
      });
      
      this.logger.log(`Added comment ${comment.id} to task ${taskId}`);
      
      return {
        id: comment.id,
        taskId: comment.taskId,
        projectId: comment.projectId,
        content: comment.content,
        postedAt: comment.postedAt,
        attachment: comment.fileAttachment ? {
          fileName: comment.fileAttachment.fileName || '',
          fileType: comment.fileAttachment.fileType || '',
          fileUrl: comment.fileAttachment.fileUrl || '',
          resourceType: comment.fileAttachment.resourceType,
        } : undefined,
      };
    } catch (error: any) {
      this.logger.error(`Failed to add comment to task ${taskId}: ${error.message}`);
      throw error;
    }
  }
}


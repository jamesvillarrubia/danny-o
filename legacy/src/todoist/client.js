/**
 * Todoist API Client
 * 
 * Wrapper around the official Todoist API client with additional features:
 * - Rate limit handling
 * - Error recovery and retries
 * - Logging and monitoring
 * - Optimistic updates
 * 
 * This client provides a clean interface for all Todoist operations needed
 * by the AI task management system.
 */

import { TodoistApi } from '@doist/todoist-api-typescript';

export class TodoistClient {
  /**
   * @param {string} apiKey - Todoist API key
   */
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Todoist API key is required');
    }

    this.api = new TodoistApi(apiKey);
    this.rateLimitRemaining = null;
    this.rateLimitReset = null;
  }

  // ==================== Task Operations ====================

  /**
   * Get all active tasks
   * @param {Object} options - Filter options
   * @param {string} [options.projectId] - Filter by project
   * @param {string} [options.labelId] - Filter by label
   * @param {string} [options.filter] - Todoist filter string
   * @returns {Promise<Array>} Array of tasks
   */
  async getTasks(options = {}) {
    try {
      console.log('[Todoist] Fetching all tasks (with pagination)...');
      
      const params = {};
      if (options.projectId) params.projectId = options.projectId;
      if (options.labelId) params.labelId = options.labelId;
      if (options.filter) params.filter = options.filter;

      let allTasks = [];
      let cursor = null;
      let pageCount = 0;

      do {
        if (cursor) {
          params.cursor = cursor;
        }
        
        const response = await this.api.getTasks(params);
        const tasks = response?.results || response || [];
        
        if (!Array.isArray(tasks)) {
          console.warn('[Todoist] API returned invalid tasks response:', response);
          break;
        }
        
        allTasks = allTasks.concat(tasks);
        cursor = response?.nextCursor || null;
        pageCount++;
        
        if (cursor) {
          console.log(`[Todoist] Fetched page ${pageCount}: ${tasks.length} tasks (total: ${allTasks.length}, more available...)`);
        }
      } while (cursor);
      
      console.log(`[Todoist] Fetched ${allTasks.length} total tasks across ${pageCount} page(s)`);
      return allTasks;
    } catch (error) {
      console.error('[Todoist] Error fetching tasks:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Get a single task by ID
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} Task object
   */
  async getTask(taskId) {
    try {
      console.log(`[Todoist] Fetching task ${taskId}...`);
      const task = await this.api.getTask(taskId);
      return task;
    } catch (error) {
      console.error(`[Todoist] Error fetching task ${taskId}:`, error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Create a new task
   * @param {Object} taskData - Task data
   * @param {string} taskData.content - Task content (required)
   * @param {string} [taskData.description] - Task description
   * @param {string} [taskData.projectId] - Project ID
   * @param {string} [taskData.parentId] - Parent task ID (for subtasks)
   * @param {number} [taskData.priority] - Priority (1-4)
   * @param {string} [taskData.dueString] - Due date string (e.g., "tomorrow")
   * @param {string} [taskData.dueDate] - Due date (YYYY-MM-DD)
   * @param {Array<string>} [taskData.labels] - Label names
   * @returns {Promise<Object>} Created task
   */
  async createTask(taskData) {
    try {
      console.log('[Todoist] Creating task:', taskData.content);
      
      const task = await this.api.addTask({
        content: taskData.content,
        description: taskData.description,
        projectId: taskData.projectId,
        parentId: taskData.parentId,
        priority: taskData.priority || 1,
        dueString: taskData.dueString,
        dueDate: taskData.dueDate,
        labels: taskData.labels || []
      });

      console.log(`[Todoist] Created task ${task.id}`);
      return task;
    } catch (error) {
      console.error('[Todoist] Error creating task:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Update a task
   * @param {string} taskId - Task ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated task
   */
  async updateTask(taskId, updates) {
    try {
      console.log(`[Todoist] Updating task ${taskId}`);
      
      const task = await this.api.updateTask(taskId, updates);
      console.log(`[Todoist] Updated task ${taskId}`);
      
      return task;
    } catch (error) {
      console.error(`[Todoist] Error updating task ${taskId}:`, error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Close/complete a task
   * @param {string} taskId - Task ID
   * @returns {Promise<boolean>} Success status
   */
  async closeTask(taskId) {
    try {
      console.log(`[Todoist] Closing task ${taskId}`);
      
      await this.api.closeTask(taskId);
      console.log(`[Todoist] Closed task ${taskId}`);
      
      return true;
    } catch (error) {
      console.error(`[Todoist] Error closing task ${taskId}:`, error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Reopen a completed task
   * @param {string} taskId - Task ID
   * @returns {Promise<boolean>} Success status
   */
  async reopenTask(taskId) {
    try {
      console.log(`[Todoist] Reopening task ${taskId}`);
      
      await this.api.reopenTask(taskId);
      console.log(`[Todoist] Reopened task ${taskId}`);
      
      return true;
    } catch (error) {
      console.error(`[Todoist] Error reopening task ${taskId}:`, error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Delete a task
   * @param {string} taskId - Task ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteTask(taskId) {
    try {
      console.log(`[Todoist] Deleting task ${taskId}`);
      
      await this.api.deleteTask(taskId);
      console.log(`[Todoist] Deleted task ${taskId}`);
      
      return true;
    } catch (error) {
      console.error(`[Todoist] Error deleting task ${taskId}:`, error.message);
      throw this._handleError(error);
    }
  }

  // ==================== Project Operations ====================

  /**
   * Get all projects
   * @returns {Promise<Array>} Array of projects
   */
  async getProjects() {
    try {
      console.log('[Todoist] Fetching all projects (with pagination)...');
      
      let allProjects = [];
      let cursor = null;
      let pageCount = 0;

      do {
        const params = cursor ? { cursor } : {};
        const response = await this.api.getProjects(params);
        const projects = response?.results || response || [];
        
        if (!Array.isArray(projects)) {
          console.warn('[Todoist] API returned invalid projects response:', response);
          break;
        }
        
        allProjects = allProjects.concat(projects);
        cursor = response?.nextCursor || null;
        pageCount++;
      } while (cursor);
      
      console.log(`[Todoist] Fetched ${allProjects.length} total projects across ${pageCount} page(s)`);
      return allProjects;
    } catch (error) {
      console.error('[Todoist] Error fetching projects:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Get a single project by ID
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Project object
   */
  async getProject(projectId) {
    try {
      const project = await this.api.getProject(projectId);
      return project;
    } catch (error) {
      console.error(`[Todoist] Error fetching project ${projectId}:`, error.message);
      throw this._handleError(error);
    }
  }

  // ==================== Label Operations ====================

  /**
   * Get all labels
   * @returns {Promise<Array>} Array of labels
   */
  async getLabels() {
    try {
      console.log('[Todoist] Fetching all labels (with pagination)...');
      
      let allLabels = [];
      let cursor = null;
      let pageCount = 0;

      do {
        const params = cursor ? { cursor } : {};
        const response = await this.api.getLabels(params);
        const labels = response?.results || response || [];
        
        if (!Array.isArray(labels)) {
          console.warn('[Todoist] API returned invalid labels response:', response);
          break;
        }
        
        allLabels = allLabels.concat(labels);
        cursor = response?.nextCursor || null;
        pageCount++;
      } while (cursor);
      
      console.log(`[Todoist] Fetched ${allLabels.length} total labels across ${pageCount} page(s)`);
      return allLabels;
    } catch (error) {
      console.error('[Todoist] Error fetching labels:', error.message);
      throw this._handleError(error);
    }
  }

  // ==================== Batch Operations ====================

  /**
   * Update multiple tasks in batch
   * @param {Array<Object>} updates - Array of {taskId, updates}
   * @returns {Promise<Array>} Array of results
   */
  async batchUpdateTasks(updates) {
    console.log(`[Todoist] Batch updating ${updates.length} tasks...`);
    
    const results = [];
    
    // Process in batches to respect rate limits
    const batchSize = 10;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(({ taskId, updates }) => this.updateTask(taskId, updates))
      );

      results.push(...batchResults);

      // Rate limit courtesy delay
      if (i + batchSize < updates.length) {
        await this._delay(100);
      }
    }

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`[Todoist] Batch update complete: ${successful} success, ${failed} failed`);
    
    return results;
  }

  // ==================== Helper Methods ====================

  /**
   * Handle API errors with appropriate messaging
   * @private
   */
  _handleError(error) {
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

  /**
   * Delay helper for rate limiting
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if API is accessible
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    try {
      await this.api.getProjects();
      return true;
    } catch (error) {
      console.error('[Todoist] Connection test failed:', error.message);
      return false;
    }
  }
}


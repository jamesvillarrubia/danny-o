/**
 * Todoist Sync Service
 * 
 * Orchestrates synchronization between Todoist API and local storage.
 * 
 * Features:
 * - Uses Todoist Sync API v1 for efficient bulk data fetching (single request)
 * - Supports incremental sync via sync_token (only fetch changes)
 * - Comments are fetched in bulk with tasks, eliminating N+1 API calls
 * - Background sync on configurable interval
 * - Conflict detection and resolution
 * - Auto-classification trigger for new tasks
 * 
 * The sync engine is storage-agnostic and works with any StorageAdapter
 * implementation (SQLite, PostgreSQL, etc.).
 * 
 * @see https://developer.todoist.com/api/v1#tag/Sync
 */

import { Inject, Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ITaskProvider } from '../../common/interfaces/task-provider.interface';
import { IStorageAdapter } from '../../common/interfaces/storage-adapter.interface';
import { Task, TaskHistory, Project, Comment } from '../../common/interfaces';
import { ReconciliationService } from './reconciliation.service';
import { SyncOptionsDto, SyncResultDto, CompleteTaskDto, CreateTaskInputDto } from '../dto';
import { TodoistSyncProvider, BulkSyncResult } from '../../task-provider/todoist/todoist-sync.provider';

type SyncCallback = (tasks: Task[]) => Promise<void>;
type SyncCompleteCallback = (result: SyncResultDto) => Promise<void>;

@Injectable()
export class SyncService implements OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name);
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private lastSyncError: Error | null = null;
  private intervalMs: number;
  private onNewTasks: SyncCallback | null = null;
  private onSyncComplete: SyncCompleteCallback | null = null;

  /**
   * In-memory cache of comments by task ID from the last bulk sync.
   * This eliminates the need for N+1 API calls to fetch comments per task.
   */
  private cachedCommentsByTaskId: Map<string, Comment[]> = new Map();

  constructor(
    @Inject('ITaskProvider')
    private readonly taskProvider: ITaskProvider,
    @Inject('IStorageAdapter')
    private readonly storage: IStorageAdapter,
    @Inject(ReconciliationService)
    private readonly reconciler: ReconciliationService,
    @Optional()
    @Inject('ITodoistSyncProvider')
    private readonly syncProvider?: TodoistSyncProvider,
  ) {
    this.intervalMs = 300000; // Default: 5 minutes
  }

  /**
   * Clean up on module destroy
   */
  onModuleDestroy(): void {
    this.stop();
  }

  /**
   * Configure sync options and callbacks
   */
  configure(options: {
    intervalMs?: number;
    onNewTasks?: SyncCallback;
    onSyncComplete?: SyncCompleteCallback;
  }): void {
    if (options.intervalMs) {
      this.intervalMs = options.intervalMs;
    }
    if (options.onNewTasks) {
      this.onNewTasks = options.onNewTasks;
    }
    if (options.onSyncComplete) {
      this.onSyncComplete = options.onSyncComplete;
    }
  }

  /**
   * Start background sync
   */
  async start(): Promise<void> {
    this.logger.log(`Starting background sync (interval: ${this.intervalMs}ms)`);

    // Do initial sync
    await this.syncNow();

    // Set up recurring sync
    this.syncInterval = setInterval(() => {
      this.syncNow().catch((error) => {
        this.logger.error(`Background sync error: ${error.message}`);
        this.lastSyncError = error;
      });
    }, this.intervalMs);

    this.logger.log('Background sync started');
  }

  /**
   * Stop background sync
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.logger.log('Background sync stopped');
    }
  }

  /**
   * Perform a sync operation now using Sync API v1 for efficient bulk fetching.
   * 
   * Uses incremental sync when possible (via sync_token) to only fetch changes
   * since the last sync, dramatically reducing API calls and data transfer.
   */
  async syncNow(): Promise<SyncResultDto> {
    if (this.isSyncing) {
      this.logger.log('Sync already in progress, skipping');
      return {
        success: false,
        error: 'Sync already in progress',
        timestamp: new Date(),
      };
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      // Use Sync API if available, otherwise fall back to REST API
      if (this.syncProvider) {
        return await this.syncWithSyncApi(startTime);
      } else {
        return await this.syncWithRestApi(startTime);
      }
    } catch (error: any) {
      this.logger.error(`Sync failed: ${error.message}`);
      this.lastSyncError = error;

      return {
        success: false,
        error: error.message,
        timestamp: new Date(),
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Efficient sync using Todoist Sync API v1
   * - Single API call fetches ALL tasks, projects, labels, and comments
   * - Supports incremental sync to only fetch changes
   */
  private async syncWithSyncApi(startTime: number): Promise<SyncResultDto> {
    this.logger.log('Starting sync with Sync API v1...');

    // Get stored sync token for incremental sync
    const syncToken = await this.storage.getSyncToken();
    const isFullSync = syncToken === '*';

    this.logger.log(`Performing ${isFullSync ? 'full' : 'incremental'} sync...`);

    // Single API call to get everything!
    const bulkResult = await this.syncProvider!.bulkSync(syncToken);

    // Cache comments for later use (eliminates N+1 API calls)
    this.cachedCommentsByTaskId = bulkResult.commentsByTaskId;

    // Detect new tasks (for AI classification)
    const newTasks = await this.detectNewTasks(bulkResult.tasks);

    // Save to storage in parallel
    const [taskCount, projectCount, labelCount] = await Promise.all([
      this.storage.saveTasks(bulkResult.tasks),
      this.storage.saveProjects(bulkResult.projects),
      this.storage.saveLabels(bulkResult.labels),
    ]);

    // Reconcile metadata categories with actual Todoist projects
    await this.reconcileCategories(bulkResult.tasks, bulkResult.projects);

    // Save the new sync token for incremental sync next time
    await this.storage.setSyncToken(bulkResult.syncToken);
    await this.storage.setLastSyncTime(new Date());

    const duration = Date.now() - startTime;
    const commentsCount = bulkResult.commentsByTaskId.size;

    const result: SyncResultDto = {
      success: true,
      duration,
      tasks: taskCount,
      projects: projectCount,
      labels: labelCount,
      newTasks: newTasks.length,
      timestamp: new Date(),
    };

    this.logger.log(
      `Sync complete in ${duration}ms (1 API call): ` +
      `${taskCount} tasks, ${projectCount} projects, ${labelCount} labels, ` +
      `${commentsCount} tasks with comments, ${newTasks.length} new tasks`
    );

    // Trigger callbacks
    if (newTasks.length > 0 && this.onNewTasks) {
      await this.onNewTasks(newTasks);
    }

    if (this.onSyncComplete) {
      await this.onSyncComplete(result);
    }

    this.lastSyncError = null;
    return result;
  }

  /**
   * Fallback sync using REST API (less efficient, multiple API calls)
   */
  private async syncWithRestApi(startTime: number): Promise<SyncResultDto> {
    this.logger.log('Starting sync with REST API (fallback mode)...');

    // Fetch data from Todoist (3 API calls)
    const [tasks, projects, labels] = await Promise.all([
      this.taskProvider.getTasks(),
      this.taskProvider.getProjects(),
      this.taskProvider.getLabels(),
    ]);

    // Detect new tasks (for AI classification)
    const newTasks = await this.detectNewTasks(tasks);

    // Save to storage
    const [taskCount, projectCount, labelCount] = await Promise.all([
      this.storage.saveTasks(tasks),
      this.storage.saveProjects(projects),
      this.storage.saveLabels(labels),
    ]);

    // Reconcile metadata categories with actual Todoist projects
    await this.reconcileCategories(tasks, projects);

    // Update last sync time
    await this.storage.setLastSyncTime(new Date());

    const duration = Date.now() - startTime;
    const result: SyncResultDto = {
      success: true,
      duration,
      tasks: taskCount,
      projects: projectCount,
      labels: labelCount,
      newTasks: newTasks.length,
      timestamp: new Date(),
    };

    this.logger.log(`Sync complete in ${duration}ms (3 API calls): ${JSON.stringify({
      tasks: taskCount,
      projects: projectCount,
      labels: labelCount,
      newTasks: newTasks.length,
    })}`);

    // Trigger callbacks
    if (newTasks.length > 0 && this.onNewTasks) {
      await this.onNewTasks(newTasks);
    }

    if (this.onSyncComplete) {
      await this.onSyncComplete(result);
    }

    this.lastSyncError = null;
    return result;
  }

  /**
   * Detect tasks that are new since last sync
   */
  private async detectNewTasks(currentTasks: Task[]): Promise<Task[]> {
    try {
      // Get all existing task IDs from storage
      const existingTasks = await this.storage.getTasks({ completed: false });
      const existingIds = new Set(existingTasks.map((t) => t.id));

      // Find tasks that don't exist in storage
      const newTasks = currentTasks.filter((task) => !existingIds.has(task.id));

      if (newTasks.length > 0) {
        this.logger.log(`Detected ${newTasks.length} new tasks`);
      }

      return newTasks;
    } catch (error: any) {
      this.logger.error(`Error detecting new tasks: ${error.message}`);
      return [];
    }
  }

  /**
   * Push local changes to Todoist
   */
  async pushTaskUpdate(taskId: string, updates: any): Promise<boolean> {
    try {
      this.logger.log(`Pushing updates for task ${taskId}`);

      // Update in Todoist
      await this.taskProvider.updateTask(taskId, updates);

      // Update in local storage
      await this.storage.updateTask(taskId, updates);

      this.logger.log(`Successfully pushed updates for task ${taskId}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to push updates for task ${taskId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Complete a task both locally and in Todoist
   */
  async completeTask(taskId: string, completionMetadata: CompleteTaskDto = {}): Promise<boolean> {
    try {
      this.logger.log(`Completing task ${taskId}`);

      // Get task details before completing
      const task = await this.storage.getTask(taskId);

      if (!task) {
        throw new Error(`Task ${taskId} not found in storage`);
      }

      // Close in Todoist
      await this.taskProvider.closeTask(taskId);

      // Update in storage
      await this.storage.updateTask(taskId, {
        isCompleted: true,
        completedAt: new Date().toISOString(),
      });

      // Save completion history for learning
      const historyData: Partial<TaskHistory> = {
        taskContent: task.content,
        completedAt: new Date(),
        category: task.metadata?.category,
        actualDuration: completionMetadata.actualDuration,
        context: completionMetadata.context,
      };

      await this.storage.saveTaskCompletion(taskId, historyData);

      this.logger.log(`Task ${taskId} completed successfully`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to complete task ${taskId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reopen a completed task both locally and in Todoist.
   * This is used to undo a task completion.
   */
  async reopenTask(taskId: string): Promise<boolean> {
    try {
      this.logger.log(`Reopening task ${taskId}`);

      // Get task details
      const task = await this.storage.getTask(taskId);

      if (!task) {
        throw new Error(`Task ${taskId} not found in storage`);
      }

      // Reopen in Todoist
      await this.taskProvider.reopenTask(taskId);

      // Update in storage
      await this.storage.updateTask(taskId, {
        isCompleted: false,
        completedAt: null,
      });

      this.logger.log(`Task ${taskId} reopened successfully`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to reopen task ${taskId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new task in Todoist and sync to storage
   */
  async createTask(taskData: CreateTaskInputDto): Promise<Task> {
    try {
      this.logger.log(`Creating new task: ${taskData.content}`);

      // Create in Todoist
      const task = await this.taskProvider.createTask(taskData);

      // Save to storage
      await this.storage.saveTasks([task]);

      this.logger.log(`Created task ${task.id}`);
      return task;
    } catch (error: any) {
      this.logger.error(`Failed to create task: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a task from both Todoist and storage
   */
  async deleteTask(taskId: string): Promise<boolean> {
    try {
      this.logger.log(`Deleting task ${taskId}`);

      // Delete from Todoist (if method exists)
      // await this.taskProvider.deleteTask(taskId);

      // Delete from storage
      await this.storage.deleteTask(taskId);

      this.logger.log(`Task ${taskId} deleted successfully`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to delete task ${taskId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get sync status
   */
  getStatus(): {
    isRunning: boolean;
    isSyncing: boolean;
    intervalMs: number;
    lastError: string | null;
  } {
    return {
      isRunning: this.syncInterval !== null,
      isSyncing: this.isSyncing,
      intervalMs: this.intervalMs,
      lastError: this.lastSyncError ? this.lastSyncError.message : null,
    };
  }

  /**
   * Force a full resync (clears sync token to force full data fetch)
   */
  async fullResync(): Promise<SyncResultDto> {
    this.logger.log('Performing full resync (clearing sync token)...');
    
    // Clear the sync token to force a full sync
    await this.storage.setSyncToken('*');
    
    return await this.syncNow();
  }

  /**
   * Reconcile task metadata categories with actual Todoist project assignments
   * Updates local metadata to match Todoist as the source of truth
   */
  private async reconcileCategories(tasks: Task[], projects: Project[]): Promise<void> {
    this.logger.log('Reconciling task metadata with Todoist state...');

    let manualChanges = 0;
    let clearedRecommendations = 0;

    for (const task of tasks) {
      const metadata = await this.storage.getTaskMetadata(task.id);
      const lastSyncedState = await this.storage.getLastSyncedState(task.id);

      // Analyze changes
      const analysis = await this.reconciler.detectChanges(task, metadata, lastSyncedState);

      if (analysis.anyChangedManually) {
        // User made manual changes after AI classification
        this.logger.log(`Task ${task.id} changed manually: ${analysis.reason}`);

        // If content changed, clear ALL AI metadata (task needs full reclassification)
        if (analysis.contentChangedManually) {
          await this.storage.saveFieldMetadata(task.id, 'recommended_category', null, null);
          await this.storage.saveFieldMetadata(task.id, 'time_estimate_minutes', null, null);
          await this.storage.saveFieldMetadata(task.id, 'priority_score', null, null);
          await this.storage.saveFieldMetadata(task.id, 'recommendation_applied', false, null);
          await this.storage.saveFieldMetadata(task.id, 'classification_source', null, null);
          clearedRecommendations++;
        } else {
          // Only project/labels changed - mark as manual override
          const currentCategory = this.reconciler.getCategoryFromProject(task.projectId, projects);
          if (currentCategory) {
            await this.storage.saveFieldMetadata(
              task.id,
              'recommended_category',
              currentCategory,
              new Date(),
            );
            await this.storage.saveFieldMetadata(task.id, 'recommendation_applied', true, null);
            // Mark as manual so classify --all skips it
            await this.storage.saveFieldMetadata(task.id, 'classification_source', 'manual', null);
          }
        }

        manualChanges++;
      }

      // Always update last synced state to current Todoist state
      await this.storage.saveLastSyncedState(task.id, task, new Date());
    }

    if (manualChanges > 0) {
      this.logger.log(
        `Detected ${manualChanges} tasks with manual changes, cleared ${clearedRecommendations} recommendations`,
      );
    }
  }

  /**
   * Attach comments to tasks efficiently.
   * 
   * OPTIMIZATION: Uses cached comments from the last bulk sync instead of
   * making N API calls (one per task). This eliminates the N+1 problem.
   * 
   * If cache is empty (e.g., no sync has been done), falls back to REST API
   * with rate limiting.
   * 
   * @param tasks - Tasks to attach comments to
   * @param options - Options for fallback behavior
   * @returns Tasks with comments attached
   */
  async fetchCommentsForTasks(
    tasks: Task[], 
    options: { respectRateLimits?: boolean; forceRefresh?: boolean } = {}
  ): Promise<Task[]> {
    const { respectRateLimits = true, forceRefresh = false } = options;
    
    this.logger.log(`Attaching comments to ${tasks.length} tasks...`);
    
    if (tasks.length === 0) {
      return tasks;
    }

    // If we have cached comments from Sync API and don't need refresh, use them
    if (this.cachedCommentsByTaskId.size > 0 && !forceRefresh) {
      this.logger.log(`Using cached comments from Sync API (0 additional API calls)`);
      return tasks.map(task => ({
        ...task,
        comments: this.cachedCommentsByTaskId.get(task.id) || [],
      }));
    }

    // Fallback: If Sync API available but cache empty, do a FULL sync to populate
    // Note: We use fullResync() instead of syncNow() because incremental sync
    // only returns changes, not the full data set including all comments
    if (this.syncProvider && this.cachedCommentsByTaskId.size === 0) {
      this.logger.log('Comments cache empty, performing full sync to populate...');
      await this.fullResync();
      
      // Now use the cached comments
      return tasks.map(task => ({
        ...task,
        comments: this.cachedCommentsByTaskId.get(task.id) || [],
      }));
    }

    // Final fallback: REST API with rate limiting (N+1 problem, but necessary)
    this.logger.warn('Falling back to REST API for comments (N+1 API calls)');
    return await this.fetchCommentsViaRestApi(tasks, respectRateLimits);
  }

  /**
   * Fallback method to fetch comments via REST API (N+1 calls)
   */
  private async fetchCommentsViaRestApi(tasks: Task[], respectRateLimits: boolean): Promise<Task[]> {
    const tasksWithComments: Task[] = [];
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      try {
        const comments = await this.taskProvider.getComments(task.id);
        tasksWithComments.push({ ...task, comments });
        
        // Rate limit: 200ms delay between requests
        if (respectRateLimits && i < tasks.length - 1) {
          await this.delay(200);
        }
      } catch (error: any) {
        // If rate limit hit, stop fetching and return what we have
        if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
          this.logger.warn(`Rate limit hit after ${i + 1} tasks. Returning tasks fetched so far.`);
          return [...tasksWithComments, ...tasks.slice(i)];
        }
        
        this.logger.warn(`Failed to fetch comments for task ${task.id}: ${error.message}`);
        tasksWithComments.push(task);
      }
    }
    
    return tasksWithComments;
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Add a comment to a task
   */
  async addCommentToTask(taskId: string, content: string): Promise<void> {
    try {
      this.logger.log(`Adding comment to task ${taskId}`);
      await this.taskProvider.addComment(taskId, content);
      this.logger.log(`Comment added to task ${taskId}`);
    } catch (error: any) {
      this.logger.error(`Failed to add comment to task ${taskId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the last sync timestamp
   */
  async getLastSyncTime(): Promise<Date | null> {
    return this.storage.getLastSyncTime();
  }

  /**
   * Get all local tasks from storage
   */
  async getLocalTasks(filters?: { completed?: boolean }): Promise<Task[]> {
    return this.storage.getTasks(filters);
  }
}

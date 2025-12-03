/**
 * Todoist Sync Engine
 * 
 * Orchestrates synchronization between Todoist API and local storage.
 * Features:
 * - Background sync on configurable interval
 * - Conflict detection and resolution
 * - Incremental updates for efficiency
 * - Auto-classification trigger for new tasks
 * 
 * The sync engine is storage-agnostic and works with any StorageAdapter
 * implementation (SQLite, PostgreSQL, etc.).
 */

import { TodoistClient } from './client.js';
import { TaskReconciler } from './reconciliation.js';

export class SyncEngine {
  /**
   * @param {TodoistClient} todoistClient - Todoist API client
   * @param {StorageAdapter} storage - Storage adapter
   * @param {Object} options - Sync options
   * @param {number} [options.intervalMs] - Sync interval in milliseconds
   * @param {Function} [options.onNewTasks] - Callback for newly detected tasks
   * @param {Function} [options.onSyncComplete] - Callback after each sync
   */
  constructor(todoistClient, storage, options = {}) {
    this.todoist = todoistClient;
    this.storage = storage;
    this.intervalMs = options.intervalMs || 300000; // Default: 5 minutes
    this.onNewTasks = options.onNewTasks || null;
    this.onSyncComplete = options.onSyncComplete || null;
    
    this.syncInterval = null;
    this.isSyncing = false;
    this.lastSyncError = null;
  }

  /**
   * Start background sync
   * @returns {Promise<void>}
   */
  async start() {
    console.log(`[Sync] Starting background sync (interval: ${this.intervalMs}ms)`);
    
    // Do initial sync
    await this.syncNow();

    // Set up recurring sync
    this.syncInterval = setInterval(() => {
      this.syncNow().catch(error => {
        console.error('[Sync] Background sync error:', error);
        this.lastSyncError = error;
      });
    }, this.intervalMs);

    console.log('[Sync] Background sync started');
  }

  /**
   * Stop background sync
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[Sync] Background sync stopped');
    }
  }

  /**
   * Perform a sync operation now
   * @returns {Promise<Object>} Sync result summary
   */
  async syncNow() {
    if (this.isSyncing) {
      console.log('[Sync] Sync already in progress, skipping');
      return { skipped: true };
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      console.log('[Sync] Starting sync...');

      // Fetch data from Todoist
      const [tasks, projects, labels] = await Promise.all([
        this.todoist.getTasks(),
        this.todoist.getProjects(),
        this.todoist.getLabels()
      ]);

      // Detect new tasks (for AI classification)
      const newTasks = await this._detectNewTasks(tasks);

      // Save to storage
      const [taskCount, projectCount, labelCount] = await Promise.all([
        this.storage.saveTasks(tasks),
        this.storage.saveProjects(projects),
        this.storage.saveLabels(labels)
      ]);

      // Reconcile metadata categories with actual Todoist projects
      await this._reconcileCategories(tasks, projects);

      // Update last sync time
      await this.storage.setLastSyncTime(new Date());

      const duration = Date.now() - startTime;
      const result = {
        success: true,
        duration,
        tasks: taskCount,
        projects: projectCount,
        labels: labelCount,
        newTasks: newTasks.length,
        timestamp: new Date()
      };

      console.log(`[Sync] Sync complete in ${duration}ms:`, {
        tasks: taskCount,
        projects: projectCount,
        labels: labelCount,
        newTasks: newTasks.length
      });

      // Trigger callbacks
      if (newTasks.length > 0 && this.onNewTasks) {
        await this.onNewTasks(newTasks);
      }

      if (this.onSyncComplete) {
        await this.onSyncComplete(result);
      }

      this.lastSyncError = null;
      return result;

    } catch (error) {
      console.error('[Sync] Sync failed:', error);
      this.lastSyncError = error;
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Detect tasks that are new since last sync
   * @private
   */
  async _detectNewTasks(currentTasks) {
    try {
      // Get all existing task IDs from storage
      const existingTasks = await this.storage.getTasks({ completed: false });
      const existingIds = new Set(existingTasks.map(t => t.id));

      // Find tasks that don't exist in storage
      const newTasks = currentTasks.filter(task => !existingIds.has(task.id));

      if (newTasks.length > 0) {
        console.log(`[Sync] Detected ${newTasks.length} new tasks`);
      }

      return newTasks;
    } catch (error) {
      console.error('[Sync] Error detecting new tasks:', error);
      return [];
    }
  }

  /**
   * Push local changes to Todoist
   * @param {string} taskId - Task ID
   * @param {Object} updates - Changes to push
   * @returns {Promise<boolean>} Success status
   */
  async pushTaskUpdate(taskId, updates) {
    try {
      console.log(`[Sync] Pushing updates for task ${taskId}`);

      // Update in Todoist
      await this.todoist.updateTask(taskId, updates);

      // Update in local storage
      await this.storage.updateTask(taskId, updates);

      console.log(`[Sync] Successfully pushed updates for task ${taskId}`);
      return true;

    } catch (error) {
      console.error(`[Sync] Failed to push updates for task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Complete a task both locally and in Todoist
   * @param {string} taskId - Task ID
   * @param {Object} completionMetadata - Metadata for learning
   * @returns {Promise<boolean>} Success status
   */
  async completeTask(taskId, completionMetadata = {}) {
    try {
      console.log(`[Sync] Completing task ${taskId}`);

      // Get task details before completing
      const task = await this.storage.getTask(taskId);
      
      if (!task) {
        throw new Error(`Task ${taskId} not found in storage`);
      }

      // Close in Todoist
      await this.todoist.closeTask(taskId);

      // Update in storage
      await this.storage.updateTask(taskId, {
        isCompleted: true,
        completedAt: new Date().toISOString()
      });

      // Save completion history for learning
      await this.storage.saveTaskCompletion(taskId, {
        taskContent: task.content,
        completedAt: new Date(),
        category: task.metadata?.category,
        actualDuration: completionMetadata.actualDuration,
        context: completionMetadata.context
      });

      console.log(`[Sync] Task ${taskId} completed successfully`);
      return true;

    } catch (error) {
      console.error(`[Sync] Failed to complete task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new task in Todoist and sync to storage
   * @param {Object} taskData - Task data
   * @returns {Promise<Object>} Created task
   */
  async createTask(taskData) {
    try {
      console.log('[Sync] Creating new task:', taskData.content);

      // Create in Todoist
      const task = await this.todoist.createTask(taskData);

      // Save to storage
      await this.storage.saveTasks([task]);

      console.log(`[Sync] Created task ${task.id}`);
      return task;

    } catch (error) {
      console.error('[Sync] Failed to create task:', error);
      throw error;
    }
  }

  /**
   * Delete a task from both Todoist and storage
   * @param {string} taskId - Task ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteTask(taskId) {
    try {
      console.log(`[Sync] Deleting task ${taskId}`);

      // Delete from Todoist
      await this.todoist.deleteTask(taskId);

      // Delete from storage
      await this.storage.deleteTask(taskId);

      console.log(`[Sync] Task ${taskId} deleted successfully`);
      return true;

    } catch (error) {
      console.error(`[Sync] Failed to delete task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Get sync status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isRunning: this.syncInterval !== null,
      isSyncing: this.isSyncing,
      intervalMs: this.intervalMs,
      lastError: this.lastSyncError ? this.lastSyncError.message : null
    };
  }

  /**
   * Force a full resync (clear and repopulate storage)
   * @returns {Promise<Object>} Sync result
   */
  async fullResync() {
    console.log('[Sync] Performing full resync...');
    
    // For now, just do a regular sync
    // In the future, we could add logic to detect and resolve conflicts
    return await this.syncNow();
  }

  /**
   * Reconcile task metadata categories with actual Todoist project assignments
   * Updates local metadata to match Todoist as the source of truth
   * @private
   */
  async _reconcileCategories(tasks, projects) {
    console.log('[Sync] Reconciling task metadata with Todoist state...');

    const reconciler = new TaskReconciler();
    await reconciler.initialize();

    let manualChanges = 0;
    let clearedRecommendations = 0;

    for (const task of tasks) {
      const metadata = await this.storage.getTaskMetadata(task.id);
      const lastSyncedState = await this.storage.getLastSyncedState(task.id);

      // Analyze changes
      const analysis = await reconciler.detectChanges(task, metadata, lastSyncedState);

      if (analysis.anyChangedManually) {
        // User made manual changes after AI classification
        console.log(`[Sync] Task ${task.id} changed manually: ${analysis.reason}`);
        
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
          const currentCategory = reconciler.getCategoryFromProject(task.projectId, projects);
          if (currentCategory) {
            await this.storage.saveFieldMetadata(task.id, 'recommended_category', currentCategory, new Date());
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
      console.log(`[Sync] Detected ${manualChanges} tasks with manual changes, cleared ${clearedRecommendations} recommendations`);
    }
  }
}


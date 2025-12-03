/**
 * Task Enrichment Layer
 * 
 * Manages AI-generated metadata and enhancements for Todoist tasks.
 * This layer sits between the sync engine and AI operations, providing
 * a clean interface for storing and retrieving AI classifications,
 * time estimates, and other metadata.
 * 
 * Key responsibilities:
 * - Store AI classifications alongside task data
 * - Maintain audit log of AI changes
 * - Handle metadata updates and versioning
 * - Provide enriched task views combining Todoist + AI data
 */

import { TaskReconciler } from './reconciliation.js';

export class TaskEnrichment {
  /**
   * @param {StorageAdapter} storage - Storage adapter
   * @param {TodoistClient} todoist - Todoist client (optional)
   */
  constructor(storage, todoist = null) {
    this.storage = storage;
    this.todoist = todoist;
  }

  /**
   * Enrich a task with AI-generated metadata
   * @param {string} taskId - Task ID
   * @param {Object} metadata - AI-generated metadata
   * @param {string} [metadata.category] - Life area category
   * @param {string} [metadata.timeEstimate] - Time estimate (e.g., "20-30min")
   * @param {string} [metadata.size] - T-shirt size (XS, S, M, L, XL)
   * @param {number} [metadata.aiConfidence] - Confidence score (0-1)
   * @param {string} [metadata.aiReasoning] - AI explanation
   * @param {boolean} [metadata.needsSupplies] - Requires supplies
   * @param {boolean} [metadata.canDelegate] - Can be delegated
   * @param {string} [metadata.energyLevel] - Required energy level
   * @returns {Promise<void>}
   */
  async enrichTask(taskId, metadata, options = {}) {
    console.log(`[Enrichment] Enriching task ${taskId} with AI metadata`);

    const now = new Date();

    // Validate metadata
    if (metadata.category) {
      this._validateCategory(metadata.category);
    }

    if (metadata.size) {
      this._validateSize(metadata.size);
    }

    if (metadata.energyLevel) {
      this._validateEnergyLevel(metadata.energyLevel);
    }

    // Save AI recommendation with timestamp (not current state - this is a recommendation)
    if (metadata.category) {
      await this.storage.saveFieldMetadata(
        taskId,
        'recommended_category',
        metadata.category,
        now
      );
    }

    if (metadata.timeEstimate) {
      // Parse time estimate to minutes if it's a string like "20-30min"
      const minutes = this._parseTimeEstimate(metadata.timeEstimate);
      await this.storage.saveFieldMetadata(
        taskId,
        'time_estimate_minutes',
        minutes,
        now
      );
    }

    // Also save to old metadata format for backward compatibility
    await this.storage.saveTaskMetadata(taskId, metadata);

    // Apply labels if provided (merge with existing labels)
    if (metadata.labels && metadata.labels.length > 0 && this.todoist) {
      try {
        const task = await this.storage.getTask(taskId);
        
        // Get current labels on the task
        const currentLabels = task.labels || [];
        
        // Get all available labels to map IDs to names
        const allLabels = await this.storage.getLabels();
        
        // Convert new label IDs to names
        const newLabelNames = metadata.labels
          .map(labelId => {
            const label = allLabels.find(l => l.id === labelId || l.name.toLowerCase().replace(/\s+/g, '-') === labelId);
            return label?.name;
          })
          .filter(Boolean);
        
        // Merge with existing labels (dedupe)
        const mergedLabels = Array.from(new Set([...currentLabels, ...newLabelNames]));
        
        if (newLabelNames.length > 0) {
          await this.todoist.api.updateTask(taskId, { labels: mergedLabels });
          console.log(`[Enrichment] Applied labels: ${newLabelNames.join(', ')} (merged with existing)`);
        }
      } catch (error) {
        console.warn(`[Enrichment] Failed to apply labels:`, error.message);
        // Don't fail the whole enrichment if labels fail
      }
    }

    // Move task to matching project in Todoist FIRST (if category provided)
    // Only update local DB after Todoist confirms the move
    if (metadata.category && options.moveToProject !== false) {
      const projectId = await this._getProjectIdForCategory(metadata.category);
      
      if (projectId) {
        const task = await this.storage.getTask(taskId);
        
        // Only move if it's in a different project
        if (task && task.projectId !== projectId) {
          console.log(`[Enrichment] Moving task to ${metadata.category} project in Todoist...`);
          
          // Move in Todoist using moveTask API - this is the source of truth
          if (this.todoist) {
            try {
              const movedTask = await this.todoist.api.moveTask(taskId, { projectId: projectId });
              
              // Update local storage with new project
              await this.storage.updateTask(taskId, { project_id: projectId });
              
              // Mark recommendation as applied by AI
              await this.storage.saveFieldMetadata(taskId, 'recommendation_applied', true, now);
              await this.storage.saveFieldMetadata(taskId, 'classification_source', 'ai', now);
              
              // Update last synced state with the new Todoist state
              // This ensures future syncs know this was an AI move, not a manual move
              // Serialize the task to remove any Date objects or complex types
              const taskSnapshot = JSON.parse(JSON.stringify({
                ...task,
                projectId: projectId,
                updatedAt: movedTask.updatedAt || now.toISOString()
              }));
              await this.storage.saveLastSyncedState(taskId, taskSnapshot, now);
            } catch (error) {
              console.error(`[Enrichment] Failed during enrichment:`, error);
              throw new Error(`Failed to move task to ${metadata.category}: ${error.message}`);
            }
          }
        } else {
          // Task already in correct project, mark recommendation as applied
          await this.storage.saveFieldMetadata(taskId, 'recommendation_applied', true, now);
        }
      }
    }

    console.log(`[Enrichment] Task ${taskId} enriched successfully`);
  }

  /**
   * Parse time estimate string to minutes
   * @private
   */
  _parseTimeEstimate(estimate) {
    if (typeof estimate === 'number') return estimate;
    if (!estimate) return null;
    
    // Handle formats like "20-30min", "1-2h", "30min", etc.
    const match = estimate.match(/(\d+)(?:-(\d+))?\s*(min|h|hour|hours)?/i);
    if (!match) return null;
    
    const min = parseInt(match[1]);
    const max = match[2] ? parseInt(match[2]) : min;
    const unit = (match[3] || 'min').toLowerCase();
    
    // Convert to minutes
    const multiplier = unit.startsWith('h') ? 60 : 1;
    const avg = Math.round((min + max) / 2);
    
    return avg * multiplier;
  }

  /**
   * Enrich multiple tasks in batch
   * @param {Array<Object>} enrichments - Array of {taskId, metadata}
   * @returns {Promise<Array>} Results
   */
  async enrichTasksBatch(enrichments) {
    console.log(`[Enrichment] Batch enriching ${enrichments.length} tasks...`);

    const results = await Promise.allSettled(
      enrichments.map(({ taskId, metadata }) =>
        this.enrichTask(taskId, metadata)
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[Enrichment] Batch complete: ${successful} success, ${failed} failed`);

    return results;
  }

  /**
   * Get enriched task (combines Todoist data + AI metadata)
   * @param {string} taskId - Task ID
   * @returns {Promise<Object|null>} Enriched task or null
   */
  async getEnrichedTask(taskId) {
    const task = await this.storage.getTask(taskId);
    return task; // Already includes metadata from storage join
  }

  /**
   * Get all enriched tasks with optional filters
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} Enriched tasks
   */
  async getEnrichedTasks(filters = {}) {
    const tasks = await this.storage.getTasks(filters);
    return tasks; // Already includes metadata from storage join
  }

  /**
   * Get tasks that need classification
   * @param {Object} options - Options
   * @param {boolean} [options.force=false] - Include manually classified tasks
   * @returns {Promise<Array>} Unclassified tasks
   */
  async getUnclassifiedTasks(options = {}) {
    const { force = false } = options;
    console.log(`[Enrichment] Finding unclassified tasks (force=${force})...`);

    const allTasks = await this.storage.getTasks({ completed: false });
    const reconciler = new TaskReconciler();
    await reconciler.initialize();
    
    const unclassified = [];
    let skippedManual = 0;
    
    for (const task of allTasks) {
      const metadata = await this.storage.getTaskMetadata(task.id);
      const lastSyncedState = await this.storage.getLastSyncedState(task.id);
      
      // Skip manually classified tasks unless force=true
      if (!force && metadata?.classification_source === 'manual') {
        skippedManual++;
        continue;
      }
      
      // Use reconciler to detect if task needs (re)classification
      const analysis = await reconciler.detectChanges(task, metadata, lastSyncedState);
      
      if (analysis.needsReclassify || force) {
        unclassified.push(task);
      }
    }

    console.log(`[Enrichment] Found ${unclassified.length} unclassified tasks (skipped ${skippedManual} manual)`);
    
    return unclassified;
  }

  /**
   * Get tasks by life area category
   * @param {string} category - Life area category
   * @returns {Promise<Array>} Tasks in category
   */
  async getTasksByCategory(category) {
    this._validateCategory(category);
    return await this.storage.getTasks({ category, completed: false });
  }

  /**
   * Get tasks that need supplies
   * @returns {Promise<Array>} Tasks needing supplies
   */
  async getTasksNeedingSupplies() {
    return await this.storage.queryTasksByMetadata({ needsSupplies: true });
  }

  /**
   * Get tasks that can be delegated
   * @returns {Promise<Array>} Delegatable tasks
   */
  async getDelegatableTasks() {
    return await this.storage.queryTasksByMetadata({ canDelegate: true });
  }

  /**
   * Get tasks by size
   * @param {string} size - Size (XS, S, M, L, XL)
   * @returns {Promise<Array>} Tasks of given size
   */
  async getTasksBySize(size) {
    this._validateSize(size);
    return await this.storage.queryTasksByMetadata({ size });
  }

  /**
   * Get tasks by energy level
   * @param {string} energyLevel - Energy level (low, medium, high)
   * @returns {Promise<Array>} Tasks requiring energy level
   */
  async getTasksByEnergyLevel(energyLevel) {
    this._validateEnergyLevel(energyLevel);
    return await this.storage.queryTasksByMetadata({ energyLevel });
  }

  /**
   * Update task category
   * @param {string} taskId - Task ID
   * @param {string} category - New category
   * @returns {Promise<void>}
   */
  async updateCategory(taskId, category) {
    this._validateCategory(category);

    const metadata = await this.storage.getTaskMetadata(taskId) || {};
    metadata.category = category;

    await this.storage.saveTaskMetadata(taskId, metadata);
    console.log(`[Enrichment] Updated category for task ${taskId} to ${category}`);
  }

  /**
   * Get enrichment statistics
   * @returns {Promise<Object>} Statistics
   */
  async getEnrichmentStats() {
    const allTasks = await this.storage.getTasks({ completed: false });
    
    const classified = allTasks.filter(t => t.metadata?.category).length;
    const withTimeEstimate = allTasks.filter(t => t.metadata?.timeEstimate).length;
    const withSize = allTasks.filter(t => t.metadata?.size).length;

    // Count by category
    const byCategory = {};
    for (const task of allTasks) {
      const cat = task.metadata?.category || 'unclassified';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    return {
      total: allTasks.length,
      classified,
      unclassified: allTasks.length - classified,
      withTimeEstimate,
      withSize,
      byCategory
    };
  }

  // ==================== Validation Helpers ====================

  _validateCategory(category) {
    const validCategories = [
      'work',
      'home-improvement',
      'home-maintenance',
      'personal-family',
      'speaking-gig',
      'big-ideas',
      'inspiration',
      'inbox'
    ];

    if (!validCategories.includes(category)) {
      throw new Error(
        `Invalid category: ${category}. ` +
        `Valid categories: ${validCategories.join(', ')}`
      );
    }
  }

  _validateSize(size) {
    const validSizes = ['XS', 'S', 'M', 'L', 'XL'];

    if (!validSizes.includes(size)) {
      throw new Error(
        `Invalid size: ${size}. ` +
        `Valid sizes: ${validSizes.join(', ')}`
      );
    }
  }

  _validateEnergyLevel(energyLevel) {
    const validLevels = ['low', 'medium', 'high'];

    if (!validLevels.includes(energyLevel)) {
      throw new Error(
        `Invalid energy level: ${energyLevel}. ` +
        `Valid levels: ${validLevels.join(', ')}`
      );
    }
  }

  /**
   * Get Todoist project ID for a category
   * @param {string} category - Category name (work, home-improvement, etc.)
   * @returns {Promise<string|null>} Project ID or null
   */
  async _getProjectIdForCategory(category) {
    // Map category names to project names
    const categoryToProjectName = {
      'work': 'Work',
      'home-improvement': 'Home Improvement',
      'home-maintenance': 'Home Maintenance',
      'personal-family': 'Personal/Family',
      'speaking-gig': 'Speaking Gigs',
      'big-ideas': 'Big Ideas',
      'inspiration': 'Inspiration',
      'inbox-ideas': 'Inbox'  // Keep inbox-ideas in Inbox for now
    };

    const projectName = categoryToProjectName[category];
    if (!projectName) {
      console.warn(`[Enrichment] No project mapping for category: ${category}`);
      return null;
    }

    // Get all projects and find matching one
    const projects = await this.storage.getProjects();
    const project = projects.find(p => p.name === projectName);

    if (!project) {
      console.warn(`[Enrichment] Project not found: ${projectName}`);
      return null;
    }

    return project.id;
  }
}

/**
 * Life area categories used in the system
 */
export const LIFE_AREAS = {
  WORK: 'work',
  HOME_REPAIR: 'home-repair',
  HOME_MAINTENANCE: 'home-maintenance',
  PERSONAL_FAMILY: 'personal-family',
  SPEAKING_GIG: 'speaking-gig',
  BIG_IDEAS: 'big-ideas',
  INBOX_IDEAS: 'inbox-ideas'
};

/**
 * Task size categories
 */
export const TASK_SIZES = {
  XS: 'XS',  // < 5 minutes
  S: 'S',    // 5-15 minutes
  M: 'M',    // 15-30 minutes
  L: 'L',    // 30-60 minutes
  XL: 'XL'   // > 60 minutes
};

/**
 * Energy level categories
 */
export const ENERGY_LEVELS = {
  LOW: 'low',       // Low mental/physical energy required
  MEDIUM: 'medium', // Moderate effort
  HIGH: 'high'      // High focus/energy needed
};


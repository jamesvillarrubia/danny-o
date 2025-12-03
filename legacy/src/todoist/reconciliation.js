/**
 * Task Reconciliation Engine
 * 
 * Detects conflicts between Todoist state (source of truth) and AI recommendations.
 * Uses per-field timestamps to determine whether changes were made manually
 * or by the AI agent.
 * 
 * Key principle: Most recent change wins
 * - If task changed in Todoist AFTER AI classification → manual change, respect it
 * - If AI classified AFTER last Todoist update → AI recommendation is current
 */

import { loadTaxonomy } from '../config/taxonomy-loader.js';

export class TaskReconciler {
  constructor() {
    this.taxonomy = null;
    this.projectToCategory = null;
    this.categoryToProject = null;
  }

  /**
   * Initialize the reconciler by loading taxonomy
   */
  async initialize() {
    if (!this.taxonomy) {
      this.taxonomy = await loadTaxonomy();
      this._buildProjectMappings();
    }
  }

  /**
   * Build bidirectional mappings between project names and categories
   * @private
   */
  _buildProjectMappings() {
    this.projectToCategory = {};
    this.categoryToProject = {};

    for (const project of this.taxonomy.projects) {
      this.projectToCategory[project.name] = project.id;
      this.categoryToProject[project.id] = project.name;
    }
  }

  /**
   * Compare Todoist task state vs local metadata, detect conflicts
   * Compares ALL task fields comprehensively
   * 
   * @param {Object} todoistTask - Current task from Todoist API
   * @param {Object} localMetadata - Task metadata from local DB
   * @param {Object} lastSyncedStateObj - Last known state from Todoist
   * @returns {Object} Analysis with change detection and recommendations
   */
  async detectChanges(todoistTask, localMetadata, lastSyncedStateObj) {
    await this.initialize();

    // Handle missing data
    if (!localMetadata) {
      return {
        changedFields: [],
        projectChangedManually: false,
        contentChangedManually: false,
        anyChangedManually: false,
        needsReclassify: true,
        reason: 'No metadata exists - task needs classification'
      };
    }

    if (!lastSyncedStateObj || !lastSyncedStateObj.taskState) {
      // First sync or missing data - treat as needing classification
      return {
        changedFields: [],
        projectChangedManually: false,
        contentChangedManually: false,
        anyChangedManually: false,
        needsReclassify: !localMetadata.recommended_category,
        reason: 'No sync state - cannot detect changes'
      };
    }

    const lastSyncedTask = lastSyncedStateObj.taskState;

    // Parse timestamps (handle both Date objects and ISO strings)
    const todoistUpdatedAt = this._parseDate(todoistTask.updatedAt);
    const categoryClassifiedAt = this._parseDate(localMetadata.category_classified_at);

    // Compare ALL relevant fields
    const fieldsToCompare = [
      'content',
      'description',
      'projectId',
      'priority',
      'labels',      // Important: track label changes
      'due',
      'parentId',
      'order',
      'isCompleted'
    ];

    const changedFields = [];
    let projectChangedManually = false;
    let contentChangedManually = false;

    for (const field of fieldsToCompare) {
      const comparison = this._compareField(
        todoistTask[field],
        lastSyncedTask[field],
        todoistUpdatedAt,
        categoryClassifiedAt
      );

      if (comparison.fieldChanged) {
        changedFields.push({
          field,
          oldValue: lastSyncedTask[field],
          newValue: todoistTask[field],
          changedManually: comparison.changedManually
        });

        // Track specific important fields
        if (field === 'projectId' && comparison.changedManually) {
          projectChangedManually = true;
        }
        if (field === 'content' && comparison.changedManually) {
          contentChangedManually = true;
        }
      }
    }

    // Check if content change is significant
    const significantContentChange = contentChangedManually && 
      this._isContentSignificantChange(lastSyncedTask.content, todoistTask.content);

    // Determine if reclassification is needed
    const needsReclassify = 
      !localMetadata.recommended_category ||    // Never classified
      projectChangedManually ||                 // User moved it manually
      significantContentChange;                 // Content changed significantly

    return {
      changedFields,
      projectChangedManually,
      contentChangedManually,
      anyChangedManually: changedFields.some(f => f.changedManually),
      needsReclassify,
      reason: this._explainReasonComprehensive(changedFields, localMetadata)
    };
  }

  /**
   * Compare a single field between Todoist and last synced state
   * Determine if change was manual (after AI classification)
   * Handles primitives, arrays, and objects
   * 
   * @private
   * @param {*} todoistValue - Current value from Todoist
   * @param {*} syncedValue - Last synced value
   * @param {Date} todoistUpdatedAt - When task was last updated in Todoist
   * @param {Date} aiClassifiedAt - When AI last classified this task
   * @returns {Object} Change analysis
   */
  _compareField(todoistValue, syncedValue, todoistUpdatedAt, aiClassifiedAt) {
    // Handle arrays (like labels)
    const fieldChanged = Array.isArray(todoistValue) && Array.isArray(syncedValue)
      ? !this._arraysEqual(todoistValue, syncedValue)
      : typeof todoistValue === 'object' && typeof syncedValue === 'object'
        ? JSON.stringify(todoistValue) !== JSON.stringify(syncedValue)
        : todoistValue !== syncedValue;
    
    // If field changed and Todoist timestamp is after AI classification,
    // it means user changed it manually after AI classified it
    const changedAfterAI = fieldChanged && 
                           todoistUpdatedAt && 
                           aiClassifiedAt && 
                           todoistUpdatedAt > aiClassifiedAt;

    return {
      fieldChanged,
      changedAfterAI,
      changedManually: changedAfterAI  // Alias for clarity
    };
  }

  /**
   * Compare two arrays for equality
   * @private
   */
  _arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();
    return sorted1.every((val, idx) => val === sorted2[idx]);
  }

  /**
   * Determine if a content change is significant enough to warrant reclassification
   * Minor edits (typo fixes, punctuation) shouldn't trigger reclassification
   * 
   * @private
   */
  _isContentSignificantChange(oldContent, newContent) {
    if (!oldContent || !newContent) return true;

    // Normalize for comparison
    const normalize = (str) => str.toLowerCase().trim().replace(/[^\w\s]/g, '');
    const oldNorm = normalize(oldContent);
    const newNorm = normalize(newContent);

    // If normalized versions are same, it's just punctuation/formatting
    if (oldNorm === newNorm) return false;

    // If length changed significantly (>20%), likely significant
    const lengthRatio = newNorm.length / oldNorm.length;
    if (lengthRatio < 0.8 || lengthRatio > 1.2) return true;

    // Calculate simple word-level diff
    const oldWords = new Set(oldNorm.split(/\s+/));
    const newWords = new Set(newNorm.split(/\s+/));
    
    const wordsAdded = [...newWords].filter(w => !oldWords.has(w)).length;
    const wordsRemoved = [...oldWords].filter(w => !newWords.has(w)).length;
    const totalWords = Math.max(oldWords.size, newWords.size);
    
    // If >25% of words changed, it's significant
    const changeRatio = (wordsAdded + wordsRemoved) / totalWords;
    return changeRatio > 0.25;
  }

  /**
   * Generate human-readable explanation of change detection
   * @private
   */
  _explainReasonComprehensive(changedFields, localMetadata) {
    if (!localMetadata.recommended_category) {
      return 'Never classified';
    }
    
    const manualChanges = changedFields.filter(f => f.changedManually);
    
    if (manualChanges.length === 0) {
      if (changedFields.length === 0) {
        return 'No changes detected';
      }
      return 'Changes detected but before AI classification';
    }
    
    // Describe what changed manually
    const fieldNames = manualChanges.map(f => f.field).join(', ');
    return `Manual changes after AI classification: ${fieldNames}`;
  }

  /**
   * Get current category from Todoist project ID (source of truth)
   * 
   * @param {string} projectId - Todoist project ID
   * @param {Array} projects - Array of project objects from Todoist
   * @returns {string|null} Category ID or null if not mapped
   */
  getCategoryFromProject(projectId, projects) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return null;

    return this.projectToCategory[project.name] || null;
  }

  /**
   * Get Todoist project name from category ID
   * 
   * @param {string} categoryId - Category ID (work, home-improvement, etc.)
   * @returns {string|null} Project name or null if not mapped
   */
  getProjectNameFromCategory(categoryId) {
    return this.categoryToProject[categoryId] || null;
  }

  /**
   * Parse date from various formats (Date object, ISO string, timestamp)
   * @private
   */
  _parseDate(dateValue) {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue === 'string') return new Date(dateValue);
    if (typeof dateValue === 'number') return new Date(dateValue);
    return null;
  }

  /**
   * Find conflicts between AI recommendations and current Todoist state
   * Returns tasks where recommended_category doesn't match actual project
   * 
   * @param {Array} tasks - Array of tasks with metadata
   * @param {Array} projects - Array of Todoist projects
   * @returns {Array} Tasks with conflicts
   */
  findConflicts(tasks, projects) {
    const conflicts = [];

    for (const task of tasks) {
      if (!task.metadata?.recommended_category) continue;

      const currentCategory = this.getCategoryFromProject(task.projectId, projects);
      const recommendedCategory = task.metadata.recommended_category;

      if (currentCategory !== recommendedCategory) {
        conflicts.push({
          taskId: task.id,
          content: task.content,
          currentProject: projects.find(p => p.id === task.projectId)?.name,
          currentCategory,
          recommendedCategory,
          recommendedProject: this.getProjectNameFromCategory(recommendedCategory),
          classifiedAt: task.metadata.category_classified_at,
          todoistUpdatedAt: task.updatedAt
        });
      }
    }

    return conflicts;
  }
}


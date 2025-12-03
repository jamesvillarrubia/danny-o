/**
 * Abstract Storage Adapter Interface
 * 
 * Defines the contract for storage implementations (SQLite, PostgreSQL, etc.).
 * This abstraction allows seamless switching between local and cloud deployments.
 * 
 * All storage adapters must implement these methods to ensure compatibility
 * with the rest of the application.
 */

export class StorageAdapter {
  /**
   * Initialize the storage adapter and set up connections
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Close database connections and cleanup resources
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('close() must be implemented by subclass');
  }

  // ==================== Task Operations ====================

  /**
   * Save multiple tasks to storage (upsert operation)
   * @param {Array<Object>} tasks - Array of task objects from Todoist API
   * @returns {Promise<number>} Number of tasks saved
   */
  async saveTasks(tasks) {
    throw new Error('saveTasks() must be implemented by subclass');
  }

  /**
   * Get tasks with optional filtering
   * @param {Object} filters - Filter criteria
   * @param {string} [filters.category] - Filter by life area category
   * @param {number} [filters.priority] - Filter by priority (1-4)
   * @param {string} [filters.projectId] - Filter by Todoist project ID
   * @param {boolean} [filters.completed] - Include completed tasks
   * @param {number} [filters.limit] - Maximum number of results
   * @returns {Promise<Array<Object>>} Array of tasks with metadata
   */
  async getTasks(filters = {}) {
    throw new Error('getTasks() must be implemented by subclass');
  }

  /**
   * Get a single task by ID
   * @param {string} taskId - Todoist task ID
   * @returns {Promise<Object|null>} Task object with metadata or null
   */
  async getTask(taskId) {
    throw new Error('getTask() must be implemented by subclass');
  }

  /**
   * Update a task
   * @param {string} taskId - Todoist task ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<boolean>} Success status
   */
  async updateTask(taskId, updates) {
    throw new Error('updateTask() must be implemented by subclass');
  }

  /**
   * Delete a task
   * @param {string} taskId - Todoist task ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteTask(taskId) {
    throw new Error('deleteTask() must be implemented by subclass');
  }

  /**
   * Query tasks by metadata criteria
   * @param {Object} criteria - Query criteria
   * @param {string} [criteria.needsSupplies] - Filter by supply needs
   * @param {boolean} [criteria.canDelegate] - Filter by delegation potential
   * @param {string} [criteria.energyLevel] - Filter by energy level required
   * @param {string} [criteria.size] - Filter by size (XS, S, M, L, XL)
   * @returns {Promise<Array<Object>>} Matching tasks
   */
  async queryTasksByMetadata(criteria) {
    throw new Error('queryTasksByMetadata() must be implemented by subclass');
  }

  // ==================== Task Metadata Operations ====================

  /**
   * Save or update AI-generated metadata for a task
   * @param {string} taskId - Todoist task ID
   * @param {Object} metadata - AI-generated task metadata
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
  async saveTaskMetadata(taskId, metadata) {
    throw new Error('saveTaskMetadata() must be implemented by subclass');
  }

  /**
   * Get metadata for a task
   * @param {string} taskId - Todoist task ID
   * @returns {Promise<Object|null>} Task metadata or null
   */
  async getTaskMetadata(taskId) {
    throw new Error('getTaskMetadata() must be implemented by subclass');
  }

  /**
   * Save metadata for a specific field with timestamp
   * Used for per-field change tracking and conflict detection
   * @param {string} taskId - Todoist task ID
   * @param {string} fieldName - Name of the metadata field
   * @param {*} value - Field value
   * @param {Date} classifiedAt - When this field was classified/updated
   * @returns {Promise<void>}
   */
  async saveFieldMetadata(taskId, fieldName, value, classifiedAt) {
    throw new Error('saveFieldMetadata() must be implemented by subclass');
  }

  /**
   * Get metadata for a specific field
   * @param {string} taskId - Todoist task ID
   * @param {string} fieldName - Name of the metadata field
   * @returns {Promise<Object|null>} Field metadata with timestamp
   */
  async getFieldMetadata(taskId, fieldName) {
    throw new Error('getFieldMetadata() must be implemented by subclass');
  }

  /**
   * Get last synced state from Todoist (for change detection)
   * @param {string} taskId - Todoist task ID
   * @returns {Promise<Object|null>} Last synced task state (entire Todoist task object) or null
   * @returns {Date} return.last_synced_at - When last synced
   */
  async getLastSyncedState(taskId) {
    throw new Error('getLastSyncedState() must be implemented by subclass');
  }

  /**
   * Save last synced state from Todoist
   * Stores entire task object as JSON for comprehensive change detection
   * @param {string} taskId - Todoist task ID
   * @param {Object} taskState - Complete Todoist task object to save
   * @param {Date} [syncedAt] - Sync timestamp (defaults to now)
   * @returns {Promise<void>}
   */
  async saveLastSyncedState(taskId, taskState, syncedAt = null) {
    throw new Error('saveLastSyncedState() must be implemented by subclass');
  }

  // ==================== Task History & Learning ====================

  /**
   * Record task completion for learning purposes
   * @param {string} taskId - Todoist task ID
   * @param {Object} metadata - Completion metadata
   * @param {Date} [metadata.completedAt] - Completion timestamp
   * @param {number} [metadata.actualDuration] - Actual time taken (minutes)
   * @param {string} [metadata.category] - Task category at completion
   * @param {Object} [metadata.context] - Additional context
   * @returns {Promise<void>}
   */
  async saveTaskCompletion(taskId, metadata) {
    throw new Error('saveTaskCompletion() must be implemented by subclass');
  }

  /**
   * Get task completion history with filtering
   * @param {Object} filters - Filter criteria
   * @param {string} [filters.category] - Filter by category
   * @param {Date} [filters.startDate] - Start date
   * @param {Date} [filters.endDate] - End date
   * @param {number} [filters.limit] - Maximum results
   * @returns {Promise<Array<Object>>} Completion records
   */
  async getTaskHistory(filters = {}) {
    throw new Error('getTaskHistory() must be implemented by subclass');
  }

  /**
   * Get completion patterns for a category (for learning)
   * @param {string} category - Life area category
   * @returns {Promise<Object>} Pattern analysis
   * @returns {number} return.count - Number of completed tasks
   * @returns {number} return.avgDuration - Average completion time
   * @returns {Array<string>} return.commonPatterns - Common patterns observed
   */
  async getCompletionPatterns(category) {
    throw new Error('getCompletionPatterns() must be implemented by subclass');
  }

  // ==================== Projects & Labels ====================

  /**
   * Save Todoist projects
   * @param {Array<Object>} projects - Todoist projects
   * @returns {Promise<number>} Number saved
   */
  async saveProjects(projects) {
    throw new Error('saveProjects() must be implemented by subclass');
  }

  /**
   * Get all projects
   * @returns {Promise<Array<Object>>} Projects
   */
  async getProjects() {
    throw new Error('getProjects() must be implemented by subclass');
  }

  /**
   * Save Todoist labels
   * @param {Array<Object>} labels - Todoist labels
   * @returns {Promise<number>} Number saved
   */
  async saveLabels(labels) {
    throw new Error('saveLabels() must be implemented by subclass');
  }

  /**
   * Get all labels
   * @returns {Promise<Array<Object>>} Labels
   */
  async getLabels() {
    throw new Error('getLabels() must be implemented by subclass');
  }

  // ==================== Sync State ====================

  /**
   * Get the last sync timestamp
   * @returns {Promise<Date|null>} Last sync time or null
   */
  async getLastSyncTime() {
    throw new Error('getLastSyncTime() must be implemented by subclass');
  }

  /**
   * Update the last sync timestamp
   * @param {Date} timestamp - Sync timestamp
   * @returns {Promise<void>}
   */
  async setLastSyncTime(timestamp) {
    throw new Error('setLastSyncTime() must be implemented by subclass');
  }
}


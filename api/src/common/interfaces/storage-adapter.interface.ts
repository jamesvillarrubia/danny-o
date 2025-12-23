/**
 * Storage Adapter Interface
 * 
 * Abstract interface for database storage implementations.
 * Implementations: SQLite, PostgreSQL, etc.
 */

import type { Task, TaskMetadata, TaskHistory, Project, Label, TaskFilters } from '@danny-tasks/shared';

export interface SyncState {
  taskState: any;
  syncedAt: Date;
}

/**
 * Abstract storage adapter that all implementations must extend
 */
export abstract class IStorageAdapter {
  /**
   * Initialize the storage (connect, create schema, run migrations)
   */
  abstract initialize(): Promise<void>;

  /**
   * Close the storage connection
   */
  abstract close(): Promise<void>;

  // ==================== Task Operations ====================

  /**
   * Save multiple tasks (upsert)
   */
  abstract saveTasks(tasks: Task[]): Promise<number>;

  /**
   * Get tasks with optional filters
   */
  abstract getTasks(filters?: TaskFilters): Promise<Task[]>;

  /**
   * Get a single task by ID
   */
  abstract getTask(taskId: string): Promise<Task | null>;

  /**
   * Update a task
   */
  abstract updateTask(taskId: string, updates: Partial<Task>): Promise<boolean>;

  /**
   * Delete a task
   */
  abstract deleteTask(taskId: string): Promise<boolean>;

  /**
   * Query tasks by metadata criteria
   */
  abstract queryTasksByMetadata(criteria: Partial<TaskMetadata>): Promise<Task[]>;

  // ==================== Task Metadata Operations ====================

  /**
   * Save metadata for a task
   */
  abstract saveTaskMetadata(taskId: string, metadata: Partial<TaskMetadata>): Promise<void>;

  /**
   * Get metadata for a task
   */
  abstract getTaskMetadata(taskId: string): Promise<TaskMetadata | null>;

  /**
   * Save metadata for a specific field with timestamp
   */
  abstract saveFieldMetadata(taskId: string, fieldName: string, value: any, classifiedAt: Date | null): Promise<void>;

  /**
   * Get metadata for a specific field
   */
  abstract getFieldMetadata(taskId: string, fieldName: string): Promise<{ value: any; classifiedAt: Date } | null>;

  /**
   * Get last synced state from provider (for change detection)
   */
  abstract getLastSyncedState(taskId: string): Promise<SyncState | null>;

  /**
   * Save last synced state from provider
   */
  abstract saveLastSyncedState(taskId: string, taskState: any, syncedAt?: Date): Promise<void>;

  // ==================== Task History & Learning ====================

  /**
   * Save task completion history (for learning)
   */
  abstract saveTaskCompletion(taskId: string, metadata: Partial<TaskHistory>): Promise<void>;

  /**
   * Get task completion history with filters
   */
  abstract getTaskHistory(filters?: any): Promise<TaskHistory[]>;

  /**
   * Get completion patterns for a category (for learning)
   */
  abstract getCompletionPatterns(category: string): Promise<{
    count: number;
    avgDuration: number;
    commonPatterns: string[];
  }>;

  // ==================== Projects & Labels ====================

  /**
   * Save multiple projects (upsert)
   */
  abstract saveProjects(projects: Project[]): Promise<number>;

  /**
   * Get all projects
   */
  abstract getProjects(): Promise<Project[]>;

  /**
   * Save multiple labels (upsert)
   */
  abstract saveLabels(labels: Label[]): Promise<number>;

  /**
   * Get all labels
   */
  abstract getLabels(): Promise<Label[]>;

  // ==================== Sync State ====================

  /**
   * Get the last sync timestamp
   */
  abstract getLastSyncTime(): Promise<Date | null>;

  /**
   * Set the last sync timestamp
   */
  abstract setLastSyncTime(timestamp: Date): Promise<void>;

  /**
   * Get the Todoist sync token for incremental sync
   * Returns '*' if no token exists (triggers full sync)
   */
  abstract getSyncToken(): Promise<string>;

  /**
   * Save the Todoist sync token for incremental sync
   */
  abstract setSyncToken(token: string): Promise<void>;

  // ==================== AI Interaction Logging ====================

  /**
   * Log an AI interaction for analysis and prompt optimization
   */
  abstract logAIInteraction(data: {
    interactionType: string;
    taskId?: string;
    inputContext?: any;
    promptUsed?: string;
    aiResponse?: any;
    actionTaken?: string;
    success: boolean;
    errorMessage?: string;
    latencyMs?: number;
    modelUsed?: string;
  }): Promise<void>;

  /**
   * Get AI interactions with optional filters
   */
  abstract getAIInteractions(filters?: {
    interactionType?: string;
    taskId?: string;
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<Array<{
    id: number;
    interactionType: string;
    taskId?: string;
    inputContext?: any;
    promptUsed?: string;
    aiResponse?: any;
    actionTaken?: string;
    success: boolean;
    errorMessage?: string;
    latencyMs?: number;
    modelUsed?: string;
    createdAt: Date;
  }>>;

  // ==================== Dashboard Views ====================

  /**
   * Get all saved views
   */
  abstract getViews(): Promise<Array<{
    id: number;
    name: string;
    slug: string;
    filterConfig: any;
    isDefault: boolean;
    orderIndex: number;
  }>>;

  /**
   * Get a single view by slug or ID
   */
  abstract getView(slugOrId: string | number): Promise<{
    id: number;
    name: string;
    slug: string;
    filterConfig: any;
    isDefault: boolean;
    orderIndex: number;
  } | null>;

  /**
   * Create a new view
   */
  abstract createView(data: {
    name: string;
    slug: string;
    filterConfig: any;
    orderIndex?: number;
  }): Promise<{
    id: number;
    name: string;
    slug: string;
    filterConfig: any;
    isDefault: boolean;
    orderIndex: number;
  }>;

  /**
   * Update a view
   */
  abstract updateView(slugOrId: string | number, data: {
    name?: string;
    filterConfig?: any;
    orderIndex?: number;
  }): Promise<boolean>;

  /**
   * Delete a view (cannot delete default views)
   */
  abstract deleteView(slugOrId: string | number): Promise<boolean>;

  // ==================== Configuration ====================

  /**
   * Get a configuration value by key
   */
  abstract getConfig(key: string): Promise<string | null>;

  /**
   * Set a configuration value
   * @param key Configuration key
   * @param value Configuration value
   * @param encrypted Whether to encrypt the value (for sensitive data like API keys)
   */
  abstract setConfig(key: string, value: string, encrypted?: boolean): Promise<void>;

  /**
   * Check if a configuration key exists and has a non-empty value
   */
  abstract hasConfig(key: string): Promise<boolean>;
}

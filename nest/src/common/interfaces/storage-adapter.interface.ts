/**
 * Storage Adapter Interface
 * 
 * Abstract interface for database storage implementations.
 * Implementations: SQLite, PostgreSQL, etc.
 */

import { Task, TaskMetadata, TaskHistory, Project, Label, TaskFilters } from './task.interface';

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
}

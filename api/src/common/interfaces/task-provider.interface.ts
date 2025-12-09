/**
 * Task Provider Interface
 * 
 * Abstraction layer for task management systems (Todoist, Trello, Asana, etc.).
 * This interface allows the application to work with any task management provider
 * by implementing these methods.
 */

import { Task, Project, Label, TaskFilters, CreateTaskDto, UpdateTaskDto, Comment } from './task.interface';

export interface ITaskProvider {
  /**
   * Get all active tasks with optional filtering
   */
  getTasks(filters?: TaskFilters): Promise<Task[]>;

  /**
   * Get a single task by ID
   */
  getTask(taskId: string): Promise<Task>;

  /**
   * Create a new task
   */
  createTask(data: CreateTaskDto): Promise<Task>;

  /**
   * Update an existing task
   */
  updateTask(taskId: string, updates: UpdateTaskDto): Promise<Task>;

  /**
   * Update task duration (for time blocking)
   * @param taskId The task ID
   * @param durationMinutes Duration in minutes
   */
  updateTaskDuration(taskId: string, durationMinutes: number): Promise<Task>;

  /**
   * Move task to a different project
   */
  moveTask(taskId: string, projectId: string): Promise<Task>;

  /**
   * Close/complete a task
   */
  closeTask(taskId: string): Promise<boolean>;

  /**
   * Reopen a completed task
   */
  reopenTask(taskId: string): Promise<boolean>;

  /**
   * Delete a task permanently
   */
  deleteTask(taskId: string): Promise<boolean>;

  /**
   * Batch update multiple tasks
   */
  batchUpdateTasks(updates: Array<{ taskId: string; updates: UpdateTaskDto }>): Promise<Array<{ status: string; value?: Task; reason?: Error }>>;

  /**
   * Get all projects
   */
  getProjects(): Promise<Project[]>;

  /**
   * Get a single project by ID
   */
  getProject(projectId: string): Promise<Project>;

  /**
   * Get all labels
   */
  getLabels(): Promise<Label[]>;

  /**
   * Get comments for a task
   */
  getComments(taskId: string): Promise<Comment[]>;

  /**
   * Add a comment to a task
   */
  addComment(taskId: string, content: string): Promise<Comment>;

  /**
   * Test connection to the provider
   */
  testConnection(): Promise<boolean>;
}


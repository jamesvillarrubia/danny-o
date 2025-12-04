/**
 * Mock Todoist Sync Provider
 * 
 * Mock implementation of TodoistSyncProvider for testing the Sync API path.
 */

import { Task, Project, Label, Comment } from '../../src/common/interfaces';
import { BulkSyncResult } from '../../src/task-provider/todoist/todoist-sync.provider';

export class MockTodoistSyncProvider {
  private tasks: Task[] = [];
  private projects: Project[] = [];
  private labels: Label[] = [];
  private commentsByTaskId: Map<string, Comment[]> = new Map();
  private syncToken = 'mock_sync_token_123';
  private isFullSync = true;

  /**
   * Mock bulk sync - returns all seeded data in one call
   */
  async bulkSync(syncToken: string = '*'): Promise<BulkSyncResult> {
    // Simulate incremental sync behavior
    const isFullSync = syncToken === '*';
    
    return {
      tasks: this.tasks,
      projects: this.projects,
      labels: this.labels,
      commentsByTaskId: this.commentsByTaskId,
      syncToken: this.syncToken,
      isFullSync,
    };
  }

  /**
   * Mock full sync
   */
  async fullSync(): Promise<BulkSyncResult> {
    return this.bulkSync('*');
  }

  /**
   * Mock connection test
   */
  async testConnection(): Promise<boolean> {
    return true;
  }

  // ==================== Test Helper Methods ====================

  /**
   * Clear all mock data
   */
  clear(): void {
    this.tasks = [];
    this.projects = [];
    this.labels = [];
    this.commentsByTaskId.clear();
    this.syncToken = 'mock_sync_token_123';
    this.isFullSync = true;
  }

  /**
   * Seed tasks for testing
   */
  seedTasks(tasks: Task[]): void {
    this.tasks = tasks;
  }

  /**
   * Seed projects for testing
   */
  seedProjects(projects: Project[]): void {
    this.projects = projects;
  }

  /**
   * Seed labels for testing
   */
  seedLabels(labels: Label[]): void {
    this.labels = labels;
  }

  /**
   * Seed comments for testing
   */
  seedComments(taskId: string, comments: Comment[]): void {
    this.commentsByTaskId.set(taskId, comments);
  }

  /**
   * Set the sync token that will be returned
   */
  setSyncToken(token: string): void {
    this.syncToken = token;
  }
}


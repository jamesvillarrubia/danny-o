/**
 * Mock Storage Adapter
 * 
 * In-memory implementation of IStorageAdapter for testing.
 */

import { IStorageAdapter, Task, TaskMetadata, TaskHistory, Project, Label, TaskFilters, SyncState } from '../../src/common/interfaces';

export class MockStorageAdapter implements IStorageAdapter {
  private tasks: Map<string, Task> = new Map();
  private metadata: Map<string, TaskMetadata> = new Map();
  private history: TaskHistory[] = [];
  private projects: Map<string, Project> = new Map();
  private labels: Map<string, Label> = new Map();
  private lastSyncTime: Date | null = null;
  private syncToken: string = '*';

  async initialize(): Promise<void> {
    // No-op for mock
  }

  async close(): Promise<void> {
    // No-op for mock
  }

  // Task Operations
  async saveTasks(tasks: Task[]): Promise<number> {
    for (const task of tasks) {
      this.tasks.set(task.id, task);
    }
    return tasks.length;
  }

  async getTasks(filters?: TaskFilters): Promise<Task[]> {
    let results = Array.from(this.tasks.values());

    if (filters?.category) {
      results = results.filter((t) => t.metadata?.category === filters.category);
    }

    if (filters?.priority) {
      results = results.filter((t) => t.priority === filters.priority);
    }

    if (filters?.completed !== undefined) {
      results = results.filter((t) => t.isCompleted === filters.completed);
    }

    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  async getTask(taskId: string): Promise<Task | null> {
    return this.tasks.get(taskId) || null;
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    this.tasks.set(taskId, { ...task, ...updates });
    return true;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    return this.tasks.delete(taskId);
  }

  async queryTasksByMetadata(criteria: Partial<TaskMetadata>): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter((task) => {
      if (!task.metadata) return false;

      for (const [key, value] of Object.entries(criteria)) {
        if (task.metadata[key as keyof TaskMetadata] !== value) {
          return false;
        }
      }

      return true;
    });
  }

  // Task Metadata Operations
  async saveTaskMetadata(taskId: string, metadata: Partial<TaskMetadata>): Promise<void> {
    const existing = this.metadata.get(taskId) || {};
    this.metadata.set(taskId, { ...existing, ...metadata });

    // Also update task object
    const task = this.tasks.get(taskId);
    if (task) {
      task.metadata = { ...task.metadata, ...metadata };
    }
  }

  async getTaskMetadata(taskId: string): Promise<TaskMetadata | null> {
    return this.metadata.get(taskId) || null;
  }

  async saveFieldMetadata(taskId: string, fieldName: string, value: any, classifiedAt: Date): Promise<void> {
    const metadata = this.metadata.get(taskId) || {};
    (metadata as any)[fieldName] = value;
    if (classifiedAt) {
      (metadata as any)[`${fieldName}_classified_at`] = classifiedAt;
    }
    this.metadata.set(taskId, metadata);
  }

  async getFieldMetadata(taskId: string, fieldName: string): Promise<{ value: any; classifiedAt: Date } | null> {
    const metadata = this.metadata.get(taskId);
    if (!metadata) return null;

    return {
      value: (metadata as any)[fieldName],
      classifiedAt: (metadata as any)[`${fieldName}_classified_at`],
    };
  }

  async getLastSyncedState(taskId: string): Promise<SyncState | null> {
    // Simple mock - return null
    return null;
  }

  async saveLastSyncedState(taskId: string, taskState: any, syncedAt?: Date): Promise<void> {
    // Simple mock - no-op
  }

  // Task History & Learning
  async saveTaskCompletion(taskId: string, metadata: Partial<TaskHistory>): Promise<void> {
    this.history.push({
      taskId,
      taskContent: metadata.taskContent || '',
      completedAt: metadata.completedAt || new Date(),
      actualDuration: metadata.actualDuration,
      category: metadata.category,
      context: metadata.context,
    });
  }

  async getTaskHistory(filters?: any): Promise<TaskHistory[]> {
    let results = [...this.history];

    if (filters?.category) {
      results = results.filter((h) => h.category === filters.category);
    }

    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  async getCompletionPatterns(category: string): Promise<any> {
    const categoryHistory = this.history.filter((h) => h.category === category);

    return {
      category,
      totalCompleted: categoryHistory.length,
      averageDuration: categoryHistory.reduce((sum, h) => sum + (h.actualDuration || 0), 0) / categoryHistory.length,
    };
  }

  // Projects & Labels
  async saveProjects(projects: Project[]): Promise<number> {
    for (const project of projects) {
      this.projects.set(project.id, project);
    }
    return projects.length;
  }

  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async saveLabels(labels: Label[]): Promise<number> {
    for (const label of labels) {
      this.labels.set(label.id, label);
    }
    return labels.length;
  }

  async getLabels(): Promise<Label[]> {
    return Array.from(this.labels.values());
  }

  // Sync State
  async getLastSyncTime(): Promise<Date | null> {
    return this.lastSyncTime;
  }

  async setLastSyncTime(timestamp: Date): Promise<void> {
    this.lastSyncTime = timestamp;
  }

  async getSyncToken(): Promise<string> {
    return this.syncToken;
  }

  async setSyncToken(token: string): Promise<void> {
    this.syncToken = token;
  }

  // Helper methods for testing
  clear(): void {
    this.tasks.clear();
    this.metadata.clear();
    this.history = [];
    this.projects.clear();
    this.labels.clear();
    this.lastSyncTime = null;
    this.syncToken = '*';
  }

  seedTasks(tasks: Task[]): void {
    for (const task of tasks) {
      this.tasks.set(task.id, task);
      if (task.metadata) {
        this.metadata.set(task.id, task.metadata);
      }
    }
  }
}


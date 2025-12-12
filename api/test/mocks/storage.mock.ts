/**
 * Mock Storage Adapter
 * 
 * In-memory implementation of IStorageAdapter for testing.
 */

import { IStorageAdapter, Task, TaskMetadata, TaskHistory, Project, Label, TaskFilters, SyncState, TaskInsightStats } from '../../src/common/interfaces';

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

  // AI Interaction Logging
  private aiInteractions: Array<{
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
  }> = [];

  async logAIInteraction(data: {
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
  }): Promise<void> {
    this.aiInteractions.push({
      id: this.aiInteractions.length + 1,
      ...data,
      createdAt: new Date(),
    });
  }

  async getAIInteractions(filters?: {
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
  }>> {
    let results = [...this.aiInteractions];
    
    if (filters?.interactionType) {
      results = results.filter(i => i.interactionType === filters.interactionType);
    }
    if (filters?.taskId) {
      results = results.filter(i => i.taskId === filters.taskId);
    }
    if (filters?.success !== undefined) {
      results = results.filter(i => i.success === filters.success);
    }
    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }
    
    return results;
  }

  // Task Insight Stats
  async getTaskInsightStats(): Promise<TaskInsightStats> {
    const tasks = Array.from(this.tasks.values());
    return {
      totalActive: tasks.filter(t => !t.isCompleted).length,
      completedLast7Days: 0,
      completedLast30Days: 0,
      avgCompletionTimeMinutes: null,
      categoryCounts: [],
      priorityCounts: [],
      overdueCount: 0,
      dueTodayCount: 0,
      dueThisWeekCount: 0,
      noDateCount: tasks.filter(t => !t.dueDate).length,
    };
  }

  // Dashboard Views
  private views: Map<number, any> = new Map();
  private viewIdCounter = 1;

  async getViews(): Promise<any[]> {
    return Array.from(this.views.values());
  }

  async getView(slugOrId: string | number): Promise<any | null> {
    if (typeof slugOrId === 'number') {
      return this.views.get(slugOrId) || null;
    }
    return Array.from(this.views.values()).find(v => v.slug === slugOrId) || null;
  }

  async createView(data: { name: string; slug: string; filterConfig: any; orderIndex?: number }): Promise<any> {
    const view = {
      id: this.viewIdCounter++,
      ...data,
      isDefault: false,
      orderIndex: data.orderIndex ?? 0,
    };
    this.views.set(view.id, view);
    return view;
  }

  async updateView(slugOrId: string | number, data: { name?: string; filterConfig?: any; orderIndex?: number }): Promise<boolean> {
    const view = await this.getView(slugOrId);
    if (!view) return false;
    Object.assign(view, data);
    return true;
  }

  async deleteView(slugOrId: string | number): Promise<boolean> {
    const view = await this.getView(slugOrId);
    if (!view || view.isDefault) return false;
    return this.views.delete(view.id);
  }

  // Cached Insights
  private cachedInsights: Map<string, { data: any; generatedAt: string; expiresAt: string }> = new Map();

  async getCachedInsights<T>(cacheKey: string): Promise<{ data: T; generatedAt: string; expiresAt: string } | null> {
    const cached = this.cachedInsights.get(cacheKey);
    if (!cached) return null;
    if (new Date(cached.expiresAt) < new Date()) {
      this.cachedInsights.delete(cacheKey);
      return null;
    }
    return cached as { data: T; generatedAt: string; expiresAt: string };
  }

  async setCachedInsights<T>(cacheKey: string, data: T, ttlHours = 24): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
    this.cachedInsights.set(cacheKey, {
      data,
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
  }

  async invalidateCachedInsights(cacheKey: string): Promise<void> {
    this.cachedInsights.delete(cacheKey);
  }

  // App Configuration
  private configs: Map<string, string> = new Map();

  async getConfig(key: string): Promise<string | null> {
    return this.configs.get(key) || null;
  }

  async setConfig(key: string, value: string, encrypted = false): Promise<void> {
    this.configs.set(key, value);
  }

  async getConfigs(keys: string[]): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};
    for (const key of keys) {
      result[key] = this.configs.get(key) || null;
    }
    return result;
  }

  async hasConfig(key: string): Promise<boolean> {
    return this.configs.has(key);
  }

  // System Information
  getDialect(): 'pglite' | 'postgres' {
    return 'pglite';
  }

  getConnectionInfo(): { dialect: 'pglite' | 'postgres'; path?: string; connectionString?: string } {
    return { dialect: 'pglite', path: ':memory:' };
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
    this.aiInteractions = [];
    this.views.clear();
    this.cachedInsights.clear();
    this.configs.clear();
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


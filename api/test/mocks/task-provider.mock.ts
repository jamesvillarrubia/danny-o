/**
 * Mock Task Provider
 * 
 * Mock implementation of ITaskProvider for testing.
 */

import { ITaskProvider, Task, Project, Label, TaskFilters, CreateTaskDto, UpdateTaskDto, Comment } from '../../src/common/interfaces';

export class MockTaskProvider implements ITaskProvider {
  private tasks: Map<string, Task> = new Map();
  private projects: Map<string, Project> = new Map();
  private labels: Map<string, Label> = new Map();
  private comments: Map<string, Comment[]> = new Map();

  async getTasks(filters?: TaskFilters): Promise<Task[]> {
    let results = Array.from(this.tasks.values());

    if (filters?.priority) {
      results = results.filter((t) => t.priority === filters.priority);
    }

    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  async getTask(taskId: string): Promise<Task> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    return task;
  }

  async createTask(data: CreateTaskDto): Promise<Task> {
    const task: Task = {
      id: `task_${Date.now()}`,
      content: data.content,
      description: data.description,
      projectId: data.projectId || 'inbox',
      priority: data.priority || 1,
      labels: data.labels || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isCompleted: false,
    };

    this.tasks.set(task.id, task);
    return task;
  }

  async updateTask(taskId: string, updates: UpdateTaskDto): Promise<Task> {
    const task = await this.getTask(taskId);
    const updated = {
      ...task,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(taskId, updated);
    return updated;
  }

  async updateTaskDuration(taskId: string, durationMinutes: number): Promise<Task> {
    const task = await this.getTask(taskId);
    // In mock, we just store duration as metadata (Todoist stores it natively)
    const updated = {
      ...task,
      updatedAt: new Date().toISOString(),
      // Store in metadata for testing purposes
      metadata: {
        ...task.metadata,
        timeEstimateMinutes: durationMinutes,
      },
    };
    this.tasks.set(taskId, updated);
    return updated;
  }

  async closeTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.isCompleted = true;
    task.completedAt = new Date().toISOString();
    return true;
  }

  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async getLabels(): Promise<Label[]> {
    return Array.from(this.labels.values());
  }

  async moveTask(taskId: string, projectId: string): Promise<Task> {
    const task = await this.getTask(taskId);
    task.projectId = projectId;
    this.tasks.set(taskId, task);
    return task;
  }

  async reopenTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    task.isCompleted = false;
    task.completedAt = null;
    return true;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    return this.tasks.delete(taskId);
  }

  async batchUpdateTasks(
    updates: Array<{ taskId: string; updates: UpdateTaskDto }>
  ): Promise<Array<{ status: string; value?: Task; reason?: Error }>> {
    const results = [];
    for (const { taskId, updates: taskUpdates } of updates) {
      try {
        const task = await this.updateTask(taskId, taskUpdates);
        results.push({ status: 'fulfilled', value: task });
      } catch (error) {
        results.push({ status: 'rejected', reason: error as Error });
      }
    }
    return results;
  }

  async getProject(projectId: string): Promise<Project> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    return project;
  }

  async getComments(taskId: string): Promise<Comment[]> {
    return this.comments.get(taskId) || [];
  }

  async addComment(taskId: string, content: string): Promise<Comment> {
    const comment: Comment = {
      id: `comment_${Date.now()}`,
      taskId,
      content,
      postedAt: new Date().toISOString(),
    };
    const existing = this.comments.get(taskId) || [];
    existing.push(comment);
    this.comments.set(taskId, existing);
    return comment;
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  // Helper methods for testing
  clear(): void {
    this.tasks.clear();
    this.projects.clear();
    this.labels.clear();
    this.comments.clear();
  }

  seedTasks(tasks: Task[]): void {
    for (const task of tasks) {
      this.tasks.set(task.id, task);
    }
  }

  seedProjects(projects: Project[]): void {
    for (const project of projects) {
      this.projects.set(project.id, project);
    }
  }

  seedLabels(labels: Label[]): void {
    for (const label of labels) {
      this.labels.set(label.id, label);
    }
  }
}


/**
 * Todoist Sync API Provider
 * 
 * Efficient implementation using Todoist's Sync API v9 for bulk data fetching.
 * 
 * Key advantages over REST API:
 * - Single request fetches ALL tasks, projects, labels, AND comments (notes)
 * - Supports incremental sync via sync_token (only fetch changes)
 * - Dramatically reduces API calls and avoids rate limits
 * 
 * @see https://developer.todoist.com/sync/v9/
 */

import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  Task,
  Project,
  Label,
  Comment,
  TaskDue,
} from '../../common/interfaces/task.interface';

/**
 * Response structure from Todoist Sync API v1
 * @see https://developer.todoist.com/api/v1#tag/Sync
 */
export interface TodoistSyncResponse {
  sync_token: string;
  full_sync: boolean;
  /** UTC timestamp of when full sync data was generated (only on initial sync) */
  full_sync_date_utc?: string;
  items?: TodoistSyncItem[];
  projects?: TodoistSyncProject[];
  labels?: TodoistSyncLabel[];
  notes?: TodoistSyncNote[];
  user?: any;
  [key: string]: any;
}

/**
 * Todoist Sync API item (task) structure
 */
interface TodoistSyncItem {
  id: string;
  content: string;
  description: string;
  project_id: string;
  parent_id: string | null;
  priority: number;
  labels: string[];
  due: {
    date: string;
    datetime?: string;
    string?: string;
    timezone?: string;
    is_recurring: boolean;
  } | null;
  added_at: string;
  is_deleted: boolean;
  checked: boolean;
  completed_at: string | null;
}

/**
 * Todoist Sync API project structure
 */
interface TodoistSyncProject {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
  child_order: number;
  is_deleted: boolean;
  is_archived: boolean;
  is_favorite: boolean;
  inbox_project: boolean;
  team_inbox: boolean;
  view_style: string;
}

/**
 * Todoist Sync API label structure
 */
interface TodoistSyncLabel {
  id: string;
  name: string;
  color: string;
  item_order: number;
  is_deleted: boolean;
  is_favorite: boolean;
}

/**
 * Todoist Sync API note (comment) structure
 */
interface TodoistSyncNote {
  id: string;
  item_id: string;
  project_id?: string;
  content: string;
  posted_at: string;
  is_deleted: boolean;
  file_attachment?: {
    file_name: string;
    file_type: string;
    file_url: string;
    resource_type: string;
  };
}

/**
 * Bulk sync result containing all fetched data
 */
export interface BulkSyncResult {
  tasks: Task[];
  projects: Project[];
  labels: Label[];
  /** Map of taskId -> comments for that task */
  commentsByTaskId: Map<string, Comment[]>;
  syncToken: string;
  isFullSync: boolean;
}

@Injectable()
export class TodoistSyncProvider {
  private readonly logger = new Logger(TodoistSyncProvider.name);
  private readonly client: AxiosInstance;
  
  /**
   * Todoist API v1 unified sync endpoint
   * Note: The sync endpoint still uses legacy naming (items, notes) as documented
   * @see https://developer.todoist.com/api/v1#tag/Sync
   */
  private readonly SYNC_API_URL = 'https://api.todoist.com/api/v1/sync';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Todoist API key is required');
    }

    this.client = axios.create({
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    this.logger.log('Todoist Sync API provider initialized');
  }

  /**
   * Perform a bulk sync operation fetching all data in a single request.
   * 
   * @param syncToken - Previous sync token for incremental sync, or '*' for full sync
   * @returns All tasks, projects, labels, and comments with the new sync token
   */
  async bulkSync(syncToken: string = '*'): Promise<BulkSyncResult> {
    const isFullSync = syncToken === '*';
    this.logger.log(`Starting ${isFullSync ? 'full' : 'incremental'} sync...`);

    try {
      const response = await this.client.post<TodoistSyncResponse>(
        this.SYNC_API_URL,
        new URLSearchParams({
          sync_token: syncToken,
          resource_types: JSON.stringify(['items', 'projects', 'labels', 'notes']),
        }),
      );

      const data = response.data;

      // Convert Todoist items to our Task format
      const tasks = (data.items || [])
        .filter(item => !item.is_deleted && !item.checked)
        .map(item => this.convertToTask(item));

      // Convert projects
      const projects = (data.projects || [])
        .filter(project => !project.is_deleted && !project.is_archived)
        .map(project => this.convertToProject(project));

      // Convert labels
      const labels = (data.labels || [])
        .filter(label => !label.is_deleted)
        .map(label => this.convertToLabel(label));

      // Group notes (comments) by task ID
      const commentsByTaskId = new Map<string, Comment[]>();
      for (const note of (data.notes || [])) {
        if (note.is_deleted || !note.item_id) continue;
        
        const comment = this.convertToComment(note);
        const existing = commentsByTaskId.get(note.item_id) || [];
        existing.push(comment);
        commentsByTaskId.set(note.item_id, existing);
      }

      this.logger.log(
        `Sync complete: ${tasks.length} tasks, ${projects.length} projects, ` +
        `${labels.length} labels, ${commentsByTaskId.size} tasks with comments`
      );

      return {
        tasks,
        projects,
        labels,
        commentsByTaskId,
        syncToken: data.sync_token,
        isFullSync: data.full_sync,
      };
    } catch (error: any) {
      this.logger.error(`Sync API error: ${error.message}`);
      throw this.handleError(error);
    }
  }

  /**
   * Fetch all data with a fresh full sync (ignoring any cached sync token)
   */
  async fullSync(): Promise<BulkSyncResult> {
    return this.bulkSync('*');
  }

  /**
   * Test connection to Todoist API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.post(
        this.SYNC_API_URL,
        new URLSearchParams({
          sync_token: '*',
          resource_types: JSON.stringify(['user']),
        }),
      );
      this.logger.log('Connection test successful');
      return true;
    } catch (error: any) {
      this.logger.error(`Connection test failed: ${error.message}`);
      return false;
    }
  }

  // ==================== Data Conversion Methods ====================

  private convertToTask(item: TodoistSyncItem): Task {
    return {
      id: item.id,
      content: item.content,
      description: item.description || '',
      projectId: item.project_id,
      parentId: item.parent_id || null,
      priority: item.priority || 1,
      labels: item.labels || [],
      due: item.due ? this.convertToDue(item.due) : null,
      createdAt: item.added_at,
      updatedAt: new Date().toISOString(),
      isCompleted: item.checked || false,
      completedAt: item.completed_at || null,
    };
  }

  private convertToDue(due: TodoistSyncItem['due']): TaskDue | null {
    if (!due) return null;
    return {
      date: due.date,
      datetime: due.datetime ?? null,
      string: due.string ?? undefined,
      timezone: due.timezone ?? null,
      isRecurring: due.is_recurring || false,
    };
  }

  private convertToProject(project: TodoistSyncProject): Project {
    return {
      id: project.id,
      name: project.name,
      color: project.color,
      parentId: project.parent_id || null,
      order: project.child_order,
      isShared: false,
      isFavorite: project.is_favorite || false,
      isInboxProject: project.inbox_project || false,
      isTeamInbox: project.team_inbox || false,
    };
  }

  private convertToLabel(label: TodoistSyncLabel): Label {
    return {
      id: label.id,
      name: label.name,
      color: label.color,
      order: label.item_order,
      isFavorite: label.is_favorite || false,
    };
  }

  private convertToComment(note: TodoistSyncNote): Comment {
    return {
      id: note.id,
      taskId: note.item_id,
      projectId: note.project_id,
      content: note.content,
      postedAt: note.posted_at,
      attachment: note.file_attachment ? {
        fileName: note.file_attachment.file_name,
        fileType: note.file_attachment.file_type,
        fileUrl: note.file_attachment.file_url,
        resourceType: note.file_attachment.resource_type,
      } : undefined,
    };
  }

  private handleError(error: any): Error {
    if (error.response) {
      const status = error.response.status;
      
      if (status === 429) {
        return new Error('Rate limit exceeded. Please try again later.');
      }
      if (status === 401) {
        return new Error('Invalid Todoist API key. Please check your configuration.');
      }
      if (status === 403) {
        return new Error('Access forbidden. Check API key permissions.');
      }
      if (status >= 500) {
        return new Error('Todoist service error. Please try again later.');
      }
    }
    return error;
  }
}


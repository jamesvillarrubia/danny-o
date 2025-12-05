/**
 * Core Task Types
 * 
 * Generic task interfaces that are provider-agnostic.
 * These allow swapping between different task management systems.
 */

/**
 * Comment on a task or project
 */
export interface Comment {
  id: string;
  taskId?: string;
  projectId?: string;
  content: string;
  postedAt: string;
  attachment?: {
    fileName: string;
    fileType: string;
    fileUrl: string;
    resourceType: string;
  };
}

export interface Task {
  id: string;
  content: string;
  description?: string;
  projectId: string;
  parentId?: string | null;
  priority: number; // 1-4
  labels?: string[];
  due?: TaskDue | null;
  createdAt: string;
  updatedAt: string;
  isCompleted: boolean;
  completedAt?: string | null;
  
  // Comments (optional, fetched separately)
  comments?: Comment[];
  
  // Metadata from enrichment (optional)
  metadata?: TaskMetadata;
}

export interface TaskDue {
  date: string; // YYYY-MM-DD
  datetime?: string | null; // ISO 8601
  string?: string; // Natural language
  timezone?: string | null;
  isRecurring: boolean;
}

export interface TaskMetadata {
  category?: string;
  timeEstimate?: string;
  timeEstimateMinutes?: number;
  size?: 'XS' | 'S' | 'M' | 'L' | 'XL';
  aiConfidence?: number;
  aiReasoning?: string;
  needsSupplies?: boolean;
  canDelegate?: boolean;
  energyLevel?: 'low' | 'medium' | 'high';
  classificationSource?: 'ai' | 'manual';
  recommendedCategory?: string;
  recommendationApplied?: boolean;
  categoryClassifiedAt?: Date;
  // Legacy field names for backward compatibility (snake_case from DB)
  category_classified_at?: Date;
  classification_source?: 'ai' | 'manual';
  recommended_category?: string;
}

export interface Project {
  id: string;
  name: string;
  color?: string;
  parentId?: string | null;
  order?: number;
  commentCount?: number;
  isShared?: boolean;
  isFavorite?: boolean;
  isInboxProject?: boolean;
  isTeamInbox?: boolean;
  url?: string;
}

export interface Label {
  id: string;
  name: string;
  color?: string;
  order?: number;
  isFavorite?: boolean;
}

export interface TaskFilters {
  projectId?: string;
  labelId?: string;
  filter?: string;
  category?: string;
  priority?: number;
  completed?: boolean;
  limit?: number;
}

export interface CreateTaskDto {
  content: string;
  description?: string;
  projectId?: string;
  parentId?: string;
  priority?: number;
  dueString?: string;
  dueDate?: string;
  labels?: string[];
}

export interface UpdateTaskDto {
  content?: string;
  description?: string;
  projectId?: string;
  priority?: number;
  dueString?: string;
  dueDate?: string;
  labels?: string[];
}

export interface TaskHistory {
  id?: number;
  taskId?: string;
  taskContent?: string;
  completedAt?: Date;
  category?: string;
  actualDuration?: number;
  context?: string;
}


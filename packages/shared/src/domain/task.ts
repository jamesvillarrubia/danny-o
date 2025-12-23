/**
 * Core Task Domain Types
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

/**
 * Task due date information
 */
export interface TaskDue {
  date: string; // YYYY-MM-DD
  datetime?: string | null; // ISO 8601
  string?: string; // Natural language
  timezone?: string | null;
  isRecurring: boolean;
}

/**
 * Task metadata from AI enrichment
 */
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

/**
 * Core task interface
 */
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

/**
 * Task filter criteria
 */
export interface TaskFilters {
  projectId?: string;
  labelId?: string;
  filter?: string;
  category?: string;
  priority?: number;
  completed?: boolean;
  limit?: number;
}

/**
 * DTO for creating a task
 */
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

/**
 * DTO for updating a task
 */
export interface UpdateTaskDto {
  content?: string;
  description?: string;
  projectId?: string;
  priority?: number;
  dueString?: string;
  dueDate?: string;
  labels?: string[];
}

/**
 * Task completion history
 */
export interface TaskHistory {
  id?: number;
  taskId?: string;
  taskContent?: string;
  completedAt?: Date;
  category?: string;
  actualDuration?: number;
  context?: string;
}

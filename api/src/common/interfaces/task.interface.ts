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

/**
 * Time constraint options for scheduling tasks
 * - business-hours: Must be done Mon-Fri 9am-5pm (banks, offices, calls)
 * - weekdays-only: Must be done Mon-Fri but not time-restricted
 * - evenings: Best done after work hours
 * - weekends: Best done Sat/Sun
 * - anytime: No scheduling constraints
 */
export type TimeConstraint = 'business-hours' | 'weekdays-only' | 'evenings' | 'weekends' | 'anytime';

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
  
  // Scheduling fields
  requiresDriving?: boolean;
  timeConstraint?: TimeConstraint;
  
  // Legacy field names for backward compatibility (snake_case from DB)
  category_classified_at?: Date;
  classification_source?: 'ai' | 'manual';
  recommended_category?: string;
  requires_driving?: boolean;
  time_constraint?: TimeConstraint;
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
  
  // Scheduling filters
  requiresDriving?: boolean;
  timeConstraint?: TimeConstraint;
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
  // Duration fields for Todoist time blocking
  duration?: number;
  durationUnit?: 'minute' | 'day';
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

/**
 * Pre-computed statistics for task insights
 * These are aggregated in the database, not by the AI
 */
export interface TaskInsightStats {
  // Overview counts
  totalActive: number;
  totalCompletedLast30Days: number;

  // Active tasks by category
  activeByCategory: Record<string, number>;
  
  // Completed tasks by category (last 30 days)
  completedByCategory: Record<string, number>;

  // Age distribution of active tasks
  taskAgeBuckets: {
    recent: number;      // < 7 days old
    week: number;        // 7-30 days old
    month: number;       // 30-90 days old
    stale: number;       // 90+ days old
  };

  // Completion metrics
  avgCompletionTimeByCategory: Record<string, number | null>;
  completionRateLast7Days: number;  // tasks completed / tasks created
  completionRateLast30Days: number;

  // Estimate coverage
  tasksWithEstimates: number;
  tasksWithoutEstimates: number;

  // Due date analysis
  overdueTasks: number;
  dueSoon: number; // due in next 7 days

  // Top labels on active tasks
  topLabels: Array<{ label: string; count: number }>;

  // Stale task examples (for AI to suggest archiving)
  stalestTasks: Array<{ id: string; content: string; ageInDays: number; category: string }>;
}


/**
 * TypeScript Types for Danny Web App
 */

// Task types
export interface TaskDue {
  date: string;
  datetime?: string | null;
  string?: string;
  timezone?: string | null;
  isRecurring: boolean;
}

export interface TaskMetadata {
  category?: string;
  timeEstimate?: string;
  timeEstimateMinutes?: number;
  size?: 'XS' | 'S' | 'M' | 'L' | 'XL';
  aiConfidence?: number;
}

export interface Task {
  id: string;
  content: string;
  description?: string;
  projectId?: string;
  priority: number;
  labels?: string[];
  due?: TaskDue | null;
  createdAt?: string;
  updatedAt?: string;
  isCompleted: boolean;
  completedAt?: string | null;
  metadata?: TaskMetadata;
}

// View types
export interface ViewFilterConfig {
  priority?: number[];
  categories?: string[];
  projectId?: string;
  dueWithin?: 'today' | '7d' | '14d' | '30d';
  overdue?: boolean;
  completed?: boolean;
  taskIds?: string[];
  limit?: number;
}

export interface View {
  id: number;
  name: string;
  slug: string;
  filterConfig: ViewFilterConfig;
  isDefault: boolean;
  orderIndex: number;
}

// Chat types
export interface ChatAction {
  type: string;
  description: string;
  taskId?: string;
  filterConfig?: ViewFilterConfig;
}

export interface ChatResponse {
  response: string;
  success: boolean;
  turns?: number;
  actions?: ChatAction[];
  filterConfig?: ViewFilterConfig;
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

export interface ListTasksResponse {
  tasks: Task[];
  view: View;
  totalCount: number;
}

export interface ListViewsResponse {
  views: View[];
}

// Settings
export interface Settings {
  apiKey: string;
  theme?: 'light' | 'dark' | 'system';
}


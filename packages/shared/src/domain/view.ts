/**
 * View Domain Types
 * 
 * Views represent saved filter configurations for task lists.
 */

/**
 * View filter configuration
 */
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

/**
 * View interface
 */
export interface View {
  id: number;
  name: string;
  slug: string;
  filterConfig: ViewFilterConfig;
  isDefault: boolean;
  orderIndex: number;
}

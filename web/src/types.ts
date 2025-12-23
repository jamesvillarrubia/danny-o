/**
 * TypeScript Types for Danny Web App
 * 
 * Re-exports shared types from @danny-tasks/shared.
 * Web-specific types are defined here.
 */

// Re-export all shared domain and API types
export type {
  Task,
  TaskDue,
  TaskMetadata,
  Project,
  Label,
  View,
  ViewFilterConfig,
  ListTasksResponse,
  ListViewsResponse,
  ChatResponse,
  ChatAction,
  ApiResponse,
  SyncMode,
  OrphanedTasksReport,
  MergeDecision,
} from '@danny-tasks/shared';

// Web-specific types
export interface Settings {
  apiKey: string;
  theme?: 'light' | 'dark' | 'system';
}


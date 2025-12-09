/**
 * Kysely Database Types
 * 
 * Type definitions for all database tables.
 * Used by Kysely for type-safe queries.
 */

import { Generated, ColumnType } from 'kysely';

// Task table
export interface TaskTable {
  id: string;
  content: string;
  description: string | null;
  project_id: string | null;
  parent_id: string | null;
  order: number | null;
  priority: number;
  due_string: string | null;
  due_date: string | null;
  due_datetime: string | null;
  due_timezone: string | null;
  labels: string | null; // JSON array
  created_at: string | null;
  is_completed: number; // 0 or 1
  completed_at: string | null;
  content_hash: string | null;
  raw_data: string | null; // JSON
  last_synced_at: ColumnType<string, string | undefined, string>;
}

// Task metadata table
export interface TaskMetadataTable {
  task_id: string;
  category: string | null;
  time_estimate: string | null;
  time_estimate_minutes: number | null;
  time_estimate_minutes_classified_at: string | null;
  size: string | null;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  needs_supplies: number | null; // 0 or 1
  can_delegate: number | null; // 0 or 1
  energy_level: string | null;
  classification_source: string | null;
  recommended_category: string | null;
  recommended_category_classified_at: string | null;
  category_classified_at: string | null;
  priority_score: number | null;
  priority_classified_at: string | null;
  last_synced_state: string | null; // JSON
  last_synced_at: string | null;
  recommendation_applied: number | null; // 0 or 1
  // Scheduling fields
  requires_driving: number | null; // 0 or 1
  time_constraint: string | null; // 'business-hours' | 'weekdays-only' | 'evenings' | 'weekends' | 'anytime'
  created_at: ColumnType<string, string | undefined, string>;
  updated_at: ColumnType<string, string | undefined, string>;
}

// Task history table
export interface TaskHistoryTable {
  id: Generated<number>;
  task_id: string;
  content: string;
  completed_at: string;
  actual_duration: number | null;
  estimated_duration: number | null;
  category: string | null;
  context: string | null; // JSON
  created_at: ColumnType<string, string | undefined, string>;
}

// Projects table
export interface ProjectTable {
  id: string;
  name: string;
  color: string | null;
  parent_id: string | null;
  order: number | null;
  is_shared: number; // 0 or 1
  is_favorite: number; // 0 or 1
  is_inbox_project: number; // 0 or 1
  raw_data: string | null; // JSON
  last_synced_at: ColumnType<string, string | undefined, string>;
}

// Labels table
export interface LabelTable {
  id: string;
  name: string;
  color: string | null;
  order: number | null;
  is_favorite: number; // 0 or 1
  last_synced_at: ColumnType<string, string | undefined, string>;
}

// Sync state table
export interface SyncStateTable {
  key: string;
  value: string | null;
  updated_at: ColumnType<string, string | undefined, string>;
}

// AI interactions logging table
export interface AIInteractionTable {
  id: Generated<number>;
  interaction_type: string; // 'classify', 'respond', 'plan', etc.
  task_id: string | null;
  input_context: string | null; // JSON
  prompt_used: string | null;
  ai_response: string | null; // JSON
  action_taken: string | null;
  success: number; // 0 or 1
  error_message: string | null;
  latency_ms: number | null;
  model_used: string | null;
  created_at: ColumnType<string, string | undefined, string>;
}

// Migrations table
export interface MigrationTable {
  id: string;
  applied_at: ColumnType<string, string | undefined, string>;
}

// Dashboard views table
export interface ViewTable {
  id: Generated<number>;
  name: string;
  slug: string; // URL-friendly identifier
  filter_config: string; // JSON configuration
  is_default: number; // 0 or 1 - one of the built-in views
  order_index: number; // Display order
  created_at: ColumnType<string, string | undefined, string>;
  updated_at: ColumnType<string, string | undefined, string>;
}

// Complete database interface
export interface Database {
  tasks: TaskTable;
  task_metadata: TaskMetadataTable;
  task_history: TaskHistoryTable;
  projects: ProjectTable;
  labels: LabelTable;
  sync_state: SyncStateTable;
  ai_interactions: AIInteractionTable;
  migrations: MigrationTable;
  views: ViewTable;
}


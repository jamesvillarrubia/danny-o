/**
 * Core Task Types
 * 
 * Re-exports from @danny-tasks/shared for backward compatibility.
 * API-specific interfaces (IStorageAdapter, ITaskProvider) remain in separate files.
 */

// Re-export all domain types from shared package
export type {
  Comment,
  Task,
  TaskDue,
  TaskMetadata,
  Project,
  Label,
  TaskFilters,
  CreateTaskDto,
  UpdateTaskDto,
  TaskHistory,
} from '@danny-tasks/shared';


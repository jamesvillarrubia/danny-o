/**
 * Task API DTOs
 * 
 * Request and response DTOs for task-related API endpoints.
 * Follows Google API Design Guide conventions.
 */

import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// Request DTOs
// ============================================================================

/**
 * Query parameters for listing tasks
 */
export class ListTasksQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(4)
  priority?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number = 1000;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  completed?: boolean = false;
}

/**
 * Request body for creating a task
 */
export class CreateTaskDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  priority?: number;

  @IsOptional()
  @IsString()
  dueString?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];
}

/**
 * Request body for updating a task
 */
export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  priority?: number;

  @IsOptional()
  @IsString()
  dueString?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];

  @IsOptional()
  @IsString()
  category?: string;
}

/**
 * Request body for completing a task
 */
export class CompleteTaskRequestDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  actualMinutes?: number;

  @IsOptional()
  @IsString()
  context?: string;
}

/**
 * Request body for syncing tasks
 */
export class SyncTasksRequestDto {
  @IsOptional()
  @IsBoolean()
  fullSync?: boolean = false;
}

/**
 * Request body for searching tasks
 */
export class SearchTasksRequestDto {
  @IsString()
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * Request body for batch updating tasks
 */
export class BatchUpdateTasksRequestDto {
  @IsArray()
  updates!: Array<{
    taskId: string;
    updates: UpdateTaskDto;
  }>;
}

// ============================================================================
// Response DTOs
// ============================================================================

/**
 * Standard task response
 */
export interface TaskResponseDto {
  id: string;
  content: string;
  description?: string;
  projectId: string;
  priority: number;
  labels?: string[];
  due?: {
    date: string;
    datetime?: string | null;
    string?: string;
    isRecurring: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
  isCompleted: boolean;
  completedAt?: string | null;
  metadata?: {
    category?: string;
    timeEstimate?: string;
    timeEstimateMinutes?: number;
    size?: 'XS' | 'S' | 'M' | 'L' | 'XL';
    aiConfidence?: number;
  };
}

/**
 * List tasks response with pagination
 */
export interface ListTasksResponseDto {
  tasks: TaskResponseDto[];
  totalCount: number;
  nextPageToken?: string;
}

/**
 * Sync result response
 */
export interface SyncResponseDto {
  synced: number;
  tasks: number;
  projects: number;
  labels: number;
  newTasks: number;
  duration: number;
}

/**
 * Search result response
 */
export interface SearchTasksResponseDto {
  results: TaskResponseDto[];
  query: string;
  totalMatches: number;
}

/**
 * Complete task response
 */
export interface CompleteTaskResponseDto {
  taskId: string;
  completedAt: string;
  actualMinutes?: number;
}

/**
 * Batch update response
 */
export interface BatchUpdateResponseDto {
  updated: number;
  failed: number;
  results: Array<{
    taskId: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
}


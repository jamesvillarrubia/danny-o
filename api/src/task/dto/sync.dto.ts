/**
 * DTOs for Task Sync Operations
 * 
 * Data transfer objects for sync engine operations with validation.
 */

import { IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class SyncOptionsDto {
  @IsOptional()
  @IsNumber()
  intervalMs?: number;
}

export class SyncResultDto {
  @IsBoolean()
  success: boolean;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsNumber()
  tasks?: number;

  @IsOptional()
  @IsNumber()
  projects?: number;

  @IsOptional()
  @IsNumber()
  labels?: number;

  @IsOptional()
  @IsNumber()
  newTasks?: number;

  @IsOptional()
  @IsString()
  error?: string;

  timestamp: Date;
}

export class CompleteTaskDto {
  @IsOptional()
  @IsNumber()
  actualDuration?: number;

  @IsOptional()
  @IsString()
  context?: string;
}

export class CreateTaskInputDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsString()
  dueString?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  labels?: string[];
}


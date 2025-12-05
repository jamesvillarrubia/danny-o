/**
 * DTOs for MCP Tool Inputs
 * 
 * Validation schemas for each MCP tool's input arguments.
 */

import { IsString, IsNumber, IsOptional, IsArray, IsBoolean, IsEnum, Min, Max } from 'class-validator';

export class ListTasksInputDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  priority?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class GetTaskInputDto {
  @IsString()
  taskId: string;
}

export class ClassifyTasksInputDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  taskIds?: string[];
}

export class PrioritizeInputDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class EstimateTimeInputDto {
  @IsString()
  taskId: string;
}

export class DailyPlanInputDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  hoursAvailable?: number;
}

export class BreakdownTaskInputDto {
  @IsString()
  taskId: string;
}

export class SearchTasksInputDto {
  @IsString()
  query: string;
}

export class UpdateTaskInputDto {
  @IsString()
  taskId: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  priority?: number;

  @IsOptional()
  @IsString()
  category?: string;
}

export class CompleteTaskInputDto {
  @IsString()
  taskId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  actualMinutes?: number;
}

export class TaskHistoryInputDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class CompleteTaskBySearchInputDto {
  @IsString()
  searchTerm: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  actualMinutes?: number;
}

export class RecentlyCompletedInputDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class ProductivityStatsInputDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  days?: number;
}

export class ProcessTextInputDto {
  @IsString()
  text: string;
}


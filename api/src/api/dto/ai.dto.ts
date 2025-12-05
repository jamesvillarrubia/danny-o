/**
 * AI API DTOs
 * 
 * Request and response DTOs for AI-related API endpoints.
 * Follows Google API Design Guide conventions for RPC-style methods.
 */

import { IsString, IsOptional, IsNumber, IsArray, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// Request DTOs
// ============================================================================

/**
 * Request body for classifying tasks
 */
export class ClassifyTasksRequestDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  taskIds?: string[];

  @IsOptional()
  @Type(() => Boolean)
  force?: boolean = false;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  batchSize?: number = 10;
}

/**
 * Request body for prioritizing tasks
 */
export class PrioritizeTasksRequestDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

/**
 * Request body for estimating task time
 */
export class EstimateTimeRequestDto {
  @IsString()
  taskId!: string;
}

/**
 * Request body for generating a daily plan
 */
export class DailyPlanRequestDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(16)
  hoursAvailable?: number;

  @IsOptional()
  @IsString()
  focusCategory?: string;
}

/**
 * Request body for breaking down a task
 */
export class BreakdownTaskRequestDto {
  @IsString()
  taskId!: string;
}

/**
 * Request body for getting insights
 */
export class InsightsRequestDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(90)
  days?: number = 7;
}

// ============================================================================
// Response DTOs
// ============================================================================

/**
 * Classification result for a single task
 */
export interface ClassificationResultDto {
  taskId: string;
  taskContent: string;
  category: string;
  confidence: number;
  reasoning?: string;
}

/**
 * Classify tasks response
 */
export interface ClassifyTasksResponseDto {
  results: ClassificationResultDto[];
  tasksProcessed: number;
  tasksClassified: number;
  duration: number;
}

/**
 * Priority recommendation for a single task
 */
export interface PriorityRecommendationDto {
  taskId: string;
  taskContent: string;
  recommendedPriority: number;
  urgencyScore: number;
  impactScore: number;
  reasoning: string;
}

/**
 * Prioritize tasks response
 */
export interface PrioritizeTasksResponseDto {
  recommendations: PriorityRecommendationDto[];
  startWith: string | null;
  defer: string[];
  delegate: string[];
}

/**
 * Time estimate response
 */
export interface EstimateTimeResponseDto {
  taskId: string;
  taskContent: string;
  estimate: string;
  timeEstimateMinutes: number;
  size: 'XS' | 'S' | 'M' | 'L' | 'XL';
  confidence: number;
  reasoning: string;
}

/**
 * Daily plan response
 */
export interface DailyPlanResponseDto {
  summary: string;
  notes: string;
  today: {
    tasks: Array<{
      taskId: string;
      content: string;
      estimatedMinutes: number;
      reason: string;
    }>;
    totalTime: string;
  };
  thisWeek: {
    tasks: Array<{
      taskId: string;
      content: string;
    }>;
    reasoning: string;
  };
  needsSupplies?: {
    tasks: Array<{
      taskId: string;
      content: string;
    }>;
    shoppingList: string[];
    suggestion: string;
  };
  delegateToSpouse?: {
    tasks: Array<{
      taskId: string;
      content: string;
    }>;
    reasoning: string;
  };
}

/**
 * Task breakdown (subtasks) response
 */
export interface BreakdownTaskResponseDto {
  taskId: string;
  taskContent: string;
  subtasks: Array<{
    content: string;
    estimatedMinutes: number;
    order: number;
  }>;
  totalEstimate: string;
  supplyList?: string[];
  notes?: string;
}

/**
 * Productivity insight
 */
export interface InsightDto {
  type: 'pattern' | 'recommendation' | 'warning' | 'achievement';
  title: string;
  description: string;
  data?: Record<string, any>;
}

/**
 * Insights response
 */
export interface InsightsResponseDto {
  insights: InsightDto[];
  recommendations: string[];
  period: string;
  stats: {
    tasksCompleted: number;
    averageCompletionTime?: number;
    mostProductiveCategory?: string;
    mostProductiveDay?: string;
  };
}


/**
 * Stats API DTOs
 * 
 * Request and response DTOs for statistics and analytics endpoints.
 */

import { IsOptional, IsNumber, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// Request DTOs
// ============================================================================

/**
 * Query parameters for productivity stats
 */
export class ProductivityStatsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(90)
  days?: number = 7;

  @IsOptional()
  @IsString()
  category?: string;
}

/**
 * Query parameters for task history
 */
export class TaskHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

// ============================================================================
// Response DTOs
// ============================================================================

/**
 * Productivity statistics response
 */
export interface ProductivityStatsResponseDto {
  period: string;
  totalCompleted: number;
  withTimeTracking: number;
  averageMinutes: number | null;
  byCategory: Record<string, number>;
  byDay: Record<string, number>;
  trends?: {
    direction: 'up' | 'down' | 'stable';
    percentageChange: number;
    comparedTo: string;
  };
}

/**
 * Enrichment statistics response
 */
export interface EnrichmentStatsResponseDto {
  total: number;
  classified: number;
  unclassified: number;
  withTimeEstimate: number;
  withPriority: number;
  byCategory: Record<string, number>;
  classificationRate: number;
  aiClassified: number;
  manuallyClassified: number;
}

/**
 * Task history entry
 */
export interface TaskHistoryEntryDto {
  id: number;
  taskId: string;
  taskContent: string;
  completedAt: string;
  category?: string;
  actualDuration?: number;
  timeAgo: string;
}

/**
 * Task history response
 */
export interface TaskHistoryResponseDto {
  entries: TaskHistoryEntryDto[];
  totalCount: number;
  nextPageToken?: string;
}


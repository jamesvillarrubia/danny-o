/**
 * DTOs for Task Enrichment Operations
 * 
 * Data transfer objects for AI enrichment metadata.
 */

import { IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class TaskMetadataDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  timeEstimate?: string;

  @IsOptional()
  @IsString()
  size?: 'XS' | 'S' | 'M' | 'L' | 'XL';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  aiConfidence?: number;

  @IsOptional()
  @IsString()
  aiReasoning?: string;

  @IsOptional()
  @IsBoolean()
  needsSupplies?: boolean;

  @IsOptional()
  @IsBoolean()
  canDelegate?: boolean;

  @IsOptional()
  @IsString()
  energyLevel?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsArray()
  labels?: string[];

  @IsOptional()
  @IsString()
  classificationSource?: 'ai' | 'manual';

  @IsOptional()
  @IsString()
  recommendedCategory?: string;

  @IsOptional()
  @IsBoolean()
  recommendationApplied?: boolean;

  @IsOptional()
  @IsObject()
  categoryClassifiedAt?: Date;

  @IsOptional()
  @IsNumber()
  timeEstimateMinutes?: number;

  // Legacy field names for backward compatibility (snake_case from DB)
  @IsOptional()
  @IsObject()
  category_classified_at?: Date;

  @IsOptional()
  @IsString()
  classification_source?: 'ai' | 'manual';

  @IsOptional()
  @IsString()
  recommended_category?: string;
}

export class EnrichmentOptionsDto {
  @IsOptional()
  @IsBoolean()
  moveToProject?: boolean;
}

export class BatchEnrichmentDto {
  taskId: string;
  metadata: TaskMetadataDto;
}

export class UnclassifiedTasksOptionsDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class EnrichmentStatsDto {
  @IsNumber()
  total: number;

  @IsNumber()
  classified: number;

  @IsNumber()
  unclassified: number;

  @IsNumber()
  withTimeEstimate: number;

  @IsNumber()
  withSize: number;

  @IsObject()
  byCategory: Record<string, number>;
}


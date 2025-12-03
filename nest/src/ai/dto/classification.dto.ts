/**
 * Classification DTOs
 */

import { IsArray, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class ClassificationResultDto {
  @IsString()
  taskId: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];

  @IsOptional()
  @IsArray()
  suggestedLabels?: Array<{
    id: string;
    name: string;
    reasoning: string;
  }>;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @IsString()
  reasoning: string;
}

export class TimeEstimateDto {
  @IsString()
  taskId: string;

  @IsString()
  timeEstimate: string;

  @IsOptional()
  @IsNumber()
  timeEstimateMinutes?: number;

  @IsString()
  size: 'XS' | 'S' | 'M' | 'L' | 'XL';

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @IsString()
  reasoning: string;
}

export class PrioritizationDto {
  @IsArray()
  prioritized: Array<{
    taskId: string;
    task: any;
    priority: string;
    reasoning: string;
    suggestedOrder: number;
    todoistPriority: number; // 1-4 (Todoist priority)
    suggestedDueDate?: string; // Natural language date to assign
    scheduledTime?: string; // Specific time slot (e.g., "2pm tomorrow")
  }>;

  recommendations: {
    startWith: string;
    defer: string[];
    delegate: string[];
    archive?: string[]; // Tasks to archive
  };
}

export class SubtaskBreakdownDto {
  @IsString()
  taskId: string;

  @IsArray()
  subtasks: Array<{
    content: string;
    order: number;
    timeEstimate: string;
    needsSupplies: boolean;
    supplies: string[];
  }>;

  @IsString()
  totalEstimate: string;

  @IsArray()
  @IsString({ each: true })
  supplyList: string[];

  @IsString()
  notes: string;
}

export class DailyPlanDto {
  @IsString()
  plan: string;

  @IsOptional()
  @IsString()
  reasoning?: string;

  @IsOptional()
  today?: {
    tasks: Array<{
      task: any;
      scheduledTime: string;
      reasoning: string;
    }>;
    totalTime: string;
  };

  @IsOptional()
  thisWeek?: {
    tasks: any[];
    reasoning: string;
  };

  @IsOptional()
  needsSupplies?: {
    tasks: any[];
    shoppingList: string[];
    suggestion: string;
  };

  @IsOptional()
  delegateToSpouse?: {
    tasks: any[];
    reasoning: string;
  };

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SupplyAnalysisDto {
  taskSupplies: Array<{
    task: any;
    supplies: string[];
    store: string;
    estimatedCost: string | null;
  }>;

  shoppingTrips: Array<{
    store: string;
    tasks: any[];
    items: string[];
  }>;

  @IsString()
  recommendations: string;
}

export class SearchResultDto {
  matches: Array<{
    task: any;
    relevanceScore: number;
    reasoning: string;
  }>;

  @IsString()
  interpretation: string;
}

export class InsightsDto {
  @IsString()
  insights: string;

  @IsArray()
  recommendations: string[];

  @IsOptional()
  patterns?: Array<{
    observation: string;
    category: string;
    significance: string;
  }>;

  @IsOptional()
  @IsString()
  summary?: string;
}


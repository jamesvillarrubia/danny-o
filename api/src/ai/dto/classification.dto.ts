/**
 * Classification DTOs
 */

import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { TimeConstraint } from '../../common/interfaces';

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

  @IsOptional()
  @IsBoolean()
  requiresDriving?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['business-hours', 'weekdays-only', 'evenings', 'weekends', 'anytime'])
  timeConstraint?: TimeConstraint;

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
  timeEstimateMinutes?: number | null;

  @IsOptional()
  @IsBoolean()
  needsBreakdown?: boolean;

  @IsString()
  size: 'XS' | 'S' | 'M' | 'L' | 'XL';

  @IsOptional()
  @IsBoolean()
  requiresDriving?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['business-hours', 'weekdays-only', 'evenings', 'weekends', 'anytime'])
  timeConstraint?: TimeConstraint;

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

/**
 * AI-generated analysis for comprehensive insights
 */
export class AIInsightsAnalysisDto {
  @IsString()
  summary: string;

  @IsArray()
  keyFindings: Array<{
    title: string;
    description: string;
    type: 'positive' | 'warning' | 'neutral';
    significance: 'high' | 'medium' | 'low';
  }>;

  @IsOptional()
  habits?: {
    good: string[];
    needsWork: string[];
  };

  @IsArray()
  recommendations: Array<{
    action: string;
    reasoning: string;
    priority: 'now' | 'soon' | 'later';
  }>;
}

/**
 * Comprehensive insights response with stats and AI analysis
 */
export class ComprehensiveInsightsDto {
  // Pre-computed statistics from the database
  stats: {
    totalActive: number;
    totalCompletedLast30Days: number;
    activeByCategory: Record<string, number>;
    completedByCategory: Record<string, number>;
    taskAgeBuckets: {
      recent: number;
      week: number;
      month: number;
      stale: number;
    };
    completionRateLast7Days: number;
    completionRateLast30Days: number;
    tasksWithEstimates: number;
    tasksWithoutEstimates: number;
    overdueTasks: number;
    dueSoon: number;
    topLabels: Array<{ label: string; count: number }>;
    stalestTasks: Array<{ id: string; content: string; ageInDays: number; category: string }>;
    // Behavioral metrics
    completionsByDayOfWeek: Record<string, number>;
    dailyCompletions: Array<{ date: string; count: number }>;
    currentStreak: number;
    longestStreak: number;
    lastCompletionDate: string | null;
    productivityScore: number;
    categoryVelocity: Record<string, { completed: number; avgDaysToComplete: number | null }>;
    procrastinationStats: {
      completedOnTime: number;
      completedLastMinute: number;
      completedLate: number;
    };
  };

  // AI-generated analysis
  aiAnalysis: AIInsightsAnalysisDto;

  // Metadata
  generatedAt: string;
  periodDays: number;
}


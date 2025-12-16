/**
 * Task Enrichment Service
 * 
 * Manages AI-generated metadata and enhancements for Todoist tasks.
 * This layer sits between the sync engine and AI operations, providing
 * a clean interface for storing and retrieving AI classifications,
 * time estimates, and other metadata.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { IStorageAdapter } from '../../common/interfaces/storage-adapter.interface';
import { ITaskProvider } from '../../common/interfaces/task-provider.interface';
import { Task, Project, TimeConstraint } from '../../common/interfaces';
import {
  TaskMetadataDto,
  EnrichmentOptionsDto,
  BatchEnrichmentDto,
  UnclassifiedTasksOptionsDto,
  EnrichmentStatsDto,
} from '../dto';
import { ReconciliationService } from './reconciliation.service';

const VALID_CATEGORIES = [
  'work',
  'home-improvement',
  'home-maintenance',
  'personal-family',
  'speaking-gig',
  'big-ideas',
  'inspiration',
  'inbox',
];

// Map common invalid categories to valid ones
const CATEGORY_MAPPINGS: Record<string, string> = {
  'networking': 'personal-family',
  'personal': 'personal-family',
  'family': 'personal-family',
  'career': 'work',
  'job': 'work',
  'professional': 'work',
  'home': 'home-maintenance',
  'house': 'home-maintenance',
  'learning': 'inspiration',
  'education': 'inspiration',
  'reading': 'inspiration',
};

const VALID_SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const VALID_ENERGY_LEVELS = ['low', 'medium', 'high'];
const VALID_TIME_CONSTRAINTS: TimeConstraint[] = ['business-hours', 'weekdays-only', 'evenings', 'weekends', 'anytime'];

// Time bucket labels for Todoist - these should exist as labels in your Todoist account
const TIME_BUCKET_LABELS = {
  15: '15-minutes',
  30: '30-minutes',
  45: '45-minutes',
  60: '1-hour',
  90: '90-minutes',
  120: '2-hours',
} as const;

const NEEDS_BREAKDOWN_LABEL = 'needs-breakdown';
const ALL_TIME_LABELS = [...Object.values(TIME_BUCKET_LABELS), NEEDS_BREAKDOWN_LABEL];

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(
    @Inject('IStorageAdapter')
    private readonly storage: IStorageAdapter,
    @Inject('ITaskProvider')
    private readonly taskProvider: ITaskProvider,
    @Inject(ReconciliationService)
    private readonly reconciler: ReconciliationService,
  ) {}

  /**
   * Enrich a task with AI-generated metadata
   */
  async enrichTask(
    taskId: string,
    metadata: TaskMetadataDto,
    options: EnrichmentOptionsDto = {},
  ): Promise<void> {
    this.logger.log(`Enriching task ${taskId} with AI metadata`);

    const now = new Date();

    // Validate and map metadata
    let validatedCategory = metadata.category;
    if (metadata.category) {
      validatedCategory = this.validateCategory(metadata.category);
      // Update metadata with the mapped category if it changed
      if (validatedCategory !== metadata.category) {
        metadata.category = validatedCategory;
      }
    }

    if (metadata.size) {
      this.validateSize(metadata.size);
    }

    if (metadata.energyLevel) {
      this.validateEnergyLevel(metadata.energyLevel);
    }

    if (metadata.timeConstraint) {
      this.validateTimeConstraint(metadata.timeConstraint);
    }

    // Save AI recommendation with timestamp (use validated category)
    if (validatedCategory) {
      await this.storage.saveFieldMetadata(taskId, 'recommended_category', validatedCategory, now);
    }

    // Handle time estimates - save metadata, sync duration, and apply time bucket label
    // Check for explicit null/undefined vs having a value
    const hasExplicitNull = metadata.timeEstimateMinutes === null || 
                           metadata.timeEstimate === 'needs-breakdown';
    const minutes = hasExplicitNull ? null : (
      metadata.timeEstimateMinutes ?? 
      (metadata.timeEstimate ? this.parseTimeEstimate(metadata.timeEstimate) : null)
    );
    
    if (minutes && minutes > 0) {
      await this.storage.saveFieldMetadata(taskId, 'time_estimate_minutes', minutes, now);
      
      // Auto-sync duration to Todoist for time blocking
      try {
        await this.taskProvider.updateTaskDuration(taskId, minutes);
        this.logger.log(`Synced duration ${minutes}min to Todoist for task ${taskId}`);
      } catch (error: any) {
        this.logger.warn(`Failed to sync duration to Todoist: ${error.message}`);
        // Don't fail enrichment if Todoist sync fails
      }
      
      // Apply time bucket label (15min, 30min, 1hr, etc. or needs-breakdown)
      await this.applyTimeBucketLabel(taskId, minutes);
    } else if (hasExplicitNull || metadata.timeEstimate) {
      // Explicitly null or needs-breakdown means task is too complex or can't be estimated
      // Apply needs-breakdown label
      this.logger.log(`Task ${taskId} marked as needs-breakdown (cannot estimate time)`);
      await this.applyTimeBucketLabel(taskId, null);
    }

    // Save to old metadata format for backward compatibility
    await this.storage.saveTaskMetadata(taskId, metadata as any);

    // Apply labels if provided
    if (metadata.labels && metadata.labels.length > 0) {
      try {
        const task = await this.storage.getTask(taskId);
        if (!task) {
          throw new Error(`Task ${taskId} not found`);
        }

        const currentLabels = task.labels || [];
        const allLabels = await this.storage.getLabels();

        // Convert new label IDs to names
        const newLabelNames = metadata.labels
          .map((labelId) => {
            const label = allLabels.find(
              (l) =>
                l.id === labelId ||
                l.name.toLowerCase().replace(/\s+/g, '-') === labelId,
            );
            return label?.name;
          })
          .filter(Boolean) as string[];

        // Merge with existing labels (dedupe)
        const mergedLabels = Array.from(new Set([...currentLabels, ...newLabelNames]));

        if (newLabelNames.length > 0) {
          await this.taskProvider.updateTask(taskId, { labels: mergedLabels });
          this.logger.log(`Applied labels: ${newLabelNames.join(', ')}`);
        }
      } catch (error: any) {
        this.logger.warn(`Failed to apply labels: ${error.message}`);
        // Don't fail the whole enrichment if labels fail
      }
    }

    // Move task to matching project in Todoist
    if (metadata.category && options.moveToProject !== false) {
      const projectId = await this.getProjectIdForCategory(metadata.category);

      if (projectId) {
        const task = await this.storage.getTask(taskId);

        if (task && task.projectId !== projectId) {
          this.logger.log(`Moving task to ${metadata.category} project in Todoist...`);

          try {
            // Use moveTask instead of updateTask - Todoist API requires dedicated endpoint for project changes
            const movedTask = await this.taskProvider.moveTask(taskId, projectId);

            // Update local storage with new project
            await this.storage.updateTask(taskId, { projectId: projectId } as any);

            // Mark recommendation as applied by AI
            await this.storage.saveFieldMetadata(taskId, 'recommendation_applied', true, now);
            await this.storage.saveFieldMetadata(taskId, 'classification_source', 'ai', now);

            // Update last synced state
            const taskSnapshot = JSON.parse(
              JSON.stringify({
                ...task,
                projectId: projectId,
                updatedAt: movedTask.updatedAt || now.toISOString(),
              }),
            );
            await this.storage.saveLastSyncedState(taskId, taskSnapshot, now);
          } catch (error: any) {
            this.logger.error(`Failed during enrichment: ${error.message}`);
            throw new Error(`Failed to move task to ${metadata.category}: ${error.message}`);
          }
        } else {
          // Task already in correct project
          await this.storage.saveFieldMetadata(taskId, 'recommendation_applied', true, now);
        }
      }
    }

    this.logger.log(`Task ${taskId} enriched successfully`);
  }

  /**
   * Parse time estimate string to minutes
   */
  private parseTimeEstimate(estimate: string | number): number | null {
    if (typeof estimate === 'number') return estimate;
    if (!estimate) return null;

    // Handle formats like "20-30min", "1-2h", "30min", etc.
    const match = estimate.match(/(\d+)(?:-(\d+))?\s*(min|h|hour|hours)?/i);
    if (!match) return null;

    const min = parseInt(match[1]);
    const max = match[2] ? parseInt(match[2]) : min;
    const unit = (match[3] || 'min').toLowerCase();

    // Convert to minutes
    const multiplier = unit.startsWith('h') ? 60 : 1;
    const avg = Math.round((min + max) / 2);

    return avg * multiplier;
  }

  /**
   * Get the appropriate time bucket label for a given duration in minutes.
   * Returns 'needs-breakdown' for tasks > 2 hours.
   */
  private getTimeBucketLabel(minutes: number): string {
    if (minutes <= 0) return NEEDS_BREAKDOWN_LABEL;
    if (minutes <= 15) return TIME_BUCKET_LABELS[15];
    if (minutes <= 30) return TIME_BUCKET_LABELS[30];
    if (minutes <= 45) return TIME_BUCKET_LABELS[45];
    if (minutes <= 60) return TIME_BUCKET_LABELS[60];
    if (minutes <= 90) return TIME_BUCKET_LABELS[90];
    if (minutes <= 120) return TIME_BUCKET_LABELS[120];
    // Tasks over 2 hours need to be broken down
    return NEEDS_BREAKDOWN_LABEL;
  }

  /**
   * Apply time bucket label to a task based on estimated minutes.
   * Removes any existing time bucket labels first to avoid conflicts.
   */
  private async applyTimeBucketLabel(taskId: string, minutes: number | null): Promise<void> {
    try {
      const task = await this.storage.getTask(taskId);
      if (!task) {
        this.logger.warn(`Task ${taskId} not found, cannot apply time label`);
        return;
      }

      const currentLabels = task.labels || [];
      
      // Remove any existing time bucket labels
      const filteredLabels = currentLabels.filter(
        (label) => !ALL_TIME_LABELS.includes(label.toLowerCase().replace(/\s+/g, '-'))
      );

      // Determine the new time label
      const newTimeLabel = minutes ? this.getTimeBucketLabel(minutes) : NEEDS_BREAKDOWN_LABEL;
      
      // Add the new time label
      const updatedLabels = [...filteredLabels, newTimeLabel];

      // Update task in Todoist
      await this.taskProvider.updateTask(taskId, { labels: updatedLabels });
      this.logger.log(`Applied time label "${newTimeLabel}" to task ${taskId} (${minutes || 'unknown'} min)`);
    } catch (error: any) {
      this.logger.warn(`Failed to apply time bucket label: ${error.message}`);
      // Don't fail enrichment if label application fails
    }
  }

  /**
   * Enrich multiple tasks in batch
   */
  async enrichTasksBatch(enrichments: BatchEnrichmentDto[]): Promise<PromiseSettledResult<void>[]> {
    this.logger.log(`Batch enriching ${enrichments.length} tasks...`);

    const results = await Promise.allSettled(
      enrichments.map(({ taskId, metadata }) => this.enrichTask(taskId, metadata)),
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    this.logger.log(`Batch complete: ${successful} success, ${failed} failed`);

    return results;
  }

  /**
   * Get enriched task (combines Todoist data + AI metadata)
   */
  async getEnrichedTask(taskId: string): Promise<Task | null> {
    return await this.storage.getTask(taskId);
  }

  /**
   * Get all enriched tasks with optional filters
   */
  async getEnrichedTasks(filters: any = {}): Promise<Task[]> {
    return await this.storage.getTasks(filters);
  }

  /**
   * Get tasks that need classification
   */
  async getUnclassifiedTasks(options: UnclassifiedTasksOptionsDto = {}): Promise<Task[]> {
    const { force = false } = options;
    this.logger.log(`Finding unclassified tasks (force=${force})...`);

    const allTasks = await this.storage.getTasks({ completed: false });

    const unclassified: Task[] = [];
    let skippedManual = 0;

    for (const task of allTasks) {
      const metadata = await this.storage.getTaskMetadata(task.id);
      const lastSyncedState = await this.storage.getLastSyncedState(task.id);

      // Skip manually classified tasks unless force=true
      if (!force && (metadata?.classificationSource === 'manual' || metadata?.classification_source === 'manual')) {
        skippedManual++;
        continue;
      }

      // Use reconciler to detect if task needs (re)classification
      const analysis = await this.reconciler.detectChanges(task, metadata, lastSyncedState);

      if (analysis.needsReclassify || force) {
        unclassified.push(task);
      }
    }

    this.logger.log(
      `Found ${unclassified.length} unclassified tasks (skipped ${skippedManual} manual)`,
    );

    return unclassified;
  }

  /**
   * Get tasks by life area category
   */
  async getTasksByCategory(category: string): Promise<Task[]> {
    const validatedCategory = this.validateCategory(category);
    return await this.storage.getTasks({ category: validatedCategory, completed: false });
  }

  /**
   * Get tasks that need supplies
   */
  async getTasksNeedingSupplies(): Promise<Task[]> {
    return await this.storage.queryTasksByMetadata({ needsSupplies: true });
  }

  /**
   * Get tasks that can be delegated
   */
  async getDelegatableTasks(): Promise<Task[]> {
    return await this.storage.queryTasksByMetadata({ canDelegate: true });
  }

  /**
   * Get tasks by size
   */
  async getTasksBySize(size: string): Promise<Task[]> {
    this.validateSize(size);
    return await this.storage.queryTasksByMetadata({ size: size as any });
  }

  /**
   * Get tasks by energy level
   */
  async getTasksByEnergyLevel(energyLevel: string): Promise<Task[]> {
    this.validateEnergyLevel(energyLevel);
    return await this.storage.queryTasksByMetadata({ energyLevel: energyLevel as any });
  }

  /**
   * Get tasks that require driving (for trip batching)
   */
  async getTasksRequiringDriving(): Promise<Task[]> {
    return await this.storage.queryTasksByMetadata({ requiresDriving: true });
  }

  /**
   * Get tasks by time constraint (for scheduling)
   */
  async getTasksByTimeConstraint(timeConstraint: TimeConstraint): Promise<Task[]> {
    this.validateTimeConstraint(timeConstraint);
    return await this.storage.queryTasksByMetadata({ timeConstraint });
  }

  /**
   * Update task category
   */
  async updateCategory(taskId: string, category: string): Promise<void> {
    const validatedCategory = this.validateCategory(category);

    const metadata = (await this.storage.getTaskMetadata(taskId)) || {};
    (metadata as any).category = validatedCategory;

    await this.storage.saveTaskMetadata(taskId, metadata);
    this.logger.log(`Updated category for task ${taskId} to ${category}`);
  }

  /**
   * Get enrichment statistics
   */
  async getEnrichmentStats(): Promise<EnrichmentStatsDto> {
    const allTasks = await this.storage.getTasks({ completed: false });

    const classified = allTasks.filter((t) => t.metadata?.category).length;
    const withTimeEstimate = allTasks.filter((t) => t.metadata?.timeEstimate || t.metadata?.timeEstimateMinutes).length;
    const withSize = allTasks.filter((t) => t.metadata?.size).length;

    // Count by category
    const byCategory: Record<string, number> = {};
    for (const task of allTasks) {
      const cat = task.metadata?.category || 'unclassified';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    return {
      total: allTasks.length,
      classified,
      unclassified: allTasks.length - classified,
      withTimeEstimate,
      withSize,
      byCategory,
    };
  }

  // ==================== Validation Helpers ====================

  private validateCategory(category: string): string {
    // Return the category if it's already valid
    if (VALID_CATEGORIES.includes(category)) {
      return category;
    }

    // Try to map to a valid category
    const mappedCategory = CATEGORY_MAPPINGS[category.toLowerCase()];
    if (mappedCategory) {
      this.logger.warn(`Mapping invalid category "${category}" → "${mappedCategory}"`);
      return mappedCategory;
    }

    // If we can't map it, throw an error
    throw new Error(
      `Invalid category: ${category}. Valid categories: ${VALID_CATEGORIES.join(', ')}`,
    );
  }

  private validateSize(size: string): void {
    if (!VALID_SIZES.includes(size)) {
      throw new Error(`Invalid size: ${size}. Valid sizes: ${VALID_SIZES.join(', ')}`);
    }
  }

  private validateEnergyLevel(energyLevel: string): void {
    if (!VALID_ENERGY_LEVELS.includes(energyLevel)) {
      throw new Error(
        `Invalid energy level: ${energyLevel}. Valid levels: ${VALID_ENERGY_LEVELS.join(', ')}`,
      );
    }
  }

  private validateTimeConstraint(timeConstraint: string): void {
    if (!VALID_TIME_CONSTRAINTS.includes(timeConstraint as TimeConstraint)) {
      throw new Error(
        `Invalid time constraint: ${timeConstraint}. Valid constraints: ${VALID_TIME_CONSTRAINTS.join(', ')}`,
      );
    }
  }

  /**
   * Get Todoist project ID for a category
   */
  private async getProjectIdForCategory(category: string): Promise<string | null> {
    // Map category names to project names
    const categoryToProjectName: Record<string, string> = {
      work: 'Work',
      'home-improvement': 'Home Improvement',
      'home-maintenance': 'Home Maintenance',
      'personal-family': 'Personal/Family',
      'speaking-gig': 'Speaking Gigs',
      'big-ideas': 'Big Ideas',
      inspiration: 'Inspiration',
      'inbox-ideas': 'Inbox',
    };

    const projectName = categoryToProjectName[category];
    if (!projectName) {
      this.logger.warn(`No project mapping for category: ${category}`);
      return null;
    }

    // Get all projects and find matching one
    const projects = await this.storage.getProjects();
    const project = projects.find((p) => p.name === projectName);

    if (!project) {
      this.logger.warn(`Project not found: ${projectName}`);
      return null;
    }

    return project.id;
  }
}


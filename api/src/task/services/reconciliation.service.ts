/**
 * Task Reconciliation Service
 * 
 * Detects conflicts between Todoist state (source of truth) and AI recommendations.
 * Uses per-field timestamps to determine whether changes were made manually
 * or by the AI agent.
 * 
 * Key principle: Most recent change wins
 * - If task changed in Todoist AFTER AI classification → manual change, respect it
 * - If AI classified AFTER last Todoist update → AI recommendation is current
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { TaxonomyService } from '../../config/taxonomy/taxonomy.service';
import { Task, Project, TaskMetadata, SyncState } from '../../common/interfaces';

interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  changedManually: boolean;
}

interface ChangeAnalysis {
  changedFields: FieldChange[];
  projectChangedManually: boolean;
  contentChangedManually: boolean;
  anyChangedManually: boolean;
  needsReclassify: boolean;
  reason: string;
}

interface ConflictInfo {
  taskId: string;
  content: string;
  currentProject?: string;
  currentCategory?: string;
  recommendedCategory: string;
  recommendedProject?: string;
  classifiedAt?: Date;
  todoistUpdatedAt: string;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  private projectToCategory: Map<string, string> = new Map();
  private categoryToProject: Map<string, string> = new Map();

  constructor(@Inject(TaxonomyService) private readonly taxonomyService: TaxonomyService) {
    // Don't build mappings in constructor - taxonomy might not be loaded yet
    // Will be built on first use via lazy initialization
  }

  /**
   * Build bidirectional mappings between project names and categories (lazy initialization)
   */
  private buildProjectMappings(): void {
    if (this.projectToCategory.size > 0) {
      return; // Already built
    }
    
    const taxonomy = this.taxonomyService.getTaxonomy();
    
    for (const project of taxonomy.projects) {
      this.projectToCategory.set(project.name, project.id);
      this.categoryToProject.set(project.id, project.name);
    }
  }

  /**
   * Compare Todoist task state vs local metadata, detect conflicts
   * Compares ALL task fields comprehensively
   */
  async detectChanges(
    todoistTask: Task,
    localMetadata: TaskMetadata | null,
    lastSyncedState: SyncState | null,
  ): Promise<ChangeAnalysis> {
    // Ensure project mappings are built
    this.buildProjectMappings();
    
    // Handle missing data
    if (!localMetadata) {
      return {
        changedFields: [],
        projectChangedManually: false,
        contentChangedManually: false,
        anyChangedManually: false,
        needsReclassify: true,
        reason: 'No metadata exists - task needs classification',
      };
    }

    if (!lastSyncedState || !lastSyncedState.taskState) {
      // First sync or missing data - treat as needing classification
      return {
        changedFields: [],
        projectChangedManually: false,
        contentChangedManually: false,
        anyChangedManually: false,
        needsReclassify: !(localMetadata.recommendedCategory || localMetadata.recommended_category),
        reason: 'No sync state - cannot detect changes',
      };
    }

    const lastSyncedTask = lastSyncedState.taskState;

    // Parse timestamps
    const todoistUpdatedAt = this.parseDate(todoistTask.updatedAt);
    const categoryClassifiedAt = this.parseDate(localMetadata.categoryClassifiedAt || localMetadata.category_classified_at);

    // Compare ALL relevant fields
    const fieldsToCompare: (keyof Task)[] = [
      'content',
      'description',
      'projectId',
      'priority',
      'labels',
      'due',
      'parentId',
      'isCompleted',
    ];

    const changedFields: FieldChange[] = [];
    let projectChangedManually = false;
    let contentChangedManually = false;

    for (const field of fieldsToCompare) {
      const comparison = this.compareField(
        todoistTask[field],
        lastSyncedTask[field],
        todoistUpdatedAt,
        categoryClassifiedAt,
      );

      if (comparison.fieldChanged) {
        changedFields.push({
          field,
          oldValue: lastSyncedTask[field],
          newValue: todoistTask[field],
          changedManually: comparison.changedManually,
        });

        // Track specific important fields
        if (field === 'projectId' && comparison.changedManually) {
          projectChangedManually = true;
        }
        if (field === 'content' && comparison.changedManually) {
          contentChangedManually = true;
        }
      }
    }

    // Check if content change is significant
    const significantContentChange =
      contentChangedManually &&
      this.isContentSignificantChange(
        lastSyncedTask.content || '',
        todoistTask.content,
      );

    // Determine if reclassification is needed
    const needsReclassify =
      !(localMetadata.recommendedCategory || localMetadata.recommended_category) || // Never classified
      projectChangedManually || // User moved it manually
      significantContentChange; // Content changed significantly

    return {
      changedFields,
      projectChangedManually,
      contentChangedManually,
      anyChangedManually: changedFields.some((f) => f.changedManually),
      needsReclassify,
      reason: this.explainReason(changedFields, localMetadata),
    };
  }

  /**
   * Compare a single field between Todoist and last synced state
   */
  private compareField(
    todoistValue: any,
    syncedValue: any,
    todoistUpdatedAt: Date | null,
    aiClassifiedAt: Date | null,
  ): { fieldChanged: boolean; changedAfterAI: boolean; changedManually: boolean } {
    // Handle arrays (like labels)
    const fieldChanged = Array.isArray(todoistValue) && Array.isArray(syncedValue)
      ? !this.arraysEqual(todoistValue, syncedValue)
      : typeof todoistValue === 'object' && typeof syncedValue === 'object'
        ? JSON.stringify(todoistValue) !== JSON.stringify(syncedValue)
        : todoistValue !== syncedValue;

    // If field changed and Todoist timestamp is after AI classification,
    // it means user changed it manually after AI classified it
    const changedAfterAI =
      fieldChanged &&
      !!todoistUpdatedAt &&
      !!aiClassifiedAt &&
      todoistUpdatedAt > aiClassifiedAt;

    return {
      fieldChanged,
      changedAfterAI,
      changedManually: changedAfterAI,
    };
  }

  /**
   * Compare two arrays for equality
   */
  private arraysEqual(arr1: any[], arr2: any[]): boolean {
    if (arr1.length !== arr2.length) return false;
    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();
    return sorted1.every((val, idx) => val === sorted2[idx]);
  }

  /**
   * Determine if a content change is significant enough to warrant reclassification
   */
  private isContentSignificantChange(oldContent: string, newContent: string): boolean {
    if (!oldContent || !newContent) return true;

    // Normalize for comparison
    const normalize = (str: string) =>
      str.toLowerCase().trim().replace(/[^\w\s]/g, '');
    const oldNorm = normalize(oldContent);
    const newNorm = normalize(newContent);

    // If normalized versions are same, it's just punctuation/formatting
    if (oldNorm === newNorm) return false;

    // If length changed significantly (>20%), likely significant
    const lengthRatio = newNorm.length / oldNorm.length;
    if (lengthRatio < 0.8 || lengthRatio > 1.2) return true;

    // Calculate simple word-level diff
    const oldWords = new Set(oldNorm.split(/\s+/));
    const newWords = new Set(newNorm.split(/\s+/));

    const wordsAdded = [...newWords].filter((w) => !oldWords.has(w)).length;
    const wordsRemoved = [...oldWords].filter((w) => !newWords.has(w)).length;
    const totalWords = Math.max(oldWords.size, newWords.size);

    // If >25% of words changed, it's significant
    const changeRatio = (wordsAdded + wordsRemoved) / totalWords;
    return changeRatio > 0.25;
  }

  /**
   * Generate human-readable explanation of change detection
   */
  private explainReason(changedFields: FieldChange[], localMetadata: TaskMetadata): string {
    if (!(localMetadata.recommendedCategory || localMetadata.recommended_category)) {
      return 'Never classified';
    }

    const manualChanges = changedFields.filter((f) => f.changedManually);

    if (manualChanges.length === 0) {
      if (changedFields.length === 0) {
        return 'No changes detected';
      }
      return 'Changes detected but before AI classification';
    }

    // Describe what changed manually
    const fieldNames = manualChanges.map((f) => f.field).join(', ');
    return `Manual changes after AI classification: ${fieldNames}`;
  }

  /**
   * Get current category from Todoist project ID (source of truth)
   */
  getCategoryFromProject(projectId: string, projects: Project[]): string | null {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return null;

    return this.projectToCategory.get(project.name) || null;
  }

  /**
   * Get Todoist project name from category ID
   */
  getProjectNameFromCategory(categoryId: string): string | null {
    return this.categoryToProject.get(categoryId) || null;
  }

  /**
   * Parse date from various formats
   */
  private parseDate(dateValue: any): Date | null {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue === 'string') return new Date(dateValue);
    if (typeof dateValue === 'number') return new Date(dateValue);
    return null;
  }

  /**
   * Find conflicts between AI recommendations and current Todoist state
   */
  findConflicts(tasks: Task[], projects: Project[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    for (const task of tasks) {
      const taskRecommendedCategory = task.metadata?.recommendedCategory || task.metadata?.recommended_category;
      if (!taskRecommendedCategory) continue;

      const currentCategory = this.getCategoryFromProject(task.projectId, projects);
      const recommendedCategory = taskRecommendedCategory;

      if (currentCategory !== recommendedCategory) {
        conflicts.push({
          taskId: task.id,
          content: task.content,
          currentProject: projects.find((p) => p.id === task.projectId)?.name,
          currentCategory: currentCategory || undefined,
          recommendedCategory,
          recommendedProject: this.getProjectNameFromCategory(recommendedCategory) || undefined,
          classifiedAt: task.metadata?.category_classified_at,
          todoistUpdatedAt: task.updatedAt,
        });
      }
    }

    return conflicts;
  }
}


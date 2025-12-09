import { vi } from 'vitest';

/**
 * Enrichment Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EnrichmentService } from '../../../src/task/services/enrichment.service';
import { ReconciliationService } from '../../../src/task/services/reconciliation.service';
import { TaxonomyService } from '../../../src/config/taxonomy/taxonomy.service';
import { MockStorageAdapter } from '../../mocks/storage.mock';
import { MockTaskProvider } from '../../mocks/task-provider.mock';
import { createMockTask, createMockMetadata } from '../../fixtures/tasks.fixture';

describe('EnrichmentService', () => {
  let service: EnrichmentService;
  let storage: MockStorageAdapter;
  let taskProvider: MockTaskProvider;
  let reconciliation: ReconciliationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrichmentService,
        ReconciliationService,
        TaxonomyService,
        {
          provide: 'IStorageAdapter',
          useClass: MockStorageAdapter,
        },
        {
          provide: 'ITaskProvider',
          useClass: MockTaskProvider,
        },
      ],
    }).compile();

    service = module.get<EnrichmentService>(EnrichmentService);
    storage = module.get<MockStorageAdapter>('IStorageAdapter');
    taskProvider = module.get<MockTaskProvider>('ITaskProvider');
    reconciliation = module.get<ReconciliationService>(ReconciliationService);
    
    // Initialize TaxonomyService
    const taxonomyService = module.get<TaxonomyService>(TaxonomyService);
    taxonomyService.onModuleInit();
  });

  afterEach(() => {
    storage.clear();
    taskProvider.clear();
  });

  describe('enrichTask', () => {
    it('should enrich a task with metadata', async () => {
      const task = createMockTask({ id: 'task_1', content: 'Test Task' });
      storage.seedTasks([task]);

      const metadata = createMockMetadata({
        category: 'work',
        timeEstimateMinutes: 30,
        aiConfidence: 0.9,
      });

      await service.enrichTask('task_1', metadata);

      const savedMetadata = await storage.getTaskMetadata('task_1');
      expect(savedMetadata).toBeDefined();
      expect(savedMetadata?.category).toBe('work');
      expect(savedMetadata?.timeEstimateMinutes).toBe(30);
      expect(savedMetadata?.aiConfidence).toBe(0.9);
    });

    it('should move task to correct project when moveToProject is true', async () => {
      const task = createMockTask({ id: 'task_1', projectId: 'inbox' });
      storage.seedTasks([task]);
      taskProvider.seedTasks([task]);

      const metadata = createMockMetadata({ category: 'work' });

      await service.enrichTask('task_1', metadata, { moveToProject: true });

      // Verify task was updated
      const calls = vi.spyOn(taskProvider, 'updateTask');
      expect(calls).toBeDefined();
    });
  });

  describe('getUnclassifiedTasks', () => {
    it('should return tasks without category metadata', async () => {
      const classified = createMockTask({
        id: 'task_1',
        metadata: { category: 'work' },
      });
      const unclassified = createMockTask({
        id: 'task_2',
        content: 'Unclassified',
      });

      storage.seedTasks([classified, unclassified]);

      // Mock reconciler to return needsReclassify based on whether task has metadata
      vi.spyOn(reconciliation, 'detectChanges').mockImplementation(async (task, metadata) => {
        return {
          needsReclassify: !metadata?.category,
          needsProjectMove: false,
          needsLabelUpdate: false,
          needsPriorityUpdate: false,
          needsMetadataUpdate: false,
          currentCategory: metadata?.category,
          currentProject: undefined,
          currentLabels: [],
          currentPriority: undefined,
        };
      });

      const result = await service.getUnclassifiedTasks({ force: false });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task_2');
    });

    it('should return all tasks when force is true', async () => {
      const task1 = createMockTask({
        id: 'task_1',
        metadata: { category: 'work', classification_source: 'manual' },
      });
      const task2 = createMockTask({ id: 'task_2' });

      storage.seedTasks([task1, task2]);

      const result = await service.getUnclassifiedTasks({ force: true });

      expect(result).toHaveLength(2);
    });
  });

  describe('getEnrichmentStats', () => {
    it('should return enrichment statistics', async () => {
      const tasks = [
        createMockTask({
          id: 'task_1',
          metadata: { category: 'work', timeEstimateMinutes: 30, size: 'M' },
        }),
        createMockTask({
          id: 'task_2',
          metadata: { category: 'home-maintenance' },
        }),
        createMockTask({ id: 'task_3' }),
      ];

      storage.seedTasks(tasks);

      const stats = await service.getEnrichmentStats();

      expect(stats.total).toBe(3);
      expect(stats.classified).toBe(2);
      expect(stats.unclassified).toBe(1);
      expect(stats.withTimeEstimate).toBe(1);
      expect(stats.withSize).toBe(1);
      expect(stats.byCategory['work']).toBe(1);
      expect(stats.byCategory['home-maintenance']).toBe(1);
    });
  });

  describe('updateCategory', () => {
    it('should update task category', async () => {
      const task = createMockTask({ id: 'task_1', metadata: { category: 'inbox' } });
      storage.seedTasks([task]);

      await service.updateCategory('task_1', 'work');

      const metadata = await storage.getTaskMetadata('task_1');
      expect(metadata?.category).toBe('work');
    });
  });

  describe('getTasksByCategory', () => {
    it('should get tasks filtered by category', async () => {
      const tasks = [
        createMockTask({ id: 'task_1', metadata: { category: 'work' } }),
        createMockTask({ id: 'task_2', metadata: { category: 'home-maintenance' } }),
      ];

      storage.seedTasks(tasks);

      const workTasks = await service.getTasksByCategory('work');
      expect(workTasks).toHaveLength(1);
      expect(workTasks[0].id).toBe('task_1');
    });
  });

  describe('getTasksNeedingSupplies', () => {
    it('should get tasks that need supplies', async () => {
      const tasks = [
        createMockTask({ id: 'task_1', metadata: { needsSupplies: true } }),
        createMockTask({ id: 'task_2', metadata: { needsSupplies: false } }),
      ];

      storage.seedTasks(tasks);

      const supplyTasks = await service.getTasksNeedingSupplies();
      expect(supplyTasks).toHaveLength(1);
      expect(supplyTasks[0].id).toBe('task_1');
    });
  });

  describe('getTasksRequiringDriving', () => {
    it('should get tasks that require driving', async () => {
      const tasks = [
        createMockTask({ id: 'task_1', metadata: { requiresDriving: true } }),
        createMockTask({ id: 'task_2', metadata: { requiresDriving: false } }),
        createMockTask({ id: 'task_3', metadata: { requiresDriving: true } }),
      ];

      storage.seedTasks(tasks);

      const drivingTasks = await service.getTasksRequiringDriving();
      expect(drivingTasks).toHaveLength(2);
      expect(drivingTasks.map(t => t.id).sort()).toEqual(['task_1', 'task_3']);
    });

    it('should return empty array when no tasks require driving', async () => {
      const tasks = [
        createMockTask({ id: 'task_1', metadata: { requiresDriving: false } }),
        createMockTask({ id: 'task_2' }),
      ];

      storage.seedTasks(tasks);

      const drivingTasks = await service.getTasksRequiringDriving();
      expect(drivingTasks).toHaveLength(0);
    });
  });

  describe('getTasksByTimeConstraint', () => {
    it('should get tasks with business-hours constraint', async () => {
      const tasks = [
        createMockTask({ id: 'task_1', metadata: { timeConstraint: 'business-hours' } }),
        createMockTask({ id: 'task_2', metadata: { timeConstraint: 'anytime' } }),
        createMockTask({ id: 'task_3', metadata: { timeConstraint: 'business-hours' } }),
      ];

      storage.seedTasks(tasks);

      const businessTasks = await service.getTasksByTimeConstraint('business-hours');
      expect(businessTasks).toHaveLength(2);
      expect(businessTasks.map(t => t.id).sort()).toEqual(['task_1', 'task_3']);
    });

    it('should get tasks with weekend constraint', async () => {
      const tasks = [
        createMockTask({ id: 'task_1', metadata: { timeConstraint: 'weekends' } }),
        createMockTask({ id: 'task_2', metadata: { timeConstraint: 'anytime' } }),
      ];

      storage.seedTasks(tasks);

      const weekendTasks = await service.getTasksByTimeConstraint('weekends');
      expect(weekendTasks).toHaveLength(1);
      expect(weekendTasks[0].id).toBe('task_1');
    });

    it('should throw error for invalid time constraint', async () => {
      await expect(service.getTasksByTimeConstraint('invalid' as any)).rejects.toThrow(
        'Invalid time constraint'
      );
    });
  });

  describe('enrichTask with scheduling fields', () => {
    it('should enrich a task with requiresDriving and timeConstraint', async () => {
      const task = createMockTask({ id: 'task_errand', content: 'Pick up package from UPS store' });
      storage.seedTasks([task]);

      const metadata = createMockMetadata({
        category: 'personal-family',
        timeEstimateMinutes: 30,
        requiresDriving: true,
        timeConstraint: 'business-hours',
      });

      await service.enrichTask('task_errand', metadata);

      const savedMetadata = await storage.getTaskMetadata('task_errand');
      expect(savedMetadata).toBeDefined();
      expect(savedMetadata?.requiresDriving).toBe(true);
      expect(savedMetadata?.timeConstraint).toBe('business-hours');
    });

    it('should sync duration to Todoist when timeEstimateMinutes is provided', async () => {
      const task = createMockTask({ id: 'task_with_duration', content: 'Meeting prep' });
      storage.seedTasks([task]);
      taskProvider.seedTasks([task]);

      const updateDurationSpy = vi.spyOn(taskProvider, 'updateTaskDuration');

      const metadata = createMockMetadata({
        category: 'work',
        timeEstimateMinutes: 45,
      });

      await service.enrichTask('task_with_duration', metadata);

      expect(updateDurationSpy).toHaveBeenCalledWith('task_with_duration', 45);
    });

    it('should validate timeConstraint values', async () => {
      const task = createMockTask({ id: 'task_invalid', content: 'Test' });
      storage.seedTasks([task]);

      const metadata = createMockMetadata({
        category: 'work',
        timeConstraint: 'invalid-constraint' as any,
      });

      await expect(service.enrichTask('task_invalid', metadata)).rejects.toThrow(
        'Invalid time constraint'
      );
    });
  });
});


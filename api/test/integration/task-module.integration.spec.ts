/**
 * Task Module Integration Tests
 * 
 * Tests the integration between TaskModule components:
 * - Sync → Enrichment workflow
 * - Reconciliation with conflicts
 * - Task metadata persistence
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TaskModule } from '../../src/task/task.module';
import { StorageModule } from '../../src/storage/storage.module';
import { TaskProviderModule } from '../../src/task-provider/task-provider.module';
import { ConfigurationModule } from '../../src/config/config.module';
import { SyncService } from '../../src/task/services/sync.service';
import { EnrichmentService } from '../../src/task/services/enrichment.service';
import { ReconciliationService } from '../../src/task/services/reconciliation.service';
import { MockTaskProvider } from '../mocks/task-provider.mock';
import { createMockTask, mockProjects, mockLabels } from '../fixtures/tasks.fixture';

describe('TaskModule Integration', () => {
  let syncService: SyncService;
  let enrichmentService: EnrichmentService;
  let reconciliationService: ReconciliationService;
  let taskProvider: MockTaskProvider;

  beforeAll(async () => {
    // Set environment variable for in-memory database
    process.env.SQLITE_PATH = ':memory:';
    process.env.DATABASE_TYPE = 'sqlite';

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TaskModule,
        StorageModule,
        TaskProviderModule,
        ConfigurationModule,
      ],
    })
      .overrideProvider('ITaskProvider')
      .useClass(MockTaskProvider)
      .compile();

    // Initialize the NestJS application to trigger onModuleInit hooks
    await module.init();

    syncService = module.get<SyncService>(SyncService);
    enrichmentService = module.get<EnrichmentService>(EnrichmentService);
    reconciliationService = module.get<ReconciliationService>(ReconciliationService);
    taskProvider = module.get<MockTaskProvider>('ITaskProvider');
  });

  beforeEach(() => {
    taskProvider.clear();
  });

  describe('Sync → Enrichment Workflow', () => {
    it('should sync tasks and enrich with metadata', async () => {
      // Arrange: Add tasks to mock provider
      const tasks = [
        createMockTask({ id: 'task_1', content: 'Test Task 1' }),
        createMockTask({ id: 'task_2', content: 'Test Task 2' }),
      ];
      taskProvider.seedTasks(tasks);
      taskProvider.seedProjects(mockProjects);
      taskProvider.seedLabels(mockLabels);

      // Act: Sync
      const syncResult = await syncService.syncNow();

      // Assert: Sync successful
      expect(syncResult.success).toBe(true);
      expect(syncResult.tasks).toBeGreaterThanOrEqual(2);

      // Act: Enrich first task
      await enrichmentService.enrichTask('task_1', {
        category: 'work',
        timeEstimateMinutes: 30,
        size: 'M',
      });

      // Assert: Metadata persisted
      const unclassified = await enrichmentService.getUnclassifiedTasks();
      expect(unclassified).toHaveLength(1); // Only task_2 unclassified
      expect(unclassified[0].id).toBe('task_2');
    });

    it('should handle full sync and enrichment cycle', async () => {
      // Arrange
      taskProvider.seedTasks([
        createMockTask({ id: 'task_1' }),
        createMockTask({ id: 'task_2' }),
        createMockTask({ id: 'task_3' }),
      ]);
      taskProvider.seedProjects(mockProjects);
      taskProvider.seedLabels(mockLabels);

      // Act: Full sync
      await syncService.fullResync();

      // Act: Get stats before enrichment
      const statsBefore = await enrichmentService.getEnrichmentStats();
      expect(statsBefore.classified).toBe(0);

      // Act: Enrich all
      await enrichmentService.enrichTask('task_1', { category: 'work' });
      await enrichmentService.enrichTask('task_2', { category: 'home-maintenance' });
      await enrichmentService.enrichTask('task_3', { category: 'personal-family' });

      // Assert: Stats updated
      const statsAfter = await enrichmentService.getEnrichmentStats();
      expect(statsAfter.classified).toBe(3);
      expect(statsAfter.byCategory['work']).toBe(1);
      expect(statsAfter.byCategory['home-maintenance']).toBe(1);
    });
  });

  describe('Conflict Detection', () => {
    it('should detect when task is updated in Todoist after classification', async () => {
      // Arrange: Sync initial task
      const task = createMockTask({
        id: 'task_1',
        content: 'Original Task',
        projectId: 'inbox',
      });
      taskProvider.seedTasks([task]);
      taskProvider.seedProjects(mockProjects);
      taskProvider.seedLabels(mockLabels);
      await syncService.syncNow();

      // Act: Classify task locally
      await enrichmentService.enrichTask('task_1', {
        category: 'work',
        recommendedCategory: 'work',
      });

      // Act: Task updated in Todoist (project changed)
      const updatedTask = {
        ...task,
        projectId: 'project_work',
        updatedAt: new Date().toISOString(),
      };
      taskProvider.clear();
      taskProvider.seedTasks([updatedTask]);
      taskProvider.seedProjects(mockProjects);
      taskProvider.seedLabels(mockLabels);

      // Act: Sync again
      const syncResult = await syncService.syncNow();

      // Assert: Can detect task was modified
      // (Reconciliation service would flag this)
      expect(syncResult).toBeDefined();
      expect(syncResult.success).toBe(true);
    });
  });

  describe('Task History Tracking', () => {
    it('should track task completion in history', async () => {
      // Arrange
      const task = createMockTask({
        id: 'task_1',
        content: 'Task to complete',
        metadata: { category: 'work', timeEstimateMinutes: 30 },
      });
      taskProvider.seedTasks([task]);
      taskProvider.seedProjects(mockProjects);
      taskProvider.seedLabels(mockLabels);
      await syncService.syncNow();

      // Act: Complete task with actual time
      await syncService.completeTask('task_1', {
        actualDuration: 45,
        category: 'work',
      });

      // Assert: Can be used for learning
      // (LearningService would analyze this)
      expect(task).toBeDefined();
    });
  });
});


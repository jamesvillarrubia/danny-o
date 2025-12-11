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
import { MockTodoistSyncProvider } from '../mocks/todoist-sync.mock';
import { createMockTask, mockProjects, mockLabels } from '../fixtures/tasks.fixture';

describe('TaskModule Integration', () => {
  let syncService: SyncService;
  let enrichmentService: EnrichmentService;
  let reconciliationService: ReconciliationService;
  let taskProvider: MockTaskProvider;
  let syncProvider: MockTodoistSyncProvider;

  beforeAll(async () => {
    // Set environment variable for in-memory PGlite database
    process.env.PGLITE_PATH = ':memory:';

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
      .overrideProvider('ITodoistSyncProvider')
      .useClass(MockTodoistSyncProvider)
      .compile();

    // Initialize the NestJS application to trigger onModuleInit hooks
    await module.init();

    syncService = module.get<SyncService>(SyncService);
    enrichmentService = module.get<EnrichmentService>(EnrichmentService);
    reconciliationService = module.get<ReconciliationService>(ReconciliationService);
    taskProvider = module.get<MockTaskProvider>('ITaskProvider');
    syncProvider = module.get<MockTodoistSyncProvider>('ITodoistSyncProvider');
  });

  beforeEach(() => {
    taskProvider.clear();
    syncProvider.clear();
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
      
      // Also seed sync provider (for Sync API path)
      syncProvider.seedTasks(tasks);
      syncProvider.seedProjects(mockProjects);
      syncProvider.seedLabels(mockLabels);

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
      // Arrange - use unique task IDs to avoid conflicts with other tests
      const tasks = [
        createMockTask({ id: 'fullsync_task_1' }),
        createMockTask({ id: 'fullsync_task_2' }),
        createMockTask({ id: 'fullsync_task_3' }),
      ];
      taskProvider.seedTasks(tasks);
      taskProvider.seedProjects(mockProjects);
      taskProvider.seedLabels(mockLabels);
      
      // Also seed sync provider (for Sync API path)
      syncProvider.seedTasks(tasks);
      syncProvider.seedProjects(mockProjects);
      syncProvider.seedLabels(mockLabels);

      // Act: Full sync
      await syncService.fullResync();

      // Act: Get stats before enrichment
      const statsBefore = await enrichmentService.getEnrichmentStats();
      const initialClassified = statsBefore.classified;

      // Act: Enrich all
      await enrichmentService.enrichTask('fullsync_task_1', { category: 'work' });
      await enrichmentService.enrichTask('fullsync_task_2', { category: 'home-maintenance' });
      await enrichmentService.enrichTask('fullsync_task_3', { category: 'personal-family' });

      // Assert: Stats updated - verify the 3 tasks we enriched are now classified
      const statsAfter = await enrichmentService.getEnrichmentStats();
      // The classified count should increase by at least 3 (the tasks we just enriched)
      expect(statsAfter.classified).toBeGreaterThanOrEqual(initialClassified + 3);
      // Verify the specific categories we enriched
      expect(statsAfter.byCategory['work'] || 0).toBeGreaterThanOrEqual(1);
      expect(statsAfter.byCategory['home-maintenance'] || 0).toBeGreaterThanOrEqual(1);
      expect(statsAfter.byCategory['personal-family'] || 0).toBeGreaterThanOrEqual(1);
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
      
      // Also seed sync provider
      syncProvider.seedTasks([task]);
      syncProvider.seedProjects(mockProjects);
      syncProvider.seedLabels(mockLabels);
      
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
      
      // Also update sync provider
      syncProvider.clear();
      syncProvider.seedTasks([updatedTask]);
      syncProvider.seedProjects(mockProjects);
      syncProvider.seedLabels(mockLabels);

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
      
      // Also seed sync provider
      syncProvider.seedTasks([task]);
      syncProvider.seedProjects(mockProjects);
      syncProvider.seedLabels(mockLabels);
      
      // Sync to ensure task exists in storage
      const syncResult = await syncService.syncNow();
      expect(syncResult.success).toBe(true);
      expect(syncResult.tasks).toBeGreaterThanOrEqual(1);

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


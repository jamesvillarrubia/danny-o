/**
 * CLI End-to-End Tests
 * 
 * Tests complete CLI workflows as a user would experience them:
 * - sync → list → classify → complete
 * - Daily plan generation
 * - Task creation and management
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CommandFactory } from 'nest-commander';
import { AppModule } from '../../src/app.module';
import { IStorageAdapter } from '../../src/common/interfaces';
import { MockTaskProvider } from '../mocks/task-provider.mock';
import { createMockTask, mockProjects, mockLabels } from '../fixtures/tasks.fixture';

describe('CLI E2E', () => {
  let app: TestingModule;
  let storage: IStorageAdapter;
  let taskProvider: MockTaskProvider;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('ITaskProvider')
      .useClass(MockTaskProvider)
      .compile();

    storage = app.get<IStorageAdapter>('IStorageAdapter');
    taskProvider = app.get<MockTaskProvider>('ITaskProvider');
  });

  beforeEach(() => {
    taskProvider.clear();
  });

  describe('Sync Workflow', () => {
    it('should sync tasks from Todoist', async () => {
      // Arrange
      taskProvider.seedTasks([
        createMockTask({ id: 'task_1', content: 'Task 1' }),
        createMockTask({ id: 'task_2', content: 'Task 2' }),
      ]);
      taskProvider.seedProjects(mockProjects);
      taskProvider.seedLabels(mockLabels);

      // Act: Run sync command
      // In real E2E, this would use CommandFactory.run()
      // For now, we test the service directly
      const syncService = app.get('SyncService');
      const result = await syncService.syncNow();

      // Assert
      expect(result.success).toBe(true);
      expect(result.tasks).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Complete Task Workflow', () => {
    it('should sync, classify, and complete a task', async () => {
      // Arrange
      const task = createMockTask({
        id: 'task_1',
        content: 'Complete this task',
      });
      taskProvider.seedTasks([task]);
      taskProvider.seedProjects(mockProjects);
      taskProvider.seedLabels(mockLabels);

      // Act: Sync
      const syncService = app.get('SyncService');
      await syncService.syncNow();

      // Act: Classify (via enrichment)
      const enrichmentService = app.get('EnrichmentService');
      await enrichmentService.enrichTask('task_1', {
        category: 'work',
        timeEstimateMinutes: 30,
      });

      // Act: Complete
      await syncService.completeTask('task_1', {
        actualDuration: 45,
      });

      // Assert: Task in history
      const history = await storage.getTaskHistory({ limit: 10 });
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].taskId).toBe('task_1');
      expect(history[0].actualDuration).toBe(45);
    });
  });

  describe('Daily Plan Workflow', () => {
    it('should generate a daily plan from available tasks', async () => {
      // Arrange
      taskProvider.seedTasks([
        createMockTask({ id: 'task_1', content: 'Morning task', priority: 4 }),
        createMockTask({ id: 'task_2', content: 'Afternoon task', priority: 2 }),
        createMockTask({ id: 'task_3', content: 'Evening task', priority: 1 }),
      ]);
      taskProvider.seedProjects(mockProjects);
      taskProvider.seedLabels(mockLabels);

      // Act: Sync
      const syncService = app.get('SyncService');
      await syncService.syncNow();

      // Act: Generate plan (would be via CLI command)
      const aiOps = app.get('AIOperationsService');
      const tasks = await storage.getTasks({ completed: false });
      const plan = await aiOps.suggestDailyPlan(tasks);

      // Assert
      expect(plan).toBeDefined();
      expect(plan.plan).toBeDefined();
    });
  });

  afterAll(async () => {
    await app.close();
  });
});


/**
import { vi } from 'vitest';
 * Sync Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SyncService } from '../../../src/task/services/sync.service';
import { ReconciliationService } from '../../../src/task/services/reconciliation.service';
import { TaxonomyService } from '../../../src/config/taxonomy/taxonomy.service';
import { MockStorageAdapter } from '../../mocks/storage.mock';
import { MockTaskProvider } from '../../mocks/task-provider.mock';
import { createMockTask, mockProjects, mockLabels } from '../../fixtures/tasks.fixture';

describe('SyncService', () => {
  let service: SyncService;
  let storage: MockStorageAdapter;
  let taskProvider: MockTaskProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        ReconciliationService,
        TaxonomyService,
        {
          provide: 'ITaskProvider',
          useClass: MockTaskProvider,
        },
        {
          provide: 'IStorageAdapter',
          useClass: MockStorageAdapter,
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              if (key === 'SYNC_INTERVAL') return 300000;
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
    storage = module.get<MockStorageAdapter>('IStorageAdapter');
    taskProvider = module.get<MockTaskProvider>('ITaskProvider');
    
    // Initialize TaxonomyService
    const taxonomyService = module.get<TaxonomyService>(TaxonomyService);
    taxonomyService.onModuleInit();
  });

  afterEach(() => {
    storage.clear();
    taskProvider.clear();
  });

  describe('syncNow', () => {
    it('should sync tasks from Todoist to storage', async () => {
      const todoistTasks = [
        createMockTask({ id: 'task_1', content: 'Task from Todoist' }),
        createMockTask({ id: 'task_2', content: 'Another task' }),
      ];

      taskProvider.seedTasks(todoistTasks);
      taskProvider.seedProjects(mockProjects);
      taskProvider.seedLabels(mockLabels);

      const result = await service.syncNow();

      expect(result.success).toBe(true);
      expect(result.tasks).toBeGreaterThanOrEqual(2);
      expect(result.projects).toBeGreaterThanOrEqual(mockProjects.length);
      expect(result.labels).toBeGreaterThanOrEqual(mockLabels.length);

      const storedTasks = await storage.getTasks();
      expect(storedTasks).toHaveLength(2);
    });

    it('should detect new tasks', async () => {
      // First sync
      const initialTasks = [createMockTask({ id: 'task_1' })];
      taskProvider.seedTasks(initialTasks);
      taskProvider.seedProjects(mockProjects);
      taskProvider.seedLabels(mockLabels);

      await service.syncNow();

      // Second sync with new task
      const newTask = createMockTask({ id: 'task_2', content: 'New Task' });
      taskProvider.seedTasks([...initialTasks, newTask]);

      const result = await service.syncNow();

      expect(result.success).toBe(true);
      expect(result.newTasks).toBe(1);
    });

    it('should update last sync time', async () => {
      taskProvider.seedProjects(mockProjects);
      taskProvider.seedLabels(mockLabels);

      const beforeSync = await storage.getLastSyncTime();
      expect(beforeSync).toBeNull();

      await service.syncNow();

      const afterSync = await storage.getLastSyncTime();
      expect(afterSync).toBeDefined();
      expect(afterSync).toBeInstanceOf(Date);
    });
  });

  describe('completeTask', () => {
    it('should complete a task and save to history', async () => {
      const task = createMockTask({
        id: 'task_1',
        content: 'Task to complete',
        metadata: { category: 'work' },
      });

      storage.seedTasks([task]);
      taskProvider.seedTasks([task]);

      await service.completeTask('task_1', { actualDuration: 30 });

      const history = await storage.getTaskHistory();
      expect(history).toHaveLength(1);
      expect(history[0].taskId).toBe('task_1');
      expect(history[0].actualDuration).toBe(30);
      expect(history[0].category).toBe('work');
    });

    it('should handle completion without metadata', async () => {
      const task = createMockTask({ id: 'task_1' });
      storage.seedTasks([task]);
      taskProvider.seedTasks([task]);

      await service.completeTask('task_1');

      const history = await storage.getTaskHistory();
      expect(history).toHaveLength(1);
      expect(history[0].taskId).toBe('task_1');
    });
  });

  describe('createTask', () => {
    it('should create a new task in Todoist and storage', async () => {
      const input = {
        content: 'New task',
        description: 'Task description',
        priority: 3,
      };

      const result = await service.createTask(input);

      expect(result).toBeDefined();
      expect(result.content).toBe('New task');
      expect(result.description).toBe('Task description');
      expect(result.priority).toBe(3);
    });
  });

  describe('fullResync', () => {
    it('should perform a complete resync', async () => {
      const tasks = [createMockTask({ id: 'task_1' })];
      taskProvider.seedTasks(tasks);
      taskProvider.seedProjects(mockProjects);
      taskProvider.seedLabels(mockLabels);

      const result = await service.fullResync();

      expect(result.success).toBe(true);
      expect(result.tasks).toBeGreaterThanOrEqual(1);
    });
  });
});


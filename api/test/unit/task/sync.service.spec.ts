/**
 * Sync Service Unit Tests
 * 
 * Tests both REST API fallback path and Sync API optimized path.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SyncService } from '../../../src/task/services/sync.service';
import { ReconciliationService } from '../../../src/task/services/reconciliation.service';
import { TaxonomyService } from '../../../src/config/taxonomy/taxonomy.service';
import { MockStorageAdapter } from '../../mocks/storage.mock';
import { MockTaskProvider } from '../../mocks/task-provider.mock';
import { MockTodoistSyncProvider } from '../../mocks/todoist-sync.mock';
import { createMockTask, mockProjects, mockLabels } from '../../fixtures/tasks.fixture';

describe('SyncService', () => {
  describe('REST API Fallback Path', () => {
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
          // No ITodoistSyncProvider - will use REST API fallback
        ],
      }).compile();

      service = module.get<SyncService>(SyncService);
      storage = module.get<MockStorageAdapter>('IStorageAdapter');
      taskProvider = module.get<MockTaskProvider>('ITaskProvider');
      
      const taxonomyService = module.get<TaxonomyService>(TaxonomyService);
      taxonomyService.onModuleInit();
    });

    afterEach(() => {
      storage.clear();
      taskProvider.clear();
    });

    it('should sync tasks from Todoist to storage via REST API', async () => {
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
      const initialTasks = [createMockTask({ id: 'task_1' })];
      taskProvider.seedTasks(initialTasks);
      taskProvider.seedProjects(mockProjects);
      taskProvider.seedLabels(mockLabels);

      await service.syncNow();

      const newTask = createMockTask({ id: 'task_2', content: 'New Task' });
      taskProvider.seedTasks([...initialTasks, newTask]);

      const result = await service.syncNow();

      expect(result.success).toBe(true);
      expect(result.newTasks).toBe(1);
    });
  });

  describe('Sync API Optimized Path', () => {
    let service: SyncService;
    let storage: MockStorageAdapter;
    let syncProvider: MockTodoistSyncProvider;

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
            provide: 'ITodoistSyncProvider',
            useClass: MockTodoistSyncProvider,
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
      syncProvider = module.get<MockTodoistSyncProvider>('ITodoistSyncProvider');
      
      const taxonomyService = module.get<TaxonomyService>(TaxonomyService);
      taxonomyService.onModuleInit();
    });

    afterEach(() => {
      storage.clear();
      syncProvider.clear();
    });

    it('should sync all data in single bulk sync call', async () => {
      const tasks = [
        createMockTask({ id: 'task_1', content: 'Task 1' }),
        createMockTask({ id: 'task_2', content: 'Task 2' }),
      ];

      syncProvider.seedTasks(tasks);
      syncProvider.seedProjects(mockProjects);
      syncProvider.seedLabels(mockLabels);

      const result = await service.syncNow();

      expect(result.success).toBe(true);
      expect(result.tasks).toBe(2);
      expect(result.projects).toBe(mockProjects.length);
      expect(result.labels).toBe(mockLabels.length);
    });

    it('should cache comments from bulk sync', async () => {
      const task = createMockTask({ id: 'task_1', content: 'Task with comments' });
      const comments = [
        { id: 'comment_1', taskId: 'task_1', content: 'First comment', postedAt: new Date().toISOString() },
        { id: 'comment_2', taskId: 'task_1', content: 'Second comment', postedAt: new Date().toISOString() },
      ];

      syncProvider.seedTasks([task]);
      syncProvider.seedProjects(mockProjects);
      syncProvider.seedLabels(mockLabels);
      syncProvider.seedComments('task_1', comments);

      await service.syncNow();

      // Fetch comments should use cache (no additional API calls)
      const tasksWithComments = await service.fetchCommentsForTasks([task]);

      expect(tasksWithComments).toHaveLength(1);
      expect(tasksWithComments[0].comments).toHaveLength(2);
      expect(tasksWithComments[0].comments![0].content).toBe('First comment');
    });

    it('should save and use sync token for incremental sync', async () => {
      syncProvider.seedProjects(mockProjects);
      syncProvider.seedLabels(mockLabels);
      syncProvider.setSyncToken('new_token_456');

      await service.syncNow();

      // Check that sync token was saved
      const savedToken = await storage.getSyncToken();
      expect(savedToken).toBe('new_token_456');
    });

    it('should clear sync token on fullResync', async () => {
      // Set an existing sync token
      await storage.setSyncToken('existing_token');

      syncProvider.seedProjects(mockProjects);
      syncProvider.seedLabels(mockLabels);

      await service.fullResync();

      // After fullResync starts, it should have cleared the token to '*'
      // (The new token from the response will be saved)
      const savedToken = await storage.getSyncToken();
      expect(savedToken).toBe('mock_sync_token_123'); // The mock's default token
    });
  });

  describe('Common Operations', () => {
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
      
      const taxonomyService = module.get<TaxonomyService>(TaxonomyService);
      taxonomyService.onModuleInit();
    });

    afterEach(() => {
      storage.clear();
      taskProvider.clear();
    });

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

    it('should return sync status', () => {
      const status = service.getStatus();

      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('isSyncing');
      expect(status).toHaveProperty('intervalMs');
      expect(status).toHaveProperty('lastError');
    });
  });
});

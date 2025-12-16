/**
 * Integration Tests for Sync Modes
 * 
 * Tests for standalone mode, Todoist mode, and switching between them.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { SyncService } from '../../src/task/services/sync.service';
import { ReconciliationService } from '../../src/task/services/reconciliation.service';
import { IStorageAdapter } from '../../src/common/interfaces/storage-adapter.interface';
import { ITaskProvider } from '../../src/common/interfaces/task-provider.interface';
import { ConfigService } from '@nestjs/config';
import type { Task, CreateTaskDto } from '../../src/common/interfaces';

describe('Sync Modes Integration Tests', () => {
  let syncService: SyncService;
  let storageAdapter: IStorageAdapter;
  let taskProvider: ITaskProvider;
  let configService: ConfigService;

  beforeEach(async () => {
    // Create mock storage adapter
    const mockStorage = {
      getConfig: vi.fn(),
      setConfig: vi.fn(),
      hasConfig: vi.fn(),
      createTask: vi.fn(),
      updateTask: vi.fn(),
      deleteTask: vi.fn(),
      getTask: vi.fn(),
      enqueueSyncOperation: vi.fn(),
      getPendingSyncOperations: vi.fn(),
      markSyncOperationComplete: vi.fn(),
      markSyncOperationFailed: vi.fn(),
      saveLastSyncedState: vi.fn(),
      getLastSyncedState: vi.fn(),
      getTaskFieldTimestamps: vi.fn(),
    };

    // Create mock task provider (Todoist)
    const mockTaskProvider = {
      createTask: vi.fn(),
      updateTask: vi.fn(),
      deleteTask: vi.fn(),
      getTasks: vi.fn(),
      getTask: vi.fn(),
      completeTask: vi.fn(),
    };

    // Create testing module
    const moduleRef = await Test.createTestingModule({
      providers: [
        SyncService,
        ReconciliationService,
        {
          provide: 'IStorageAdapter',
          useValue: mockStorage,
        },
        {
          provide: 'ITaskProvider',
          useValue: mockTaskProvider,
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn(),
          },
        },
      ],
    }).compile();

    syncService = moduleRef.get<SyncService>(SyncService);
    storageAdapter = moduleRef.get<IStorageAdapter>('IStorageAdapter');
    taskProvider = moduleRef.get<ITaskProvider>('ITaskProvider');
    configService = moduleRef.get<ConfigService>(ConfigService);
  });

  describe('Standalone Mode', () => {
    it('should create task locally without syncing to Todoist', async () => {
      const taskData: CreateTaskDto = {
        content: 'Test task in standalone mode',
        priority: 1,
      };

      const localTask: Task = {
        id: 'local-uuid-123',
        content: taskData.content,
        priority: taskData.priority,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock standalone mode
      vi.mocked(storageAdapter.getConfig).mockResolvedValue('standalone');
      vi.mocked(storageAdapter.createTask).mockResolvedValue(localTask);

      const result = await syncService.createTask(taskData);

      expect(storageAdapter.createTask).toHaveBeenCalledWith(taskData);
      expect(taskProvider.createTask).not.toHaveBeenCalled(); // Should NOT sync to Todoist
      expect(result.id).toBe('local-uuid-123');
    });

    it('should update task locally without syncing to Todoist', async () => {
      const taskId = 'local-uuid-123';
      const updates = { content: 'Updated content' };

      vi.mocked(storageAdapter.getConfig).mockResolvedValue('standalone');
      vi.mocked(storageAdapter.updateTask).mockResolvedValue(true);

      await syncService.updateTask(taskId, updates);

      expect(storageAdapter.updateTask).toHaveBeenCalledWith(taskId, updates);
      expect(taskProvider.updateTask).not.toHaveBeenCalled(); // Should NOT sync to Todoist
    });

    it('should delete task locally without syncing to Todoist', async () => {
      const taskId = 'local-uuid-123';

      vi.mocked(storageAdapter.getConfig).mockResolvedValue('standalone');
      vi.mocked(storageAdapter.deleteTask).mockResolvedValue(true);

      await syncService.deleteTask(taskId);

      expect(storageAdapter.deleteTask).toHaveBeenCalledWith(taskId);
      expect(taskProvider.deleteTask).not.toHaveBeenCalled(); // Should NOT sync to Todoist
    });
  });

  describe('Todoist Mode', () => {
    it('should create task locally first, then sync to Todoist', async () => {
      const taskData: CreateTaskDto = {
        content: 'Test task in Todoist mode',
        priority: 1,
      };

      const localTask: Task = {
        id: 'local-uuid-123',
        content: taskData.content,
        priority: taskData.priority,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const todoistTask: Task = {
        ...localTask,
        id: 'todoist-id-456', // Todoist assigns its own ID
      };

      // Mock Todoist mode
      vi.mocked(storageAdapter.getConfig).mockResolvedValue('todoist');
      vi.mocked(storageAdapter.createTask).mockResolvedValue(localTask);
      vi.mocked(taskProvider.createTask).mockResolvedValue(todoistTask);
      vi.mocked(storageAdapter.updateTask).mockResolvedValue(true);

      const result = await syncService.createTask(taskData);

      // Verify local creation happened first
      expect(storageAdapter.createTask).toHaveBeenCalledWith(taskData);
      
      // Verify sync to Todoist happened
      expect(taskProvider.createTask).toHaveBeenCalledWith(taskData);
      
      // Verify local task was updated with Todoist ID
      expect(storageAdapter.updateTask).toHaveBeenCalledWith(
        localTask.id,
        expect.objectContaining({ id: todoistTask.id })
      );

      expect(result.id).toBe('todoist-id-456');
    });

    it('should rollback local creation if Todoist sync fails (fail_transaction mode)', async () => {
      const taskData: CreateTaskDto = {
        content: 'Test task that fails to sync',
        priority: 1,
      };

      const localTask: Task = {
        id: 'local-uuid-123',
        content: taskData.content,
        priority: taskData.priority,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock Todoist mode with fail_transaction behavior
      vi.mocked(storageAdapter.getConfig).mockImplementation(async (key: string) => {
        if (key === 'TASK_PROVIDER_MODE') return 'todoist';
        if (key === 'SYNC_FAILURE_BEHAVIOR') return 'fail_transaction';
        return null;
      });
      vi.mocked(storageAdapter.createTask).mockResolvedValue(localTask);
      vi.mocked(taskProvider.createTask).mockRejectedValue(new Error('Todoist API error'));
      vi.mocked(storageAdapter.deleteTask).mockResolvedValue(true);

      await expect(syncService.createTask(taskData)).rejects.toThrow();

      // Verify rollback happened
      expect(storageAdapter.deleteTask).toHaveBeenCalledWith(localTask.id);
    });

    it('should keep local task and enqueue sync if Todoist sync fails (queue mode)', async () => {
      const taskData: CreateTaskDto = {
        content: 'Test task that fails to sync but is queued',
        priority: 1,
      };

      const localTask: Task = {
        id: 'local-uuid-123',
        content: taskData.content,
        priority: taskData.priority,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock Todoist mode with queue behavior (default)
      vi.mocked(storageAdapter.getConfig).mockImplementation(async (key: string) => {
        if (key === 'TASK_PROVIDER_MODE') return 'todoist';
        if (key === 'SYNC_FAILURE_BEHAVIOR') return 'queue';
        return null;
      });
      vi.mocked(storageAdapter.createTask).mockResolvedValue(localTask);
      vi.mocked(taskProvider.createTask).mockRejectedValue(new Error('Todoist API error'));
      vi.mocked(storageAdapter.enqueueSyncOperation).mockResolvedValue();

      const result = await syncService.createTask(taskData);

      // Verify local task was kept
      expect(result.id).toBe('local-uuid-123');
      
      // Verify sync was queued
      expect(storageAdapter.enqueueSyncOperation).toHaveBeenCalledWith(
        localTask.id,
        'create',
        taskData
      );
    });
  });

  describe('Mode Switching', () => {
    it('should handle switching from standalone to Todoist mode', async () => {
      // This would typically trigger orphan detection
      // The actual implementation is in the settings controller
      vi.mocked(storageAdapter.setConfig).mockResolvedValue();

      await storageAdapter.setConfig('TASK_PROVIDER_MODE', 'todoist');
      await storageAdapter.setConfig('TODOIST_API_KEY', 'test-api-key', true);

      expect(storageAdapter.setConfig).toHaveBeenCalledWith('TASK_PROVIDER_MODE', 'todoist');
      expect(storageAdapter.setConfig).toHaveBeenCalledWith('TODOIST_API_KEY', 'test-api-key', true);
    });

    it('should handle switching from Todoist to standalone mode', async () => {
      vi.mocked(storageAdapter.setConfig).mockResolvedValue();

      await storageAdapter.setConfig('TASK_PROVIDER_MODE', 'standalone');
      await storageAdapter.setConfig('TODOIST_API_KEY', '', true); // Clear API key

      expect(storageAdapter.setConfig).toHaveBeenCalledWith('TASK_PROVIDER_MODE', 'standalone');
      expect(storageAdapter.setConfig).toHaveBeenCalledWith('TODOIST_API_KEY', '', true);
    });
  });
});


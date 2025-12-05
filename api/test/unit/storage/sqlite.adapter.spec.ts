/**
 * SQLite Adapter Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SQLiteAdapter } from '../../../src/storage/adapters/sqlite.adapter';
import { mockTasks, mockProjects, createMockTask } from '../../fixtures/tasks.fixture';
import * as fs from 'fs';
import * as path from 'path';

describe('SQLiteAdapter', () => {
  let adapter: SQLiteAdapter;
  const testDbPath = path.join(__dirname, '../../test.db');

  beforeEach(async () => {
    // Remove test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: SQLiteAdapter,
          useFactory: () => {
            return new SQLiteAdapter(testDbPath);
          },
        },
      ],
    }).compile();

    adapter = module.get<SQLiteAdapter>(SQLiteAdapter);
    await adapter.initialize();
  });

  afterEach(async () => {
    await adapter.close();
    
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Task Operations', () => {
    it('should save and retrieve tasks', async () => {
      const tasks = [createMockTask({ id: 'test_1', content: 'Test Task 1' })];
      
      const saved = await adapter.saveTasks(tasks);
      expect(saved).toBe(1);

      const retrieved = await adapter.getTask('test_1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe('Test Task 1');
    });

    it('should filter tasks by category', async () => {
      const tasks = [
        createMockTask({ id: 'task_1' }),
        createMockTask({ id: 'task_2' }),
        createMockTask({ id: 'task_3' }),
      ];

      await adapter.saveTasks(tasks);
      
      // Save metadata separately
      await adapter.saveTaskMetadata('task_1', { category: 'work' });
      await adapter.saveTaskMetadata('task_2', { category: 'home-maintenance' });
      await adapter.saveTaskMetadata('task_3', { category: 'work' });

      const workTasks = await adapter.getTasks({ category: 'work' });
      expect(workTasks).toHaveLength(2);
      expect(workTasks.every((t) => t.metadata?.category === 'work')).toBe(true);
    });

    it('should filter tasks by priority', async () => {
      const tasks = [
        createMockTask({ id: 'task_1', priority: 4 }),
        createMockTask({ id: 'task_2', priority: 2 }),
        createMockTask({ id: 'task_3', priority: 4 }),
      ];

      await adapter.saveTasks(tasks);

      const highPriorityTasks = await adapter.getTasks({ priority: 4 });
      expect(highPriorityTasks).toHaveLength(2);
      expect(highPriorityTasks.every((t) => t.priority === 4)).toBe(true);
    });

    it('should update a task', async () => {
      const task = createMockTask({ id: 'test_1', content: 'Original' });
      await adapter.saveTasks([task]);

      const updated = await adapter.updateTask('test_1', { content: 'Updated' });
      expect(updated).toBe(true);

      const retrieved = await adapter.getTask('test_1');
      expect(retrieved?.content).toBe('Updated');
    });

    it('should delete a task', async () => {
      const task = createMockTask({ id: 'test_1' });
      await adapter.saveTasks([task]);

      const deleted = await adapter.deleteTask('test_1');
      expect(deleted).toBe(true);

      const retrieved = await adapter.getTask('test_1');
      expect(retrieved).toBeNull();
    });
  });

  describe('Metadata Operations', () => {
    it('should save and retrieve task metadata', async () => {
      const task = createMockTask({ id: 'test_1' });
      await adapter.saveTasks([task]);

      await adapter.saveTaskMetadata('test_1', {
        category: 'work',
        timeEstimateMinutes: 60,
        aiConfidence: 0.95,
      });

      const metadata = await adapter.getTaskMetadata('test_1');
      expect(metadata).toBeDefined();
      expect(metadata?.category).toBe('work');
      expect(metadata?.timeEstimateMinutes).toBe(60);
      expect(metadata?.aiConfidence).toBe(0.95);
    });

    it('should query tasks by metadata', async () => {
      const tasks = [
        createMockTask({ id: 'task_1' }),
        createMockTask({ id: 'task_2' }),
        createMockTask({ id: 'task_3' }),
      ];

      await adapter.saveTasks(tasks);
      
      // Save metadata separately
      await adapter.saveTaskMetadata('task_1', { category: 'work', size: 'M' });
      await adapter.saveTaskMetadata('task_2', { category: 'work', size: 'L' });
      await adapter.saveTaskMetadata('task_3', { category: 'home-maintenance', size: 'M' });

      const results = await adapter.queryTasksByMetadata({ category: 'work', size: 'M' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('task_1');
    });
  });

  describe('Project and Label Operations', () => {
    it('should save and retrieve projects', async () => {
      const saved = await adapter.saveProjects(mockProjects);
      expect(saved).toBe(mockProjects.length);

      const retrieved = await adapter.getProjects();
      expect(retrieved).toHaveLength(mockProjects.length);
    });

    it('should save and retrieve labels', async () => {
      const labels = [
        { id: 'label_1', name: 'urgent', color: 'red', order: 1 },
        { id: 'label_2', name: 'waiting', color: 'yellow', order: 2 },
      ];

      const saved = await adapter.saveLabels(labels);
      expect(saved).toBe(2);

      const retrieved = await adapter.getLabels();
      expect(retrieved).toHaveLength(2);
    });
  });

  describe('Sync State', () => {
    it('should save and retrieve last sync time', async () => {
      const now = new Date();
      await adapter.setLastSyncTime(now);

      const retrieved = await adapter.getLastSyncTime();
      expect(retrieved).toBeDefined();
      expect(retrieved?.getTime()).toBe(now.getTime());
    });
  });
});


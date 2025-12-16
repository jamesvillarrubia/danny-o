/**
 * Integration Tests for Conflict Resolution
 * 
 * Tests per-field timestamp-based conflict resolution.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ReconciliationService } from '../../src/task/services/reconciliation.service';
import type { Task } from '../../src/common/interfaces';

describe('Conflict Resolution Integration Tests', () => {
  let reconciliationService: ReconciliationService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ReconciliationService],
    }).compile();

    reconciliationService = moduleRef.get<ReconciliationService>(ReconciliationService);
  });

  describe('Per-field Timestamp Conflict Resolution', () => {
    it('should resolve conflicts with Todoist winning for content field', async () => {
      const localTask: Task = {
        id: 'task-123',
        content: 'Local content',
        description: 'Shared description',
        priority: 1,
        isCompleted: false,
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T12:00:00Z',
        contentUpdatedAt: '2024-01-01T10:00:00Z',
      };

      const todoistTask: Task = {
        id: 'task-123',
        content: 'Todoist content (newer)',
        description: 'Shared description',
        priority: 1,
        isCompleted: false,
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T13:00:00Z',
        contentUpdatedAt: '2024-01-01T13:00:00Z', // Newer
      };

      const localTimestamps = {
        content: new Date('2024-01-01T10:00:00Z'),
        description: new Date('2024-01-01T10:00:00Z'),
        priority: new Date('2024-01-01T10:00:00Z'),
      };

      const todoistTimestamps = {
        content: new Date('2024-01-01T13:00:00Z'), // Newer
        description: new Date('2024-01-01T10:00:00Z'),
        priority: new Date('2024-01-01T10:00:00Z'),
      };

      const { mergedTask, changesApplied } = await reconciliationService.resolveConflicts(
        localTask,
        todoistTask,
        localTimestamps,
        todoistTimestamps
      );

      expect(changesApplied).toBe(true);
      expect(mergedTask.content).toBe('Todoist content (newer)'); // Todoist wins
      expect(mergedTask.description).toBe('Shared description'); // No change
    });

    it('should resolve conflicts with local winning for priority field', async () => {
      const localTask: Task = {
        id: 'task-123',
        content: 'Shared content',
        priority: 4,
        isCompleted: false,
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T14:00:00Z',
        priorityUpdatedAt: '2024-01-01T14:00:00Z', // Newer
      };

      const todoistTask: Task = {
        id: 'task-123',
        content: 'Shared content',
        priority: 1,
        isCompleted: false,
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T12:00:00Z',
        priorityUpdatedAt: '2024-01-01T12:00:00Z',
      };

      const localTimestamps = {
        content: new Date('2024-01-01T10:00:00Z'),
        priority: new Date('2024-01-01T14:00:00Z'), // Newer
      };

      const todoistTimestamps = {
        content: new Date('2024-01-01T10:00:00Z'),
        priority: new Date('2024-01-01T12:00:00Z'),
      };

      const { mergedTask, changesApplied } = await reconciliationService.resolveConflicts(
        localTask,
        todoistTask,
        localTimestamps,
        todoistTimestamps
      );

      expect(changesApplied).toBe(false); // No changes because local is already newer
      expect(mergedTask.priority).toBe(4); // Local wins
    });

    it('should handle multiple field conflicts independently', async () => {
      const localTask: Task = {
        id: 'task-123',
        content: 'Local content (older)',
        description: 'Local description (newer)',
        priority: 1,
        labels: ['local-label'],
        isCompleted: false,
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T12:00:00Z',
        contentUpdatedAt: '2024-01-01T10:00:00Z',
        descriptionUpdatedAt: '2024-01-01T12:00:00Z',
        labelsUpdatedAt: '2024-01-01T11:00:00Z',
      };

      const todoistTask: Task = {
        id: 'task-123',
        content: 'Todoist content (newer)',
        description: 'Todoist description (older)',
        priority: 1,
        labels: ['todoist-label'],
        isCompleted: false,
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T13:00:00Z',
        contentUpdatedAt: '2024-01-01T13:00:00Z',
        descriptionUpdatedAt: '2024-01-01T10:00:00Z',
        labelsUpdatedAt: '2024-01-01T13:00:00Z',
      };

      const localTimestamps = {
        content: new Date('2024-01-01T10:00:00Z'),
        description: new Date('2024-01-01T12:00:00Z'),
        labels: new Date('2024-01-01T11:00:00Z'),
      };

      const todoistTimestamps = {
        content: new Date('2024-01-01T13:00:00Z'),
        description: new Date('2024-01-01T10:00:00Z'),
        labels: new Date('2024-01-01T13:00:00Z'),
      };

      const { mergedTask, changesApplied } = await reconciliationService.resolveConflicts(
        localTask,
        todoistTask,
        localTimestamps,
        todoistTimestamps
      );

      expect(changesApplied).toBe(true);
      expect(mergedTask.content).toBe('Todoist content (newer)'); // Todoist wins
      expect(mergedTask.description).toBe('Local description (newer)'); // Local wins
      expect(mergedTask.labels).toEqual(['todoist-label']); // Todoist wins
    });

    it('should handle completion status conflicts', async () => {
      const localTask: Task = {
        id: 'task-123',
        content: 'Task content',
        priority: 1,
        isCompleted: false,
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T12:00:00Z',
        isCompletedUpdatedAt: '2024-01-01T10:00:00Z',
      };

      const todoistTask: Task = {
        id: 'task-123',
        content: 'Task content',
        priority: 1,
        isCompleted: true,
        completedAt: '2024-01-01T14:00:00Z',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T14:00:00Z',
        isCompletedUpdatedAt: '2024-01-01T14:00:00Z', // Newer
      };

      const localTimestamps = {
        isCompleted: new Date('2024-01-01T10:00:00Z'),
      };

      const todoistTimestamps = {
        isCompleted: new Date('2024-01-01T14:00:00Z'), // Newer
      };

      const { mergedTask, changesApplied } = await reconciliationService.resolveConflicts(
        localTask,
        todoistTask,
        localTimestamps,
        todoistTimestamps
      );

      expect(changesApplied).toBe(true);
      expect(mergedTask.isCompleted).toBe(true); // Todoist wins (task was completed)
    });

    it('should handle due date conflicts', async () => {
      const localTask: Task = {
        id: 'task-123',
        content: 'Task with due date',
        priority: 1,
        isCompleted: false,
        due: {
          date: '2024-01-15',
          isRecurring: false,
        },
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T12:00:00Z',
        dueUpdatedAt: '2024-01-01T12:00:00Z',
      };

      const todoistTask: Task = {
        id: 'task-123',
        content: 'Task with due date',
        priority: 1,
        isCompleted: false,
        due: {
          date: '2024-01-20', // Different date
          isRecurring: false,
        },
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T14:00:00Z',
        dueUpdatedAt: '2024-01-01T14:00:00Z', // Newer
      };

      const localTimestamps = {
        due: new Date('2024-01-01T12:00:00Z'),
      };

      const todoistTimestamps = {
        due: new Date('2024-01-01T14:00:00Z'), // Newer
      };

      const { mergedTask, changesApplied } = await reconciliationService.resolveConflicts(
        localTask,
        todoistTask,
        localTimestamps,
        todoistTimestamps
      );

      expect(changesApplied).toBe(true);
      expect(mergedTask.due?.date).toBe('2024-01-20'); // Todoist wins
    });
  });
});


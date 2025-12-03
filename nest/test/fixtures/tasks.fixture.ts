/**
 * Task Test Fixtures
 * 
 * Reusable test data for tasks, projects, and labels.
 */

import { Task, Project, Label, TaskMetadata } from '../../src/common/interfaces';

export const mockProjects: Project[] = [
  {
    id: 'project_work',
    name: 'Work',
    color: 'blue',
    order: 1,
    isInboxProject: false,
  },
  {
    id: 'project_home',
    name: 'Home Maintenance',
    color: 'green',
    order: 2,
    isInboxProject: false,
  },
  {
    id: 'project_personal',
    name: 'Personal',
    color: 'red',
    order: 3,
    isInboxProject: false,
  },
  {
    id: 'inbox',
    name: 'Inbox',
    color: 'gray',
    order: 0,
    isInboxProject: true,
  },
];

export const mockLabels: Label[] = [
  {
    id: 'label_urgent',
    name: 'urgent',
    color: 'red',
    order: 1,
  },
  {
    id: 'label_waiting',
    name: 'waiting',
    color: 'yellow',
    order: 2,
  },
  {
    id: 'label_someday',
    name: 'someday',
    color: 'gray',
    order: 3,
  },
];

export const mockMetadata: TaskMetadata = {
  category: 'work',
  timeEstimate: '30 minutes',
  timeEstimateMinutes: 30,
  size: 'M',
  aiConfidence: 0.9,
  aiReasoning: 'This is a work-related task',
  classificationSource: 'ai',
  categoryClassifiedAt: new Date('2024-01-01'),
};

export const mockTasks: Task[] = [
  {
    id: 'task_1',
    content: 'Write unit tests',
    description: 'Write comprehensive unit tests for the storage module',
    projectId: 'project_work',
    priority: 3,
    labels: ['urgent'],
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
    isCompleted: false,
    metadata: {
      category: 'work',
      timeEstimate: '2 hours',
      timeEstimateMinutes: 120,
      size: 'L',
      aiConfidence: 0.95,
      classificationSource: 'ai',
    },
  },
  {
    id: 'task_2',
    content: 'Fix leaky faucet',
    description: 'Kitchen sink is dripping',
    projectId: 'project_home',
    priority: 2,
    labels: [],
    createdAt: '2024-01-02T10:00:00Z',
    updatedAt: '2024-01-02T10:00:00Z',
    isCompleted: false,
    metadata: {
      category: 'home-maintenance',
      timeEstimate: '45 minutes',
      timeEstimateMinutes: 45,
      size: 'M',
      aiConfidence: 0.85,
      needsSupplies: true,
      classificationSource: 'ai',
    },
  },
  {
    id: 'task_3',
    content: 'Call dentist',
    description: 'Schedule annual checkup',
    projectId: 'project_personal',
    priority: 1,
    labels: ['waiting'],
    createdAt: '2024-01-03T10:00:00Z',
    updatedAt: '2024-01-03T10:00:00Z',
    isCompleted: false,
    metadata: {
      category: 'personal-family',
      timeEstimate: '10 minutes',
      timeEstimateMinutes: 10,
      size: 'XS',
      aiConfidence: 0.9,
      classificationSource: 'ai',
    },
  },
  {
    id: 'task_4',
    content: 'Review pull requests',
    projectId: 'project_work',
    priority: 2,
    labels: [],
    createdAt: '2024-01-04T10:00:00Z',
    updatedAt: '2024-01-04T10:00:00Z',
    isCompleted: true,
    completedAt: '2024-01-04T15:00:00Z',
    metadata: {
      category: 'work',
      timeEstimate: '1 hour',
      timeEstimateMinutes: 60,
      size: 'M',
      aiConfidence: 0.92,
      classificationSource: 'ai',
    },
  },
  {
    id: 'task_5',
    content: 'Unclassified task',
    description: 'This task has no metadata',
    projectId: 'inbox',
    priority: 1,
    labels: [],
    createdAt: '2024-01-05T10:00:00Z',
    updatedAt: '2024-01-05T10:00:00Z',
    isCompleted: false,
  },
];

/**
 * Create a mock task with custom properties
 */
export function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task_${Date.now()}`,
    content: 'Test task',
    projectId: 'inbox',
    priority: 1,
    labels: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCompleted: false,
    ...overrides,
  };
}

/**
 * Create a mock project with custom properties
 */
export function createMockProject(overrides: Partial<Project> = {}): Project {
  return {
    id: `project_${Date.now()}`,
    name: 'Test Project',
    color: 'blue',
    order: 1,
    isInboxProject: false,
    ...overrides,
  };
}

/**
 * Create mock metadata with custom properties
 */
export function createMockMetadata(overrides: Partial<TaskMetadata> = {}): TaskMetadata {
  return {
    category: 'work',
    timeEstimate: '30 minutes',
    timeEstimateMinutes: 30,
    size: 'M',
    aiConfidence: 0.9,
    classificationSource: 'ai',
    ...overrides,
  };
}


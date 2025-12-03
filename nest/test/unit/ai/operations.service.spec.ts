/**
 * AI Operations Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AIOperationsService } from '../../../src/ai/services/operations.service';
import { ClaudeService } from '../../../src/ai/services/claude.service';
import { LearningService } from '../../../src/ai/services/learning.service';
import { PromptsService } from '../../../src/ai/prompts/prompts.service';
import { TaxonomyService } from '../../../src/config/taxonomy/taxonomy.service';
import { MockStorageAdapter } from '../../mocks/storage.mock';
import { MockClaudeService } from '../../mocks/claude.mock';
import { createMockTask } from '../../fixtures/tasks.fixture';

describe('AIOperationsService', () => {
  let service: AIOperationsService;
  let claudeService: MockClaudeService;
  let storage: MockStorageAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIOperationsService,
        LearningService,
        PromptsService,
        TaxonomyService,
        {
          provide: ClaudeService,
          useClass: MockClaudeService,
        },
        {
          provide: 'IStorageAdapter',
          useClass: MockStorageAdapter,
        },
      ],
    }).compile();

    service = module.get<AIOperationsService>(AIOperationsService);
    claudeService = module.get<MockClaudeService>(ClaudeService);
    storage = module.get<MockStorageAdapter>('IStorageAdapter');
  });

  afterEach(() => {
    claudeService.clearMockResponses();
    storage.clear();
  });

  describe('classifyTasks', () => {
    it('should classify tasks using AI', async () => {
      const tasks = [
        createMockTask({ id: 'task_1', content: 'Write unit tests' }),
        createMockTask({ id: 'task_2', content: 'Fix leaky faucet' }),
      ];

      // Mock AI response
      claudeService.setMockResponse('classify', {
        tasks: [
          { taskId: 'task_1', category: 'work', confidence: 0.9, reasoning: 'Software development task' },
          { taskId: 'task_2', category: 'home-maintenance', confidence: 0.85, reasoning: 'Home repair task' },
        ],
      });

      const results = await service.classifyTasks(tasks);

      expect(results).toHaveLength(2);
      expect(results[0].taskId).toBe('task_1');
      expect(results[0].category).toBe('work');
      expect(results[0].confidence).toBe(0.9);
      expect(results[1].category).toBe('home-maintenance');
    });

    it('should return empty array for no tasks', async () => {
      const results = await service.classifyTasks([]);
      expect(results).toEqual([]);
    });
  });

  describe('estimateTaskDuration', () => {
    it('should estimate task duration using AI', async () => {
      const task = createMockTask({
        id: 'task_1',
        content: 'Write comprehensive unit tests',
        description: 'Cover all edge cases',
      });

      claudeService.setMockResponse('estimate', {
        taskId: 'task_1',
        timeEstimate: '2-3 hours',
        size: 'L',
        confidence: 0.8,
        reasoning: 'Comprehensive testing requires significant time',
      });

      const result = await service.estimateTaskDuration(task);

      expect(result.taskId).toBe('task_1');
      expect(result.timeEstimate).toBe('2-3 hours');
      expect(result.size).toBe('L');
      expect(result.confidence).toBe(0.8);
    });
  });

  describe('prioritizeTasks', () => {
    it('should prioritize tasks using AI', async () => {
      const tasks = [
        createMockTask({ id: 'task_1', content: 'Urgent bug fix', priority: 4 }),
        createMockTask({ id: 'task_2', content: 'Nice to have feature', priority: 1 }),
        createMockTask({ id: 'task_3', content: 'Critical security patch', priority: 4 }),
      ];

      claudeService.setMockResponse('prioritize', {
        prioritized: [
          { taskId: 'task_3', priority: 'critical', suggestedOrder: 1, reasoning: 'Security is critical' },
          { taskId: 'task_1', priority: 'high', suggestedOrder: 2, reasoning: 'Bug impacts users' },
          { taskId: 'task_2', priority: 'low', suggestedOrder: 3, reasoning: 'Can be deferred' },
        ],
        recommendations: {
          startWith: 'task_3',
          defer: ['task_2'],
          delegate: [],
        },
      });

      const result = await service.prioritizeTasks(tasks);

      expect(result.prioritized).toHaveLength(3);
      expect(result.prioritized[0].suggestedOrder).toBe(1);
      expect(result.recommendations.startWith).toBe('task_3');
    });
  });

  describe('createSubtasks', () => {
    it('should break down complex tasks into subtasks', async () => {
      const task = createMockTask({
        id: 'task_1',
        content: 'Migrate application to NestJS',
        description: 'Complete rewrite with TypeScript',
      });

      claudeService.setMockResponse('breakdown', {
        taskId: 'task_1',
        subtasks: [
          { content: 'Set up NestJS project', order: 1, timeEstimate: '1 hour', needsSupplies: false, supplies: [] },
          { content: 'Migrate storage layer', order: 2, timeEstimate: '4 hours', needsSupplies: false, supplies: [] },
          { content: 'Write tests', order: 3, timeEstimate: '6 hours', needsSupplies: false, supplies: [] },
        ],
        totalEstimate: '11 hours',
        supplyList: [],
        notes: 'Break into phases',
      });

      const result = await service.createSubtasks(task);

      expect(result.subtasks).toHaveLength(3);
      expect(result.totalEstimate).toBe('11 hours');
      expect(result.subtasks[0].content).toBe('Set up NestJS project');
    });
  });

  describe('suggestDailyPlan', () => {
    it('should create a daily plan from tasks', async () => {
      const tasks = [
        createMockTask({ id: 'task_1', content: 'Morning task', priority: 3 }),
        createMockTask({ id: 'task_2', content: 'Afternoon task', priority: 2 }),
      ];

      const result = await service.suggestDailyPlan(tasks, { hoursAvailable: 6 });

      expect(result).toBeDefined();
      expect(result.plan).toBeDefined();
    });

    it('should handle empty task list', async () => {
      const result = await service.suggestDailyPlan([], {});

      expect(result.plan).toBe('No tasks available for planning.');
    });
  });

  describe('filterTasksByIntent', () => {
    it('should filter tasks using natural language query', async () => {
      const tasks = [
        createMockTask({ id: 'task_1', content: 'Fix urgent bug' }),
        createMockTask({ id: 'task_2', content: 'Write documentation' }),
        createMockTask({ id: 'task_3', content: 'Critical security fix' }),
      ];

      claudeService.setMockResponse('search', {
        matches: [
          { task: tasks[0], relevanceScore: 0.9, reasoning: 'Urgent bug' },
          { task: tasks[2], relevanceScore: 0.95, reasoning: 'Critical security' },
        ],
        interpretation: 'Looking for high-priority urgent tasks',
      });

      const result = await service.filterTasksByIntent('urgent tasks', tasks);

      expect(result.matches).toHaveLength(2);
      expect(result.interpretation).toBeDefined();
    });
  });

  describe('generateInsights', () => {
    it('should generate productivity insights from history', async () => {
      // Seed some completion history
      await storage.saveTaskCompletion('task_1', {
        taskContent: 'Completed task',
        category: 'work',
        actualDuration: 30,
        completedAt: new Date(),
      });

      await storage.saveTaskCompletion('task_2', {
        taskContent: 'Another task',
        category: 'work',
        actualDuration: 45,
        completedAt: new Date(),
      });

      claudeService.setMockResponse('insights', {
        insights: 'You complete most work tasks in 30-45 minutes',
        recommendations: ['Break larger tasks into smaller chunks', 'Schedule complex tasks in morning'],
      });

      const result = await service.generateInsights();

      expect(result.insights).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });
});


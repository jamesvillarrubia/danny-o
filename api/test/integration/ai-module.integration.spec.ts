/**
 * AI Module Integration Tests
 * 
 * Tests the integration between AIModule components:
 * - Claude service → Operations workflow
 * - Classification → Enrichment pipeline
 * - Learning from history
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AIModule } from '../../src/ai/ai.module';
import { StorageModule } from '../../src/storage/storage.module';
import { ConfigurationModule } from '../../src/config/config.module';
import { TaskProviderModule } from '../../src/task-provider/task-provider.module';
import { AIOperationsService } from '../../src/ai/services/operations.service';
import { ClaudeService } from '../../src/ai/services/claude.service';
import { LearningService } from '../../src/ai/services/learning.service';
import { MockClaudeService } from '../mocks/claude.mock';
import { MockStorageAdapter } from '../mocks/storage.mock';
import { MockTaskProvider } from '../mocks/task-provider.mock';
import { createMockTask } from '../fixtures/tasks.fixture';

describe('AIModule Integration', () => {
  let aiOps: AIOperationsService;
  let claude: MockClaudeService;
  let learning: LearningService;
  let storage: MockStorageAdapter;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AIModule, StorageModule, ConfigurationModule, TaskProviderModule],
    })
      .overrideProvider(ClaudeService)
      .useClass(MockClaudeService)
      .overrideProvider('IStorageAdapter')
      .useClass(MockStorageAdapter)
      .overrideProvider('ITaskProvider')
      .useClass(MockTaskProvider)
      .compile();

    aiOps = module.get<AIOperationsService>(AIOperationsService);
    claude = module.get<ClaudeService>(ClaudeService) as unknown as MockClaudeService;
    learning = module.get<LearningService>(LearningService);
    storage = module.get<MockStorageAdapter>('IStorageAdapter');
  });

  beforeEach(() => {
    if (claude && typeof claude.clearMockResponses === 'function') {
      claude.clearMockResponses();
    }
    storage.clear();
  });

  describe('Classification → Storage Pipeline', () => {
    it('should classify tasks and persist metadata', async () => {
      // Arrange
      const tasks = [
        createMockTask({ id: 'task_1', content: 'Write unit tests' }),
        createMockTask({ id: 'task_2', content: 'Fix leaky faucet' }),
      ];
      storage.seedTasks(tasks);

      // Mock Claude response
      claude.setMockResponse('classify', {
        tasks: [
          { taskId: 'task_1', category: 'work', confidence: 0.95 },
          { taskId: 'task_2', category: 'home-maintenance', confidence: 0.90 },
        ],
      });

      // Act: Classify
      const results = await aiOps.classifyTasks(tasks);

      // Assert: Classification successful
      expect(results).toHaveLength(2);
      expect(results[0].category).toBe('work');
      expect(results[1].category).toBe('home-maintenance');

      // Note: In real integration, this would persist to storage
      // via EnrichmentService which is tested in task-module.integration
    });
  });

  describe('Learning from History', () => {
    it('should analyze completion patterns', async () => {
      // Arrange: Add completion history
      await storage.saveTaskCompletion('task_1', {
        taskContent: 'Task 1',
        category: 'work',
        actualDuration: 30,
        completedAt: new Date(),
      });

      await storage.saveTaskCompletion('task_2', {
        taskContent: 'Task 2',
        category: 'work',
        actualDuration: 45,
        completedAt: new Date(),
      });

      await storage.saveTaskCompletion('task_3', {
        taskContent: 'Task 3',
        category: 'home-maintenance',
        actualDuration: 60,
        completedAt: new Date(),
      });

      // Act: Get completion patterns
      const patterns = await learning.getCompletionPatterns({ category: 'work' });

      // Assert: Patterns calculated
      expect(patterns).toBeDefined();
      // Patterns would include average time, completion rate, etc.
    });
  });

  describe('Multi-step AI Operations', () => {
    it('should perform classification and time estimation in sequence', async () => {
      // Arrange
      const task = createMockTask({
        id: 'task_1',
        content: 'Complex development task',
        description: 'Requires multiple steps',
      });

      // Mock responses
      claude.setMockResponse('classify', {
        tasks: [{ taskId: 'task_1', category: 'work', confidence: 0.9 }],
      });

      claude.setMockResponse('estimate', {
        taskId: 'task_1',
        timeEstimate: '2-3 hours',
        timeEstimateMinutes: 150,
        size: 'L',
        confidence: 0.85,
      });

      // Act: Classify
      const classification = await aiOps.classifyTasks([task]);

      // Act: Estimate time
      const estimate = await aiOps.estimateTaskDuration(task);

      // Assert: Both successful
      expect(classification[0].category).toBe('work');
      expect(estimate.timeEstimateMinutes).toBe(150);
      expect(estimate.size).toBe('L');
    });
  });
});


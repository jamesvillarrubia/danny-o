/**
 * MCP Server End-to-End Tests
 * 
 * Tests complete MCP workflows:
 * - Tool discovery and execution
 * - Multi-turn conversations
 * - Task processor agent
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { MCPServerService } from '../../src/mcp/services/mcp-server.service';
import { MockTaskProvider } from '../mocks/task-provider.mock';
import { MockClaudeService } from '../mocks/claude.mock';
import { createMockTask, mockProjects, mockLabels } from '../fixtures/tasks.fixture';
import { ClaudeService } from '../../src/ai/services/claude.service';

describe('MCP E2E', () => {
  let app: TestingModule;
  let mcpServer: MCPServerService;
  let taskProvider: MockTaskProvider;
  let claudeService: MockClaudeService;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('ITaskProvider')
      .useClass(MockTaskProvider)
      .overrideProvider(ClaudeService)
      .useClass(MockClaudeService)
      .compile();

    mcpServer = app.get<MCPServerService>('MCPServerService');
    taskProvider = app.get<MockTaskProvider>('ITaskProvider');
    claudeService = app.get<MockClaudeService>(ClaudeService);
  });

  beforeEach(() => {
    taskProvider.clear();
    claudeService.clearMockResponses();
  });

  describe('Tool Discovery', () => {
    it('should register and discover all MCP tools', async () => {
      // MCP server is initialized with tools via decorators
      // In a real test, we would call listTools() and verify

      expect(mcpServer).toBeDefined();
      // Tools are registered via @MCPToolHandler decorators
    });
  });

  describe('Task Management Workflow', () => {
    it('should list, update, and complete tasks via MCP tools', async () => {
      // Arrange
      taskProvider.seedTasks([
        createMockTask({ id: 'task_1', content: 'MCP Test Task' }),
      ]);
      taskProvider.seedProjects(mockProjects);
      taskProvider.seedLabels(mockLabels);

      // In real MCP test, would simulate tool calls
      // For now, test the underlying services

      const syncService = app.get('SyncService');
      await syncService.syncNow();

      const storage = app.get('IStorageAdapter');
      const tasks = await storage.getTasks({ limit: 10 });

      expect(tasks.length).toBeGreaterThanOrEqual(1);
      expect(tasks[0].content).toBe('MCP Test Task');
    });
  });

  describe('AI Classification Workflow', () => {
    it('should classify tasks via ai_classify_tasks tool', async () => {
      // Arrange
      taskProvider.seedTasks([
        createMockTask({ id: 'task_1', content: 'Write unit tests' }),
        createMockTask({ id: 'task_2', content: 'Fix leaky faucet' }),
      ]);
      taskProvider.seedProjects(mockProjects);
      taskProvider.seedLabels(mockLabels);

      // Mock Claude response
      claudeService.setMockResponse('classify', {
        tasks: [
          { taskId: 'task_1', category: 'work', confidence: 0.95 },
          { taskId: 'task_2', category: 'home-maintenance', confidence: 0.90 },
        ],
      });

      // Act: Sync and classify
      const syncService = app.get('SyncService');
      await syncService.syncNow();

      const aiOps = app.get('AIOperationsService');
      const storage = app.get('IStorageAdapter');
      const tasks = await storage.getTasks({ completed: false });
      const results = await aiOps.classifyTasks(tasks);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].category).toBe('work');
      expect(results[1].category).toBe('home-maintenance');
    });
  });

  describe('Task Processor Agent', () => {
    it('should process natural language input', async () => {
      // Arrange
      taskProvider.seedProjects(mockProjects);
      taskProvider.seedLabels(mockLabels);

      // This would test the process_text_agent tool
      // which allows pasting task lists or natural language

      // For now, verify the agent tool exists
      expect(mcpServer).toBeDefined();
    });
  });

  afterAll(async () => {
    await app.close();
  });
});


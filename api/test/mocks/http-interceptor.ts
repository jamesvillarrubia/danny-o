/**
 * HTTP Interceptor for Mock API Responses
 * 
 * Uses nock to intercept outbound HTTP requests and return fixture data.
 * Works identically in local and Docker environments.
 * 
 * Usage:
 *   import { setupMockInterceptors, teardownMockInterceptors } from './http-interceptor';
 *   
 *   beforeAll(() => setupMockInterceptors());
 *   afterAll(() => teardownMockInterceptors());
 */

import nock from 'nock';
import { claudeFixtures, todoistFixtures, getFixtureResponse } from './fixtures';

// API Base URLs
const TODOIST_REST_BASE = 'https://api.todoist.com';
const TODOIST_SYNC_BASE = 'https://todoist.com';
const ANTHROPIC_BASE = 'https://api.anthropic.com';

/**
 * Configuration options for mock interceptors
 */
export interface MockInterceptorOptions {
  /** Enable logging of intercepted requests */
  verbose?: boolean;
  /** Allow real network requests for unmatched routes */
  allowUnmocked?: boolean;
  /** Custom fixture overrides */
  overrides?: {
    todoist?: Partial<Record<keyof typeof todoistFixtures, any>>;
    claude?: Partial<Record<keyof typeof claudeFixtures, any>>;
  };
}

/**
 * Set up mock interceptors for all external APIs
 */
export function setupMockInterceptors(options: MockInterceptorOptions = {}): void {
  const { verbose = false, allowUnmocked = false } = options;

  // Disable real HTTP if not allowing unmocked
  if (!allowUnmocked) {
    nock.disableNetConnect();
    // Allow localhost for test server
    nock.enableNetConnect((host) => {
      return host.includes('localhost') || host.includes('127.0.0.1');
    });
  }

  // Set up Todoist REST API mocks
  setupTodoistRestMocks(options);

  // Set up Todoist Sync API mocks
  setupTodoistSyncMocks(options);

  // Set up Anthropic (Claude) API mocks
  setupAnthropicMocks(options);

  if (verbose) {
    console.log('[MockInterceptor] Interceptors set up for Todoist and Anthropic APIs');
  }
}

/**
 * Tear down all mock interceptors
 */
export function teardownMockInterceptors(): void {
  nock.cleanAll();
  nock.enableNetConnect();
}

/**
 * Check if all expected mocks were called
 */
export function verifyMocks(): boolean {
  return nock.isDone();
}

/**
 * Get pending mocks that weren't called
 */
export function getPendingMocks(): string[] {
  return nock.pendingMocks();
}

/**
 * Set up Todoist REST API mocks
 */
function setupTodoistRestMocks(options: MockInterceptorOptions): void {
  const scope = nock(TODOIST_REST_BASE);
  const overrides = options.overrides?.todoist || {};

  // GET /rest/v2/tasks - List tasks
  scope
    .get('/rest/v2/tasks')
    .reply(200, () => {
      const fixture = overrides.tasksList || todoistFixtures.tasksList();
      return getFixtureResponse(fixture);
    })
    .persist();

  // GET /rest/v2/tasks/:id - Get single task
  scope
    .get(/\/rest\/v2\/tasks\/[\w-]+/)
    .reply((uri) => {
      const taskId = uri.split('/').pop();
      const fixture = overrides.taskSingle || todoistFixtures.taskSingle();
      const response = getFixtureResponse(fixture);
      
      // Return the fixture if it matches, or 404
      if (response.id === taskId || taskId === 'test-task-1') {
        return [200, response];
      }
      return [404, { error: 'Task not found' }];
    })
    .persist();

  // POST /rest/v2/tasks - Create task
  scope
    .post('/rest/v2/tasks')
    .reply(201, (uri, body: any) => {
      const fixture = overrides.createTask || todoistFixtures.createTask();
      const response = getFixtureResponse(fixture);
      return {
        ...response,
        content: body.content || response.content,
        project_id: body.project_id || response.project_id,
      };
    })
    .persist();

  // POST /rest/v2/tasks/:id/close - Complete task
  scope
    .post(/\/rest\/v2\/tasks\/[\w-]+\/close/)
    .reply(204)
    .persist();

  // DELETE /rest/v2/tasks/:id - Delete task
  scope
    .delete(/\/rest\/v2\/tasks\/[\w-]+/)
    .reply(204)
    .persist();

  // GET /rest/v2/projects - List projects
  scope
    .get('/rest/v2/projects')
    .reply(200, () => {
      const fixture = overrides.projectsList || todoistFixtures.projectsList();
      return getFixtureResponse(fixture);
    })
    .persist();

  // GET /rest/v2/labels - List labels
  scope
    .get('/rest/v2/labels')
    .reply(200, () => {
      const fixture = overrides.labelsList || todoistFixtures.labelsList();
      return getFixtureResponse(fixture);
    })
    .persist();
}

/**
 * Set up Todoist Sync API mocks
 */
function setupTodoistSyncMocks(options: MockInterceptorOptions): void {
  const scope = nock(TODOIST_SYNC_BASE);
  const overrides = options.overrides?.todoist || {};

  // POST /sync/v9/sync - Sync endpoint
  scope
    .post('/sync/v9/sync')
    .reply(200, () => {
      const fixture = overrides.syncResponse || todoistFixtures.syncResponse();
      return getFixtureResponse(fixture);
    })
    .persist();
}

/**
 * Set up Anthropic (Claude) API mocks
 */
function setupAnthropicMocks(options: MockInterceptorOptions): void {
  const scope = nock(ANTHROPIC_BASE);
  const overrides = options.overrides?.claude || {};

  // POST /v1/messages - Claude messages endpoint
  scope
    .post('/v1/messages')
    .reply((uri, body: any) => {
      const messages = body.messages || [];
      const lastMessage = messages[messages.length - 1];
      const prompt = lastMessage?.content?.toLowerCase() || '';

      let response: any;

      // Match prompt to appropriate fixture
      if (prompt.includes('classify')) {
        if (prompt.includes('work') || prompt.includes('code')) {
          response = overrides.classifyWorkTasks || claudeFixtures.classifyWorkTasks();
        } else {
          response = overrides.classifyHomeTasks || claudeFixtures.classifyHomeTasks();
        }
      } else if (prompt.includes('prioritize') || prompt.includes('priority')) {
        response = overrides.prioritize || claudeFixtures.prioritize();
      } else if (prompt.includes('estimate') || prompt.includes('duration')) {
        // Check if task seems complex
        if (prompt.includes('complex') || prompt.includes('large') || prompt.length > 500) {
          response = overrides.estimateLarge || claudeFixtures.estimateLarge();
        } else {
          response = overrides.estimateSmall || claudeFixtures.estimateSmall();
        }
      } else if (prompt.includes('plan') || prompt.includes('schedule') || prompt.includes('daily')) {
        response = overrides.dailyPlan || claudeFixtures.dailyPlan();
      } else if (prompt.includes('breakdown') || prompt.includes('subtask')) {
        response = overrides.breakdown || claudeFixtures.breakdown();
      } else if (prompt.includes('insight') || prompt.includes('analyze') || prompt.includes('productivity')) {
        response = overrides.insights || claudeFixtures.insights();
      } else {
        // Default response
        response = { response: { message: 'Mock response' } };
      }

      const fixtureResponse = getFixtureResponse(response);

      // Format as Claude API response
      return [
        200,
        {
          id: 'mock_msg_' + Date.now(),
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: JSON.stringify(fixtureResponse),
            },
          ],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 100,
            output_tokens: 200,
          },
        },
      ];
    })
    .persist();
}

/**
 * Create a custom fixture mock for a specific test
 */
export function mockCustomResponse(
  baseUrl: string,
  path: string,
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  response: any,
  statusCode = 200,
): nock.Scope {
  const scope = nock(baseUrl);
  
  switch (method) {
    case 'get':
      return scope.get(path).reply(statusCode, response);
    case 'post':
      return scope.post(path).reply(statusCode, response);
    case 'put':
      return scope.put(path).reply(statusCode, response);
    case 'patch':
      return scope.patch(path).reply(statusCode, response);
    case 'delete':
      return scope.delete(path).reply(statusCode, response);
  }
}

/**
 * Reset mocks but keep interceptors active
 */
export function resetMocks(): void {
  nock.cleanAll();
  setupMockInterceptors();
}


/**
 * Mock Bootstrap
 * 
 * Sets up HTTP interceptors for external APIs when running in mock mode.
 * This file is dynamically imported only when USE_MOCKS=true to avoid
 * bundling test dependencies in production.
 * 
 * @module mock-bootstrap
 */

import nock from 'nock';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// API Base URLs
const TODOIST_REST_BASE = 'https://api.todoist.com';
const TODOIST_SYNC_BASE = 'https://todoist.com';
const ANTHROPIC_BASE = 'https://api.anthropic.com';

// Fixture paths - resolve relative to project root
const FIXTURES_DIR = join(__dirname, '..', 'test', 'mocks', 'fixtures');

/**
 * Load a JSON fixture file
 */
function loadFixture<T>(category: string, name: string): T | null {
  const filePath = join(FIXTURES_DIR, category, `${name}.json`);
  if (!existsSync(filePath)) {
    console.warn(`[MockBootstrap] Fixture not found: ${filePath}`);
    return null;
  }
  const content = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(content);
  return parsed.response || parsed;
}

/**
 * Set up all mock interceptors for external APIs
 */
export function setupMocks(): void {
  console.log('[MockBootstrap] Enabling HTTP mocks for external APIs...');

  // Disable real HTTP connections except localhost
  nock.disableNetConnect();
  nock.enableNetConnect((host) => {
    return host.includes('localhost') || host.includes('127.0.0.1');
  });

  setupTodoistMocks();
  setupAnthropicMocks();

  console.log('[MockBootstrap] Mock interceptors active for Todoist and Anthropic APIs');
}

/**
 * Set up Todoist API mocks (REST + Sync)
 */
function setupTodoistMocks(): void {
  const restScope = nock(TODOIST_REST_BASE);
  const syncScope = nock(TODOIST_SYNC_BASE);

  // GET /rest/v2/tasks
  restScope
    .get('/rest/v2/tasks')
    .reply(200, () => loadFixture('todoist', 'tasks-list'))
    .persist();

  // GET /rest/v2/tasks/:id
  restScope
    .get(/\/rest\/v2\/tasks\/[\w-]+/)
    .reply((uri) => {
      const fixture = loadFixture<any>('todoist', 'task-single');
      const taskId = uri.split('/').pop();
      if (fixture && (fixture.id === taskId || taskId === 'test-task-1')) {
        return [200, fixture];
      }
      return [404, { error: 'Task not found' }];
    })
    .persist();

  // POST /rest/v2/tasks
  restScope
    .post('/rest/v2/tasks')
    .reply(201, (uri, body: any) => {
      const fixture = loadFixture<any>('todoist', 'create-task');
      return {
        ...fixture,
        id: `mock-task-${Date.now()}`,
        content: body.content || fixture?.content,
        project_id: body.project_id || fixture?.project_id,
      };
    })
    .persist();

  // POST /rest/v2/tasks/:id/close
  restScope
    .post(/\/rest\/v2\/tasks\/[\w-]+\/close/)
    .reply(204)
    .persist();

  // DELETE /rest/v2/tasks/:id
  restScope
    .delete(/\/rest\/v2\/tasks\/[\w-]+/)
    .reply(204)
    .persist();

  // PATCH /rest/v2/tasks/:id
  restScope
    .patch(/\/rest\/v2\/tasks\/[\w-]+/)
    .reply((uri, body: any) => {
      const fixture = loadFixture<any>('todoist', 'task-single');
      if (!fixture) return [404, { error: 'Task not found' }];
      return [200, { ...fixture, ...body }];
    })
    .persist();

  // GET /rest/v2/projects
  restScope
    .get('/rest/v2/projects')
    .reply(200, () => loadFixture('todoist', 'projects-list'))
    .persist();

  // GET /rest/v2/labels
  restScope
    .get('/rest/v2/labels')
    .reply(200, () => loadFixture('todoist', 'labels-list'))
    .persist();

  // POST /sync/v9/sync
  syncScope
    .post('/sync/v9/sync')
    .reply(200, () => loadFixture('todoist', 'sync-response'))
    .persist();
}

/**
 * Set up Anthropic (Claude) API mocks
 */
function setupAnthropicMocks(): void {
  const scope = nock(ANTHROPIC_BASE);

  // POST /v1/messages
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
          response = loadFixture('claude', 'classify-work-tasks');
        } else {
          response = loadFixture('claude', 'classify-home-tasks');
        }
      } else if (prompt.includes('prioritize') || prompt.includes('priority')) {
        response = loadFixture('claude', 'prioritize-response');
      } else if (prompt.includes('estimate') || prompt.includes('duration')) {
        if (prompt.includes('complex') || prompt.includes('large') || prompt.length > 500) {
          response = loadFixture('claude', 'estimate-large-task');
        } else {
          response = loadFixture('claude', 'estimate-small-task');
        }
      } else if (prompt.includes('plan') || prompt.includes('schedule') || prompt.includes('daily')) {
        response = loadFixture('claude', 'daily-plan');
      } else if (prompt.includes('breakdown') || prompt.includes('subtask')) {
        response = loadFixture('claude', 'breakdown-task');
      } else if (prompt.includes('insight') || prompt.includes('analyze') || prompt.includes('productivity')) {
        response = loadFixture('claude', 'insights');
      } else {
        response = { message: 'Mock response for unmatched prompt' };
      }

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
              text: JSON.stringify(response),
            },
          ],
          model: 'claude-sonnet-4-20250514',
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
 * Tear down all mock interceptors
 */
export function teardownMocks(): void {
  nock.cleanAll();
  nock.enableNetConnect();
  console.log('[MockBootstrap] Mock interceptors disabled');
}

#!/usr/bin/env tsx
/**
 * Fixture Recording Utility
 * 
 * Records real API responses from Todoist and Anthropic to update test fixtures.
 * This ensures mock fixtures stay in sync with real API behavior.
 * 
 * Usage:
 *   pnpm test:step-ci:record
 *   # or
 *   tsx scripts/record-fixtures.ts [--todoist] [--claude] [--all]
 * 
 * Environment variables required:
 *   - TODOIST_API_KEY: Your Todoist API key
 *   - ANTHROPIC_API_KEY: Your Anthropic API key (for Claude fixtures)
 * 
 * @module scripts/record-fixtures
 */

import 'dotenv/config';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import axios from 'axios';

// Configuration
const FIXTURES_DIR = join(__dirname, '..', 'test', 'mocks', 'fixtures');
const TODOIST_REST_BASE = 'https://api.todoist.com';
const TODOIST_SYNC_BASE = 'https://todoist.com';
const ANTHROPIC_BASE = 'https://api.anthropic.com';

// API Keys
const TODOIST_API_KEY = process.env.TODOIST_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

interface RecordingResult {
  fixture: string;
  success: boolean;
  error?: string;
}

/**
 * Save a fixture to disk
 */
function saveFixture(category: string, name: string, data: any, metadata: any = {}): void {
  const dir = join(FIXTURES_DIR, category);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const fixture = {
    description: metadata.description || `Recorded ${category} API response for ${name}`,
    endpoint: metadata.endpoint || 'unknown',
    recorded_at: new Date().toISOString(),
    response: data,
  };

  const filePath = join(dir, `${name}.json`);
  writeFileSync(filePath, JSON.stringify(fixture, null, 2) + '\n');
  console.log(`✓ Saved ${filePath}`);
}

/**
 * Record Todoist API fixtures
 */
async function recordTodoistFixtures(): Promise<RecordingResult[]> {
  if (!TODOIST_API_KEY) {
    console.error('❌ TODOIST_API_KEY not set - skipping Todoist fixtures');
    return [{ fixture: 'todoist/*', success: false, error: 'API key not set' }];
  }

  const results: RecordingResult[] = [];
  const headers = { Authorization: `Bearer ${TODOIST_API_KEY}` };

  console.log('\n📡 Recording Todoist API fixtures...\n');

  try {
    // 1. Tasks list
    console.log('  Recording tasks-list...');
    const tasksResponse = await axios.get(`${TODOIST_REST_BASE}/rest/v2/tasks`, { headers });
    // Limit to first 10 tasks to keep fixtures manageable
    const tasks = tasksResponse.data.slice(0, 10);
    saveFixture('todoist', 'tasks-list', tasks, {
      description: 'Todoist API response for listing tasks (first 10)',
      endpoint: 'GET /rest/v2/tasks',
    });
    results.push({ fixture: 'todoist/tasks-list', success: true });

    // 2. Single task (use first task if available)
    if (tasks.length > 0) {
      console.log('  Recording task-single...');
      const taskResponse = await axios.get(`${TODOIST_REST_BASE}/rest/v2/tasks/${tasks[0].id}`, { headers });
      saveFixture('todoist', 'task-single', taskResponse.data, {
        description: 'Todoist API response for getting a single task',
        endpoint: `GET /rest/v2/tasks/${tasks[0].id}`,
      });
      results.push({ fixture: 'todoist/task-single', success: true });
    }

    // 3. Projects list
    console.log('  Recording projects-list...');
    const projectsResponse = await axios.get(`${TODOIST_REST_BASE}/rest/v2/projects`, { headers });
    saveFixture('todoist', 'projects-list', projectsResponse.data, {
      description: 'Todoist API response for listing projects',
      endpoint: 'GET /rest/v2/projects',
    });
    results.push({ fixture: 'todoist/projects-list', success: true });

    // 4. Labels list
    console.log('  Recording labels-list...');
    const labelsResponse = await axios.get(`${TODOIST_REST_BASE}/rest/v2/labels`, { headers });
    saveFixture('todoist', 'labels-list', labelsResponse.data, {
      description: 'Todoist API response for listing labels',
      endpoint: 'GET /rest/v2/labels',
    });
    results.push({ fixture: 'todoist/labels-list', success: true });

    // 5. Sync API response
    console.log('  Recording sync-response...');
    const syncResponse = await axios.post(
      `${TODOIST_SYNC_BASE}/sync/v9/sync`,
      {
        sync_token: '*',
        resource_types: ['items', 'projects', 'labels', 'notes'],
      },
      { headers },
    );
    // Limit items for fixture size
    const syncData = {
      ...syncResponse.data,
      items: syncResponse.data.items?.slice(0, 10) || [],
      notes: syncResponse.data.notes?.slice(0, 5) || [],
    };
    saveFixture('todoist', 'sync-response', syncData, {
      description: 'Todoist Sync API response (truncated)',
      endpoint: 'POST /sync/v9/sync',
    });
    results.push({ fixture: 'todoist/sync-response', success: true });

    // 6. Create task (we'll create and immediately delete)
    console.log('  Recording create-task...');
    const createResponse = await axios.post(
      `${TODOIST_REST_BASE}/rest/v2/tasks`,
      {
        content: '[TEST] Fixture recording task - will be deleted',
        description: 'Created by fixture recording script',
        priority: 1,
      },
      { headers, headers: { ...headers, 'Content-Type': 'application/json' } },
    );
    saveFixture('todoist', 'create-task', createResponse.data, {
      description: 'Todoist API response for creating a task',
      endpoint: 'POST /rest/v2/tasks',
    });
    results.push({ fixture: 'todoist/create-task', success: true });

    // Clean up: delete the test task
    console.log('  Cleaning up test task...');
    await axios.delete(`${TODOIST_REST_BASE}/rest/v2/tasks/${createResponse.data.id}`, { headers });

  } catch (error: any) {
    console.error(`  ❌ Error recording Todoist fixtures: ${error.message}`);
    results.push({ fixture: 'todoist/*', success: false, error: error.message });
  }

  return results;
}

/**
 * Record Claude/Anthropic API fixtures
 */
async function recordClaudeFixtures(): Promise<RecordingResult[]> {
  if (!ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set - skipping Claude fixtures');
    return [{ fixture: 'claude/*', success: false, error: 'API key not set' }];
  }

  const results: RecordingResult[] = [];
  const headers = {
    'x-api-key': ANTHROPIC_API_KEY,
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };

  console.log('\n🤖 Recording Claude API fixtures...\n');

  // Define prompts to record for each fixture type
  const prompts: Array<{
    name: string;
    description: string;
    prompt: string;
  }> = [
    {
      name: 'classify-work-tasks',
      description: 'Claude response for classifying work-related tasks',
      prompt: `Classify this task into a category. Task: "Review pull request for authentication module"
        
        Return JSON with: { "category": "work|home|personal|health|finance|social|errands", "confidence": 0.0-1.0, "reasoning": "..." }`,
    },
    {
      name: 'classify-home-tasks',
      description: 'Claude response for classifying home-related tasks',
      prompt: `Classify this task into a category. Task: "Fix leaky bathroom faucet"
        
        Return JSON with: { "category": "work|home|personal|health|finance|social|errands", "confidence": 0.0-1.0, "reasoning": "..." }`,
    },
    {
      name: 'prioritize-response',
      description: 'Claude response for prioritizing tasks',
      prompt: `Prioritize these tasks by importance and urgency:
        1. Review pull request
        2. Fix bathroom faucet
        3. Buy groceries
        
        Return JSON with: { "prioritizedTasks": [{ "id": "...", "priority": 1-4, "reasoning": "..." }] }`,
    },
    {
      name: 'estimate-small-task',
      description: 'Claude response for estimating a small task',
      prompt: `Estimate time for this task: "Reply to email from John"
        
        Return JSON with: { "estimate": "X minutes/hours", "size": "XS|S|M|L|XL", "confidence": 0.0-1.0, "reasoning": "..." }`,
    },
    {
      name: 'estimate-large-task',
      description: 'Claude response for estimating a large task',
      prompt: `Estimate time for this complex task: "Refactor the entire authentication system to use OAuth2 with multiple providers, including Google, GitHub, and custom SAML integration. Must maintain backward compatibility and include comprehensive tests."
        
        Return JSON with: { "estimate": "X hours/days", "size": "XS|S|M|L|XL", "confidence": 0.0-1.0, "reasoning": "...", "breakdown": [...] }`,
    },
    {
      name: 'daily-plan',
      description: 'Claude response for generating a daily plan',
      prompt: `Create a daily schedule for these tasks:
        - Review PR (high priority, 30 min)
        - Team standup (fixed at 10am, 15 min)
        - Write documentation (medium priority, 2 hours)
        
        Return JSON with: { "schedule": [{ "task": "...", "startTime": "...", "duration": "..." }], "summary": "...", "notes": "..." }`,
    },
    {
      name: 'breakdown-task',
      description: 'Claude response for breaking down a complex task',
      prompt: `Break down this task into subtasks: "Build user authentication system"
        
        Return JSON with: { "subtasks": [{ "title": "...", "estimate": "...", "dependencies": [...] }], "totalEstimate": "..." }`,
    },
    {
      name: 'insights',
      description: 'Claude response for productivity insights',
      prompt: `Analyze this productivity data and provide insights:
        - 45 tasks completed last week
        - Average completion time: 2.3 hours
        - Most productive day: Tuesday
        - Most common category: work (60%)
        
        Return JSON with: { "insights": [{ "type": "pattern|recommendation|warning", "description": "..." }], "recommendations": [...] }`,
    },
  ];

  for (const { name, description, prompt } of prompts) {
    try {
      console.log(`  Recording ${name}...`);
      const response = await axios.post(
        `${ANTHROPIC_BASE}/v1/messages`,
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        },
        { headers },
      );

      // Extract the text content from Claude's response
      const textContent = response.data.content.find((c: any) => c.type === 'text');
      let parsedResponse: any;
      
      try {
        // Try to parse as JSON (Claude should return JSON based on our prompts)
        parsedResponse = JSON.parse(textContent?.text || '{}');
      } catch {
        // If not valid JSON, wrap the text
        parsedResponse = { response: textContent?.text };
      }

      saveFixture('claude', name, parsedResponse, {
        description,
        endpoint: 'POST /v1/messages',
      });
      results.push({ fixture: `claude/${name}`, success: true });

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error: any) {
      console.error(`  ❌ Error recording ${name}: ${error.message}`);
      results.push({ fixture: `claude/${name}`, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const recordTodoist = args.includes('--todoist') || args.includes('--all') || args.length === 0;
  const recordClaude = args.includes('--claude') || args.includes('--all') || args.length === 0;

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           Fixture Recording Utility                        ║');
  console.log('║                                                            ║');
  console.log('║  Records real API responses to keep test fixtures in sync  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const allResults: RecordingResult[] = [];

  if (recordTodoist) {
    const todoistResults = await recordTodoistFixtures();
    allResults.push(...todoistResults);
  }

  if (recordClaude) {
    const claudeResults = await recordClaudeFixtures();
    allResults.push(...claudeResults);
  }

  // Summary
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('                        Summary');
  console.log('════════════════════════════════════════════════════════════\n');

  const successful = allResults.filter((r) => r.success);
  const failed = allResults.filter((r) => !r.success);

  console.log(`✓ ${successful.length} fixtures recorded successfully`);
  if (failed.length > 0) {
    console.log(`✗ ${failed.length} fixtures failed:`);
    for (const f of failed) {
      console.log(`  - ${f.fixture}: ${f.error}`);
    }
  }

  console.log('\n💡 Next steps:');
  console.log('   1. Review the updated fixtures in test/mocks/fixtures/');
  console.log('   2. Run tests to ensure they still pass: pnpm test');
  console.log('   3. Run step-ci with mocks: pnpm test:step-ci:mock');
  console.log('   4. Commit the updated fixtures if all tests pass');
  console.log('');

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

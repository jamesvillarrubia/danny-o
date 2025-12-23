/**
 * Vitest Setup File
 * 
 * Global setup for all tests.
 */

import { beforeAll, afterAll } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_TYPE = 'pglite';
process.env.PGLITE_PATH = './data/test.db';

// Mock environment variables if not set
if (!process.env.TODOIST_API_KEY) {
  process.env.TODOIST_API_KEY = 'test-api-key';
}

if (!process.env.CLAUDE_API_KEY) {
  process.env.CLAUDE_API_KEY = 'test-claude-key';
}

beforeAll(() => {
  // Global setup
});

afterAll(() => {
  // Global cleanup
});


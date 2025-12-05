/**
 * Mock Fixtures Index
 * 
 * Exports all fixture data for use in tests and mock servers.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = __dirname;

/**
 * Load a JSON fixture file
 */
function loadFixture<T>(category: string, name: string): T {
  const filePath = join(fixturesDir, category, `${name}.json`);
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

// Claude API Fixtures
export const claudeFixtures = {
  classifyWorkTasks: () => loadFixture<any>('claude', 'classify-work-tasks'),
  classifyHomeTasks: () => loadFixture<any>('claude', 'classify-home-tasks'),
  prioritize: () => loadFixture<any>('claude', 'prioritize-response'),
  estimateSmall: () => loadFixture<any>('claude', 'estimate-small-task'),
  estimateLarge: () => loadFixture<any>('claude', 'estimate-large-task'),
  dailyPlan: () => loadFixture<any>('claude', 'daily-plan'),
  breakdown: () => loadFixture<any>('claude', 'breakdown-task'),
  insights: () => loadFixture<any>('claude', 'insights'),
};

// Todoist API Fixtures
export const todoistFixtures = {
  tasksList: () => loadFixture<any>('todoist', 'tasks-list'),
  taskSingle: () => loadFixture<any>('todoist', 'task-single'),
  projectsList: () => loadFixture<any>('todoist', 'projects-list'),
  labelsList: () => loadFixture<any>('todoist', 'labels-list'),
  syncResponse: () => loadFixture<any>('todoist', 'sync-response'),
  createTask: () => loadFixture<any>('todoist', 'create-task'),
};

/**
 * Get fixture response (extracts the 'response' field if present)
 */
export function getFixtureResponse<T>(fixture: any): T {
  return fixture.response || fixture;
}

/**
 * Load all fixtures for a category
 */
export function loadAllFixtures(category: 'claude' | 'todoist'): Record<string, any> {
  const fixtures = category === 'claude' ? claudeFixtures : todoistFixtures;
  const result: Record<string, any> = {};
  
  for (const [key, loader] of Object.entries(fixtures)) {
    try {
      result[key] = (loader as () => any)();
    } catch (error) {
      console.warn(`Failed to load fixture ${category}/${key}:`, error);
    }
  }
  
  return result;
}


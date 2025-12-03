/**
 * Todoist AI Task Manager - Main Entry Point
 * 
 * This module exports the core components for programmatic use
 * and provides a simple interface for initializing the system.
 */

import dotenv from 'dotenv';
import { createStorage } from './storage/factory.js';
import { TodoistClient } from './todoist/client.js';
import { SyncEngine } from './todoist/sync.js';
import { TaskEnrichment } from './todoist/enrichment.js';
import { AIAgent } from './ai/agent.js';
import { AIOperations } from './ai/operations.js';
import { LearningSystem } from './ai/learning.js';

// Load environment variables
dotenv.config();

/**
 * Initialize the task management system
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Initialized system components
 */
export async function initialize(options = {}) {
  console.log('[System] Initializing Todoist AI Task Manager...');

  // Storage
  const storage = await createStorage(options.storage);
  console.log('[System] ✓ Storage initialized');

  // Todoist client
  const todoistApiKey = options.todoistApiKey || process.env.TODOIST_API_KEY;
  if (!todoistApiKey) {
    throw new Error('TODOIST_API_KEY is required');
  }
  const todoist = new TodoistClient(todoistApiKey);
  console.log('[System] ✓ Todoist client initialized');

  // Sync engine
  const sync = new SyncEngine(todoist, storage, {
    intervalMs: options.syncInterval || parseInt(process.env.SYNC_INTERVAL) || 300000
  });
  console.log('[System] ✓ Sync engine initialized');

  // Task enrichment
  const enrichment = new TaskEnrichment(storage);
  console.log('[System] ✓ Task enrichment initialized');

  // AI components (optional)
  let aiAgent = null;
  let aiOps = null;
  let learning = null;

  const claudeApiKey = options.claudeApiKey || process.env.CLAUDE_API_KEY;
  if (claudeApiKey) {
    aiAgent = new AIAgent(claudeApiKey);
    aiOps = new AIOperations(aiAgent, storage);
    learning = new LearningSystem(storage);
    console.log('[System] ✓ AI components initialized');
  } else {
    console.log('[System] ⚠ AI components skipped (no Claude API key)');
  }

  console.log('[System] ✅ System ready\n');

  return {
    storage,
    todoist,
    sync,
    enrichment,
    aiAgent,
    aiOps,
    learning,
    
    /**
     * Cleanup and close connections
     */
    async close() {
      sync.stop();
      await storage.close();
      console.log('[System] Closed');
    }
  };
}

// Export components for direct use
export { createStorage } from './storage/factory.js';
export { TodoistClient } from './todoist/client.js';
export { SyncEngine } from './todoist/sync.js';
export { TaskEnrichment, LIFE_AREAS, TASK_SIZES, ENERGY_LEVELS } from './todoist/enrichment.js';
export { AIAgent } from './ai/agent.js';
export { AIOperations } from './ai/operations.js';
export { LearningSystem } from './ai/learning.js';

/**
 * Quick start example (if run directly)
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      const system = await initialize();

      // Example: Sync and list tasks
      console.log('Running example sync...');
      const syncResult = await system.sync.syncNow();
      console.log(`Synced ${syncResult.tasks} tasks\n`);

      // Example: Get unclassified tasks
      const unclassified = await system.enrichment.getUnclassifiedTasks();
      console.log(`Found ${unclassified.length} unclassified tasks\n`);

      // Example: Get stats
      const stats = await system.enrichment.getEnrichmentStats();
      console.log('Stats:', stats);

      await system.close();
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  })();
}


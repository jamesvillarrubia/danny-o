#!/usr/bin/env node

/**
 * Task Management CLI
 * 
 * Command-line interface for the AI-powered Todoist task manager.
 * Provides commands for syncing, viewing, classifying, prioritizing,
 * and managing tasks with AI assistance.
 * 
 * Usage:
 *   tasks sync                    # Sync with Todoist
 *   tasks list                    # List all tasks
 *   tasks classify --all          # AI classify all tasks
 *   tasks prioritize              # AI prioritize tasks
 *   tasks plan today              # Get AI daily plan
 */

import { Command } from 'commander';
import dotenv from 'dotenv';
import { createStorage } from '../storage/factory.js';
import { TodoistClient } from '../todoist/client.js';
import { SyncEngine } from '../todoist/sync.js';
import { TaskEnrichment, LIFE_AREAS } from '../todoist/enrichment.js';
import { AIAgent } from '../ai/agent.js';
import { AIOperations } from '../ai/operations.js';
import { LearningSystem } from '../ai/learning.js';

// Load environment variables
dotenv.config();

const program = new Command();

// Global state (initialized lazily)
let storage = null;
let todoist = null;
let sync = null;
let enrichment = null;
let aiAgent = null;
let aiOps = null;
let learning = null;

// ==================== Helper Functions ====================

/**
 * Classify and enrich tasks in idempotent batches
 * Each batch is fully processed (classified + enriched) before moving to the next
 * This allows safe interruption - completed batches won't be reprocessed
 */
async function classifyAndEnrichBatches(tasks, aiOps, enrichment, debugMode = false) {
  const batchSize = 10; // Process 10 tasks at a time
  let totalProcessed = 0;

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(tasks.length / batchSize);

    console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} tasks)`);

    try {
      // Step 1: Classify this batch
      const results = await aiOps.classifyTasks(batch);

      if (debugMode) {
        console.log('📊 Classification Results:\n');
      }

      // Step 2: Immediately enrich each result
      for (const result of results) {
        try {
          await enrichment.enrichTask(result.taskId, {
            category: result.category,
            labels: result.labels,
            aiConfidence: result.confidence,
            aiReasoning: result.reasoning
          });

          const task = batch.find(t => t.id === result.taskId);
          console.log(`✅ ${task.content}`);
          console.log(`   Project: ${result.category}`);
          if (result.labels && result.labels.length > 0) {
            console.log(`   Labels: ${result.labels.join(', ')}`);
          }
          if (result.suggestedLabels && result.suggestedLabels.length > 0) {
            console.log(`   💡 Suggested new labels: ${result.suggestedLabels.map(l => l.name).join(', ')} (needs approval)`);
          }
          console.log(`   Confidence: ${Math.round((result.confidence || 0) * 100)}%`);
          if (result.reasoning) {
            console.log(`   ${result.reasoning}`);
          }
          console.log('');

          totalProcessed++;
        } catch (error) {
          const task = batch.find(t => t.id === result.taskId);
          console.error(`❌ Failed to enrich task: ${task?.content || result.taskId}`);
          console.error(`   Error: ${error.message}`);
        }
      }

      console.log(`✓ Batch ${batchNum} complete: ${results.length}/${batch.length} tasks enriched`);

    } catch (error) {
      console.error(`❌ Batch ${batchNum} failed:`, error.message);
      // Continue with next batch
    }
  }

  return totalProcessed;
}

// ==================== Initialization ====================

async function initializeServices() {
  if (storage) return; // Already initialized

  try {
    // Storage
    storage = await createStorage();

    // Todoist
    const todoistApiKey = process.env.TODOIST_API_KEY;
    if (!todoistApiKey) {
      throw new Error('TODOIST_API_KEY not found in environment variables');
    }
    todoist = new TodoistClient(todoistApiKey);

    // Sync engine
    sync = new SyncEngine(todoist, storage, {
      intervalMs: parseInt(process.env.SYNC_INTERVAL) || 300000
    });

    // Enrichment
    enrichment = new TaskEnrichment(storage, todoist);

  // AI (optional for some commands)
  const claudeApiKey = process.env.CLAUDE_API_KEY;
  if (claudeApiKey) {
    const aiOptions = {};
    if (process.env.CLAUDE_MODEL) {
      aiOptions.model = process.env.CLAUDE_MODEL;
    }
    aiAgent = new AIAgent(claudeApiKey, aiOptions);
    aiOps = new AIOperations(aiAgent, storage);
    learning = new LearningSystem(storage);
  }

  } catch (error) {
    console.error('❌ Initialization failed:', error.message);
    process.exit(1);
  }
}

async function cleanup() {
  if (storage) {
    await storage.close();
  }
}

// ==================== CLI Commands ====================

program
  .name('tasks')
  .description('AI-powered task management for Todoist')
  .version('1.0.0');

// Sync command
program
  .command('sync')
  .description('Sync tasks with Todoist')
  .option('--full', 'Force full resync')
  .action(async (options) => {
    await initializeServices();

    console.log('🔄 Syncing with Todoist...\n');

    const result = options.full
      ? await sync.fullResync()
      : await sync.syncNow();

    if (result.success) {
      console.log(`\n✅ Sync complete!`);
      console.log(`   Tasks: ${result.tasks}`);
      console.log(`   Projects: ${result.projects}`);
      console.log(`   Labels: ${result.labels}`);
      if (result.newTasks > 0) {
        console.log(`   New tasks: ${result.newTasks}`);
      }
    } else {
      console.error(`\n❌ Sync failed: ${result.error}`);
      process.exit(1);
    }

    await cleanup();
  });

// List command
program
  .command('list')
  .description('List tasks')
  .option('-c, --category <category>', 'Filter by category')
  .option('-p, --priority <priority>', 'Filter by priority (1-4)')
  .option('-l, --limit <limit>', 'Limit number of results', '50')
  .action(async (options) => {
    await initializeServices();

    const filters = {
      completed: false,
      limit: parseInt(options.limit)
    };

    if (options.category) filters.category = options.category;
    if (options.priority) filters.priority = parseInt(options.priority);

    const tasks = await storage.getTasks(filters);

    console.log(`\n📋 Tasks (${tasks.length})\n`);

    if (tasks.length === 0) {
      console.log('No tasks found.');
    } else {
      for (const task of tasks) {
        const priority = ['🔴', '🟠', '🟡', '⚪'][task.priority - 1] || '⚪';
        const category = task.metadata?.category || 'unclassified';
        const timeEst = task.metadata?.timeEstimate || 'no estimate';

        console.log(`${priority} ${task.content}`);
        console.log(`   📁 ${category} | ⏱️  ${timeEst}`);
        if (task.due) {
          console.log(`   📅 Due: ${task.due.string || task.due.date}`);
        }
        console.log();
      }
    }

    await cleanup();
  });

// Inbox command (unclassified tasks)
program
  .command('inbox')
  .description('Show unclassified tasks (excludes manual classifications)')
  .action(async () => {
    await initializeServices();

    const tasks = await enrichment.getUnclassifiedTasks({ force: false });

    console.log(`\n📥 Unclassified Tasks (${tasks.length})\n`);

    if (tasks.length === 0) {
      console.log('✅ All tasks are classified!');
    } else {
      for (const task of tasks) {
        console.log(`• ${task.content}`);
        if (task.description) {
          console.log(`  ${task.description}`);
        }
        console.log();
      }

      console.log(`💡 Run 'tasks classify --all' to classify these tasks.`);
    }

    await cleanup();
  });

// Classify command
program
  .command('classify')
  .description('Classify tasks using AI and move to correct projects')
  .argument('[taskId]', 'Task ID to classify (optional)')
  .option('-a, --all', 'Classify all unclassified tasks')
  .option('--debug', 'Debug mode: classify only 5 tasks with verbose output')
  .option('--limit <number>', 'Classify first N unclassified tasks (can be used alone)')
  .option('--force', 'Force reclassify ALL tasks, even ones already classified')
  .option('--show-conflicts', 'Show tasks where AI recommendation differs from current project')
  .action(async (taskId, options) => {
    await initializeServices();

    // Handle --show-conflicts flag
    if (options.showConflicts) {
      const { TaskReconciler } = await import('../todoist/reconciliation.js');
      const reconciler = new TaskReconciler();
      await reconciler.initialize();

      const allTasks = await storage.getTasks({ completed: false });
      const projects = await storage.getProjects();
      
      const conflicts = reconciler.findConflicts(allTasks, projects);

      if (conflicts.length === 0) {
        console.log('✅ No conflicts found! All tasks match their AI recommendations.');
        await cleanup();
        return;
      }

      console.log(`⚠️  Found ${conflicts.length} conflicts:\n`);
      
      for (const conflict of conflicts) {
        console.log(`📋 ${conflict.content}`);
        console.log(`   Current:     ${conflict.currentProject} (${conflict.currentCategory || 'none'})`);
        console.log(`   AI suggests: ${conflict.recommendedProject} (${conflict.recommendedCategory})`);
        console.log(`   Classified:  ${new Date(conflict.classifiedAt).toLocaleString()}`);
        console.log(`   Last moved:  ${new Date(conflict.todoistUpdatedAt).toLocaleString()}`);
        console.log('');
      }

      await cleanup();
      return;
    }

    if (!aiOps) {
      console.error('❌ AI operations require CLAUDE_API_KEY in environment');
      process.exit(1);
    }

    const debugMode = options.debug;
    const limit = debugMode ? 5 : (options.limit ? parseInt(options.limit) : 0);

    if (debugMode) {
      console.log('🔍 DEBUG MODE: Processing 5 tasks with verbose output\n');
    } else {
      console.log('🤖 Classifying tasks with AI...\n');
    }

    if (options.all || debugMode || options.limit || options.force) {
      // Get tasks: force mode gets ALL incomplete tasks (including manual), normal mode skips manual
      const allTasks = await enrichment.getUnclassifiedTasks({ force: options.force || false });
      
      if (options.force) {
        console.log('⚠️  FORCE MODE: Reclassifying ALL incomplete tasks (including manual)\n');
      }
      
      if (allTasks.length === 0) {
        console.log('✅ No tasks need classification!');
        await cleanup();
        return;
      }

      const tasks = limit > 0 ? allTasks.slice(0, limit) : allTasks;

      if (options.force) {
        console.log(`Found ${allTasks.length} incomplete tasks (FORCE mode)`);
      } else {
        console.log(`Found ${allTasks.length} unclassified tasks`);
      }
      
      if (limit > 0) {
        console.log(`Processing first ${tasks.length} tasks\n`);
      } else {
        console.log('');
      }

      if (debugMode) {
        console.log('📋 Tasks to classify:\n');
        tasks.forEach((task, i) => {
          console.log(`${i + 1}. [${task.id}] ${task.content}`);
          if (task.description) {
            const desc = task.description.substring(0, 80);
            console.log(`   ${desc}${task.description.length > 80 ? '...' : ''}`);
          }
        });
        console.log('');
      }

      // Process in idempotent batches: classify + enrich immediately
      const processedCount = await classifyAndEnrichBatches(tasks, aiOps, enrichment, debugMode);

      console.log(`\n✅ Successfully classified ${processedCount}/${tasks.length} tasks`);
      
      if (limit > 0 && allTasks.length > limit) {
        console.log(`💡 ${allTasks.length - limit} tasks remaining`);
      } else if (allTasks.length > tasks.length) {
        console.log(`💡 ${allTasks.length - tasks.length} tasks remaining`);
      }

    } else if (taskId) {
      const task = await storage.getTask(taskId);
      
      if (!task) {
        console.error(`❌ Task ${taskId} not found`);
        process.exit(1);
      }

      const result = await aiOps.classifyTask(task);

      await enrichment.enrichTask(result.taskId, {
        category: result.category,
        aiConfidence: result.confidence,
        aiReasoning: result.reasoning
      });

      console.log(`✅ ${task.content}`);
      console.log(`   → ${result.category} (${Math.round(result.confidence * 100)}% confident)`);
      console.log(`   ${result.reasoning}`);

    } else if (limit > 0) {
      // Allow --limit without --all to classify first N unclassified tasks
      const allTasks = await enrichment.getUnclassifiedTasks({ force: false });
      
      if (allTasks.length === 0) {
        console.log('✅ All tasks are already classified!');
        await cleanup();
        return;
      }

      const tasksToClassify = allTasks.slice(0, limit);
      console.log(`🔍 Found ${allTasks.length} unclassified tasks, processing ${tasksToClassify.length}...\n`);

      await aiOps.classifyTasks(tasksToClassify);
      
      if (allTasks.length > limit) {
        console.log(`💡 ${allTasks.length - limit} tasks remaining`);
      }

    } else {
      console.error('❌ Specify a task ID, --all flag, or --limit N');
      process.exit(1);
    }

    await cleanup();
  });

// Estimate command
program
  .command('estimate <taskId>')
  .description('Get AI time estimate for a task')
  .action(async (taskId) => {
    await initializeServices();

    if (!aiOps) {
      console.error('❌ AI operations require CLAUDE_API_KEY in environment');
      process.exit(1);
    }

    const task = await storage.getTask(taskId);
    
    if (!task) {
      console.error(`❌ Task ${taskId} not found`);
      process.exit(1);
    }

    console.log('🤖 Estimating time with AI...\n');

    const result = await aiOps.estimateTaskDuration(task);

    await enrichment.enrichTask(result.taskId, {
      timeEstimate: result.timeEstimate,
      size: result.size,
      aiConfidence: result.confidence,
      aiReasoning: result.reasoning
    });

    console.log(`⏱️  ${task.content}`);
    console.log(`   Time: ${result.timeEstimate} (Size: ${result.size})`);
    console.log(`   ${result.reasoning}`);

    await cleanup();
  });

// Prioritize command
program
  .command('prioritize')
  .description('Get AI prioritization of tasks')
  .option('-c, --category <category>', 'Filter by category')
  .option('-l, --limit <limit>', 'Number of tasks to prioritize', '20')
  .action(async (options) => {
    await initializeServices();

    if (!aiOps) {
      console.error('❌ AI operations require CLAUDE_API_KEY in environment');
      process.exit(1);
    }

    const filters = {
      completed: false,
      limit: parseInt(options.limit)
    };

    if (options.category) filters.category = options.category;

    const tasks = await storage.getTasks(filters);

    if (tasks.length === 0) {
      console.log('No tasks to prioritize.');
      await cleanup();
      return;
    }

    console.log(`🤖 Prioritizing ${tasks.length} tasks with AI...\n`);

    const result = await aiOps.prioritizeTasks(tasks);

    console.log('📊 Prioritized Tasks:\n');

    for (const item of result.prioritized) {
      const priorityIcon = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '⚪'
      }[item.priority] || '⚪';

      console.log(`${priorityIcon} ${item.task.content}`);
      console.log(`   ${item.reasoning}\n`);
    }

    if (result.recommendations.startWith) {
      console.log(`\n💡 Start with: ${result.recommendations.startWith}`);
    }

    if (result.recommendations.defer && result.recommendations.defer.length > 0) {
      console.log(`\n⏸️  Consider deferring: ${result.recommendations.defer.join(', ')}`);
    }

    if (result.recommendations.delegate && result.recommendations.delegate.length > 0) {
      console.log(`\n👥 Consider delegating: ${result.recommendations.delegate.join(', ')}`);
    }

    await cleanup();
  });

// Breakdown command
program
  .command('breakdown <taskId>')
  .description('Break down a task into subtasks')
  .action(async (taskId) => {
    await initializeServices();

    if (!aiOps) {
      console.error('❌ AI operations require CLAUDE_API_KEY in environment');
      process.exit(1);
    }

    const task = await storage.getTask(taskId);
    
    if (!task) {
      console.error(`❌ Task ${taskId} not found`);
      process.exit(1);
    }

    console.log('🤖 Breaking down task with AI...\n');

    const result = await aiOps.createSubtasks(task);

    console.log(`📝 ${task.content}\n`);
    console.log(`Subtasks (${result.subtasks.length}):\n`);

    for (const subtask of result.subtasks) {
      console.log(`${subtask.order}. ${subtask.content}`);
      console.log(`   ⏱️  ${subtask.timeEstimate}`);
      if (subtask.needsSupplies && subtask.supplies.length > 0) {
        console.log(`   🛒 Needs: ${subtask.supplies.join(', ')}`);
      }
      console.log();
    }

    console.log(`Total estimate: ${result.totalEstimate}\n`);

    if (result.supplyList && result.supplyList.length > 0) {
      console.log(`🛒 Shopping list: ${result.supplyList.join(', ')}\n`);
    }

    if (result.notes) {
      console.log(`📌 Notes: ${result.notes}`);
    }

    await cleanup();
  });

// Plan command
program
  .command('plan <timeframe>')
  .description('Get AI daily/weekly plan (today or week)')
  .action(async (timeframe) => {
    await initializeServices();

    if (!aiOps) {
      console.error('❌ AI operations require CLAUDE_API_KEY in environment');
      process.exit(1);
    }

    if (timeframe !== 'today' && timeframe !== 'week') {
      console.error('❌ Timeframe must be "today" or "week"');
      process.exit(1);
    }

    const tasks = await storage.getTasks({ completed: false, limit: 100 });

    console.log(`🤖 Creating ${timeframe} plan with AI...\n`);

    const plan = await aiOps.suggestDailyPlan(tasks);

    console.log(`📅 Plan for ${timeframe}:\n`);

    if (timeframe === 'today' && plan.today.tasks.length > 0) {
      console.log(`Today (${plan.today.totalTime}):\n`);
      
      for (const item of plan.today.tasks) {
        console.log(`${item.scheduledTime.toUpperCase()}: ${item.task.content}`);
        console.log(`   ${item.reasoning}\n`);
      }
    }

    if (plan.thisWeek.tasks.length > 0) {
      console.log(`\n📆 This week (${plan.thisWeek.tasks.length} tasks):`);
      console.log(`   ${plan.thisWeek.reasoning}\n`);
    }

    if (plan.needsSupplies.tasks.length > 0) {
      console.log(`\n🛒 Supplies needed (${plan.needsSupplies.tasks.length} tasks):`);
      console.log(`   ${plan.needsSupplies.shoppingList.join(', ')}`);
      console.log(`   ${plan.needsSupplies.suggestion}\n`);
    }

    if (plan.delegateToSpouse.tasks.length > 0) {
      console.log(`\n👥 Can delegate (${plan.delegateToSpouse.tasks.length} tasks):`);
      for (const task of plan.delegateToSpouse.tasks) {
        console.log(`   • ${task.content}`);
      }
      console.log(`   ${plan.delegateToSpouse.reasoning}\n`);
    }

    if (plan.notes) {
      console.log(`\n💡 ${plan.notes}`);
    }

    await cleanup();
  });

// Complete command with fuzzy search
program
  .command('complete <taskIdOrSearch>')
  .description('Mark a task as complete (by ID or search text)')
  .option('-t, --time <minutes>', 'Actual time taken (minutes)')
  .option('-i, --interactive', 'Select from matching tasks interactively')
  .action(async (taskIdOrSearch, options) => {
    await initializeServices();

    let task = null;
    
    // Try exact ID match first
    task = await storage.getTask(taskIdOrSearch);
    
    // If not found by ID, try fuzzy search
    if (!task) {
      console.log(`🔍 Searching for tasks matching "${taskIdOrSearch}"...\n`);
      
      const allTasks = await storage.getTasks({ completed: false });
      const matches = allTasks.filter(t => 
        t.content.toLowerCase().includes(taskIdOrSearch.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(taskIdOrSearch.toLowerCase()))
      );
      
      if (matches.length === 0) {
        console.error(`❌ No tasks found matching "${taskIdOrSearch}"`);
        process.exit(1);
      }
      
      if (matches.length === 1) {
        task = matches[0];
        console.log(`✓ Found: ${task.content}\n`);
      } else {
        console.log(`Found ${matches.length} matching tasks:\n`);
        matches.forEach((t, i) => {
          const priority = t.priority ? `(P${t.priority})` : '';
          const category = t.category ? `{${t.category}}` : '{unclassified}';
          console.log(`${i + 1}. ${t.content} ${priority} ${category}`);
          console.log(`   ID: ${t.id}`);
        });
        
        if (options.interactive) {
          // TODO: Add interactive selection with readline
          console.log('\n💡 For now, please run with a specific task ID or more specific search term');
          process.exit(0);
        } else {
          console.log('\n💡 Multiple matches found. Use --interactive or be more specific:');
          console.log(`   pnpm run cli complete "${matches[0].content}"`);
          process.exit(0);
        }
      }
    }

    console.log(`✓ Completing: ${task.content}\n`);

    const metadata = {};
    if (options.time) {
      metadata.actualDuration = parseInt(options.time);
      console.log(`⏱️  Recorded time: ${options.time} minutes`);
    }

    await sync.completeTask(task.id, metadata);

    console.log('✅ Task completed and logged for learning!');

    await cleanup();
  });

// Show recent completions
program
  .command('completed')
  .description('Show recently completed tasks')
  .option('-l, --limit <number>', 'Number of tasks to show', '10')
  .action(async (options) => {
    await initializeServices();
    
    const history = await storage.getTaskHistory({ 
      action: 'complete',
      limit: parseInt(options.limit) 
    });
    
    if (history.length === 0) {
      console.log('No completed tasks yet.');
      return;
    }
    
    console.log(`📋 Recently Completed (${history.length}):\n`);
    
    for (const entry of history) {
      const date = new Date(entry.timestamp);
      const timeAgo = getTimeAgo(date);
      const duration = entry.details?.actualDuration 
        ? ` (${entry.details.actualDuration} min)` 
        : '';
      
      console.log(`✅ ${entry.task_content || 'Unknown task'}`);
      console.log(`   Completed: ${timeAgo}${duration}\n`);
    }
    
    await cleanup();
  });

// Completion stats
program
  .command('productivity')
  .description('Show productivity statistics')
  .option('-d, --days <number>', 'Number of days to analyze', '7')
  .action(async (options) => {
    await initializeServices();
    
    const days = parseInt(options.days);
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    const history = await storage.getTaskHistory({ 
      action: 'complete',
      since: since.toISOString()
    });
    
    console.log(`📊 Productivity Stats (Last ${days} days):\n`);
    console.log(`Total completed: ${history.length} tasks`);
    
    if (history.length > 0) {
      // Calculate averages
      const withTime = history.filter(h => h.details?.actualDuration);
      if (withTime.length > 0) {
        const avgTime = withTime.reduce((sum, h) => sum + h.details.actualDuration, 0) / withTime.length;
        console.log(`Average time: ${Math.round(avgTime)} minutes per task`);
        console.log(`Time tracked: ${withTime.length}/${history.length} tasks\n`);
      }
      
      // By category
      const byCategory = {};
      for (const entry of history) {
        const cat = entry.details?.category || 'unclassified';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
      }
      
      console.log('By category:');
      for (const [category, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${category}: ${count} tasks`);
      }
      
      // Daily breakdown
      const byDay = {};
      for (const entry of history) {
        const day = new Date(entry.timestamp).toLocaleDateString();
        byDay[day] = (byDay[day] || 0) + 1;
      }
      
      console.log('\nDaily breakdown:');
      for (const [day, count] of Object.entries(byDay).sort()) {
        const bar = '█'.repeat(Math.min(count, 20));
        console.log(`  ${day}: ${bar} ${count}`);
      }
    }
    
    await cleanup();
  });

// Helper function for time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return date.toLocaleDateString();
}

// Helper function to parse task list from various formats
function parseTaskList(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const tasks = [];
  
  for (const line of lines) {
    // Skip headers and empty lines
    if (line.startsWith('#')) continue;
    
    // Match various bullet/list formats:
    // - task
    // * task
    // + task
    // 1. task
    // [ ] task
    // [x] task (completed)
    const match = line.match(/^(?:[-*+•]|\d+\.|\[[ x]\])\s*(.+)$/);
    
    if (match) {
      const content = match[1].trim();
      const isCompleted = line.includes('[x]') || line.includes('[X]');
      
      if (content.length > 0) {
        tasks.push({ content, isCompleted });
      }
    } else if (!line.startsWith(' ') && !line.startsWith('\t')) {
      // Plain text line (not indented)
      tasks.push({ content: line, isCompleted: false });
    }
  }
  
  return tasks;
}

// Helper function to find similar existing tasks
async function findSimilarTask(content, existingTasks) {
  const contentLower = content.toLowerCase();
  const words = contentLower.split(/\s+/).filter(w => w.length > 3);
  
  for (const task of existingTasks) {
    const taskLower = task.content.toLowerCase();
    
    // Exact match
    if (taskLower === contentLower) {
      return { task, similarity: 1.0 };
    }
    
    // High similarity if most words match
    const matchingWords = words.filter(w => taskLower.includes(w));
    const similarity = matchingWords.length / words.length;
    
    if (similarity > 0.7) {
      return { task, similarity };
    }
  }
  
  return null;
}

// Search command
program
  .command('search <query>')
  .description('Search tasks using natural language')
  .action(async (query) => {
    await initializeServices();

    if (!aiOps) {
      console.error('❌ AI operations require CLAUDE_API_KEY in environment');
      process.exit(1);
    }

    const tasks = await storage.getTasks({ completed: false, limit: 100 });

    console.log(`🔍 Searching for: "${query}"\n`);

    const result = await aiOps.filterTasksByIntent(query, tasks);

    console.log(`Interpretation: ${result.interpretation}\n`);
    console.log(`Found ${result.matches.length} matches:\n`);

    for (const match of result.matches) {
      const relevance = Math.round(match.relevanceScore * 100);
      console.log(`[${relevance}%] ${match.task.content}`);
      console.log(`   ${match.reasoning}\n`);
    }

    await cleanup();
  });

// History command
program
  .command('history')
  .description('View completion history')
  .option('-c, --category <category>', 'Filter by category')
  .option('-l, --limit <limit>', 'Number of results', '20')
  .action(async (options) => {
    await initializeServices();

    const filters = { limit: parseInt(options.limit) };
    if (options.category) filters.category = options.category;

    const history = await storage.getTaskHistory(filters);

    console.log(`\n📜 Completion History (${history.length})\n`);

    for (const entry of history) {
      const date = entry.completedAt.toLocaleDateString();
      const time = entry.actualDuration ? `${entry.actualDuration}min` : 'unknown';
      
      console.log(`✅ ${entry.taskContent}`);
      console.log(`   📅 ${date} | ⏱️  ${time} | 📁 ${entry.category || 'none'}\n`);
    }

    await cleanup();
  });

// Insights command
program
  .command('insights')
  .description('Get AI insights about your productivity')
  .action(async () => {
    await initializeServices();

    if (!aiOps) {
      console.error('❌ AI operations require CLAUDE_API_KEY in environment');
      process.exit(1);
    }

    console.log('🤖 Analyzing your productivity patterns...\n');

    const insights = await aiOps.generateInsights();

    console.log('📊 Insights:\n');

    for (const pattern of insights.patterns) {
      console.log(`${pattern.observation}`);
      console.log(`   Category: ${pattern.category}`);
      console.log(`   ${pattern.significance}\n`);
    }

    if (insights.recommendations.length > 0) {
      console.log('\n💡 Recommendations:\n');
      
      for (const rec of insights.recommendations) {
        console.log(`• ${rec.suggestion}`);
        console.log(`  ${rec.reasoning}\n`);
      }
    }

    console.log(`\n📝 ${insights.summary}`);

    await cleanup();
  });

// Stats command
program
  .command('stats')
  .description('Show enrichment statistics')
  .action(async () => {
    await initializeServices();

    const stats = await enrichment.getEnrichmentStats();

    console.log('\n📊 Statistics:\n');
    console.log(`Total tasks: ${stats.total}`);
    console.log(`Classified: ${stats.classified} (${Math.round(stats.classified / stats.total * 100)}%)`);
    console.log(`Unclassified: ${stats.unclassified}`);
    console.log(`With time estimates: ${stats.withTimeEstimate}`);
    console.log(`With size: ${stats.withSize}\n`);

    console.log('By category:');
    for (const [category, count] of Object.entries(stats.byCategory)) {
      console.log(`  ${category}: ${count}`);
    }

    await cleanup();
  });

// Test available models
program.command('models')
  .description('Test which Claude models are available')
  .action(async () => {
    console.log('🔍 Testing Claude models...\n');
    
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
    
    const modelsToTest = [
      { name: 'claude-3-haiku-20240307', cost: '$0.25/MTok', desc: 'Haiku 3 (cheapest)' },
      { name: 'claude-3-5-haiku-20241022', cost: '$0.80/MTok', desc: 'Haiku 3.5' },
      { name: 'claude-3-5-sonnet-20241022', cost: '$3/MTok', desc: 'Sonnet 3.5' },
      { name: 'claude-3-opus-20240229', cost: '$15/MTok', desc: 'Opus 3' },
    ];

    for (const model of modelsToTest) {
      try {
        process.stdout.write(`Testing ${model.name}... `);
        await client.messages.create({
          model: model.name,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        });
        console.log(`✅ ${model.desc} (${model.cost}) - AVAILABLE`);
      } catch (error) {
        if (error.status === 404) {
          console.log(`❌ NOT AVAILABLE (model not found)`);
        } else {
          console.log(`⚠️  ERROR: ${error.message}`);
        }
      }
      // Rate limit: wait 1 second between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n💡 Set CLAUDE_MODEL in .env to use a specific model');
  });

// Process text command - agentic task processing
program
  .command('process-text')
  .description('Process raw text with AI (paste task lists, commands, natural language)')
  .option('-f, --file <path>', 'Read from file instead of stdin')
  .option('-t, --text <content>', 'Provide text directly')
  .action(async (options) => {
    await initializeServices();

    if (!aiAgent) {
      console.error('❌ This command requires CLAUDE_API_KEY');
      process.exit(1);
    }

    let inputText;

    if (options.text) {
      inputText = options.text;
    } else if (options.file) {
      const fs = await import('fs/promises');
      inputText = await fs.readFile(options.file, 'utf-8');
    } else {
      // Read from stdin
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      console.log('📝 Paste your task list (Ctrl+D when done):\n');
      
      const lines = [];
      for await (const line of rl) {
        lines.push(line);
      }
      inputText = lines.join('\n');
    }

    if (!inputText || inputText.trim().length === 0) {
      console.error('❌ No input provided');
      process.exit(1);
    }

    console.log('\n🤖 Processing with AI agent...\n');

    // Import and initialize task processor
    const { TaskProcessorAgent } = await import('../ai/task-processor.js');
    
    // Define tools the agent can use
    const tools = [
      {
        name: 'search_tasks',
        description: 'Search for existing tasks by content or description',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' }
          },
          required: ['query']
        },
        handler: async (args) => {
          const allTasks = await storage.getTasks({ completed: false });
          const matches = allTasks.filter(t =>
            t.content.toLowerCase().includes(args.query.toLowerCase()) ||
            (t.description && t.description.toLowerCase().includes(args.query.toLowerCase()))
          );
          return matches.map(t => ({
            id: t.id,
            content: t.content,
            description: t.description,
            category: t.category,
            priority: t.priority
          }));
        }
      },
      {
        name: 'create_task',
        description: 'Create a new task in Todoist',
        inputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Task content/title' },
            description: { type: 'string', description: 'Optional description' },
            priority: { type: 'number', description: 'Priority 1-4' }
          },
          required: ['content']
        },
        handler: async (args) => {
          const task = await todoist.createTask({
            content: args.content,
            description: args.description,
            priority: args.priority || 1
          });
          return { success: true, taskId: task.id, content: task.content };
        }
      },
      {
        name: 'update_task',
        description: 'Update an existing task',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID to update' },
            content: { type: 'string', description: 'New content' },
            description: { type: 'string', description: 'New description' },
            priority: { type: 'number', description: 'New priority' }
          },
          required: ['taskId']
        },
        handler: async (args) => {
          const updates = {};
          if (args.content) updates.content = args.content;
          if (args.description) updates.description = args.description;
          if (args.priority) updates.priority = args.priority;
          
          await todoist.updateTask(args.taskId, updates);
          return { success: true, taskId: args.taskId };
        }
      },
      {
        name: 'complete_task',
        description: 'Mark a task as complete',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID to complete' },
            actualMinutes: { type: 'number', description: 'Time taken in minutes' }
          },
          required: ['taskId']
        },
        handler: async (args) => {
          const metadata = {};
          if (args.actualMinutes) {
            metadata.actualDuration = args.actualMinutes;
          }
          await sync.completeTask(args.taskId, metadata);
          return { success: true, taskId: args.taskId };
        }
      },
      {
        name: 'list_tasks',
        description: 'List current incomplete tasks',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Max tasks to return', default: 20 }
          }
        },
        handler: async (args) => {
          const tasks = await storage.getTasks({ 
            completed: false, 
            limit: args.limit || 20 
          });
          return tasks.map(t => ({
            id: t.id,
            content: t.content,
            category: t.category,
            priority: t.priority
          }));
        }
      }
    ];

    const processor = new TaskProcessorAgent(aiAgent.client, tools);
    const result = await processor.processText(inputText);

    if (result.success) {
      console.log('✅ ' + result.message);
      console.log(`\n(Processed in ${result.turns} AI turn(s))`);
    } else {
      console.error('❌ ' + result.message);
      process.exit(1);
    }

    await cleanup();
  });

// Taxonomy inspection commands
program
  .command('taxonomy')
  .description('Inspect task taxonomy configuration')
  .option('--validate', 'Validate taxonomy structure')
  .option('--stats', 'Show taxonomy statistics')
  .option('--projects', 'List all projects')
  .option('--labels', 'List all labels')
  .option('--prompt', 'Show generated AI classification prompt')
  .option('--sync', 'Sync taxonomy to Todoist (create missing projects/labels)')
  .option('--sync-projects', 'Sync projects only')
  .option('--sync-labels', 'Sync labels only')
  .option('--update-colors', 'Update colors for existing projects')
  .option('--dry-run', 'Show what would be created without creating (use with --sync)')
  .action(async (options) => {
    const taxonomy = await import('../config/taxonomy-loader.js');

    // Validation
    if (options.validate) {
      console.log('🔍 Validating taxonomy...\n');
      const result = taxonomy.validateTaxonomy();
      if (result.valid) {
        console.log('✅ Taxonomy is valid!');
      } else {
        console.log('❌ Validation errors:');
        result.errors.forEach(err => console.log(`  - ${err}`));
        process.exit(1);
      }
      return;
    }

    // Stats
    if (options.stats) {
      const stats = taxonomy.getTaxonomyStats();
      console.log('📊 Taxonomy Statistics\n');
      console.log(`Version: ${stats.version}`);
      console.log(`Updated: ${stats.updated}`);
      console.log(`Projects: ${stats.projects}`);
      console.log(`Label Categories: ${stats.labelCategories}`);
      console.log(`Total Labels: ${stats.totalLabels}`);
      console.log(`  Active: ${stats.activeLabels}`);
      console.log(`  Archived: ${stats.archivedLabels}`);
      return;
    }

    // Projects
    if (options.projects) {
      const projects = taxonomy.getProjects();
      console.log('📁 Projects (Mutually Exclusive)\n');
      projects.forEach((p, i) => {
        console.log(`${i + 1}. ${p.name}`);
        console.log(`   ${p.description}`);
        if (p.examples && p.examples.length > 0) {
          console.log(`   Examples:`);
          p.examples.slice(0, 2).forEach(ex => console.log(`     - ${ex}`));
        }
        console.log('');
      });
      return;
    }

    // Labels
    if (options.labels) {
      const categories = taxonomy.getLabelsByCategory();
      console.log('🏷️  Labels (Multi-tag)\n');
      categories.forEach(cat => {
        console.log(`${cat.category}:`);
        cat.labels.forEach(label => {
          const status = label.status ? ` [${label.status}]` : '';
          console.log(`  - ${label.name}${status}`);
          console.log(`    ${label.description}`);
        });
        console.log('');
      });
      return;
    }

    // Prompt
    if (options.prompt) {
      const prompt = taxonomy.generateClassificationPrompt();
      console.log('🤖 AI Classification Prompt\n');
      console.log(prompt);
      return;
    }

    // Sync to Todoist
    if (options.sync || options.syncProjects || options.syncLabels || options.updateColors) {
      await initializeServices();
      const { loadTaxonomy } = await import('../config/taxonomy-loader.js');
      
      console.log('🔄 Syncing taxonomy to Todoist...\n');
      
      const taxonomyData = await loadTaxonomy();
      const syncProjects = options.sync || options.syncProjects;
      const syncLabels = options.sync || options.syncLabels;
      const updateColors = options.updateColors;
      const dryRun = options.dryRun || false;

      let created = { projects: 0, labels: 0 };
      let skipped = { projects: 0, labels: 0 };
      let updated = { projects: 0 };

      // Sync Projects
      if (syncProjects) {
        console.log('📁 Syncing Projects...\n');
        
        // Get existing projects from Todoist
        const existingProjects = await todoist.getProjects();
        const existingNames = new Set(existingProjects.map(p => p.name.toLowerCase()));
        
        for (const project of taxonomyData.projects) {
          if (existingNames.has(project.name.toLowerCase())) {
            console.log(`  ⏭️  ${project.name} - already exists`);
            skipped.projects++;
          } else {
            if (dryRun) {
              const colorTag = project.color ? ` [${project.color}]` : '';
              console.log(`  🔍 ${project.name}${colorTag} - would create`);
            } else {
              try {
                await todoist.api.addProject({
                  name: project.name,
                  color: project.color || 'grey'
                });
                const colorTag = project.color ? ` [${project.color}]` : '';
                console.log(`  ✅ ${project.name}${colorTag} - created`);
                created.projects++;
              } catch (error) {
                console.error(`  ❌ ${project.name} - failed: ${error.message}`);
              }
            }
          }
        }
      }

      // Update colors for existing projects
      if (updateColors) {
        console.log('\n🎨 Updating Project Colors...\n');
        
        // Get existing projects from Todoist
        const existingProjects = await todoist.getProjects();
        const projectMap = new Map(existingProjects.map(p => [p.name.toLowerCase(), p]));
        
        for (const taxonomyProject of taxonomyData.projects) {
          const existing = projectMap.get(taxonomyProject.name.toLowerCase());
          if (existing) {
            const newColor = taxonomyProject.color || 'grey';
            if (existing.color !== newColor) {
              if (dryRun) {
                console.log(`  🔍 ${taxonomyProject.name}: ${existing.color} → ${newColor}`);
              } else {
                try {
                  await todoist.api.updateProject(existing.id, {
                    color: newColor
                  });
                  console.log(`  ✅ ${taxonomyProject.name}: ${existing.color} → ${newColor}`);
                  updated.projects++;
                } catch (error) {
                  console.error(`  ❌ ${taxonomyProject.name} - failed: ${error.message}`);
                }
              }
            } else {
              console.log(`  ⏭️  ${taxonomyProject.name} - already ${newColor}`);
            }
          }
        }
      }

      // Sync Labels
      if (syncLabels) {
        console.log('\n🏷️  Syncing Labels...\n');
        
        // Get existing labels from Todoist
        const existingLabels = await todoist.getLabels();
        const existingLabelNames = new Set(existingLabels.map(l => l.name.toLowerCase()));
        
        // Flatten all labels from all categories
        const allLabels = [];
        for (const category of taxonomyData.label_categories) {
          for (const label of category.labels) {
            if (!label.archived) {
              allLabels.push(label);
            }
          }
        }
        
        for (const label of allLabels) {
          if (existingLabelNames.has(label.name.toLowerCase())) {
            console.log(`  ⏭️  ${label.name} - already exists`);
            skipped.labels++;
          } else {
            if (dryRun) {
              console.log(`  🔍 ${label.name} - would create`);
            } else {
              try {
                await todoist.api.addLabel({
                  name: label.name,
                  color: 'grey'
                });
                console.log(`  ✅ ${label.name} - created`);
                created.labels++;
              } catch (error) {
                console.error(`  ❌ ${label.name} - failed: ${error.message}`);
              }
            }
          }
        }
      }

      // Summary
      console.log('\n📊 Summary:\n');
      if (syncProjects) {
        console.log(`Projects:`);
        console.log(`  Created: ${created.projects}`);
        console.log(`  Skipped: ${skipped.projects}`);
      }
      if (updateColors) {
        console.log(`Project Colors:`);
        console.log(`  Updated: ${updated.projects}`);
      }
      if (syncLabels) {
        console.log(`Labels:`);
        console.log(`  Created: ${created.labels}`);
        console.log(`  Skipped: ${skipped.labels}`);
      }

      if (dryRun) {
        console.log('\n💡 Run without --dry-run to actually create items');
      } else if (created.projects > 0 || created.labels > 0) {
        console.log('\n✅ Sync complete! Run sync to cache changes:');
        console.log('   pnpm run cli tasks sync');
      }

      return;
    }

    // Default: show summary
    const stats = taxonomy.getTaxonomyStats();
    console.log('📋 Task Taxonomy Configuration\n');
    console.log(`Version: ${stats.version} (updated: ${stats.updated})`);
    console.log(`\nProjects: ${stats.projects}`);
    console.log(`Labels: ${stats.activeLabels} active, ${stats.archivedLabels} archived\n`);
    console.log('Use --projects, --labels, --stats, or --validate for more details');
  });

// Suggestion management commands
// Clear due dates from tasks
program
  .command('clear-deadlines')
  .description('Remove due dates from incomplete tasks')
  .option('--dry-run', 'Preview what would be changed without making changes')
  .option('--filter <text>', 'Only clear deadlines for tasks matching filter')
  .option('--project <id>', 'Only clear deadlines in specific project')
  .action(async (options) => {
    await initializeServices();
    
    const dryRun = options.dryRun || false;
    console.log(dryRun ? '🔍 Preview Mode: Showing what would be cleared\n' : '🧹 Clearing fake deadlines...\n');
    
    // Get all incomplete tasks with due dates
    const filters = {
      completed: false
    };
    
    if (options.filter) {
      filters.filter = options.filter;
    }
    if (options.project) {
      filters.projectId = options.project;
    }
    
    const tasks = await storage.getTasks(filters);
    const tasksWithDueDates = tasks.filter(t => t.due && (t.due.date || t.due.datetime));
    
    if (tasksWithDueDates.length === 0) {
      console.log('No incomplete tasks with due dates found.');
      await cleanup();
      return;
    }
    
    console.log(`Found ${tasksWithDueDates.length} incomplete tasks with due dates\n`);
    
    let cleared = 0;
    let failed = 0;
    
    for (const task of tasksWithDueDates) {
      const dueInfo = task.due.datetime || task.due.date;
      
      if (dryRun) {
        console.log(`  🔍 ${task.content}`);
        console.log(`     Due: ${dueInfo} → (would remove)`);
      } else {
        try {
          // Update in Todoist
          await todoist.updateTask(task.id, { dueString: 'no date' });
          
          // Update in local storage
          await storage.updateTask(task.id, {
            due_string: null,
            due_date: null,
            due_datetime: null,
            due_timezone: null
          });
          
          console.log(`  ✅ ${task.content}`);
          console.log(`     Removed: ${dueInfo}`);
          cleared++;
        } catch (error) {
          console.error(`  ❌ ${task.content} - failed: ${error.message}`);
          failed++;
        }
      }
    }
    
    // Summary
    console.log('\n📊 Summary:\n');
    if (dryRun) {
      console.log(`Would clear: ${tasksWithDueDates.length} due dates`);
      console.log('\n💡 Run without --dry-run to actually clear deadlines');
    } else {
      console.log(`Cleared: ${cleared}`);
      if (failed > 0) {
        console.log(`Failed: ${failed}`);
      }
      console.log('\n✅ Deadlines cleared! Run sync to update cache:');
      console.log('   pnpm run cli sync');
    }
    
    await cleanup();
  });

program
  .command('suggestions')
  .description('Manage AI-suggested projects and labels')
  .option('--list', 'List all pending suggestions')
  .option('--approved', 'List approved suggestions')
  .option('--stats', 'Show suggestion statistics')
  .option('--review <id>', 'Review a specific suggestion')
  .option('--approve <id>', 'Approve a suggestion')
  .option('--defer <id>', 'Defer a suggestion')
  .option('--ignore <id>', 'Ignore a suggestion')
  .option('--promote <id>', 'Promote approved suggestion to YAML')
  .option('--type <type>', 'Type: project or label', 'label')
  .option('--notes <text>', 'Add review notes')
  .action(async (options) => {
    await initializeServices();

    const { SuggestionManager } = await import('../config/suggestion-manager.js');
    const suggestionMgr = new SuggestionManager(storage);

    // List pending
    if (options.list) {
      const pending = await suggestionMgr.listPending();
      
      if (pending.length === 0) {
        console.log('No pending suggestions');
        return;
      }

      console.log(`📋 Pending Suggestions (${pending.length})\n`);
      for (const s of pending) {
        const icon = s.type === 'project' ? '📁' : '🏷️';
        console.log(`${icon} ${s.name} (${s.type})`);
        console.log(`   ID: ${s.suggested_id}`);
        console.log(`   ${s.description}`);
        console.log(`   Suggested: ${s.times_suggested} time(s)`);
        console.log(`   Supporting tasks: ${s.supporting_tasks}`);
        console.log(`   Reasoning: ${s.reasoning}`);
        console.log('');
      }
      return;
    }

    // List approved
    if (options.approved) {
      const approved = await suggestionMgr.listApproved();
      
      if (approved.length === 0) {
        console.log('No approved suggestions (promote them or they\'re already in YAML)');
        return;
      }

      console.log(`✅ Approved Suggestions (${approved.length})\n`);
      for (const s of approved) {
        const icon = s.type === 'project' ? '📁' : '🏷️';
        console.log(`${icon} ${s.name} (${s.type})`);
        console.log(`   ID: ${s.suggested_id}`);
        console.log(`   ${s.description}`);
        console.log(`   Reviewed: ${s.reviewed_at}`);
        console.log(`   Ready to promote with: pnpm run cli suggestions --promote ${s.suggested_id} --type ${s.type}`);
        console.log('');
      }
      return;
    }

    // Stats
    if (options.stats) {
      const stats = await suggestionMgr.getStats();
      
      console.log('📊 Suggestion Statistics\n');
      console.log('Projects:');
      console.log(`  Suggested: ${stats.projects.suggested}`);
      console.log(`  Approved: ${stats.projects.approved}`);
      console.log(`  Deferred: ${stats.projects.deferred}`);
      console.log(`  Ignored: ${stats.projects.ignored}\n`);
      
      console.log('Labels:');
      console.log(`  Suggested: ${stats.labels.suggested}`);
      console.log(`  Approved: ${stats.labels.approved}`);
      console.log(`  Deferred: ${stats.labels.deferred}`);
      console.log(`  Ignored: ${stats.labels.ignored}\n`);
      
      console.log('Total:');
      console.log(`  Pending Review: ${stats.total.suggested}`);
      console.log(`  Ready to Promote: ${stats.total.approved}`);
      return;
    }

    // Review
    if (options.review) {
      const suggestion = await suggestionMgr.getSuggestion(options.type, options.review);
      
      if (!suggestion) {
        console.error(`❌ Suggestion not found: ${options.type}/${options.review}`);
        process.exit(1);
      }

      const icon = options.type === 'project' ? '📁' : '🏷️';
      console.log(`${icon} ${suggestion.suggested_name} (${options.type})\n`);
      console.log(`ID: ${suggestion.suggested_id}`);
      console.log(`Description: ${suggestion.description}`);
      console.log(`Status: ${suggestion.status}`);
      console.log(`\nReasoning: ${suggestion.reasoning}`);
      console.log(`\nSuggested: ${suggestion.times_suggested} time(s)`);
      console.log(`Supporting tasks: ${suggestion.supporting_tasks}`);
      
      if (suggestion.suggested_keywords) {
        const keywords = JSON.parse(suggestion.suggested_keywords);
        console.log(`Keywords: ${keywords.join(', ')}`);
      }

      if (suggestion.review_notes) {
        console.log(`\nReview notes: ${suggestion.review_notes}`);
      }

      console.log(`\nActions:`);
      console.log(`  Approve: pnpm run cli suggestions --approve ${options.review} --type ${options.type}`);
      console.log(`  Defer:   pnpm run cli suggestions --defer ${options.review} --type ${options.type}`);
      console.log(`  Ignore:  pnpm run cli suggestions --ignore ${options.review} --type ${options.type}`);
      return;
    }

    // Approve
    if (options.approve) {
      const success = await suggestionMgr.approve(options.type, options.approve, options.notes);
      
      if (success) {
        console.log(`✅ Approved: ${options.type}/${options.approve}`);
        console.log(`\nPromote to YAML with:`);
        console.log(`  pnpm run cli suggestions --promote ${options.approve} --type ${options.type}`);
      } else {
        console.error(`❌ Failed to approve: ${options.type}/${options.approve}`);
        process.exit(1);
      }
      return;
    }

    // Defer
    if (options.defer) {
      const success = await suggestionMgr.defer(options.type, options.defer, options.notes);
      
      if (success) {
        console.log(`⏸️  Deferred: ${options.type}/${options.defer}`);
      } else {
        console.error(`❌ Failed to defer`);
        process.exit(1);
      }
      return;
    }

    // Ignore
    if (options.ignore) {
      const success = await suggestionMgr.ignore(options.type, options.ignore, options.notes);
      
      if (success) {
        console.log(`🚫 Ignored: ${options.type}/${options.ignore} (won't suggest again)`);
      } else {
        console.error(`❌ Failed to ignore`);
        process.exit(1);
      }
      return;
    }

    // Promote to YAML
    if (options.promote) {
      try {
        const result = await suggestionMgr.promoteToYaml(options.type, options.promote);
        
        console.log(`✨ Promoted to YAML config!`);
        console.log(`\nAdded: ${result.suggestion.name}`);
        console.log(`New taxonomy version: ${result.version}`);
        console.log(`\nReload with: pnpm run cli taxonomy --validate`);
      } catch (error) {
        console.error(`❌ Failed to promote: ${error.message}`);
        process.exit(1);
      }
      return;
    }

    // Default: show help
    console.log('💡 Suggestion Management\n');
    console.log('List pending:    --list');
    console.log('List approved:   --approved');
    console.log('Show stats:      --stats');
    console.log('Review:          --review <id> --type <project|label>');
    console.log('Approve:         --approve <id> --type <project|label>');
    console.log('Promote to YAML: --promote <id> --type <project|label>');
    
    await cleanup();
  });

// Parse and execute
program.parse();


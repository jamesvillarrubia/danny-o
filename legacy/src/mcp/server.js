#!/usr/bin/env node

/**
 * MCP Server for Todoist AI Task Manager
 * 
 * Model Context Protocol server that exposes task management tools
 * to AI assistants like Claude in Cursor. Enables:
 * - Task listing and querying
 * - AI-powered classification and prioritization
 * - Task updates and completions
 * - Insights and analytics
 * 
 * Usage:
 *   Add to Cursor MCP config (~/.cursor/mcp.json):
 *   {
 *     "mcpServers": {
 *       "todoist-ai": {
 *         "command": "node",
 *         "args": ["/path/to/src/mcp/server.js"]
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { createStorage } from '../storage/factory.js';
import { TodoistClient } from '../todoist/client.js';
import { SyncEngine } from '../todoist/sync.js';
import { TaskEnrichment } from '../todoist/enrichment.js';
import { AIAgent } from '../ai/agent.js';
import { AIOperations } from '../ai/operations.js';
import { LearningSystem } from '../ai/learning.js';

// Load environment
dotenv.config();

// Initialize services
let storage, todoist, sync, enrichment, aiAgent, aiOps, learning;

// Helper function for time formatting
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return date.toLocaleDateString();
}

async function initializeServices() {
  if (storage) return; // Already initialized

  storage = await createStorage();
  todoist = new TodoistClient(process.env.TODOIST_API_KEY);
  sync = new SyncEngine(todoist, storage);
  enrichment = new TaskEnrichment(storage);

  if (process.env.CLAUDE_API_KEY) {
    aiAgent = new AIAgent(process.env.CLAUDE_API_KEY);
    aiOps = new AIOperations(aiAgent, storage);
    learning = new LearningSystem(storage);
  }
}

// Create MCP server
const server = new Server(
  {
    name: 'todoist-ai',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// ==================== Tool Handlers ====================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_todoist_tasks',
        description: 'List tasks from Todoist with optional filters (category, priority, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filter by life area category',
              enum: ['work', 'home-repair', 'home-maintenance', 'personal-family', 'speaking-gig', 'big-ideas', 'inbox-ideas']
            },
            priority: {
              type: 'number',
              description: 'Filter by priority (1=lowest, 4=highest)',
              enum: [1, 2, 3, 4]
            },
            limit: {
              type: 'number',
              description: 'Maximum number of tasks to return',
              default: 50
            }
          }
        }
      },
      {
        name: 'get_todoist_task',
        description: 'Get details for a specific task by ID',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Todoist task ID'
            }
          },
          required: ['taskId']
        }
      },
      {
        name: 'sync_todoist',
        description: 'Sync tasks with Todoist API (fetch latest)',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'ai_classify_tasks',
        description: 'Use AI to classify unclassified tasks into life area categories',
        inputSchema: {
          type: 'object',
          properties: {
            taskIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional array of specific task IDs to classify. If not provided, classifies all unclassified tasks.'
            }
          }
        }
      },
      {
        name: 'ai_prioritize',
        description: 'Get AI-powered prioritization recommendations for tasks',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Optional category to prioritize within'
            },
            limit: {
              type: 'number',
              description: 'Number of tasks to prioritize',
              default: 20
            }
          }
        }
      },
      {
        name: 'ai_estimate_time',
        description: 'Get AI time estimate for a task',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task ID to estimate'
            }
          },
          required: ['taskId']
        }
      },
      {
        name: 'ai_daily_plan',
        description: 'Get AI-generated daily plan with task recommendations',
        inputSchema: {
          type: 'object',
          properties: {
            hoursAvailable: {
              type: 'number',
              description: 'Hours available today'
            }
          }
        }
      },
      {
        name: 'ai_breakdown_task',
        description: 'Break down a complex task into subtasks using AI',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task ID to break down'
            }
          },
          required: ['taskId']
        }
      },
      {
        name: 'ai_search_tasks',
        description: 'Search tasks using natural language query',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Natural language search query'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'update_task',
        description: 'Update a task (content, category, priority, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task ID to update'
            },
            updates: {
              type: 'object',
              description: 'Fields to update',
              properties: {
                content: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'number' },
                category: { type: 'string' }
              }
            }
          },
          required: ['taskId', 'updates']
        }
      },
      {
        name: 'complete_task',
        description: 'Mark a task as complete',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task ID to complete'
            },
            actualMinutes: {
              type: 'number',
              description: 'Actual time taken in minutes (for learning)'
            }
          },
          required: ['taskId']
        }
      },
      {
        name: 'get_task_history',
        description: 'Get completion history for analysis',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filter by category'
            },
            limit: {
              type: 'number',
              description: 'Number of results',
              default: 50
            }
          }
        }
      },
      {
        name: 'get_insights',
        description: 'Get AI-powered productivity insights',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_stats',
        description: 'Get task enrichment statistics',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'complete_task_by_search',
        description: 'Complete a task by ID or fuzzy search text. Searches task content/description for matches.',
        inputSchema: {
          type: 'object',
          properties: {
            searchTerm: {
              type: 'string',
              description: 'Task ID or search text to find task (e.g., "vendor registration")'
            },
            actualMinutes: {
              type: 'number',
              description: 'Actual time taken in minutes (for learning)'
            }
          },
          required: ['searchTerm']
        }
      },
      {
        name: 'get_recently_completed',
        description: 'View recently completed tasks with timestamps',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of completed tasks to return',
              default: 10
            }
          }
        }
      },
      {
        name: 'get_productivity_stats',
        description: 'Get productivity statistics (completed tasks, time tracking, by category)',
        inputSchema: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: 'Number of days to analyze',
              default: 7
            }
          }
        }
      },
      {
        name: 'process_text_agent',
        description: 'Process raw text with an AI agent. Paste task lists (markdown, bullets, plain text) or natural language commands. The AI will intelligently create, update, or complete tasks, checking for duplicates first.',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Raw text to process (task lists, commands, natural language)'
            }
          },
          required: ['text']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  await initializeServices();

  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_todoist_tasks': {
        const tasks = await storage.getTasks({
          category: args.category,
          priority: args.priority,
          limit: args.limit || 50,
          completed: false
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tasks, null, 2)
            }
          ]
        };
      }

      case 'get_todoist_task': {
        const task = await storage.getTask(args.taskId);
        
        if (!task) {
          throw new Error(`Task ${args.taskId} not found`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(task, null, 2)
            }
          ]
        };
      }

      case 'sync_todoist': {
        const result = await sync.syncNow();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'ai_classify_tasks': {
        if (!aiOps) {
          throw new Error('AI operations require CLAUDE_API_KEY');
        }

        let tasks;
        if (args.taskIds && args.taskIds.length > 0) {
          tasks = await Promise.all(
            args.taskIds.map(id => storage.getTask(id))
          );
          tasks = tasks.filter(t => t);
        } else {
          tasks = await enrichment.getUnclassifiedTasks();
        }

        const results = await aiOps.classifyTasks(tasks);

        // Save classifications
        for (const result of results) {
          await enrichment.enrichTask(result.taskId, {
            category: result.category,
            aiConfidence: result.confidence,
            aiReasoning: result.reasoning
          });
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2)
            }
          ]
        };
      }

      case 'ai_prioritize': {
        if (!aiOps) {
          throw new Error('AI operations require CLAUDE_API_KEY');
        }

        const tasks = await storage.getTasks({
          category: args.category,
          limit: args.limit || 20,
          completed: false
        });

        const result = await aiOps.prioritizeTasks(tasks);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'ai_estimate_time': {
        if (!aiOps) {
          throw new Error('AI operations require CLAUDE_API_KEY');
        }

        const task = await storage.getTask(args.taskId);
        if (!task) {
          throw new Error(`Task ${args.taskId} not found`);
        }

        const result = await aiOps.estimateTaskDuration(task);

        // Save estimate
        await enrichment.enrichTask(result.taskId, {
          timeEstimate: result.timeEstimate,
          size: result.size,
          aiConfidence: result.confidence,
          aiReasoning: result.reasoning
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'ai_daily_plan': {
        if (!aiOps) {
          throw new Error('AI operations require CLAUDE_API_KEY');
        }

        const tasks = await storage.getTasks({ completed: false, limit: 100 });

        const context = {};
        if (args.hoursAvailable) {
          context.hoursAvailable = args.hoursAvailable;
        }

        const plan = await aiOps.suggestDailyPlan(tasks, context);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(plan, null, 2)
            }
          ]
        };
      }

      case 'ai_breakdown_task': {
        if (!aiOps) {
          throw new Error('AI operations require CLAUDE_API_KEY');
        }

        const task = await storage.getTask(args.taskId);
        if (!task) {
          throw new Error(`Task ${args.taskId} not found`);
        }

        const result = await aiOps.createSubtasks(task);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'ai_search_tasks': {
        if (!aiOps) {
          throw new Error('AI operations require CLAUDE_API_KEY');
        }

        const tasks = await storage.getTasks({ completed: false, limit: 100 });
        const result = await aiOps.filterTasksByIntent(args.query, tasks);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'update_task': {
        const { taskId, updates } = args;

        // Handle category update
        if (updates.category) {
          await enrichment.updateCategory(taskId, updates.category);
          delete updates.category;
        }

        // Update task in Todoist and storage
        if (Object.keys(updates).length > 0) {
          await sync.pushTaskUpdate(taskId, updates);
        }

        const updatedTask = await storage.getTask(taskId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(updatedTask, null, 2)
            }
          ]
        };
      }

      case 'complete_task': {
        const metadata = {};
        if (args.actualMinutes) {
          metadata.actualDuration = args.actualMinutes;
        }

        await sync.completeTask(args.taskId, metadata);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, taskId: args.taskId }, null, 2)
            }
          ]
        };
      }

      case 'get_task_history': {
        const history = await storage.getTaskHistory({
          category: args.category,
          limit: args.limit || 50
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(history, null, 2)
            }
          ]
        };
      }

      case 'get_insights': {
        if (!aiOps) {
          throw new Error('AI operations require CLAUDE_API_KEY');
        }

        const insights = await aiOps.generateInsights();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(insights, null, 2)
            }
          ]
        };
      }

      case 'get_stats': {
        const stats = await enrichment.getEnrichmentStats();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats, null, 2)
            }
          ]
        };
      }

      case 'complete_task_by_search': {
        const searchTerm = args.searchTerm;
        
        // Try exact ID match first
        let task = await storage.getTask(searchTerm);
        
        // If not found by ID, fuzzy search
        if (!task) {
          const allTasks = await storage.getTasks({ completed: false });
          const matches = allTasks.filter(t => 
            t.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
          );
          
          if (matches.length === 0) {
            throw new Error(`No tasks found matching "${searchTerm}"`);
          }
          
          if (matches.length === 1) {
            task = matches[0];
          } else {
            // Multiple matches - return them for user to disambiguate
            const matchList = matches.map(t => ({
              id: t.id,
              content: t.content,
              category: t.category || 'unclassified',
              priority: t.priority
            }));
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    multipleMatches: true,
                    count: matches.length,
                    matches: matchList,
                    message: 'Multiple tasks found. Please use a specific task ID or more specific search term.'
                  }, null, 2)
                }
              ]
            };
          }
        }
        
        // Complete the task
        const metadata = {};
        if (args.actualMinutes) {
          metadata.actualDuration = args.actualMinutes;
        }
        
        await sync.completeTask(task.id, metadata);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                taskId: task.id,
                taskContent: task.content,
                actualMinutes: args.actualMinutes
              }, null, 2)
            }
          ]
        };
      }

      case 'get_recently_completed': {
        const limit = args.limit || 10;
        const history = await storage.getTaskHistory({
          action: 'complete',
          limit
        });
        
        const formatted = history.map(entry => {
          const date = new Date(entry.timestamp);
          const timeAgo = getTimeAgo(date);
          
          return {
            taskId: entry.taskId,
            content: entry.task_content || 'Unknown task',
            completedAt: entry.timestamp,
            timeAgo,
            actualMinutes: entry.details?.actualDuration || null,
            category: entry.details?.category || 'unclassified'
          };
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: formatted.length,
                tasks: formatted
              }, null, 2)
            }
          ]
        };
      }

      case 'get_productivity_stats': {
        const days = args.days || 7;
        const since = new Date();
        since.setDate(since.getDate() - days);
        
        const history = await storage.getTaskHistory({
          action: 'complete',
          since: since.toISOString()
        });
        
        const stats = {
          period: `Last ${days} days`,
          totalCompleted: history.length,
          withTimeTracking: 0,
          averageMinutes: 0,
          byCategory: {},
          byDay: {}
        };
        
        // Calculate stats
        const withTime = history.filter(h => h.details?.actualDuration);
        stats.withTimeTracking = withTime.length;
        
        if (withTime.length > 0) {
          const totalTime = withTime.reduce((sum, h) => sum + h.details.actualDuration, 0);
          stats.averageMinutes = Math.round(totalTime / withTime.length);
        }
        
        // By category
        for (const entry of history) {
          const cat = entry.details?.category || 'unclassified';
          stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
        }
        
        // By day
        for (const entry of history) {
          const day = new Date(entry.timestamp).toLocaleDateString();
          stats.byDay[day] = (stats.byDay[day] || 0) + 1;
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats, null, 2)
            }
          ]
        };
      }

      case 'process_text_agent': {
        // Import Task Processor Agent
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
            handler: async (toolArgs) => {
              const allTasks = await storage.getTasks({ completed: false });
              const matches = allTasks.filter(t =>
                t.content.toLowerCase().includes(toolArgs.query.toLowerCase()) ||
                (t.description && t.description.toLowerCase().includes(toolArgs.query.toLowerCase()))
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
            handler: async (toolArgs) => {
              const task = await todoist.createTask({
                content: toolArgs.content,
                description: toolArgs.description,
                priority: toolArgs.priority || 1
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
            handler: async (toolArgs) => {
              const updates = {};
              if (toolArgs.content) updates.content = toolArgs.content;
              if (toolArgs.description) updates.description = toolArgs.description;
              if (toolArgs.priority) updates.priority = toolArgs.priority;
              
              await todoist.updateTask(toolArgs.taskId, updates);
              return { success: true, taskId: toolArgs.taskId };
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
            handler: async (toolArgs) => {
              const metadata = {};
              if (toolArgs.actualMinutes) {
                metadata.actualDuration = toolArgs.actualMinutes;
              }
              await sync.completeTask(toolArgs.taskId, metadata);
              return { success: true, taskId: toolArgs.taskId };
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
            handler: async (toolArgs) => {
              const tasks = await storage.getTasks({ 
                completed: false, 
                limit: toolArgs.limit || 20 
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
        const result = await processor.processText(args.text);

        return {
          content: [
            {
              type: 'text',
              text: result.success 
                ? `✅ ${result.message}\n\n(Processed in ${result.turns} AI turn(s))`
                : `❌ ${result.message}`
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

// ==================== Resource Handlers ====================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'todoist://tasks/active',
        name: 'Active Tasks',
        description: 'All active (non-completed) tasks',
        mimeType: 'application/json'
      },
      {
        uri: 'todoist://tasks/unclassified',
        name: 'Unclassified Tasks',
        description: 'Tasks that need AI classification',
        mimeType: 'application/json'
      },
      {
        uri: 'todoist://categories/work',
        name: 'Work Tasks',
        description: 'Tasks in the work category',
        mimeType: 'application/json'
      },
      {
        uri: 'todoist://insights/patterns',
        name: 'Productivity Patterns',
        description: 'AI analysis of completion patterns',
        mimeType: 'application/json'
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  await initializeServices();

  const { uri } = request.params;

  try {
    if (uri === 'todoist://tasks/active') {
      const tasks = await storage.getTasks({ completed: false });
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(tasks, null, 2)
          }
        ]
      };
    }

    if (uri === 'todoist://tasks/unclassified') {
      const tasks = await enrichment.getUnclassifiedTasks();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(tasks, null, 2)
          }
        ]
      };
    }

    if (uri.startsWith('todoist://categories/')) {
      const category = uri.split('/').pop();
      const tasks = await storage.getTasks({ category, completed: false });
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(tasks, null, 2)
          }
        ]
      };
    }

    if (uri === 'todoist://insights/patterns') {
      if (!aiOps) {
        throw new Error('AI operations require CLAUDE_API_KEY');
      }
      const insights = await aiOps.generateInsights();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(insights, null, 2)
          }
        ]
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  } catch (error) {
    throw new Error(`Failed to read resource ${uri}: ${error.message}`);
  }
});

// ==================== Start Server ====================

async function main() {
  console.error('[MCP] Starting Todoist AI MCP server...');
  
  await initializeServices();
  console.error('[MCP] Services initialized');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP] Server ready');
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});


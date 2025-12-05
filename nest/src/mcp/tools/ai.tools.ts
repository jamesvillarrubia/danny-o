/**
 * AI-Powered MCP Tools
 * 
 * AI operations (classification, prioritization, planning, etc.) exposed as MCP tools.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { MCPTool, MCPToolHandler } from '../decorators';
import { IStorageAdapter, Task } from '../../common/interfaces';
import { AIOperationsService } from '../../ai/services/operations.service';
import { SearchService } from '../../ai/services/search.service';
import { EnrichmentService } from '../../task/services/enrichment.service';
import {
  ClassifyTasksInputDto,
  PrioritizeInputDto,
  EstimateTimeInputDto,
  DailyPlanInputDto,
  BreakdownTaskInputDto,
  SearchTasksInputDto,
} from '../dto';

@Injectable()
@MCPTool()
export class AITools {
  private readonly logger = new Logger(AITools.name);

  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
    private readonly aiOps: AIOperationsService,
    private readonly searchService: SearchService,
    private readonly enrichment: EnrichmentService,
  ) {}

  @MCPToolHandler({
    name: 'ai_classify_tasks',
    description: 'Use AI to classify unclassified tasks into life area categories',
    inputSchema: {
      type: 'object',
      properties: {
        taskIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional array of specific task IDs to classify. If not provided, classifies all unclassified tasks.',
        },
      },
    },
  })
  async classifyTasks(args: ClassifyTasksInputDto) {
    let tasks;
    
    if (args.taskIds && args.taskIds.length > 0) {
      const taskResults = await Promise.all(args.taskIds.map((id) => this.storage.getTask(id)));
      tasks = taskResults.filter((t): t is Task => t !== null);
    } else {
      tasks = await this.enrichment.getUnclassifiedTasks({ force: false });
    }

    const results = await this.aiOps.classifyTasks(tasks);

    // Save classifications
    for (const result of results) {
      await this.enrichment.enrichTask(result.taskId, {
        category: result.category,
        aiConfidence: result.confidence,
        aiReasoning: result.reasoning,
        classification_source: 'ai',
      });
    }

    return results;
  }

  @MCPToolHandler({
    name: 'ai_prioritize',
    description: 'Get AI-powered prioritization recommendations for tasks',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Optional category to prioritize within',
        },
        limit: {
          type: 'number',
          description: 'Number of tasks to prioritize',
          default: 20,
        },
      },
    },
  })
  async prioritizeTasks(args: PrioritizeInputDto) {
    const tasks = await this.storage.getTasks({
      category: args.category,
      limit: args.limit || 20,
      completed: false,
    });

    const result = await this.aiOps.prioritizeTasks(tasks);
    return result;
  }

  @MCPToolHandler({
    name: 'ai_estimate_time',
    description: 'Get AI time estimate for a task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task ID to estimate',
        },
      },
      required: ['taskId'],
    },
  })
  async estimateTime(args: EstimateTimeInputDto) {
    const task = await this.storage.getTask(args.taskId);
    if (!task) {
      throw new Error(`Task ${args.taskId} not found`);
    }

    const result = await this.aiOps.estimateTaskDuration(task);

    // Save estimate
    await this.enrichment.enrichTask(result.taskId, {
      timeEstimate: result.timeEstimate,
      size: result.size,
      aiConfidence: result.confidence,
      aiReasoning: result.reasoning,
    });

    return result;
  }

  @MCPToolHandler({
    name: 'ai_daily_plan',
    description: 'Get AI-generated daily plan with task recommendations',
    inputSchema: {
      type: 'object',
      properties: {
        hoursAvailable: {
          type: 'number',
          description: 'Hours available today',
        },
      },
    },
  })
  async dailyPlan(args: DailyPlanInputDto) {
    const tasks = await this.storage.getTasks({ completed: false, limit: 100 });

    const context: any = {};
    if (args.hoursAvailable) {
      context.hoursAvailable = args.hoursAvailable;
    }

    const plan = await this.aiOps.suggestDailyPlan(tasks, context);
    return plan;
  }

  @MCPToolHandler({
    name: 'ai_breakdown_task',
    description: 'Break down a complex task into subtasks using AI',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task ID to break down',
        },
      },
      required: ['taskId'],
    },
  })
  async breakdownTask(args: BreakdownTaskInputDto) {
    const task = await this.storage.getTask(args.taskId);
    if (!task) {
      throw new Error(`Task ${args.taskId} not found`);
    }

    const result = await this.aiOps.createSubtasks(task);
    return result;
  }

  @MCPToolHandler({
    name: 'ai_search_tasks',
    description: 'Smart search for tasks using AI-powered query expansion. Handles typos, different wording, partial matches, and semantic understanding.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query (e.g., "email Jon about meeting", "fix sink")',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return',
          default: 10,
        },
        forceSemantic: {
          type: 'boolean',
          description: 'Force full semantic search even if fuzzy matching finds results',
          default: false,
        },
      },
      required: ['query'],
    },
  })
  async searchTasks(args: SearchTasksInputDto & { limit?: number; forceSemantic?: boolean }) {
    this.logger.log(`AI search for: "${args.query}"`);
    
    const result = await this.searchService.search(args.query, {
      limit: args.limit || 10,
      minScore: 0.25,
      forceSemantic: args.forceSemantic,
    });

    return {
      matchCount: result.matches.length,
      searchMethod: result.method,
      searchTimeMs: result.searchTimeMs,
      queryExpansion: {
        original: result.query.original,
        normalized: result.query.normalized,
        variations: result.query.variations.slice(0, 5),
        entities: result.query.entities,
      },
      matches: result.matches.map((m) => ({
        id: m.task.id,
        content: m.task.content,
        description: m.task.description,
        category: m.task.metadata?.category || 'unclassified',
        priority: m.task.priority,
        score: Math.round(m.score * 100),
        matchedOn: m.matchedOn,
        reasoning: m.reasoning,
      })),
    };
  }

  @MCPToolHandler({
    name: 'get_insights',
    description: 'Get AI-powered productivity insights',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  })
  async getInsights() {
    const insights = await this.aiOps.generateInsights();
    return insights;
  }

  @MCPToolHandler({
    name: 'get_stats',
    description: 'Get task enrichment statistics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  })
  async getStats() {
    const stats = await this.enrichment.getEnrichmentStats();
    return stats;
  }
}


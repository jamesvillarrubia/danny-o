/**
 * Agentic Task Processor MCP Tool
 * 
 * Advanced AI agent that processes raw text (task lists, commands, natural language)
 * and intelligently creates, updates, or completes tasks.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { MCPTool, MCPToolHandler } from '../decorators';
import { IStorageAdapter, ITaskProvider } from '../../common/interfaces';
import { SyncService } from '../../task/services/sync.service';
import { ClaudeService } from '../../ai/services/claude.service';
import { SearchService } from '../../ai/services/search.service';
import { ProcessTextInputDto } from '../dto';
import Anthropic from '@anthropic-ai/sdk';

const TASK_PROCESSOR_SYSTEM_PROMPT = `You are a task management AI assistant with direct access to a Todoist account via tools.

Your role is to process user input (which may be task lists, commands, natural language) and take appropriate actions.

# Available Actions

You have access to these tools:
- create_task: Create a new task in Todoist
- update_task: Update an existing task
- complete_task: Mark a task as complete
- search_tasks: Find existing tasks
- list_tasks: List current tasks

# Your Workflow

1. **Understand Intent**: Parse what the user wants (create, update, complete, etc.)
2. **Check for Duplicates**: Before creating, search for similar existing tasks
3. **Take Action**: Use tools to create/update/complete tasks
4. **Confirm**: Report what you did clearly
5. **Ask Questions**: If ambiguous, ask for clarification

# Guidelines

- **Avoid Duplicates**: Always search before creating. If a similar task exists, ask if they want to update it.
- **Smart Merging**: If user lists "fix sink" but "repair kitchen sink" exists, suggest updating the existing one.
- **Batch Efficiently**: Process multiple tasks in one go when possible.
- **Be Conversational**: Report back naturally ("I created 3 new tasks...", "Updated the vendor task...")
- **Ask When Unsure**: If priority/category/due date is unclear, ask.

# Example Interactions

**Input**: "- buy groceries\\n- fix the sink\\n- email John about meeting"
**Your Action**: 
1. Search for similar tasks
2. Create any that don't exist
3. Report: "Created 3 new tasks: 'buy groceries', 'fix the sink', and 'email John about meeting'"

**Input**: "mark vendor task as done, took 30 minutes"
**Your Action**:
1. Search for "vendor"
2. If multiple matches, ask which one
3. If one match, complete it with time=30
4. Report: "Marked 'Vendor Registration' as complete (30 min)"

**Input**: "I need to call Sarah, reply to that email from yesterday, and finish the presentation"
**Your Action**:
1. Check if these tasks exist
2. Create them with appropriate content
3. Report what was created

# Important Notes

- Users may paste markdown lists, bullet points, plain text, or natural language
- Always check for existing tasks before creating duplicates
- If a task is 70%+ similar to an existing one, ask before creating a duplicate
- Be helpful and conversational in your responses
- Use the tools—don't just describe what should happen!`;

@Injectable()
@MCPTool()
export class AgentTools {
  private readonly logger = new Logger(AgentTools.name);

  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
    @Inject('ITaskProvider') private readonly taskProvider: ITaskProvider,
    private readonly syncService: SyncService,
    private readonly claudeService: ClaudeService,
    private readonly searchService: SearchService,
  ) {}

  @MCPToolHandler({
    name: 'process_text_agent',
    description:
      'Process raw text with an AI agent. Paste task lists (markdown, bullets, plain text) or natural language commands. The AI will intelligently create, update, or complete tasks, checking for duplicates first.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Raw text to process (task lists, commands, natural language)',
        },
      },
      required: ['text'],
    },
  })
  async processTextAgent(args: ProcessTextInputDto) {
    // Define tools the agent can use
    const tools = this.buildAgentTools();

    const result = await this.runAgentLoop(args.text, tools);

    return {
      success: result.success,
      message: result.message,
      turns: result.turns,
    };
  }

  /**
   * Build tools for the agent
   */
  private buildAgentTools() {
    return [
      {
        name: 'search_tasks',
        description: 'Search for existing tasks using smart fuzzy matching. Handles typos, different wording, and partial matches.',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query (can be natural language, handles typos)' },
          },
          required: ['query'],
        },
        handler: async (toolArgs: any) => {
          const result = await this.searchService.search(toolArgs.query, {
            limit: 10,
            minScore: 0.3,
          });
          
          return {
            matchCount: result.matches.length,
            searchMethod: result.method,
            matches: result.matches.map((m) => ({
              id: m.task.id,
              content: m.task.content,
              description: m.task.description,
              category: m.task.metadata?.category,
              priority: m.task.priority,
              score: Math.round(m.score * 100),
              matchedOn: m.matchedOn,
            })),
          };
        },
      },
      {
        name: 'create_task',
        description: 'Create a new task in Todoist',
        input_schema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Task content/title' },
            description: { type: 'string', description: 'Optional description' },
            priority: { type: 'number', description: 'Priority 1-4' },
          },
          required: ['content'],
        },
        handler: async (toolArgs: any) => {
          const task = await this.taskProvider.createTask({
            content: toolArgs.content,
            description: toolArgs.description,
            priority: toolArgs.priority || 1,
          });
          return { success: true, taskId: task.id, content: task.content };
        },
      },
      {
        name: 'update_task',
        description: 'Update an existing task',
        input_schema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID to update' },
            content: { type: 'string', description: 'New content' },
            description: { type: 'string', description: 'New description' },
            priority: { type: 'number', description: 'New priority' },
          },
          required: ['taskId'],
        },
        handler: async (toolArgs: any) => {
          const updates: any = {};
          if (toolArgs.content) updates.content = toolArgs.content;
          if (toolArgs.description) updates.description = toolArgs.description;
          if (toolArgs.priority) updates.priority = toolArgs.priority;

          await this.taskProvider.updateTask(toolArgs.taskId, updates);
          return { success: true, taskId: toolArgs.taskId };
        },
      },
      {
        name: 'complete_task',
        description: 'Mark a task as complete',
        input_schema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID to complete' },
            actualMinutes: { type: 'number', description: 'Time taken in minutes' },
          },
          required: ['taskId'],
        },
        handler: async (toolArgs: any) => {
          const metadata: any = {};
          if (toolArgs.actualMinutes) {
            metadata.actualDuration = toolArgs.actualMinutes;
          }
          await this.syncService.completeTask(toolArgs.taskId, metadata);
          return { success: true, taskId: toolArgs.taskId };
        },
      },
      {
        name: 'list_tasks',
        description: 'List current incomplete tasks',
        input_schema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Max tasks to return', default: 20 },
          },
        },
        handler: async (toolArgs: any) => {
          const tasks = await this.storage.getTasks({
            completed: false,
            limit: toolArgs.limit || 20,
          });
          return tasks.map((t) => ({
            id: t.id,
            content: t.content,
            category: t.metadata?.category,
            priority: t.priority,
          }));
        },
      },
    ];
  }

  /**
   * Run the agentic loop with Claude
   */
  private async runAgentLoop(userInput: string, tools: any[], maxTurns = 5) {
    this.logger.log('Starting agent loop...');

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: userInput,
      },
    ];

    let turnCount = 0;
    let finalResponse = '';

    while (turnCount < maxTurns) {
      turnCount++;
      this.logger.log(`Agent turn ${turnCount}/${maxTurns}`);

      try {
        const response = await this.claudeService.getClient().messages.create({
          model: this.claudeService.getModel(),
          max_tokens: 4096,
          system: TASK_PROCESSOR_SYSTEM_PROMPT,
          messages: messages,
          tools: tools,
        });

        this.logger.log(`Agent response: ${response.stop_reason}`);

        // Check if AI wants to use tools
        if (response.stop_reason === 'tool_use') {
          const toolResults: Anthropic.MessageParam[] = [];

          for (const block of response.content) {
            if (block.type === 'tool_use') {
              this.logger.log(`Calling tool: ${block.name}`);

              try {
                const tool = tools.find((t) => t.name === block.name);
                if (!tool) {
                  throw new Error(`Unknown tool: ${block.name}`);
                }

                const result = await tool.handler(block.input);
                toolResults.push({
                  role: 'user',
                  content: [
                    {
                      type: 'tool_result',
                      tool_use_id: block.id,
                      content: JSON.stringify(result),
                    },
                  ],
                });
                this.logger.log(`Tool ${block.name} succeeded`);
              } catch (error: any) {
                this.logger.error(`Tool ${block.name} failed: ${error.message}`);
                toolResults.push({
                  role: 'user',
                  content: [
                    {
                      type: 'tool_result',
                      tool_use_id: block.id,
                      content: JSON.stringify({ error: error.message }),
                      is_error: true,
                    },
                  ],
                });
              }
            }
          }

          // Add assistant's tool use and tool results to conversation
          messages.push({
            role: 'assistant',
            content: response.content,
          });
          messages.push(...toolResults);

          // Continue the loop to get final response
          continue;
        }

        // AI finished - extract text response
        for (const block of response.content) {
          if (block.type === 'text') {
            finalResponse = block.text;
          }
        }

        break; // Done!
      } catch (error: any) {
        this.logger.error(`Agent error: ${error.message}`);
        return {
          success: false,
          message: `Error processing tasks: ${error.message}`,
          error: error.message,
          turns: turnCount,
        };
      }
    }

    if (turnCount >= maxTurns) {
      this.logger.warn('Agent reached max turns');
      finalResponse = finalResponse || 'Processing took too long. Some tasks may have been created.';
    }

    return {
      success: true,
      message: finalResponse,
      turns: turnCount,
    };
  }
}


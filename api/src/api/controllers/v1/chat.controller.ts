/**
 * Chat Controller (v1)
 * 
 * HTTP endpoint for Danny chat conversations.
 * Wraps the process_text_agent functionality for web clients.
 * 
 * Endpoints:
 * - POST /v1/chat - Send a message to Danny
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import { IStorageAdapter, ITaskProvider } from '../../../common/interfaces';
import { SyncService } from '../../../task/services/sync.service';
import { ClaudeService } from '../../../ai/services/claude.service';
import Anthropic from '@anthropic-ai/sdk';

// ==================== System Prompt ====================

const DANNY_CHAT_SYSTEM_PROMPT = `You are Danny, a helpful and friendly task management assistant.
You help the user manage their tasks in Todoist via natural conversation.

# Your Personality
- Friendly but efficient - you get things done
- Proactive - suggest next steps when appropriate
- Organized - help the user stay on track
- Concise - don't ramble, be helpful and direct

# Available Actions

You have access to these tools:
- search_tasks: Find existing tasks by content
- list_tasks: List current incomplete tasks
- create_task: Create a new task in Todoist
- update_task: Update an existing task
- complete_task: Mark a task as complete

# Guidelines

1. **Understand Context**: Parse what the user wants naturally
2. **Check First**: Before creating, search for similar existing tasks
3. **Take Action**: Use tools to help the user
4. **Confirm Clearly**: Report what you did in a friendly way
5. **Suggest Next Steps**: After completing an action, suggest what to do next if appropriate

# Example Conversations

**User**: "What do I have going on today?"
**Danny**: *uses list_tasks with due filter*
"Here's what's on your plate today:
1. Call the dentist (overdue)
2. Review project proposal
3. Pick up groceries

The dentist call is overdue - want me to reschedule it or should we tackle that first?"

**User**: "Add buy milk to my list"
**Danny**: *searches for similar, then creates*
"Done! Added 'buy milk' to your tasks. I noticed you already have 'pick up groceries' - want me to add milk as a note to that instead?"

**User**: "What should I work on next?"
**Danny**: *lists tasks sorted by priority*
"Based on your priorities, I'd suggest tackling 'Review project proposal' next - it's high priority and due today. After that, the dentist call is overdue and should probably be addressed."

**User**: "Done with the proposal"
**Danny**: *searches and completes*
"Great work! I've marked 'Review project proposal' as complete. How long did it take you? (This helps me estimate similar tasks in the future)"

# Important Notes

- Be conversational and helpful
- Use the tools - don't just describe what should happen
- Keep responses concise but warm
- If something is ambiguous, ask for clarification
- Remember: you're here to help them be productive!`;

// ==================== DTOs ====================

interface ChatRequestDto {
  message: string;
  conversationId?: string; // For future multi-turn support
}

interface ChatResponseDto {
  response: string;
  success: boolean;
  turns?: number;
  actions?: Array<{
    type: string;
    description: string;
    taskId?: string;
  }>;
}

// ==================== Controller ====================

@Controller('v1/chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
    @Inject('ITaskProvider') private readonly taskProvider: ITaskProvider,
    private readonly syncService: SyncService,
    private readonly claudeService: ClaudeService,
  ) {}

  /**
   * Send a message to Danny
   * POST /v1/chat
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async chat(@Body() body: ChatRequestDto): Promise<ChatResponseDto> {
    this.logger.log(`Chat message: ${body.message.substring(0, 100)}...`);

    const startTime = Date.now();
    const actions: ChatResponseDto['actions'] = [];

    try {
      // Build tools
      const tools = this.buildChatTools(actions);

      // Run conversation
      const result = await this.runChatLoop(body.message, tools);

      this.logger.log(`Chat completed in ${Date.now() - startTime}ms, ${result.turns} turns`);

      return {
        response: result.message,
        success: result.success,
        turns: result.turns,
        actions: actions.length > 0 ? actions : undefined,
      };
    } catch (error: any) {
      this.logger.error(`Chat error: ${error.message}`);
      return {
        response: `Sorry, I ran into an issue: ${error.message}. Can you try again?`,
        success: false,
      };
    }
  }

  /**
   * Build tools for the chat agent
   */
  private buildChatTools(actions: NonNullable<ChatResponseDto['actions']>) {
    return [
      {
        name: 'search_tasks',
        description: 'Search for existing tasks by content or description',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
        handler: async (toolArgs: any) => {
          const allTasks = await this.storage.getTasks({ completed: false });
          const matches = allTasks.filter(
            (t) =>
              t.content.toLowerCase().includes(toolArgs.query.toLowerCase()) ||
              (t.description && t.description.toLowerCase().includes(toolArgs.query.toLowerCase())),
          );
          return matches.slice(0, 10).map((t) => ({
            id: t.id,
            content: t.content,
            description: t.description,
            category: t.metadata?.category,
            priority: t.priority,
            due: t.due?.date,
          }));
        },
      },
      {
        name: 'list_tasks',
        description: 'List current incomplete tasks, optionally filtered',
        input_schema: {
          type: 'object' as const,
          properties: {
            limit: { type: 'number', description: 'Max tasks to return (default 10)' },
            dueToday: { type: 'boolean', description: 'Only show tasks due today or overdue' },
            highPriority: { type: 'boolean', description: 'Only show priority 1-2 tasks' },
          },
        },
        handler: async (toolArgs: any) => {
          let tasks = await this.storage.getTasks({
            completed: false,
            limit: toolArgs.limit || 20,
          });

          // Filter by due date
          if (toolArgs.dueToday) {
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            tasks = tasks.filter((t) => {
              if (!t.due?.date) return false;
              return new Date(t.due.date) <= today;
            });
          }

          // Filter by priority
          if (toolArgs.highPriority) {
            tasks = tasks.filter((t) => t.priority >= 3); // Todoist: 4 is highest, 1 is lowest
          }

          // Sort by priority then due date
          tasks.sort((a, b) => {
            if (a.priority !== b.priority) return b.priority - a.priority;
            if (a.due?.date && b.due?.date) {
              return new Date(a.due.date).getTime() - new Date(b.due.date).getTime();
            }
            return 0;
          });

          return tasks.slice(0, toolArgs.limit || 10).map((t) => ({
            id: t.id,
            content: t.content,
            priority: t.priority,
            due: t.due?.date,
            category: t.metadata?.category,
            isOverdue: t.due?.date ? new Date(t.due.date) < new Date() : false,
          }));
        },
      },
      {
        name: 'create_task',
        description: 'Create a new task in Todoist',
        input_schema: {
          type: 'object' as const,
          properties: {
            content: { type: 'string', description: 'Task content/title' },
            description: { type: 'string', description: 'Optional description' },
            priority: { type: 'number', description: 'Priority 1-4 (4 is highest)' },
            dueString: { type: 'string', description: 'Due date in natural language (e.g., "tomorrow", "next monday")' },
          },
          required: ['content'],
        },
        handler: async (toolArgs: any) => {
          const task = await this.taskProvider.createTask({
            content: toolArgs.content,
            description: toolArgs.description,
            priority: toolArgs.priority || 1,
            dueString: toolArgs.dueString,
          });
          
          actions.push({
            type: 'create_task',
            description: `Created task: ${task.content}`,
            taskId: task.id,
          });

          return { success: true, taskId: task.id, content: task.content };
        },
      },
      {
        name: 'update_task',
        description: 'Update an existing task',
        input_schema: {
          type: 'object' as const,
          properties: {
            taskId: { type: 'string', description: 'Task ID to update' },
            content: { type: 'string', description: 'New content' },
            description: { type: 'string', description: 'New description' },
            priority: { type: 'number', description: 'New priority' },
            dueString: { type: 'string', description: 'New due date' },
          },
          required: ['taskId'],
        },
        handler: async (toolArgs: any) => {
          const updates: any = {};
          if (toolArgs.content) updates.content = toolArgs.content;
          if (toolArgs.description) updates.description = toolArgs.description;
          if (toolArgs.priority) updates.priority = toolArgs.priority;
          if (toolArgs.dueString) updates.dueString = toolArgs.dueString;

          await this.taskProvider.updateTask(toolArgs.taskId, updates);
          
          actions.push({
            type: 'update_task',
            description: `Updated task`,
            taskId: toolArgs.taskId,
          });

          return { success: true, taskId: toolArgs.taskId };
        },
      },
      {
        name: 'complete_task',
        description: 'Mark a task as complete',
        input_schema: {
          type: 'object' as const,
          properties: {
            taskId: { type: 'string', description: 'Task ID to complete' },
            actualMinutes: { type: 'number', description: 'How long it actually took (in minutes)' },
          },
          required: ['taskId'],
        },
        handler: async (toolArgs: any) => {
          const task = await this.storage.getTask(toolArgs.taskId);
          const metadata: any = {};
          if (toolArgs.actualMinutes) {
            metadata.actualDuration = toolArgs.actualMinutes;
          }
          
          await this.syncService.completeTask(toolArgs.taskId, metadata);
          
          actions.push({
            type: 'complete_task',
            description: `Completed task: ${task?.content || 'unknown'}`,
            taskId: toolArgs.taskId,
          });

          return { success: true, taskId: toolArgs.taskId };
        },
      },
    ];
  }

  /**
   * Run the chat conversation loop with Claude
   */
  private async runChatLoop(
    userMessage: string,
    tools: any[],
    maxTurns = 5,
  ): Promise<{ success: boolean; message: string; turns: number }> {
    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: userMessage,
      },
    ];

    let turnCount = 0;
    let finalResponse = '';

    while (turnCount < maxTurns) {
      turnCount++;
      this.logger.debug(`Chat turn ${turnCount}/${maxTurns}`);

      const response = await this.claudeService.getClient().messages.create({
        model: this.claudeService.getModel(),
        max_tokens: 2048,
        system: DANNY_CHAT_SYSTEM_PROMPT,
        messages: messages,
        tools: tools,
      });

      // Check if AI wants to use tools
      if (response.stop_reason === 'tool_use') {
        const toolResults: Anthropic.MessageParam[] = [];

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            this.logger.debug(`Calling tool: ${block.name}`);

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

        // Add assistant's response and tool results
        messages.push({
          role: 'assistant',
          content: response.content,
        });
        messages.push(...toolResults);

        continue;
      }

      // AI finished - extract text response
      for (const block of response.content) {
        if (block.type === 'text') {
          finalResponse = block.text;
        }
      }

      break;
    }

    if (turnCount >= maxTurns && !finalResponse) {
      finalResponse = "I'm still working on that. Let me know if you need anything else!";
    }

    return {
      success: true,
      message: finalResponse,
      turns: turnCount,
    };
  }
}


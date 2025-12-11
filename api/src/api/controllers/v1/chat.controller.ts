/**
 * Chat Controller (v1)
 *
 * HTTP endpoint for Danny chat conversations.
 * Wraps the process_text_agent functionality for web clients.
 *
 * Endpoints:
 * - POST /v1/chat - Send a message to Danny
 */

import { Controller, Post, Body, HttpCode, HttpStatus, Inject, Logger } from '@nestjs/common';
import { IStorageAdapter, ITaskProvider } from '../../../common/interfaces';
import { SyncService } from '../../../task/services/sync.service';
import { ClaudeService } from '../../../ai/services/claude.service';
import { SearchService } from '../../../ai/services/search.service';
import { TaxonomyService } from '../../../config/taxonomy/taxonomy.service';
import { extractReadableContent } from '../../../common/utils/content-extractor';
import Anthropic from '@anthropic-ai/sdk';

// ==================== System Prompt ====================

// ==================== Conversation Management Constants ====================

/**
 * Approximate character limit before triggering summarization.
 * Claude's context is ~200k tokens, but we want to stay well under for performance.
 * ~4 chars per token, targeting ~8k tokens for history = ~32k chars
 */
const MAX_HISTORY_CHARS = 32000;

/**
 * When summarizing, keep the last N messages intact for immediate context.
 * These are the most recent exchanges that shouldn't be compressed.
 */
const KEEP_RECENT_MESSAGES = 4;

/**
 * Prompt for summarizing conversation history.
 * This is critical - we need to preserve task IDs, decisions, and context.
 */
const CONVERSATION_SUMMARY_PROMPT = `You are summarizing a conversation between a user and Danny (a task management assistant).

Your goal is to create a concise summary that preserves ALL information needed to continue the conversation seamlessly. The user should never notice that summarization occurred.

## What to Preserve (CRITICAL)
1. **Task IDs**: Any task IDs mentioned (format: alphanumeric strings) - these are essential for follow-up actions
2. **Task Names**: The exact names/content of tasks discussed
3. **User Decisions**: What the user decided, approved, or rejected
4. **Pending Questions**: Any unanswered questions or incomplete discussions
5. **Project Context**: Which projects or categories were discussed
6. **User Preferences**: Any preferences the user expressed (priorities, timing, etc.)
7. **Actions Taken**: What actions were completed (tasks created, updated, completed)

## What to Condense
- Pleasantries and acknowledgments
- Detailed explanations that have been acknowledged
- Redundant information
- Tool call details (keep results, not the process)

## Format
Write the summary as a narrative that a new assistant could read to understand the full context. Use this structure:

CONVERSATION SUMMARY:
[Concise narrative of what was discussed and decided]

KEY CONTEXT:
- Tasks mentioned: [list with IDs if known]
- Actions completed: [list]
- Pending items: [any unresolved topics]

Remember: The user will continue this conversation. Your summary must provide enough context that the assistant can respond naturally without asking the user to repeat themselves.`;

/**
 * Base system prompt for Danny chat (without dynamic context).
 * The full prompt is built by combining this with workspace context.
 */
const DANNY_CHAT_BASE_PROMPT = `You are Danny, a helpful and friendly task management assistant.
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

# Page Context

When the user sends a message from the browser extension, you may receive \`<page_context>\` at the start of their message. This contains information about the webpage they're viewing:
- **URL**: The current page URL
- **Title**: The page title
- **Selected text**: Any text they highlighted before sending the message
- **Page content**: Relevant text from the page

Use this context to understand what the user is referring to. For example:
- If they say "add this to my tasks", look at the page title, URL, or selected text
- If they mention "this article" or "this story", use the page content
- Include relevant URLs or quotes when creating tasks

# Important Notes

- Be conversational and helpful
- Use the tools - don't just describe what should happen
- Keep responses concise but warm
- If something is ambiguous, ask for clarification
- Remember: you're here to help them be productive!`;

// ==================== DTOs ====================

interface PageContext {
  url?: string;
  title?: string;
  html?: string;
  text?: string;
  selection?: string;
}

/**
 * Message format for conversation history.
 * Simplified version of Anthropic's MessageParam for transport.
 */
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequestDto {
  message: string;
  /** Previous conversation messages for context continuity */
  history?: ConversationMessage[];
  pageContext?: PageContext;
}

interface ViewFilterConfig {
  priority?: number[];
  categories?: string[];
  projectId?: string;
  dueWithin?: 'today' | '7d' | '14d' | '30d';
  overdue?: boolean;
  completed?: boolean;
  taskIds?: string[];
  limit?: number;
}

interface ChatResponseDto {
  response: string;
  success: boolean;
  turns?: number;
  actions?: Array<{
    type: string;
    description: string;
    taskId?: string;
    filterConfig?: ViewFilterConfig;
  }>;
  filterConfig?: ViewFilterConfig;
  /** Raw messages array for debugging (The Net π) */
  debugMessages?: {
    systemPrompt: string;
    messages: Anthropic.MessageParam[];
    tools: Array<{ name: string; description: string; input_schema: any }>;
  };
  /**
   * If history was summarized, this contains the new compressed history.
   * Frontend should replace its history with this to stay in sync.
   */
  summarizedHistory?: ConversationMessage[];
}

// ==================== Controller ====================

@Controller('v1/chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
    @Inject('ITaskProvider') private readonly taskProvider: ITaskProvider,
    private readonly syncService: SyncService,
    @Inject(ClaudeService) private readonly claudeService: ClaudeService,
    @Inject(TaxonomyService) private readonly taxonomyService: TaxonomyService,
    private readonly searchService: SearchService,
  ) {}

  /**
   * Send a message to Danny
   * POST /v1/chat
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async chat(@Body() body: ChatRequestDto): Promise<ChatResponseDto> {
    this.logger.log(`Chat message: ${body.message.substring(0, 100)}...`);

    if (!this.claudeService) {
      this.logger.error('ClaudeService is not available');
      return {
        response:
          'Sorry, the AI service is not available. Please check that CLAUDE_API_KEY is set in your environment variables.',
        success: false,
      };
    }

    const startTime = Date.now();
    const actions: ChatResponseDto['actions'] = [];

    try {
      // Build tools
      const tools = this.buildChatTools(actions);

      // Process conversation history - summarize if too long
      let processedHistory = body.history || [];
      const historyLength = this.estimateHistoryLength(processedHistory);

      if (historyLength > MAX_HISTORY_CHARS && processedHistory.length > KEEP_RECENT_MESSAGES) {
        this.logger.log(`History too long (${historyLength} chars), summarizing...`);
        processedHistory = await this.summarizeHistory(processedHistory);
        this.logger.log(
          `Summarized history to ${this.estimateHistoryLength(processedHistory)} chars`,
        );
      }

      // Build system prompt with workspace context
      const systemPrompt = await this.buildSystemPrompt();

      // Run conversation with history and page context
      const result = await this.runChatLoop(
        body.message,
        tools,
        systemPrompt,
        5,
        body.pageContext,
        processedHistory,
      );

      this.logger.log(`Chat completed in ${Date.now() - startTime}ms, ${result.turns} turns`);

      // Extract filter config from apply_filter action if present
      const filterAction = actions.find((a) => a.type === 'apply_filter');
      const filterConfig = filterAction?.filterConfig;

      return {
        response: result.message,
        success: result.success,
        turns: result.turns,
        actions: actions.length > 0 ? actions : undefined,
        filterConfig: filterConfig,
        debugMessages: result.debugMessages,
        // Return processed history so frontend can update its state
        summarizedHistory: historyLength > MAX_HISTORY_CHARS ? processedHistory : undefined,
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
   * Estimate the character length of conversation history
   */
  private estimateHistoryLength(history: ConversationMessage[]): number {
    return history.reduce((total, msg) => total + msg.content.length, 0);
  }

  /**
   * Summarize conversation history when it gets too long.
   * Keeps the last KEEP_RECENT_MESSAGES intact and summarizes the rest.
   */
  private async summarizeHistory(history: ConversationMessage[]): Promise<ConversationMessage[]> {
    if (!this.claudeService || history.length <= KEEP_RECENT_MESSAGES) {
      return history;
    }

    // Split history: older messages to summarize, recent messages to keep
    const splitIndex = history.length - KEEP_RECENT_MESSAGES;
    const toSummarize = history.slice(0, splitIndex);
    const toKeep = history.slice(splitIndex);

    // Format the conversation for summarization
    const conversationText = toSummarize
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');

    try {
      const response = await this.claudeService.getClient().messages.create({
        model: this.claudeService.getModel(),
        max_tokens: 1024,
        system: CONVERSATION_SUMMARY_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Please summarize this conversation:\n\n${conversationText}`,
          },
        ],
      });

      // Extract text response
      let summary = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          summary = block.text;
          break;
        }
      }

      if (!summary) {
        this.logger.warn('Summarization returned empty response, keeping original');
        return history;
      }

      // Return summary as a system-style context message followed by recent messages
      return [
        {
          role: 'user' as const,
          content: `[Previous conversation summary]\n${summary}\n[End of summary - conversation continues below]`,
        },
        {
          role: 'assistant' as const,
          content:
            'Understood, I have the context from our previous conversation. Let me continue helping you.',
        },
        ...toKeep,
      ];
    } catch (error: any) {
      this.logger.error(`Failed to summarize history: ${error.message}`);
      // On failure, just truncate to recent messages
      return toKeep;
    }
  }

  /**
   * Build workspace context for the system prompt.
   * This includes available projects, categories, and labels.
   */
  private async buildWorkspaceContext(): Promise<string> {
    const parts: string[] = [];

    // Get projects from storage (Todoist projects)
    try {
      const projects = await this.storage.getProjects();
      if (projects && projects.length > 0) {
        parts.push("# User's Todoist Projects\n");
        parts.push("These are the actual projects in the user's Todoist account:\n");
        for (const project of projects) {
          parts.push(`- **${project.name}** (ID: ${project.id})`);
        }
        parts.push('');
      }
    } catch (error) {
      this.logger.warn('Could not fetch projects for context');
    }

    // Add task categories (the AI classification categories)
    parts.push('# Task Categories (for organization)\n');
    parts.push('Tasks are organized into these categories:\n');
    parts.push('- **work**: Job-related tasks and projects');
    parts.push(
      '- **home-improvement**: Aspirational home improvement projects (building, renovations)',
    );
    parts.push('- **home-maintenance**: Regular home upkeep (repairs, yard work, cleaning)');
    parts.push('- **personal-family**: Groceries, errands, family coordination, personal tasks');
    parts.push('- **speaking-gig**: Conference talks, presentations, speaking opportunities');
    parts.push(
      '- **big-ideas**: Long-term personal goals (book writing, tool building, podcast ideas)',
    );
    parts.push('- **inspiration**: Creative sparks and ideas to explore');
    parts.push('- **inbox**: Unclassified tasks needing categorization');
    parts.push('');

    // Get labels from taxonomy service
    try {
      const labelCategories = this.taxonomyService.getLabelsByCategory();
      if (labelCategories && labelCategories.length > 0) {
        parts.push('# Available Labels\n');
        parts.push('Labels can be applied to tasks for cross-cutting organization:\n');
        for (const category of labelCategories) {
          parts.push(`\n**${category.category}:**`);
          for (const label of category.labels) {
            if (!label.status || label.status === 'active') {
              const desc = label.description ? ` - ${label.description}` : '';
              parts.push(`- ${label.name}${desc}`);
            }
          }
        }
        parts.push('');
      }
    } catch (error) {
      this.logger.warn('Could not fetch labels from taxonomy');
    }

    return parts.join('\n');
  }

  /**
   * Build the full system prompt with workspace context
   */
  private async buildSystemPrompt(): Promise<string> {
    const workspaceContext = await this.buildWorkspaceContext();

    return `${DANNY_CHAT_BASE_PROMPT}

# Your User's Workspace

${workspaceContext}

Use this context when discussing or creating tasks. Match projects and labels to the user's existing organizational structure.`;
  }

  /**
   * Build tools for the chat agent
   */
  private buildChatTools(actions: NonNullable<ChatResponseDto['actions']>) {
    return [
      {
        name: 'search_tasks',
        description: 'Search for existing tasks using smart fuzzy matching. Handles typos, different wording, partial matches, and semantic understanding.',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'Search query (natural language, handles typos and variations)' },
          },
          required: ['query'],
        },
        handler: async (toolArgs: any) => {
          const result = await this.searchService.search(toolArgs.query, {
            limit: 10,
            minScore: 0.25,
          });
          
          return result.matches.map((m) => ({
            id: m.task.id,
            content: m.task.content,
            description: m.task.description,
            category: m.task.metadata?.category,
            priority: m.task.priority,
            due: m.task.due?.date,
            score: Math.round(m.score * 100),
            matchedOn: m.matchedOn,
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
          // Build filter config for the frontend
          const filterConfig: ViewFilterConfig = {
            completed: false,
            limit: toolArgs.limit || 10,
          };

          let tasks = await this.storage.getTasks({
            completed: false,
            limit: toolArgs.limit || 20,
          });

          // Filter by due date
          if (toolArgs.dueToday) {
            filterConfig.dueWithin = 'today';
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            tasks = tasks.filter((t) => {
              if (!t.due?.date) return false;
              return new Date(t.due.date) <= today;
            });
          }

          // Filter by priority
          if (toolArgs.highPriority) {
            filterConfig.priority = [3, 4]; // Todoist: 4 is highest, 1 is lowest
            tasks = tasks.filter((t) => t.priority >= 3);
          }

          // Sort by priority then due date
          tasks.sort((a, b) => {
            if (a.priority !== b.priority) return b.priority - a.priority;
            if (a.due?.date && b.due?.date) {
              return new Date(a.due.date).getTime() - new Date(b.due.date).getTime();
            }
            return 0;
          });

          const limitedTasks = tasks.slice(0, toolArgs.limit || 10);

          // Add apply_filter action so frontend can update the view
          actions.push({
            type: 'apply_filter',
            description: `Applied filter: ${
              toolArgs.dueToday ? 'Due today, ' : ''
            }${toolArgs.highPriority ? 'High priority, ' : ''}${limitedTasks.length} tasks`,
            filterConfig: filterConfig,
          });

          return limitedTasks.map((t) => ({
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
            dueString: {
              type: 'string',
              description: 'Due date in natural language (e.g., "tomorrow", "next monday")',
            },
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
            actualMinutes: {
              type: 'number',
              description: 'How long it actually took (in minutes)',
            },
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
    systemPrompt: string,
    maxTurns = 5,
    pageContext?: PageContext,
    history?: ConversationMessage[],
  ): Promise<{
    success: boolean;
    message: string;
    turns: number;
    debugMessages: {
      systemPrompt: string;
      messages: Anthropic.MessageParam[];
      tools: Array<{ name: string; description: string; input_schema: any }>;
    };
  }> {
    if (!this.claudeService) {
      throw new Error('ClaudeService is not available');
    }

    // Build the user message with page context if available
    let fullUserMessage = userMessage;
    if (
      pageContext &&
      (pageContext.url ||
        pageContext.title ||
        pageContext.html ||
        pageContext.text ||
        pageContext.selection)
    ) {
      const contextParts: string[] = ['<page_context>'];

      if (pageContext.url) {
        contextParts.push(`URL: ${pageContext.url}`);
      }
      if (pageContext.title) {
        contextParts.push(`Title: ${pageContext.title}`);
      }
      if (pageContext.selection) {
        contextParts.push(`Selected text: "${pageContext.selection}"`);
      }

      // Extract clean content using Readability if HTML is available
      if (pageContext.html || pageContext.text) {
        const extracted = extractReadableContent(pageContext.html, pageContext.text, {
          url: pageContext.url,
          maxContentLength: 4000,
          minContentLength: 50,
        });

        if (extracted.content) {
          const sourceNote = extracted.usedReadability ? '(article content)' : '(page text)';
          contextParts.push(`Page content ${sourceNote}:\n${extracted.content}`);
        }

        this.logger.debug(
          `Content extraction: usedReadability=${extracted.usedReadability}, length=${extracted.content.length}`,
        );
      }

      contextParts.push('</page_context>');
      contextParts.push('');
      contextParts.push(userMessage);

      fullUserMessage = contextParts.join('\n');
      this.logger.debug(`Chat includes page context from: ${pageContext.url || pageContext.title}`);
    }

    // Build messages array: start with history, then add current message
    const messages: Anthropic.MessageParam[] = [];

    // Add conversation history if provided
    if (history && history.length > 0) {
      this.logger.debug(`Including ${history.length} messages from conversation history`);
      for (const msg of history) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Add the current user message
    messages.push({
      role: 'user',
      content: fullUserMessage,
    });

    let turnCount = 0;
    let finalResponse = '';

    while (turnCount < maxTurns) {
      turnCount++;
      this.logger.debug(`Chat turn ${turnCount}/${maxTurns}`);

      const response = await this.claudeService.getClient().messages.create({
        model: this.claudeService.getModel(),
        max_tokens: 2048,
        system: systemPrompt,
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

    // Build debug-safe tools (without handler functions)
    const debugTools = tools.map(({ name, description, input_schema }) => ({
      name,
      description,
      input_schema,
    }));

    return {
      success: true,
      message: finalResponse,
      turns: turnCount,
      debugMessages: {
        systemPrompt,
        messages,
        tools: debugTools,
      },
    };
  }
}

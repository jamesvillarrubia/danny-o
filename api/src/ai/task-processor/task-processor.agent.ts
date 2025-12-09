/**
 * Task Processing Agent
 * 
 * An agentic AI that accepts raw text (task lists, commands, natural language)
 * and intelligently processes it by:
 * - Creating new tasks
 * - Updating existing tasks
 * - Marking tasks complete
 * - Archiving tasks
 * - Asking clarifying questions
 * 
 * Uses Claude with tool access to make decisions and take actions.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClaudeService } from '../services/claude.service';
import { SearchService } from '../services/search.service';
import { IStorageAdapter, ITaskProvider } from '../../common/interfaces';
import axios from 'axios';
// Exa search is optional - will be null if not installed
let Exa: any = null;
try {
  // Dynamic import to handle missing module
  Exa = require('exa-js').default;
} catch {
  // exa-js not installed - web search will be unavailable
}

const TASK_PROCESSOR_SYSTEM_PROMPT = `You are a resourceful task management AI assistant with direct access to a Todoist account.

# Intent Classification

## 1. INFORMATION REQUEST
Keywords: "search", "find", "look up", "research", "tell me about", "what is", "show me"
Example: "search for TypeScript 5.0 articles"
→ **Be proactive and resourceful!**
→ Use fetch_url to try fetching from known sources:
  - Official docs/blogs (e.g., typescript blog for TypeScript questions)
  - GitHub releases/changelogs (e.g., microsoft/TypeScript for TS updates)
  - Well-known tech sites (Dev.to, Medium, etc.)
→ Try 2-3 relevant URLs, summarize findings
→ If you get good results: "Found information from [sources]. Here's what I learned: [summary]"
→ If URLs fail: "I tried fetching from [sources] but couldn't access them. For comprehensive web search, use me through Claude Desktop with DuckDuckGo Search. Would you like me to create a reminder task?"

## 2. TASK ACTION
Keywords: "create a task", "add to my list", "archive", "complete", "mark as done", "remind me to"
Example: "create a task to search for TypeScript articles"
→ Use create_task tool
→ Response: "Created task: 'Search for TypeScript articles'"

## 3. TASK QUERY
Keywords: "list", "show my tasks", "what tasks"
→ Use list_tasks or search_tasks

# Available Tools

**Task Management:**
- create_task, complete_task, search_tasks, list_tasks, archive_task, add_comment

**Information/Research:**
- fetch_url: Fetch content from ANY URL - BE RESOURCEFUL with this!

# Being Resourceful: URL Strategy

When asked to "search for X":
1. **Identify official sources**: What's the authoritative source for this topic?
   - TypeScript? → https://devblogs.microsoft.com/typescript/ or https://github.com/microsoft/TypeScript/releases
   - NestJS? → https://nestjs.com/ or https://docs.nestjs.com/
   - JavaScript? → https://developer.mozilla.org/en-US/
2. **Try known tech sites**: https://dev.to/t/[topic], etc.
3. **Attempt 2-3 URLs** before giving up
4. **Summarize any successful fetches**
5. Only if all fail: Suggest Claude Desktop + DuckDuckGo Search for better search

# Your Workflow

1. **Classify Intent**: Is this an information request or a task action?
2. **Information Requests**: Use research tools, return results directly
3. **Task Actions**: Search for duplicates first, then create/complete/archive
4. **Hybrid Requests**: Fulfill the information request, then offer to create a task with findings
5. **Confirm**: Report what you did clearly

# Guidelines

- **Distinguish Intent**: 
  - Information words (search, find, research, what, tell me) → Use research tools, return results
  - Action words (create, add, archive, complete, mark) → Use task management tools
- **Avoid Duplicates**: Always search before creating tasks. If a similar task exists, ask if they want to complete it.
- **Smart Matching**: Use fuzzy matching. "Minz Round task" should match "Minz Round" or similar titles.
- **Return Information Directly**: When user asks for information, provide it immediately - don't create a task about searching.
- **Offer Task Creation**: After fulfilling an information request, you may offer: "Would you like me to create a task with these findings?"
- **Batch Efficiently**: Process multiple tasks in one go when possible.
- **Be Conversational**: Report back naturally ("I archived the Minz Round task", "Here are 3 articles about X...")
- **Ask When Unsure**: If multiple matches found or intent is unclear, ask for clarification.

# Example Interactions

**[INFORMATION REQUEST]**
Input: "search for recent articles about TypeScript 5.0"
Your Action:
1. Recognize this is an information request (not "create a task to search")
2. Use exa_search or fetch_url to find articles
3. Return results: "I found 3 recent articles about TypeScript 5.0: [list with summaries]"
4. Offer: "Would you like me to create a task to review these?"

**[TASK ACTION]**
Input: "archive the Minz Round task"
Your Action: 
1. Search for tasks with "Minz Round"
2. Archive it
3. Report: "Archived task: 'Minz Round Presentation'"

**[TASK ACTION]**
Input: "create a task to review PRs"
Your Action:
1. Search for "review PRs" to avoid duplicates
2. If no match, create it
3. Report: "Created task: 'Review PRs'"

**[INFORMATION REQUEST]**
Input: "what's the link in my presentation task about?"
Your Action:
1. Search for "presentation" task
2. Find URL in description
3. Use fetch_url to read content
4. Summarize: "Your presentation task links to an article about X. Key points: ..."

**[TASK ACTION]**
Input: "mark all shopping tasks as complete"
Your Action:
1. Search for "shopping" tasks
2. Complete each one
3. Report: "Completed 3 shopping tasks"

# Important Notes

- Users may paste markdown lists, bullet points, plain text, or natural language
- Always check for existing tasks before creating duplicates
- If a task is 70%+ similar to an existing one, ask before creating a duplicate
- Be helpful and conversational in your responses
- Use the tools—don't just describe what should happen!`;

interface ProcessResult {
  success: boolean;
  message: string;
  turns?: number;
  error?: string;
}

type ExecutionContext = 'cli' | 'mcp' | 'web';

interface ProcessOptions {
  context?: ExecutionContext;
  maxTurns?: number;
}

@Injectable()
export class TaskProcessorAgent {
  private readonly logger = new Logger(TaskProcessorAgent.name);
  private readonly model: string;
  private readonly tools: any[];

  constructor(
    @Inject(ClaudeService) private readonly claude: ClaudeService,
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
    @Inject('ITaskProvider') private readonly taskProvider: ITaskProvider,
    private readonly searchService: SearchService,
  ) {
    // Use configured model (defaults to Haiku for speed, can override with TASK_PROCESSOR_MODEL env var)
    this.model = process.env.TASK_PROCESSOR_MODEL || process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022';
    this.tools = this.buildTools();
    this.logger.log(`Initialized with model: ${this.model}`);
  }

  /**
   * Build context-aware system prompt
   */
  private buildSystemPrompt(context: ExecutionContext): string {
    const basePrompt = TASK_PROCESSOR_SYSTEM_PROMPT;
    
    const contextInstructions = {
      cli: `

# OUTPUT FORMATTING (CLI Context)
You're being called from a terminal. Format responses appropriately:
- Keep responses CONCISE and scannable
- Use clear visual separators (blank lines between sections)
- Use emojis SPARINGLY (only for status: ✅ ❌ 🔍)
- For lists, use simple bullets or numbers
- NO markdown formatting (**bold**, *italic*, etc.) - plain text only
- Tasks should be: "number. Task Name (Priority X) - category"
- Example good response:
  "✅ Top 5 work tasks:
  
  1. Re: Mintz Round 1 & 2 (Priority 2) - work
  2. Review AI features (Priority 1) - work
  3. Document Fund names (Priority 3) - work
  4. Link to my calendar (Priority 2) - work
  5. Thank you and Follow Up (Priority 3) - work"`,

      mcp: `

# OUTPUT FORMATTING (MCP Context)
You're being called from an MCP tool. Format responses for structured consumption:
- Lead with clear status (Success/Failure)
- Be factual and precise
- Include relevant metadata (URLs, dates, sources)
- Format as clean text that can be parsed
- Example good response:
  "Success: Found 3 TypeScript 5.0 articles
  Sources: devblogs.microsoft.com, github.com
  Created task: Review TypeScript 5.0 features (ID: abc123)"`,

      web: `

# OUTPUT FORMATTING (Web/Chat Context)
You're being orchestrated by Claude in a chat. Format responses conversationally:
- Be friendly and helpful
- Use markdown for better readability
- Can be more verbose and explanatory
- Include context and reasoning
- Example good response:
  "I searched the TypeScript blog and found several great articles about 5.0! Here's what stood out:
  
  **Key Features:**
  - Decorators are now stable
  - const type parameters
  - Performance improvements
  
  I've created a task in your Todoist to review these in detail. Would you like me to summarize any specific feature?"`,
    };

    return basePrompt + contextInstructions[context];
  }

  /**
   * Build the tool definitions for Claude
   */
  private buildTools() {
    return [
      {
        name: 'search_tasks',
        description: 'Search for tasks using smart fuzzy matching. Handles typos, different wording, and partial matches. Use this before creating to avoid duplicates.',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query (can be natural language, handles typos)' },
            limit: { type: 'number', description: 'Max results to return', default: 10 },
          },
          required: ['query'],
        },
        handler: async (args: any) => {
          const result = await this.searchService.search(args.query, {
            limit: args.limit || 10,
            minScore: 0.3,
          });

          return {
            matchCount: result.matches.length,
            searchMethod: result.method,
            matches: result.matches.map((m) => ({
              id: m.task.id,
              content: m.task.content,
              category: m.task.metadata?.category,
              priority: m.task.priority,
              score: Math.round(m.score * 100),
            })),
          };
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
        handler: async (args: any) => {
          const tasks = await this.storage.getTasks({
            completed: false,
            limit: args.limit || 20,
          });
          return tasks.map((t) => ({
            id: t.id,
            content: t.content,
            category: t.metadata?.category,
            priority: t.priority,
          }));
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
            priority: { type: 'number', description: 'Priority 1-4', default: 1 },
          },
          required: ['content'],
        },
        handler: async (args: any) => {
          const task = await this.taskProvider.createTask({
            content: args.content,
            description: args.description,
            priority: args.priority || 1,
          });

          return { success: true, taskId: task.id, content: task.content };
        },
      },
      {
        name: 'complete_task',
        description: 'Mark a task as complete',
        input_schema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID to complete' },
          },
          required: ['taskId'],
        },
        handler: async (args: any) => {
          await this.taskProvider.completeTask(args.taskId);
          return { success: true, taskId: args.taskId };
        },
      },
      {
        name: 'archive_task',
        description: 'Archive/close a task without completing it (for tasks that are no longer relevant)',
        input_schema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID to archive' },
          },
          required: ['taskId'],
        },
        handler: async (args: any) => {
          await this.taskProvider.completeTask(args.taskId);
          return { success: true, taskId: args.taskId, archived: true };
        },
      },
      {
        name: 'fetch_url',
        description: 'Fetch and read the content of a URL. Use this to read links found in task descriptions or when user asks about a link.',
        input_schema: {
          type: 'object',
          properties: {
            url: { 
              type: 'string', 
              description: 'The URL to fetch (must be a valid http/https URL)' 
            },
          },
          required: ['url'],
        },
        handler: async (args: any) => {
          try {
            this.logger.log(`Fetching URL: ${args.url}`);
            
            const response = await axios.get(args.url, {
              timeout: 10000,
              maxContentLength: 500000, // 500KB limit
              headers: {
                'User-Agent': 'Danny-AI-Assistant/2.0',
              },
            });

            let content = response.data;
            
            // If HTML, try to extract text content (basic extraction)
            if (typeof content === 'string' && content.includes('<html')) {
              // Remove scripts and styles
              content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
              content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
              // Remove HTML tags
              content = content.replace(/<[^>]+>/g, ' ');
              // Clean up whitespace
              content = content.replace(/\s+/g, ' ').trim();
              // Limit to first 5000 characters for context
              content = content.substring(0, 5000);
            }

            return {
              success: true,
              url: args.url,
              contentType: response.headers['content-type'],
              content: content,
              truncated: typeof content === 'string' && content.length >= 5000,
            };
          } catch (error: any) {
            this.logger.error(`Failed to fetch URL: ${error.message}`);
            return {
              success: false,
              url: args.url,
              error: error.message,
            };
          }
        },
      },
      {
        name: 'add_comment',
        description: 'Add a comment to a task. Use this to provide updates, context, or notes on a task.',
        input_schema: {
          type: 'object',
          properties: {
            taskId: { 
              type: 'string', 
              description: 'ID of the task to add a comment to' 
            },
            content: {
              type: 'string',
              description: 'Content of the comment to add',
            },
          },
          required: ['taskId', 'content'],
        },
        handler: async (args: any) => {
          try {
            await this.taskProvider.addCommentToTask(args.taskId, args.content);
            return {
              success: true,
              taskId: args.taskId,
              message: 'Comment added successfully',
            };
          } catch (error: any) {
            this.logger.error(`Failed to add comment: ${error.message}`);
            throw new Error(`Failed to add comment: ${error.message}`);
          }
        },
      },
    ];
  }

  /**
   * Process raw user input (text chunk with tasks, commands, natural language)
   * Returns a contextually-formatted response about what was done
   */
  async processText(userInput: string, options: ProcessOptions = {}): Promise<ProcessResult> {
    const { context = 'cli', maxTurns = 5 } = options;
    
    this.logger.log(`Processing user input (context: ${context})...`);

    const systemPrompt = this.buildSystemPrompt(context);

    const messages: any[] = [
      {
        role: 'user',
        content: userInput,
      },
    ];

    let turnCount = 0;
    let finalResponse = '';

    while (turnCount < maxTurns) {
      turnCount++;
      this.logger.log(`Turn ${turnCount}/${maxTurns}`);

      try {
        const response = await this.claude.getClient().messages.create({
          model: this.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: messages,
          tools: this.tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.input_schema,
          })),
        });

        this.logger.log(`Response: ${response.stop_reason}`);

        // Check if AI wants to use tools
        if (response.stop_reason === 'tool_use') {
          const toolResults: any[] = [];

          for (const block of response.content) {
            if (block.type === 'tool_use') {
              this.logger.log(`Calling tool: ${block.name}`);

              try {
                const result = await this.executeTool(block.name, block.input);
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify(result),
                });
                this.logger.log(`Tool ${block.name} succeeded`);
              } catch (error: any) {
                this.logger.error(`Tool ${block.name} failed: ${error.message}`);
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify({ error: error.message }),
                  is_error: true,
                });
              }
            }
          }

          // Add assistant's tool use and tool results to conversation
          messages.push({
            role: 'assistant',
            content: response.content,
          });
          messages.push({
            role: 'user',
            content: toolResults,
          });

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
        this.logger.error(`Error: ${error.message}`);
        return {
          success: false,
          message: `Error processing tasks: ${error.message}`,
          error: error.message,
        };
      }
    }

    if (turnCount >= maxTurns) {
      this.logger.warn('Reached max turns');
      finalResponse =
        finalResponse || 'Processing took too long. Some tasks may have been created.';
    }

    return {
      success: true,
      message: finalResponse,
      turns: turnCount,
    };
  }

  /**
   * Execute a tool by name
   */
  private async executeTool(toolName: string, args: any): Promise<any> {
    const tool = this.tools.find((t) => t.name === toolName);

    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    if (!tool.handler) {
      throw new Error(`Tool ${toolName} has no handler`);
    }

    return await tool.handler(args);
  }
}


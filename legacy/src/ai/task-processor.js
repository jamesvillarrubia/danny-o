/**
 * Task Processing Agent
 * 
 * An agentic AI that accepts raw text (task lists, commands, natural language)
 * and intelligently processes it by:
 * - Creating new tasks
 * - Updating existing tasks
 * - Marking tasks complete
 * - Asking clarifying questions
 * 
 * Uses Claude with tool access to make decisions and take actions.
 */

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

export class TaskProcessorAgent {
  constructor(anthropic, tools) {
    this.anthropic = anthropic;
    this.tools = tools; // MCP-style tools with handlers
    this.model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'; // Use Sonnet for agentic work
    console.log('[Task Processor] Initialized with model:', this.model);
  }

  /**
   * Process raw user input (text chunk with tasks, commands, natural language)
   * Returns a conversational response about what was done
   */
  async processText(userInput, maxTurns = 5) {
    console.log('[Task Processor] Processing user input...');
    
    const messages = [
      {
        role: 'user',
        content: userInput
      }
    ];

    let turnCount = 0;
    let finalResponse = '';

    while (turnCount < maxTurns) {
      turnCount++;
      console.log(`[Task Processor] Turn ${turnCount}/${maxTurns}`);

      try {
        const response = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: 4096,
          system: TASK_PROCESSOR_SYSTEM_PROMPT,
          messages: messages,
          tools: this.tools.map(t => ({
            name: t.name,
            description: t.description,
            input_schema: t.inputSchema
          }))
        });

        console.log(`[Task Processor] Response: ${response.stop_reason}`);

        // Check if AI wants to use tools
        if (response.stop_reason === 'tool_use') {
          const toolResults = [];

          for (const block of response.content) {
            if (block.type === 'tool_use') {
              console.log(`[Task Processor] Calling tool: ${block.name}`);
              
              try {
                const result = await this.executeTool(block.name, block.input);
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify(result)
                });
                console.log(`[Task Processor] Tool ${block.name} succeeded`);
              } catch (error) {
                console.error(`[Task Processor] Tool ${block.name} failed:`, error.message);
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify({ error: error.message }),
                  is_error: true
                });
              }
            }
          }

          // Add assistant's tool use and tool results to conversation
          messages.push({
            role: 'assistant',
            content: response.content
          });
          messages.push({
            role: 'user',
            content: toolResults
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
      } catch (error) {
        console.error('[Task Processor] Error:', error.message);
        return {
          success: false,
          message: `Error processing tasks: ${error.message}`,
          error: error.message
        };
      }
    }

    if (turnCount >= maxTurns) {
      console.warn('[Task Processor] Reached max turns');
      finalResponse = finalResponse || 'Processing took too long. Some tasks may have been created.';
    }

    return {
      success: true,
      message: finalResponse,
      turns: turnCount
    };
  }

  /**
   * Execute a tool by name
   */
  async executeTool(toolName, args) {
    const tool = this.tools.find(t => t.name === toolName);
    
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    if (!tool.handler) {
      throw new Error(`Tool ${toolName} has no handler`);
    }

    return await tool.handler(args);
  }
}

export default TaskProcessorAgent;


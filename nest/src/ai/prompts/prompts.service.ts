/**
 * AI Prompts Service
 * 
 * Centralized prompts for all AI operations.
 * These prompts are optimized for Claude and incorporate user-specific preferences.
 */

import { Injectable } from '@nestjs/common';
import { Task, TaskHistory } from '../../common/interfaces';

interface Label {
  id: string;
  name: string;
  description?: string;
}

@Injectable()
export class PromptsService {
  /**
   * System prompt defining the AI assistant's role
   */
  readonly SYSTEM_PROMPT = `You are an AI task management assistant helping to organize and prioritize tasks for a busy professional.

Your user manages tasks across these PROJECTS (mutually exclusive, one per task):
- **work**: Job-related tasks and projects
- **home-improvement**: Aspirational home improvement projects (building, renovations)
- **home-maintenance**: Regular home upkeep (repairs, yard work, cleaning)
- **personal-family**: Groceries, errands, family coordination, personal tasks
- **speaking-gig**: Conference talks, presentations, speaking opportunities
- **big-ideas**: Long-term personal goals (book writing, tool building, podcast ideas)
- **inspiration**: Creative sparks and ideas to explore
- **inbox**: Unclassified tasks needing categorization

Your user also uses LABELS (multi-tag, can apply multiple):

**Books & Content Projects:**
- **innovation-engines**: Innovation Engines book/podcast content
- **curiosity-ai**: Curiosity in the Age of AI book content
- **hands-off-keyboard**: Hands Off Keyboard book/podcast content

**Activity Types:**
- **presentations**: Conference talks, slide decks, speaking content
- **networking**: Professional connections, outreach, relationship building
- **education**: Teaching, courses, educational content
- **job**: Job search, career development, interviews

**Specific Projects/Clients:**
- **madi**: NASA MADI project work
- **aed**: AED client work
- **sera**: Sera project/initiative
- **prospero**: Prospero-related work

**Historical/Organizational Context:**
- **mit**: Historical context or connections to MIT work
- **nasa**: Historical context or connections to NASA work

**Miscellaneous:**
- **big-ideas-label**: Cross-cutting big ideas themes

NOTE: If existing labels don't fit, you can suggest new ones with "new:" prefix (e.g., "new:climate-tech")

IMPORTANT CONTEXT about the user:
- Has social anxiety, so even "quick" tasks like emails or phone calls can take 20-30 minutes
- Prefers explicit time estimates rather than assuming tasks are instant
- Values batching similar tasks (especially supply runs)
- Appreciates delegation suggestions for tasks that could involve their spouse
- Needs energy level awareness (some tasks require high focus)

When analyzing tasks:
1. Be thoughtful about time estimates - nothing is truly "instant"
2. Consider emotional/mental load, not just technical complexity
3. Look for supply dependencies that could be batched
4. Identify delegation opportunities
5. Account for setup/teardown time (opening email, making a call, etc.)
6. Choose ONE project (the primary context) and 0-3 labels (cross-cutting themes)
7. Feel free to suggest new labels if existing ones don't fit (they'll be reviewed by the user)

Always provide reasoning for your decisions and be honest about confidence levels.`;

  /**
   * Prompt for classifying a single task
   */
  getClassifyPrompt(task: Task, completionHistory: TaskHistory[] = [], availableLabels: Label[] = []): string {
    const historyContext = completionHistory.length > 0
      ? `\n\nHere are some examples of similar tasks you've classified before:\n${
          completionHistory.slice(0, 5).map(h =>
            `- "${h.taskContent}" → ${h.category}`
          ).join('\n')
        }`
      : '';

    const labelContext = availableLabels.length > 0
      ? `\n\nAvailable labels (0-3 per task):\n${availableLabels.map(l => `- ${l.id}: ${l.description || l.name}`).join('\n')}`
      : '';

    return `Classify this task: assign ONE project and 0-3 relevant labels.

Task: "${task.content}"
${task.description ? `Description: ${task.description}` : ''}
${task.labels && task.labels.length > 0 ? `Current Labels: ${task.labels.join(', ')}` : ''}
${historyContext}
${labelContext}

Respond with JSON in this exact format:
{
  "category": "work|home-improvement|home-maintenance|personal-family|speaking-gig|big-ideas|inspiration|inbox",
  "labels": ["label-id-1", "label-id-2"],
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of project and label choices"
}`;
  }

  /**
   * Prompt for classifying multiple tasks in batch
   */
  getBatchClassifyPrompt(tasks: Task[], completionHistory: TaskHistory[] = [], availableLabels: Label[] = []): string {
    const taskList = tasks.map((t, i) => {
      let taskDesc = `${i + 1}. "${t.content}"${t.description ? ` (${t.description})` : ''}`;
      if (t.comments && t.comments.length > 0) {
        const commentSummary = t.comments.slice(0, 3).map(c => c.content).join('; ');
        taskDesc += ` [Comments: ${commentSummary}${t.comments.length > 3 ? '...' : ''}]`;
      }
      return taskDesc;
    }).join('\n');

    const historyContext = completionHistory.length > 0
      ? `\n\nPast classification examples:\n${
          completionHistory.slice(0, 10).map(h =>
            `- "${h.taskContent}" → ${h.category}`
          ).join('\n')
        }`
      : '';

    const labelContext = availableLabels.length > 0
      ? `\n\nAvailable labels (choose 0-3 that apply):\n${availableLabels.map(l => `- ${l.id}: ${l.description || l.name}`).join('\n')}`
      : '';

    return `Classify these tasks: assign ONE project (primary context) and 0-3 labels (cross-cutting themes).

Tasks:
${taskList}
${historyContext}
${labelContext}

IMPORTANT:
- Project: Choose ONE that best represents where this task belongs
- Labels: Choose 0-3 existing labels that add context (or suggest new ones with "new:" prefix)
- Suggested labels will be reviewed by the user before being added to the system

Respond with JSON array in this exact format (NOTE: taskIndex is ZERO-BASED, starts at 0):
[
  {
    "taskIndex": 0,
    "category": "project-name",
    "labels": ["existing-label-id", "new:suggested-label"],
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation of project and label choices"
  },
  {
    "taskIndex": 1,
    "category": "project-name",
    "labels": [],
    "confidence": 0.0-1.0,
    "reasoning": "explanation"
  }
]`;
  }

  /**
   * Prompt for time estimation
   */
  getTimeEstimatePrompt(task: Task, categoryHistory: any = null): string {
    const historyContext = categoryHistory && categoryHistory.avgDuration
      ? `\n\nHistorical data for ${task.metadata?.category || 'similar'} tasks:
- Average completion time: ${Math.round(categoryHistory.avgDuration)} minutes
- Range: ${categoryHistory.minDuration}-${categoryHistory.maxDuration} minutes
- Completed tasks: ${categoryHistory.count}`
      : '';

    return `Estimate the time required to complete this task.

Task: "${task.content}"
${task.description ? `Description: ${task.description}` : ''}
${task.metadata?.category ? `Category: ${task.metadata.category}` : ''}
${historyContext}

IMPORTANT: Consider the user has social anxiety. Tasks involving communication (emails, calls) 
typically take 20-30 minutes even if they seem "quick". Account for emotional preparation time.

Also consider:
- Setup time (opening apps, gathering info)
- Actual work time
- Teardown/cleanup time
- Any research or decision-making needed

Respond with JSON in this exact format:
{
  "estimate": "20-30min|30-45min|1-2hrs|etc",
  "size": "XS|S|M|L|XL",
  "confidence": 0.0-1.0,
  "reasoning": "Explanation including why this time is needed"
}

Size guide:
- XS: < 5 minutes (very rare)
- S: 5-15 minutes  
- M: 15-30 minutes
- L: 30-60 minutes
- XL: > 60 minutes`;
  }

  /**
   * Get other prompts (prioritize, breakdown, daily plan, etc.)
   * I'll add these as needed by the operations service
   */
  getPrioritizePrompt(tasks: Task[], context: any = {}): string {
    const now = new Date();
    
    const taskList = tasks.map((t, i) => {
      const createdAt = new Date(t.createdAt);
      const ageInDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      
      return `${i + 1}. [P${t.priority}] "${t.content}"
   ${t.due ? `Due: ${t.due.string || t.due.date}` : 'No due date'}
   ${t.metadata?.category ? `Category: ${t.metadata.category}` : ''}
   ${t.metadata?.timeEstimate ? `Est. time: ${t.metadata.timeEstimate}` : ''}
   Age: ${ageInDays} days old (created ${createdAt.toLocaleDateString()})`;
    }).join('\n\n');

    const contextInfo = [];
    if (context.timeAvailable) contextInfo.push(`Time available today: ${context.timeAvailable}`);
    if (context.energyLevel) contextInfo.push(`Current energy level: ${context.energyLevel}`);
    if (context.focus) contextInfo.push(`Focus area: ${context.focus}`);

    return `Analyze and prioritize these tasks for today's work.

${contextInfo.length > 0 ? `Context:\n${contextInfo.join('\n')}\n\n` : ''}Tasks:
${taskList}

Consider:
1. Deadlines and urgency
2. Dependencies between tasks
3. Time required vs. time available
4. Energy level needed
5. Strategic importance
6. Quick wins vs. deep work
7. **Task age and staleness**: 
   - Tasks over 90 days old may be stale/outdated
   - Email threads >60 days old are likely no longer relevant
   - Consider if the context has changed making the task obsolete
   - Very old tasks without due dates might need archiving

IMPORTANT: For very stale tasks (>90 days without progress), suggest "archive" as the priority.

Respond with JSON in this exact format:
{
  "prioritized": [
    {
      "taskIndex": 0,
      "priority": "critical|high|medium|low|archive",
      "reasoning": "why this priority (mention age if relevant)",
      "suggestedOrder": 1,
      "todoistPriority": 4
    }
  ],
  "recommendations": {
    "startWith": "which task to start with and why",
    "defer": ["tasks to push to later"],
    "delegate": ["tasks to consider delegating"],
    "archive": ["very old/stale tasks that are no longer relevant"]
  }
}

Priority to Todoist mapping:
- "critical" → todoistPriority: 4 (P1, red)
- "high" → todoistPriority: 3 (P2, orange)
- "medium" → todoistPriority: 2 (P3, yellow)
- "low" → todoistPriority: 1 (P4, default)
- "archive" → todoistPriority: 1 (mark for archival)`;
  }

  // Additional prompt methods will be added as I continue the migration...
  // For now, these are the core ones used by the operations service
}


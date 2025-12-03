/**
 * AI Prompt Library
 * 
 * Centralized prompts for all AI operations in the task management system.
 * These prompts are optimized for Claude and incorporate user-specific preferences
 * for categorization, time estimation, and prioritization.
 * 
 * All prompts request structured JSON output for reliable parsing.
 */

/**
 * System prompt defining the AI assistant's role and context
 */
export const SYSTEM_PROMPT = `You are an AI task management assistant helping to organize and prioritize tasks for a busy professional.

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
 * Prompt for classifying a single task into a life area category
 */
export function getClassifyPrompt(task, completionHistory = [], availableLabels = []) {
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
export function getBatchClassifyPrompt(tasks, completionHistory = [], availableLabels = []) {
  const taskList = tasks.map((t, i) =>
    `${i + 1}. "${t.content}"${t.description ? ` (${t.description})` : ''}`
  ).join('\n');

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
export function getTimeEstimatePrompt(task, categoryHistory = null) {
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
 * Prompt for prioritizing a list of tasks
 */
export function getPrioritizePrompt(tasks, context = {}) {
  const taskList = tasks.map((t, i) =>
    `${i + 1}. [P${t.priority}] "${t.content}"
   ${t.due ? `Due: ${t.due.string || t.due.date}` : 'No due date'}
   ${t.metadata?.category ? `Category: ${t.metadata.category}` : ''}
   ${t.metadata?.timeEstimate ? `Est. time: ${t.metadata.timeEstimate}` : ''}`
  ).join('\n\n');

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

Respond with JSON in this exact format:
{
  "prioritized": [
    {
      "taskIndex": 0,
      "priority": "critical|high|medium|low",
      "reasoning": "why this priority",
      "suggestedOrder": 1
    }
  ],
  "recommendations": {
    "startWith": "which task to start with and why",
    "defer": ["tasks to push to later"],
    "delegate": ["tasks to consider delegating"]
  }
}`;
}

/**
 * Prompt for breaking down a complex task into subtasks
 */
export function getBreakdownPrompt(task) {
  return `Break down this task into actionable subtasks.

Task: "${task.content}"
${task.description ? `Description: ${task.description}` : ''}
${task.metadata?.category ? `Category: ${task.metadata.category}` : ''}

Create a clear sequence of subtasks that:
1. Are specific and actionable
2. Have clear completion criteria
3. Are ordered logically
4. Include any supply/preparation needs
5. Account for dependencies

Respond with JSON in this exact format:
{
  "subtasks": [
    {
      "content": "specific subtask description",
      "order": 1,
      "timeEstimate": "5-10min",
      "needsSupplies": false,
      "supplies": []
    }
  ],
  "totalEstimate": "combined time estimate",
  "supplyList": ["list of all supplies needed"],
  "notes": "any important considerations"
}`;
}

/**
 * Prompt for suggesting a daily plan
 */
export function getDailyPlanPrompt(tasks, context = {}) {
  const taskList = tasks.map((t, i) =>
    `${i + 1}. "${t.content}" [${t.metadata?.timeEstimate || 'unknown time'}]
   Category: ${t.metadata?.category || 'unknown'}
   ${t.due ? `Due: ${t.due.string || t.due.date}` : ''}
   ${t.metadata?.needsSupplies ? '⚠️ Needs supplies' : ''}
   ${t.metadata?.canDelegate ? '👥 Can delegate' : ''}`
  ).join('\n\n');

  return `Create an optimized daily plan from these tasks.

Available tasks:
${taskList}

${context.hoursAvailable ? `Available time: ${context.hoursAvailable} hours` : ''}
${context.energyLevel ? `Energy level: ${context.energyLevel}` : ''}

Consider:
- Time available vs. task estimates
- Energy levels throughout the day
- Batching similar tasks (supply runs, emails)
- High-priority deadlines
- Delegation opportunities
- Weekend vs. weekday appropriateness

Respond with JSON in this exact format:
{
  "today": {
    "tasks": [
      {
        "taskIndex": 0,
        "scheduledTime": "morning|midday|afternoon|evening",
        "reasoning": "why schedule this now"
      }
    ],
    "totalTime": "estimated total time"
  },
  "thisWeek": {
    "tasks": [taskIndex, ...],
    "reasoning": "why these this week"
  },
  "needsSupplies": {
    "tasks": [taskIndex, ...],
    "shoppingList": ["items to buy"],
    "suggestion": "shopping strategy"
  },
  "delegateToSpouse": {
    "tasks": [taskIndex, ...],
    "reasoning": "why these are good to delegate"
  },
  "notes": "overall strategy and recommendations"
}`;
}

/**
 * Prompt for identifying supply needs across tasks
 */
export function getSupplyAnalysisPrompt(tasks) {
  const taskList = tasks.map((t, i) =>
    `${i + 1}. "${t.content}"${t.description ? ` - ${t.description}` : ''}`
  ).join('\n');

  return `Analyze these tasks for supply and material needs.

Tasks:
${taskList}

Identify:
1. What supplies/materials each task needs
2. Which tasks could be batched by shopping trip
3. Estimated costs if obvious
4. Where to buy (hardware store, grocery, online, etc.)

Respond with JSON in this exact format:
{
  "taskSupplies": [
    {
      "taskIndex": 0,
      "supplies": ["item1", "item2"],
      "store": "where to buy",
      "estimatedCost": "rough estimate or null"
    }
  ],
  "shoppingTrips": [
    {
      "store": "store name",
      "tasks": [taskIndexes],
      "items": ["combined shopping list"]
    }
  ],
  "recommendations": "suggestions for efficient supply acquisition"
}`;
}

/**
 * Prompt for natural language search
 */
export function getSearchPrompt(query, tasks) {
  const taskList = tasks.map((t, i) =>
    `${i + 1}. "${t.content}"${t.description ? ` - ${t.description}` : ''}
   Category: ${t.metadata?.category || 'none'}`
  ).join('\n');

  return `Find tasks matching this search query: "${query}"

Available tasks:
${taskList}

Match based on:
- Content and description keywords
- Semantic meaning and intent
- Category relevance
- Related concepts

Respond with JSON in this exact format:
{
  "matches": [
    {
      "taskIndex": 0,
      "relevanceScore": 0.0-1.0,
      "reasoning": "why this matches"
    }
  ],
  "interpretation": "what you understood from the query"
}`;
}

/**
 * Prompt for analyzing completion patterns (insights)
 */
export function getInsightsPrompt(history, currentTasks) {
  const historyByCategory = {};
  for (const h of history) {
    if (!historyByCategory[h.category]) {
      historyByCategory[h.category] = [];
    }
    historyByCategory[h.category].push(h);
  }

  const summaryText = Object.entries(historyByCategory)
    .map(([cat, items]) => `${cat}: ${items.length} completed`)
    .join(', ');

  return `Analyze task completion patterns and provide insights.

Completion history (last 30 days):
${summaryText}

Current active tasks: ${currentTasks.length}

Provide insights about:
1. Productivity patterns
2. Category balance (over/under-invested areas)
3. Potential bottlenecks
4. Suggestions for improvement

Respond with JSON in this exact format:
{
  "patterns": [
    {
      "observation": "what you noticed",
      "category": "relevant category or 'general'",
      "significance": "why this matters"
    }
  ],
  "recommendations": [
    {
      "suggestion": "what to do",
      "reasoning": "why this would help"
    }
  ],
  "summary": "overall assessment"
}`;
}


/**
 * AI Prompts Service
 * 
 * Centralized prompts for all AI operations.
 * These prompts are optimized for Claude and incorporate user-specific preferences.
 */

import { Injectable } from '@nestjs/common';
import { Task, TaskHistory, TaskInsightStats } from '../../common/interfaces';

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
8. Identify scheduling constraints:
   - requiresDriving: Does this task require physically going somewhere? (store, appointment, office)
   - timeConstraint: When can this task be done?
     * "business-hours" - Must be done Mon-Fri 9am-5pm (banks, offices, business calls, doctor appointments)
     * "weekdays-only" - Must be done Mon-Fri but not time-restricted (contractor meetings, deliveries)
     * "evenings" - Best done after work hours (family activities, personal projects)
     * "weekends" - Best done Sat/Sun (yard work, home projects, family time)
     * "anytime" - No scheduling constraints (online tasks, flexible activities)

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
- For each task, also identify scheduling constraints (requiresDriving, timeConstraint)

Respond with JSON array in this exact format (NOTE: taskIndex is ZERO-BASED, starts at 0):
[
  {
    "taskIndex": 0,
    "category": "project-name",
    "labels": ["existing-label-id", "new:suggested-label"],
    "requiresDriving": true|false,
    "timeConstraint": "business-hours|weekdays-only|evenings|weekends|anytime",
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation of project, label, and scheduling choices"
  },
  {
    "taskIndex": 1,
    "category": "project-name",
    "labels": [],
    "requiresDriving": false,
    "timeConstraint": "anytime",
    "confidence": 0.0-1.0,
    "reasoning": "explanation"
  }
]

Scheduling constraints:
- requiresDriving: Does this require physically going somewhere? (stores, appointments, offices)
- timeConstraint options:
  * "business-hours" - Must be done Mon-Fri 9am-5pm (banks, offices, medical)
  * "weekdays-only" - Must be done Mon-Fri but flexible time
  * "evenings" - Best done after work hours
  * "weekends" - Best done Sat/Sun
  * "anytime" - No constraints`;
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

    return `Estimate the time required to complete this task and identify scheduling constraints.

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
- Travel time if the task requires going somewhere

TIME BUCKETS - Estimate to fit ONE of these buckets:
- 15 minutes or less
- 30 minutes
- 45 minutes
- 1 hour (60 min)
- 90 minutes
- 2 hours (120 min)

If a task would take MORE than 2 hours, it needs to be broken down into smaller subtasks.
Set timeEstimateMinutes to null and needsBreakdown to true.

If you cannot estimate the task (too vague, unclear scope, needs research first), 
set timeEstimateMinutes to null and needsBreakdown to true.

Respond with JSON in this exact format:
{
  "estimate": "15min|30min|45min|1hr|90min|2hr|needs-breakdown",
  "timeEstimateMinutes": 30,
  "needsBreakdown": false,
  "size": "XS|S|M|L|XL",
  "requiresDriving": true|false,
  "timeConstraint": "business-hours|weekdays-only|evenings|weekends|anytime",
  "confidence": 0.0-1.0,
  "reasoning": "Explanation including why this time is needed and any scheduling considerations"
}

Size guide:
- XS: ≤15 minutes
- S: 16-30 minutes  
- M: 31-60 minutes
- L: 61-120 minutes
- XL: > 120 minutes (needs breakdown!)

Scheduling constraints:
- requiresDriving: Does this require physically going somewhere? (stores, appointments, offices)
- timeConstraint options:
  * "business-hours" - Must be done Mon-Fri 9am-5pm (banks, offices, business calls, medical appointments)
  * "weekdays-only" - Must be done Mon-Fri but flexible time (contractor meetings, deliveries)
  * "evenings" - Best done after work hours (family activities, personal projects)
  * "weekends" - Best done Sat/Sun (yard work, home improvement, family time)
  * "anytime" - No constraints (online tasks, flexible personal tasks)`;
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

  /**
   * Prompt for generating task insights from pre-computed statistics
   * Statistics are computed in SQL, not by the AI (for accuracy)
   */
  getInsightsPrompt(stats: TaskInsightStats): string {
    // Format category distributions
    const activeCategoryList = Object.entries(stats.activeByCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => `  - ${cat}: ${count}`)
      .join('\n');

    const completedCategoryList = Object.entries(stats.completedByCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => `  - ${cat}: ${count}`)
      .join('\n');

    // Format completion times
    const completionTimeList = Object.entries(stats.avgCompletionTimeByCategory)
      .filter(([, time]) => time !== null)
      .map(([cat, time]) => `  - ${cat}: ${Math.round(time as number)} min avg`)
      .join('\n');

    // Format stale tasks for archival suggestions
    const staleTaskList = stats.stalestTasks
      .map(t => `  - "${t.content}" (${t.category}, ${t.ageInDays} days old)`)
      .join('\n');

    // Format top labels
    const labelList = stats.topLabels
      .map(l => `  - ${l.label}: ${l.count} tasks`)
      .join('\n');

    return `Analyze the following PRE-COMPUTED task management statistics. These numbers are exact counts from the database - do not estimate or recalculate them.

=== OVERVIEW ===
Total active tasks: ${stats.totalActive}
Completed in last 30 days: ${stats.totalCompletedLast30Days}

=== ACTIVE TASKS BY CATEGORY ===
${activeCategoryList || '  (no data)'}

=== COMPLETED TASKS BY CATEGORY (Last 30 Days) ===
${completedCategoryList || '  (no data)'}

=== TASK AGE DISTRIBUTION (Active Tasks) ===
  - Recent (<7 days): ${stats.taskAgeBuckets.recent}
  - 7-30 days: ${stats.taskAgeBuckets.week}
  - 30-90 days: ${stats.taskAgeBuckets.month}
  - Stale (90+ days): ${stats.taskAgeBuckets.stale}

=== COMPLETION METRICS ===
  - 7-day completion rate: ${(stats.completionRateLast7Days * 100).toFixed(1)}%
  - 30-day completion rate: ${(stats.completionRateLast30Days * 100).toFixed(1)}%

=== AVERAGE COMPLETION TIME BY CATEGORY ===
${completionTimeList || '  (no data)'}

=== ESTIMATE COVERAGE ===
  - Tasks with time estimates: ${stats.tasksWithEstimates}
  - Tasks without estimates: ${stats.tasksWithoutEstimates}
  - Coverage: ${stats.totalActive > 0 ? ((stats.tasksWithEstimates / stats.totalActive) * 100).toFixed(1) : 0}%

=== DUE DATE STATUS ===
  - Overdue tasks: ${stats.overdueTasks}
  - Due in next 7 days: ${stats.dueSoon}

=== TOP LABELS (Active Tasks) ===
${labelList || '  (no labels)'}

=== STALEST TASKS (Candidates for Archival) ===
${staleTaskList || '  (none over 90 days)'}

Based on these statistics, provide insights about:
1. Productivity patterns (what's getting done vs. accumulating)
2. Category imbalances (over/under-represented areas)
3. Task hygiene issues (stale tasks, missing estimates, overdue items)
4. Specific actionable recommendations

Respond with JSON in this exact format:
{
  "insights": "A 2-3 sentence high-level summary of the most important findings",
  "recommendations": [
    "Specific actionable recommendation 1",
    "Specific actionable recommendation 2", 
    "Specific actionable recommendation 3"
  ],
  "patterns": [
    {
      "observation": "What you noticed in the data",
      "category": "productivity|balance|hygiene|bottleneck|other",
      "significance": "high|medium|low"
    }
  ],
  "summary": "One sentence TL;DR for quick reference"
}`;
  }
}


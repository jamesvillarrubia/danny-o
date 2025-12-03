# Label Strategy & Integration

## Current State

### Your Actual Todoist Labels (14 total)

**Organizations/Clients:**
- `AED` - American Education Development?
- `MIT` - Massachusetts Institute of Technology
- `NASA` - Space-related work
- `InnovationEngines` - Consulting/project work
- `MADI` - Project or client
- `Prospero` - Project or client
- `Sera` - Project or client

**Activity Types:**
- `Networking` - Relationship building, coffee chats
- `Presentations` - Speaking engagements, talks
- `Education` - Teaching, learning

**Projects/Themes:**
- `Big Ideas` - Long-term aspirational goals
- `Curiosity in the Age of AI` - Book or major project
- `Hands Off Keyboard` - Podcast or content project

**Context:**
- `job` - Career/employment related

### The Problem

The system currently has **two separate labeling systems**:

1. **Generic AI Categories** (what we built):
   ```
   work | home-repair | home-maintenance | personal-family | 
   speaking-gig | big-ideas | inbox-ideas
   ```
   - Stored in `task_metadata.category`
   - Mostly unused/empty
   - Generic life areas

2. **Your Real Labels** (what you use):
   ```
   MIT | NASA | Networking | Presentations | Big Ideas | etc.
   ```
   - Stored in `tasks.labels` (JSON array)
   - Specific and meaningful
   - Already in use

These don't talk to each other!

## Proposed Solution

### Strategy: AI-Powered Label Suggestion

Make the AI **suggest which of YOUR labels** to apply to tasks, instead of inventing generic categories.

### Implementation Plan

#### 1. Update AI Classification Prompt

**Old Prompt:**
```javascript
"Classify this task into: work, home-repair, personal-family..."
```

**New Prompt:**
```javascript
"Given these available labels:
- Organizations: MIT, NASA, AED, InnovationEngines, MADI, Prospero, Sera
- Activities: Networking, Presentations, Education
- Projects: Big Ideas, Curiosity in the Age of AI, Hands Off Keyboard
- Context: job

Suggest 0-3 appropriate labels for this task."
```

#### 2. Learn From Existing Patterns

Analyze tasks that already have labels:

```sql
-- "Big Ideas" tasks are often:
SELECT content FROM tasks WHERE labels LIKE '%Big Ideas%' LIMIT 5;
→ "Wealth vs Leverage"
→ "extraheric AI"  
→ Long-term thinking, philosophical

-- "NASA" tasks are often:
→ "Mock up Table Top exercise for AMRD"
→ Space, government, technical

-- "Networking" tasks are often:
→ "Ping Dan Goldin on Linkedin for Coffee Chat"
→ People connections, relationship building
```

The AI can learn these patterns and apply them to unlabeled tasks!

#### 3. Suggested Actions

**For New Tasks:**
```javascript
create_task("Setup coffee chat with MIT researcher")
→ AI auto-suggests: ["MIT", "Networking"]
→ User approves or modifies
```

**For Existing Unlabeled Tasks:**
```javascript
classify --all
→ AI reviews each task
→ Suggests labels based on content and patterns
→ Batch applies with confirmation
```

**For Agentic Processing:**
```javascript
process_text("Draft presentation about AI ethics for NASA")
→ AI creates task
→ Auto-applies: ["NASA", "Presentations", "Curiosity in the Age of AI"]
```

## Updated Data Model

### Keep Both Systems (Hybrid)

```javascript
task_metadata: {
  // High-level for analytics
  category: "work",  // Generic bucket
  
  // Your actual labels (suggested by AI)
  suggested_labels: ["MIT", "Networking"],
  label_confidence: 0.85,
  
  // Other AI metadata
  time_estimate: "30-45min",
  size: "M",
  energy_level: "medium"
}

tasks.labels: ["MIT", "Networking"]  // Actual Todoist labels
```

### Benefits

1. **Analytics**: Can still group by `category` for high-level stats
2. **Specificity**: Use real labels for filtering and organization
3. **AI Learning**: System learns your labeling patterns
4. **Suggestions**: AI suggests labels, you approve
5. **Backwards Compatible**: Existing labels preserved

## Implementation Steps

### Phase 1: AI Label Suggestion (Quick Win)

```javascript
// Update classification prompt
const LABEL_AWARE_PROMPT = `
Available labels:
${labels.map(l => `- ${l.name}: [context about when to use]`).join('\n')}

Suggest 0-3 labels for this task.
`;

// AI suggests labels
const result = await aiAgent.suggestLabels(task, availableLabels);
// → {suggested_labels: ["MIT", "Networking"], confidence: 0.8}
```

### Phase 2: Pattern Learning

```javascript
// Analyze existing labeled tasks
const patterns = await learning.analyzeLabels();
// → {
//     "MIT": {keywords: ["research", "lab", "academic"], context: "technical"},
//     "Networking": {keywords: ["coffee", "chat", "ping"], context: "social"}
//   }

// Use patterns for better suggestions
const improved = await aiAgent.suggestLabels(task, availableLabels, patterns);
```

### Phase 3: Bulk Classification

```javascript
// Classify all unlabeled tasks
const unlabeled = await storage.getTasks({labels: []});
const suggestions = await aiOps.suggestLabelsForTasks(unlabeled);

// Preview and confirm
console.log("AI suggests:");
suggestions.forEach(s => {
  console.log(`${s.task.content} → [${s.labels.join(', ')}]`);
});

// Apply with confirmation
if (confirm("Apply these labels?")) {
  await todoist.batchUpdateLabels(suggestions);
}
```

### Phase 4: Agentic Integration

```javascript
// Task Processor Agent uses real labels
const tools = [
  {
    name: 'get_available_labels',
    handler: async () => await storage.getLabels()
  },
  {
    name: 'suggest_labels',
    handler: async (args) => await aiAgent.suggestLabels(args.task, labels)
  },
  {
    name: 'apply_labels',
    handler: async (args) => await todoist.addLabelsToTask(args.taskId, args.labels)
  }
];

// AI automatically applies appropriate labels when creating tasks
```

## Example Workflows

### Workflow 1: Classify Existing Tasks

```bash
# AI suggests labels for all unlabeled tasks
pnpm run cli classify-labels --all

# Output:
🏷️  Label Suggestions (based on content analysis):

1. "Draft presentation on AI ethics"
   → Suggested: [Presentations, Curiosity in the Age of AI]
   → Confidence: 0.92

2. "Follow up with NASA about grant"
   → Suggested: [NASA, Networking]
   → Confidence: 0.85

3. "Brainstorm podcast topics"
   → Suggested: [Hands Off Keyboard, Big Ideas]
   → Confidence: 0.78

Apply all? [y/n]
```

### Workflow 2: Smart Task Creation

```bash
pnpm run cli process-text --text "Setup meeting with MIT lab about AI research"

# AI creates task with auto-suggested labels:
✅ Created "Setup meeting with MIT lab about AI research"
   Labels: [MIT, Networking, Education]
   (AI confidence: 0.88)
```

### Workflow 3: Pattern-Based Learning

```bash
pnpm run cli learn-labels

# Output:
📊 Label Usage Patterns:

MIT (45 tasks):
  - Common words: research, academic, lab, study
  - Often paired with: Networking, Education
  - Average priority: 3

NASA (23 tasks):
  - Common words: space, government, proposal, grant
  - Often paired with: Presentations, Big Ideas
  - Average priority: 4

Big Ideas (67 tasks):
  - Common words: long-term, vision, philosophy, future
  - Often standalone
  - Average priority: 2
```

## CLI Commands to Add

```bash
# List available labels
pnpm run cli labels list

# Suggest labels for unlabeled tasks
pnpm run cli labels suggest --all

# Classify with label suggestions
pnpm run cli classify --use-labels

# Learn from existing label patterns
pnpm run cli labels analyze

# Apply suggested labels
pnpm run cli labels apply <taskId> --labels "MIT,Networking"
```

## Benefits of This Approach

1. **Uses Your Actual System**: Works with labels you already use
2. **AI-Powered**: Suggests labels intelligently
3. **Learns Over Time**: Gets better as you use it
4. **Backwards Compatible**: Existing labels preserved
5. **Flexible**: Can still use generic categories for high-level views
6. **Agentic**: AI automatically labels when creating tasks
7. **Bulk Operations**: Classify many tasks at once

## Migration Path

1. **Keep generic categories** for now (for analytics)
2. **Add label suggestion** to classification
3. **Let users approve** AI suggestions
4. **Learn patterns** from existing labels
5. **Gradually improve** as more tasks get labeled
6. **Eventually retire** generic categories if not useful

## Questions to Clarify

1. **What do these labels mean?**
   - AED?
   - MADI?
   - Prospero?
   - Sera?

2. **How do you use them?**
   - Filter by client/organization?
   - Track projects?
   - Plan your week?

3. **What's missing?**
   - Are there labels you wish you had?
   - Labels you don't use anymore?

4. **Priority?**
   - Should we implement label suggestion first?
   - Or start with bulk classification?

---

**Bottom Line:** The AI should suggest YOUR labels (MIT, NASA, Networking, etc.) instead of generic categories. This makes the system match your actual workflow!


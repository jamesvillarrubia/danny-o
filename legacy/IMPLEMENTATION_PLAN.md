# Implementation Plan: Projects + Labels Classification

## The Correct Data Model

### Projects (Mutually Exclusive - ONE per task)

1. **Work** - Employment, consulting, client work
   - Former employers: MIT, NASA, Prospero
   - Current clients: AED
   - Any consulting/employment tasks

2. **Home Improvement** - Building new things, renovations, house projects
   - New additions to the house
   - Building projects for wife
   - Major improvements

3. **Home Maintenance** - Regular upkeep, routine repairs
   - Regular maintenance
   - Quick fixes
   - Routine household tasks

4. **Personal/Family** - Groceries, errands, family coordination
   - Shopping
   - Family errands
   - Personal appointments

5. **Speaking Gigs** - Presentations, talks, conference scheduling
   - Presentation prep
   - Speaking engagements
   - Follow-ups with event organizers
   - Talk scheduling

6. **Big Ideas** - Long-term aspirational projects
   - Writing books (Innovation Engines, Curiosity in the Age of AI, Hands Off Keyboard)
   - Building new tools/products
   - Long-term ventures
   - Aspirational goals

7. **Inspiration** - Ideas worth remembering, content capture
   - Interesting concepts
   - Content that could feed speaking gigs OR big ideas
   - Things that don't have a home yet
   - Ideas to remember for later

8. **Inbox** - Uncategorized/needs triage
   - New tasks awaiting classification
   - Unclear tasks
   - Temporary holding area

### Labels (Multi-tag - MULTIPLE per task)

**Book Projects:**
- `Innovation Engines` - Content/tasks for this book
- `Curiosity in the Age of AI` - Content/tasks for this book  
- `Hands Off Keyboard` - Content/tasks for this book

**Specific Projects/Contexts:**
- `MADI` - NASA project (for specificity)
- `AED` - Client work
- `Sera` - TBD (clarify with user)

**Activity Types:**
- `Presentations` - Content/inspiration for talks
- `Networking` - Relationship building, coffee chats

**Organizations (for context, not primary):**
- `MIT` - Former employer context (keep for history)
- `NASA` - Former employer context (keep for history)
- `Prospero` - Former employer context (keep for history)

**Archive/Deprecate:**
- `Big Ideas` - Redundant with Big Ideas project
- `Education` - MIT-related, complete
- `job` - Job hunting phase complete

## Implementation Steps

### Phase 1: Update AI Classification System ✅ CRITICAL

#### 1.1 Update Prompts (`src/ai/prompts.js`)

**Current (WRONG):**
```javascript
Categories:
- Work: Tasks related to professional duties...
- Home Repair: Tasks involving fixing...
```

**New (CORRECT):**
```javascript
Projects (choose ONE - mutually exclusive):
1. Work - Employment, consulting, client work
2. Home Improvement - Building new things, renovations, house projects
3. Home Maintenance - Regular upkeep, routine repairs
4. Personal/Family - Groceries, errands, family tasks
5. Speaking Gigs - Presentations, talks, scheduling
6. Big Ideas - Long-term aspirational projects (books, tools)
7. Inspiration - Ideas worth remembering, content capture
8. Inbox - Uncategorized/needs triage

Labels (suggest 0-3 - can be multiple):
- Book Projects: Innovation Engines, Curiosity in the Age of AI, Hands Off Keyboard
- Projects/Contexts: MADI, AED, Sera
- Activity Types: Presentations, Networking
- Organizations: MIT, NASA, Prospero (for context)

Example:
Task: "Draft chapter on AI ethics"
→ Project: Big Ideas (it's a book writing task)
→ Labels: [Curiosity in the Age of AI, Presentations]
```

#### 1.2 Update Classification Logic

```javascript
// Current: Returns generic category
async classifyTask(task) {
  return { category: "work", effort_estimate: "M" };
}

// New: Returns project + labels
async classifyTask(task) {
  return {
    project: "Big Ideas",                    // ONE project
    labels: ["Curiosity in the Age of AI"],  // 0-3 labels
    effort_estimate: "M",
    confidence: 0.85,
    reasoning: "This is book writing work for your AI book"
  };
}
```

#### 1.3 Update Storage

```javascript
// task_metadata table - ADD these columns:
ALTER TABLE task_metadata ADD COLUMN suggested_project TEXT;
ALTER TABLE task_metadata ADD COLUMN suggested_labels TEXT; -- JSON array
ALTER TABLE task_metadata ADD COLUMN project_confidence REAL;

// Deprecate: category column (or keep for backwards compat)
```

### Phase 2: Create Cross-Project Views ✅ HIGH PRIORITY

#### 2.1 CLI Commands

```bash
# List tasks by label (across all projects)
pnpm run cli list --label "Networking"
→ Shows all Networking tasks from Work, Speaking Gigs, etc.

# List tasks by project
pnpm run cli list --project "Big Ideas"
→ Shows only tasks in Big Ideas project

# List tasks by both
pnpm run cli list --project "Work" --label "AED"
→ Shows Work tasks related to AED client

# List all labels
pnpm run cli labels list
→ Shows all available labels and usage counts
```

#### 2.2 MCP Tools

```javascript
{
  name: 'list_tasks_by_label',
  description: 'List tasks with a specific label across all projects',
  inputSchema: {
    label: { type: 'string' },
    completed: { type: 'boolean', default: false }
  }
}

{
  name: 'list_tasks_by_project',
  description: 'List tasks in a specific project',
  inputSchema: {
    project: { 
      type: 'string',
      enum: ['Work', 'Home Improvement', 'Home Maintenance', 
             'Personal/Family', 'Speaking Gigs', 'Big Ideas', 
             'Inspiration', 'Inbox']
    }
  }
}
```

#### 2.3 Update Storage Queries

```javascript
// Add to SQLiteAdapter
async getTasksByLabel(labelName, filters = {}) {
  const query = `
    SELECT t.*, m.category, m.suggested_project, m.suggested_labels
    FROM tasks t
    LEFT JOIN task_metadata m ON t.id = m.task_id
    WHERE t.labels LIKE ?
    AND t.is_completed = ?
    ORDER BY t.priority DESC, t.created_at DESC
  `;
  
  return this.db.prepare(query).all(
    `%"${labelName}"%`,
    filters.completed ? 1 : 0
  );
}

async getTasksByProject(projectName, filters = {}) {
  // Query by Todoist project_id
  const project = await this.getProjectByName(projectName);
  return this.getTasks({ 
    project_id: project.id,
    ...filters 
  });
}
```

### Phase 3: AI-Powered Label Management ✅ MEDIUM PRIORITY

#### 3.1 Label Suggestion System

```javascript
// AI suggests new labels as patterns emerge
async suggestNewLabels(tasks) {
  const prompt = `
    Analyze these tasks and suggest new labels that would help organize them:
    ${tasks.map(t => t.content).join('\n')}
    
    Existing labels: ${existingLabels.join(', ')}
    
    Suggest 0-5 new labels that would add value.
  `;
  
  return aiAgent.query(prompt);
}
```

#### 3.2 Label Learning

```javascript
// Learn patterns from existing labels
async analyzeLabels() {
  const labelPatterns = {};
  
  for (const label of labels) {
    const tasks = await storage.getTasksByLabel(label.name);
    
    labelPatterns[label.name] = {
      count: tasks.length,
      commonWords: extractKeywords(tasks),
      averagePriority: calculateAverage(tasks, 'priority'),
      projectDistribution: countByProject(tasks),
      oftenPairedWith: findCommonPairings(tasks, label.name)
    };
  }
  
  return labelPatterns;
}
```

### Phase 4: Migration & Cleanup ✅ LOW PRIORITY

#### 4.1 Create Inspiration Project in Todoist

```javascript
// Via CLI or manually in Todoist
await todoist.createProject({
  name: "Inspiration",
  color: "purple"
});
```

#### 4.2 Archive/Deprecate Old Labels

```bash
# Generate report of label usage
pnpm run cli labels audit

# Shows:
# MIT: 45 tasks (all in Work project) - KEEP for context
# NASA: 23 tasks (all in Work project) - KEEP for context  
# Education: 3 tasks - ARCHIVE (no longer active)
# job: 5 tasks - ARCHIVE (phase complete)
# Big Ideas: 12 tasks - MIGRATE to "Big Ideas" project

# Migrate tasks with "Big Ideas" label to Big Ideas project
pnpm run cli migrate-label "Big Ideas" --to-project "Big Ideas"
```

#### 4.3 Bulk Reclassification

```bash
# AI reclassifies all 361 tasks
pnpm run cli classify-all --use-projects

# Preview:
🔄 Reclassifying 361 tasks with new project/label system...

"Setup coffee chat with MIT researcher"
  Current: category=work, labels=[]
  Suggested: project=Work, labels=[MIT, Networking]
  
"Draft chapter on AI ethics"  
  Current: category=inbox-ideas, labels=[Big Ideas]
  Suggested: project=Big Ideas, labels=[Curiosity in the Age of AI, Presentations]

Apply all changes? [y/n]
```

## Example Classification Results

### Example 1: Work Task
```
Input: "Follow up with AED about contract renewal"

AI Classification:
{
  project: "Work",
  labels: ["AED", "Networking"],
  effort_estimate: "20-30min",
  confidence: 0.92,
  reasoning: "This is client work (Work project) involving relationship 
              management (Networking) with AED client"
}
```

### Example 2: Big Idea Task
```
Input: "Draft outline for Innovation Engines chapter 3"

AI Classification:
{
  project: "Big Ideas",
  labels: ["Innovation Engines"],
  effort_estimate: "2-3 hours",
  confidence: 0.95,
  reasoning: "This is long-term book writing (Big Ideas project) 
              for your Innovation Engines book"
}
```

### Example 3: Speaking Gig Task
```
Input: "Prepare slides for NASA AI conference talk"

AI Classification:
{
  project: "Speaking Gigs",
  labels: ["NASA", "Presentations", "Curiosity in the Age of AI"],
  effort_estimate: "3-4 hours",
  confidence: 0.88,
  reasoning: "This is presentation prep (Speaking Gigs project), 
              related to NASA event, presentation content, and could 
              draw from your AI book"
}
```

### Example 4: Inspiration Task
```
Input: "Capture idea: wealth vs leverage dynamics"

AI Classification:
{
  project: "Inspiration",
  labels: ["Innovation Engines", "Presentations"],
  effort_estimate: "5-10min",
  confidence: 0.75,
  reasoning: "This is an idea worth remembering (Inspiration project) 
              that could go into Innovation Engines book or become 
              a talk topic"
}
```

### Example 5: Home Improvement Task
```
Input: "Build new shelving unit in garage for wife's craft supplies"

AI Classification:
{
  project: "Home Improvement",
  labels: [],
  effort_estimate: "4-6 hours",
  confidence: 0.93,
  reasoning: "This is building something new for the house 
              (Home Improvement project), not routine maintenance"
}
```

## Benefits of This System

### 1. Correct Data Model
- ✅ Projects = mutually exclusive containers (ONE per task)
- ✅ Labels = multi-tag descriptors (MULTIPLE per task)
- ✅ Matches your actual workflow

### 2. Cross-Project Views
- ✅ See all "Networking" tasks across Work, Speaking Gigs, etc.
- ✅ Filter by project when you want focused view
- ✅ Combine project + label for precision

### 3. AI Intelligence
- ✅ Suggests appropriate project based on task type
- ✅ Suggests relevant labels based on content
- ✅ Learns from your existing patterns
- ✅ Can suggest new labels as needs emerge

### 4. Flexibility
- ✅ Easy to add new projects as life evolves
- ✅ Labels can be created/deprecated dynamically
- ✅ System adapts to your workflow

## Implementation Order

### Phase 1 (Do First) - Core Classification Fix
1. Update AI prompts with correct projects
2. Update classification to return project + labels
3. Add storage columns for suggested_project
4. Test classification on sample tasks

### Phase 2 (High Value) - Cross-Project Views
1. Add CLI commands for label filtering
2. Add MCP tools for project/label queries
3. Update storage queries
4. Test with real tasks

### Phase 3 (Nice to Have) - Intelligence
1. Label learning system
2. New label suggestions
3. Pattern analysis
4. Label usage reports

### Phase 4 (Cleanup) - Migration
1. Create Inspiration project in Todoist
2. Audit existing labels
3. Archive deprecated labels
4. Bulk reclassification with preview

## Questions Before Implementation

1. **Sera label** - What is this? Big idea? Client? Something else?

2. **Inspiration project** - Should I create this in Todoist now, or do you want to do it manually?

3. **Priority** - Start with Phase 1 (fix classification) immediately? Or do you want Phase 2 (cross-project views) first?

4. **Migration** - Reclassify all 361 tasks now, or let them get reclassified organically as you work with them?

---

**This implementation will make the system match your actual mental model: Projects for WHERE tasks live, Labels for WHAT they're about.** 🎯


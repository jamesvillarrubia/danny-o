# AI Suggestion Workflow

## Overview

The system has **human-in-the-loop learning** where:
1. AI suggests new projects/labels based on patterns
2. Suggestions stored in database (not code)
3. You review and approve/defer/ignore
4. Approved suggestions promoted to YAML config
5. Ignored suggestions won't be suggested again

## Workflow States

```
AI Analyzes → suggested → (you review) → approved → promoted → YAML Config
                    ↓                          ↓
                  deferred                 ignored (soft delete)
```

### States Explained

- **suggested**: AI created this, waiting for your review
- **approved**: You liked it, ready to add to taxonomy
- **deferred**: Maybe later, keep for future consideration
- **ignored**: Don't suggest this again
- **promoted**: Added to YAML config, now official

## Database Tables

### `suggested_projects`
AI-suggested new project categories

```sql
- suggested_id: "community-work"
- suggested_name: "Community Work"
- description: "Volunteer and non-profit work"
- reasoning: "Found 15 tasks about volunteering..."
- status: suggested/approved/deferred/ignored
- times_suggested: 3 (AI suggested this 3 times)
- supporting_tasks: 15 (15 tasks would fit here)
```

### `suggested_labels`
AI-suggested new labels

```sql
- suggested_id: "climate-tech"
- suggested_name: "Climate Tech"  
- description: "Climate technology projects"
- suggested_category: "Projects & Contexts"
- reasoning: "Multiple tasks mention climate/sustainability..."
- status: suggested/approved/deferred/ignored
```

### `suggestion_history`
Audit trail of all suggestions and decisions

## CLI Commands

### View Pending Suggestions

```bash
pnpm run cli suggestions --list

# Output:
📋 Pending Suggestions (2)

📁 Community Work (project)
   ID: community-work
   Volunteer and non-profit work
   Suggested: 3 time(s)
   Supporting tasks: 15
   Reasoning: Found multiple tasks about volunteering...

🏷️ Climate Tech (label)
   ID: climate-tech
   Climate technology projects
   Suggested: 2 time(s)
   Supporting tasks: 8
   Reasoning: Several tasks mention climate/sustainability...
```

### Review a Specific Suggestion

```bash
pnpm run cli suggestions --review community-work --type project

# Output:
📁 Community Work (project)

ID: community-work
Description: Volunteer and non-profit work
Status: suggested

Reasoning: Found multiple tasks about volunteering, community service...

Suggested: 3 time(s)
Supporting tasks: 15
Keywords: volunteer, community, non-profit

Actions:
  Approve: pnpm run cli suggestions --approve community-work --type project
  Defer:   pnpm run cli suggestions --defer community-work --type project
  Ignore:  pnpm run cli suggestions --ignore community-work --type project
```

### Approve a Suggestion

```bash
pnpm run cli suggestions --approve community-work --type project

# Output:
✅ Approved: project/community-work

Promote to YAML with:
  pnpm run cli suggestions --promote community-work --type project
```

### Approve with Notes

```bash
pnpm run cli suggestions --approve climate-tech --type label \\
  --notes "Good idea, will use for green tech projects"

# Notes are stored for context
```

### Defer for Later

```bash
pnpm run cli suggestions --defer community-work --type project \\
  --notes "Maybe after current projects finish"

# Keeps it in DB but marks as deferred
# Won't show in pending list
```

### Ignore (Don't Suggest Again)

```bash
pnpm run cli suggestions --ignore climate-tech --type label \\
  --notes "Too niche, prefer broader categories"

# AI won't suggest this again
# Will be cleaned up after 90 days
```

### Promote to YAML

```bash
# View approved suggestions
pnpm run cli suggestions --approved

# Output:
✅ Approved Suggestions (1)

📁 Community Work (project)
   ID: community-work
   Volunteer and non-profit work
   Reviewed: 2025-12-02T10:30:00Z
   Ready to promote with: pnpm run cli suggestions --promote community-work --type project

# Promote it
pnpm run cli suggestions --promote community-work --type project

# Output:
✨ Promoted to YAML config!

Added: Community Work
New taxonomy version: 1.1

Reload with: pnpm run cli taxonomy --validate
```

### View Statistics

```bash
pnpm run cli suggestions --stats

# Output:
📊 Suggestion Statistics

Projects:
  Suggested: 2
  Approved: 1
  Deferred: 1
  Ignored: 0

Labels:
  Suggested: 3
  Approved: 2
  Deferred: 0
  Ignored: 1

Total:
  Pending Review: 5
  Ready to Promote: 3
```

## How AI Suggests

### Judicious Suggestion Rules

AI suggests new taxonomy items when:

1. **Pattern Detected**: Multiple tasks (5+) share common theme
2. **No Existing Match**: Doesn't fit current projects/labels well
3. **Clear Value**: Would improve organization
4. **Not Too Specific**: General enough to apply to multiple tasks

AI **does NOT** suggest for:
- One-off tasks
- Very specific project names (those are tasks, not categories)
- Slight variations of existing categories
- Temporary situations

### Example: When AI Suggests a Project

```
AI analyzes tasks and finds:
- "Volunteer at food bank" (Inbox)
- "Organize community clean-up" (Inbox)  
- "Mentor at youth program" (Inbox)
- "Help with neighborhood association" (Inbox)
- "Donate time to library" (Inbox)

All 5 tasks:
- Don't fit "Work" (not paid)
- Don't fit "Personal/Family" (community-focused)
- Don't fit "Big Ideas" (not aspirational projects)
- Share theme: community service

AI suggests:
{
  id: "community-work",
  name: "Community Work",
  description: "Volunteer and non-profit community service",
  reasoning: "Found 5 tasks about volunteering that don't fit existing projects",
  exampleTasks: [task1, task2, task3],
  keywords: ["volunteer", "community", "non-profit", "service"]
}
```

### Example: When AI Suggests a Label

```
AI analyzes labeled tasks and finds:
- Several "Work" tasks mention "climate"
- Several "Big Ideas" tasks mention "sustainability"
- No existing label captures this theme
- Would be useful for filtering/grouping

AI suggests:
{
  id: "climate-tech",
  name: "Climate Tech",
  category: "Projects & Contexts",
  description: "Climate technology and sustainability projects",
  reasoning: "Multiple tasks across projects mention climate/sustainability",
  appliesToProjects: ["work", "big-ideas"],
  keywords: ["climate", "sustainability", "green tech", "environment"]
}
```

## Integration with Classification

When AI classifies a task, it can suggest new taxonomy items:

```javascript
// AI classifying: "Organize neighborhood clean-up day"

classifyTask(task) {
  // Checks existing projects
  // None fit well
  
  // Checks for pattern
  // Finds 5 similar tasks
  
  // Suggests new project
  await suggestProject({
    id: "community-work",
    name: "Community Work",
    ...
  });
  
  // Meanwhile, puts task in Inbox
  return {
    project: "Inbox",
    labels: [],
    note: "Suggested new project: Community Work"
  };
}
```

## Approval Workflow Example

### Day 1: AI Suggests

```bash
# AI analyzing tasks...
# Found pattern: community service
# → Creates suggestion in DB
```

### Day 2: You Review

```bash
pnpm run cli suggestions --list

# See: Community Work project suggested
# Review details
pnpm run cli suggestions --review community-work --type project

# Looks good!
pnpm run cli suggestions --approve community-work --type project
```

### Day 3: You Promote

```bash
# Check approved suggestions
pnpm run cli suggestions --approved

# Promote to YAML
pnpm run cli suggestions --promote community-work --type project

# ✨ Now it's in task-taxonomy.yaml
# All future tasks can use it!
```

### Day 4: Classification Uses It

```bash
# New task: "Volunteer at library"
pnpm run cli process-text --text "Volunteer at library"

# AI now sees "Community Work" in taxonomy
# Classifies task into that project ✅
```

## Database Schema

```sql
-- Suggested projects table
CREATE TABLE suggested_projects (
  id INTEGER PRIMARY KEY,
  suggested_id TEXT UNIQUE,     -- e.g., "community-work"
  suggested_name TEXT,           -- e.g., "Community Work"
  description TEXT,
  reasoning TEXT,                -- Why AI suggested this
  example_tasks TEXT,            -- JSON array of task IDs
  suggested_keywords TEXT,       -- JSON array
  status TEXT,                   -- suggested/approved/deferred/ignored
  times_suggested INTEGER,       -- How many times AI suggested
  supporting_tasks INTEGER,      -- Count of tasks that would fit
  review_notes TEXT,             -- Your notes when reviewing
  ...
);

-- Same structure for suggested_labels
-- Plus suggestion_history for audit trail
```

## Benefits

### ✅ AI Learns
- Discovers patterns in your tasks
- Suggests improvements to taxonomy
- Adapts to your evolving workflow

### ✅ You Stay in Control
- Nothing changes without your approval
- Can defer suggestions for later
- Can ignore suggestions permanently

### ✅ Flexible & Safe
- Suggestions in DB, not code
- No risk of AI creating chaos
- Easy to promote good suggestions

### ✅ Audit Trail
- Full history of suggestions
- Track why you approved/ignored
- Understand taxonomy evolution

### ✅ Low Friction
- Simple CLI commands
- Clear review process
- Quick to promote good ideas

## Maintenance

### Regular Review

```bash
# Weekly: Check pending suggestions
pnpm run cli suggestions --list

# Monthly: Review statistics
pnpm run cli suggestions --stats

# Quarterly: Clean up old ignored suggestions
# (Happens automatically after 90 days)
```

### When to Approve

Approve if:
- ✅ Fits a real pattern in your workflow
- ✅ Would use it for multiple tasks
- ✅ Clear and not too specific
- ✅ Doesn't overlap with existing categories

### When to Defer

Defer if:
- 🤔 Maybe useful but not sure yet
- 🤔 Want to see if pattern continues
- 🤔 Need time to think about it

### When to Ignore

Ignore if:
- ❌ Too specific (one-off situation)
- ❌ Overlaps with existing categories
- ❌ Won't actually use it
- ❌ Based on temporary situation

## Advanced: Bulk Operations (Future)

```bash
# Review all pending suggestions at once
pnpm run cli suggestions --bulk-review

# Auto-approve high-confidence suggestions
pnpm run cli suggestions --auto-approve --confidence 0.9

# Export suggestions for external review
pnpm run cli suggestions --export suggestions.json
```

## Technical Notes

### Storage Location
- Suggestions: `data/tasks.db` (SQLite tables)
- Official taxonomy: `config/task-taxonomy.yaml`
- Migration: `migrations/002-suggested-taxonomy.sql`

### Code Modules
- `src/config/suggestion-manager.js` - Core suggestion logic
- `src/cli/index.js` - CLI commands
- `src/ai/*` - AI suggestion generation

### Promotion Process
1. Load YAML config
2. Add suggestion to appropriate section
3. Increment version number
4. Update timestamp
5. Write back to file
6. Mark suggestion as 'promoted' in DB

---

**The AI learns, you curate, the taxonomy evolves!** 🎯


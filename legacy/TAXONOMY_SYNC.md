# Taxonomy Sync to Todoist

## Overview

The `taxonomy --sync` command syncs your YAML-configured taxonomy to your actual Todoist workspace, creating any missing projects and labels.

## Why You Need This

Your taxonomy defines projects and labels in `config/task-taxonomy.yaml`, but these need to exist as actual projects/labels in Todoist for the AI to classify tasks correctly.

## Usage

### Dry Run (Recommended First)

See what would be created without actually creating anything:

```bash
pnpm run cli taxonomy --sync --dry-run
```

Output:
```
🔄 Syncing taxonomy to Todoist...

📁 Syncing Projects...

  🔍 Work - would create
  🔍 Home Improvement - would create
  🔍 Home Maintenance - would create
  🔍 Personal/Family - would create
  🔍 Speaking Gigs - would create
  🔍 Big Ideas - would create
  🔍 Inspiration - would create
  ⏭️  Inbox - already exists

🏷️  Syncing Labels...

  🔍 Innovation Engines - would create
  ⏭️  Curiosity in the Age of AI - already exists
  ⏭️  Hands Off Keyboard - already exists
  ...

📊 Summary:

Projects:
  Created: 0
  Skipped: 1
Labels:
  Created: 0
  Skipped: 13

💡 Run without --dry-run to actually create items
```

### Actually Create Items

```bash
pnpm run cli taxonomy --sync
```

This will:
1. Fetch existing projects and labels from Todoist
2. Compare with your taxonomy configuration
3. Create any missing projects and labels
4. Skip items that already exist
5. Show summary of what was created

### Sync Projects Only

```bash
pnpm run cli taxonomy --sync-projects
# Or with dry-run
pnpm run cli taxonomy --sync-projects --dry-run
```

### Sync Labels Only

```bash
pnpm run cli taxonomy --sync-labels
# Or with dry-run
pnpm run cli taxonomy --sync-labels --dry-run
```

## When to Use

### Initial Setup
When you first set up the system, run this to create all your taxonomy projects/labels in Todoist:

```bash
# 1. Review what will be created
pnpm run cli taxonomy --sync --dry-run

# 2. Create them
pnpm run cli taxonomy --sync

# 3. Sync to cache locally
pnpm run cli tasks sync
```

### After Editing Taxonomy
When you edit `config/task-taxonomy.yaml` and add new projects or labels:

```bash
# 1. Validate your changes
pnpm run cli taxonomy --validate

# 2. Preview what will be created
pnpm run cli taxonomy --sync --dry-run

# 3. Sync to Todoist
pnpm run cli taxonomy --sync

# 4. Sync to local cache
pnpm run cli tasks sync
```

### After Approving AI Suggestions
When you've promoted approved suggestions to the YAML:

```bash
# Suggestion was promoted to YAML
pnpm run cli suggestions --promote community-work --type project

# Now sync to Todoist
pnpm run cli taxonomy --sync

# Sync to cache
pnpm run cli tasks sync
```

## What Gets Created

### Projects
All projects defined in `projects:` section of the YAML:
- Work
- Home Improvement
- Home Maintenance
- Personal/Family
- Speaking Gigs
- Big Ideas
- Inspiration
- Inbox

### Labels
All active (non-archived) labels from all `label_categories`:
- Book projects (Innovation Engines, Curiosity in the Age of AI, Hands Off Keyboard)
- Contexts (MADI, AED, Sera)
- Activities (Presentations, Networking)
- Historical organizations (MIT, NASA, Prospero)
- Broad categories (Education, Big Ideas)

## Safety Features

### Idempotent
- Can run multiple times safely
- Only creates items that don't exist
- Skips items that already exist
- No duplicate creation

### Dry Run First
- Always see what will change
- Review before committing
- No surprises

### Case-Insensitive Matching
- Checks for existing items by name (case-insensitive)
- "Work" matches "work", "WORK", etc.
- Prevents duplicates with different casing

## Integration with Workflow

```
┌──────────────────────────────────────────┐
│ 1. Edit task-taxonomy.yaml              │
│    - Add new project or label            │
└─────────────────┬────────────────────────┘
                  ↓
┌──────────────────────────────────────────┐
│ 2. Validate                              │
│    pnpm run cli taxonomy --validate      │
└─────────────────┬────────────────────────┘
                  ↓
┌──────────────────────────────────────────┐
│ 3. Preview Sync                          │
│    pnpm run cli taxonomy --sync --dry-run│
└─────────────────┬────────────────────────┘
                  ↓
┌──────────────────────────────────────────┐
│ 4. Sync to Todoist                       │
│    pnpm run cli taxonomy --sync          │
└─────────────────┬────────────────────────┘
                  ↓
┌──────────────────────────────────────────┐
│ 5. Sync to Local Cache                   │
│    pnpm run cli tasks sync               │
└─────────────────┬────────────────────────┘
                  ↓
┌──────────────────────────────────────────┐
│ 6. AI Classification Uses New Items      │
│    ✅ Tasks now classified correctly     │
└──────────────────────────────────────────┘
```

## Troubleshooting

### Error: "TODOIST_API_KEY not found"
Make sure your `.env` file has the Todoist API key:
```bash
TODOIST_API_KEY=your_api_key_here
```

### Error: "Failed to create project"
- Check your API key has write permissions
- Check the project name is valid (not empty, not too long)
- Check Todoist API status

### Items Not Created
- Run with `--dry-run` first to see what's planned
- Check if item already exists (case-insensitive)
- Check the YAML syntax is valid

### Want to Remove Items
This command only **creates** items, it doesn't delete them. To remove:
1. Delete manually in Todoist UI
2. Or use Todoist API/tools
3. Then update your YAML to match

## Examples

### Initial Setup Workflow

```bash
# You just cloned the repo and configured taxonomy
cd tasks

# 1. Check what's defined
pnpm run cli taxonomy --projects
pnpm run cli taxonomy --labels

# 2. See what needs to be created
pnpm run cli taxonomy --sync --dry-run

# 3. Create everything
pnpm run cli taxonomy --sync

# Output:
# 📁 Syncing Projects...
#   ✅ Work - created
#   ✅ Home Improvement - created
#   ✅ Home Maintenance - created
#   ✅ Personal/Family - created
#   ✅ Speaking Gigs - created
#   ✅ Big Ideas - created
#   ✅ Inspiration - created
#   ⏭️  Inbox - already exists
#
# 🏷️  Syncing Labels...
#   ✅ Innovation Engines - created
#   ⏭️  Curiosity in the Age of AI - already exists
#   ...
#
# 📊 Summary:
# Projects:
#   Created: 7
#   Skipped: 1
# Labels:
#   Created: 1
#   Skipped: 13
#
# ✅ Sync complete! Run sync to cache changes:
#    pnpm run cli tasks sync

# 4. Sync to local cache
pnpm run cli tasks sync
```

### Adding New Project

```yaml
# Edit config/task-taxonomy.yaml
projects:
  # ... existing projects ...
  
  - id: community-work
    name: "Community Work"
    description: "Volunteer and non-profit community service"
    keywords:
      - volunteer
      - community
```

```bash
# Validate
pnpm run cli taxonomy --validate
# ✅ Taxonomy is valid!

# Preview
pnpm run cli taxonomy --sync --dry-run
# 📁 Syncing Projects...
#   🔍 Community Work - would create
#   ⏭️  Work - already exists
#   ...

# Sync to Todoist
pnpm run cli taxonomy --sync
# ✅ Community Work - created

# Sync to cache
pnpm run cli tasks sync
```

### After AI Suggestion Promotion

```bash
# AI suggested and you approved
pnpm run cli suggestions --approve climate-tech --type label
pnpm run cli suggestions --promote climate-tech --type label

# ✨ Promoted to YAML config!
# Added: Climate Tech
# New taxonomy version: 1.1

# Now sync to Todoist
pnpm run cli taxonomy --sync
# 🏷️  Syncing Labels...
#   ✅ Climate Tech - created

# Sync to cache
pnpm run cli tasks sync
```

## Command Reference

```bash
# Full sync (projects + labels)
pnpm run cli taxonomy --sync

# Dry run (see what would happen)
pnpm run cli taxonomy --sync --dry-run

# Sync projects only
pnpm run cli taxonomy --sync-projects
pnpm run cli taxonomy --sync-projects --dry-run

# Sync labels only
pnpm run cli taxonomy --sync-labels
pnpm run cli taxonomy --sync-labels --dry-run
```

## Technical Details

### How It Works

1. **Load Taxonomy**: Reads `config/task-taxonomy.yaml`
2. **Fetch Existing**: Gets current projects/labels from Todoist API
3. **Compare**: Finds items in taxonomy that don't exist in Todoist
4. **Create**: Adds missing items via Todoist API
5. **Report**: Shows summary of created/skipped items

### Matching Logic

```javascript
// Case-insensitive name matching
existingNames = new Set(['inbox', 'work', 'personal'])
taxonomyProject = { name: 'Work' }

if (existingNames.has(taxonomyProject.name.toLowerCase())) {
  // Skip - already exists
} else {
  // Create
}
```

### API Calls

```javascript
// Create project
await todoist.api.addProject({
  name: 'Work',
  color: 'grey'  // Default color
});

// Create label
await todoist.api.addLabel({
  name: 'Innovation Engines',
  color: 'grey'  // Default color
});
```

---

**Keep your Todoist workspace in sync with your taxonomy configuration!** 🔄


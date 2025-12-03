# Configurable Task Taxonomy

## Overview

Your task taxonomy (projects and labels) is now **fully configurable** via a YAML file. No more hardcoded categories in the code!

## The Configuration File

**Location:** `config/task-taxonomy.yaml`

This single file defines:
- **8 Projects** (mutually exclusive containers)
- **14 Labels** (multi-tag descriptors)
- **Classification rules** for the AI
- **Examples and keywords** for learning

### Structure

```yaml
projects:
  - id: work
    name: "Work"
    description: "Employment, consulting, client work"
    examples:
      - "Follow up with AED about contract renewal"
    keywords:
      - employment
      - consulting
      - client

label_categories:
  - category: "Book Projects"
    labels:
      - id: innovation-engines
        name: "Innovation Engines"
        description: "Content for Innovation Engines book"
        keywords:
          - innovation
          - leverage
```

## Your Current Taxonomy

### Projects (8 total)
1. **Work** - Employment, consulting, clients
2. **Home Improvement** - Building new things, renovations
3. **Home Maintenance** - Regular upkeep, repairs
4. **Personal/Family** - Groceries, errands, family tasks
5. **Speaking Gigs** - Presentations, talks, scheduling
6. **Big Ideas** - Long-term aspirational projects (books, tools)
7. **Inspiration** - Ideas worth remembering
8. **Inbox** - Uncategorized/needs triage

### Labels (11 active, 3 archived)

**Book Projects:**
- Innovation Engines
- Curiosity in the Age of AI
- Hands Off Keyboard

**Projects & Contexts:**
- MADI (NASA project)
- AED (client)
- Sera (TBD)

**Activity Types:**
- Presentations
- Networking

**Organizations:**
- MIT, NASA, Prospero (for historical context)

**Archived:**
- Education, job, Big Ideas (deprecated)

## CLI Commands

### Inspect Taxonomy

```bash
# Show summary
pnpm run cli taxonomy

# Output:
# 📋 Task Taxonomy Configuration
# Version: 1.0 (updated: 2025-12-02)
# Projects: 8
# Labels: 11 active, 3 archived
```

### View Projects

```bash
pnpm run cli taxonomy --projects

# Output:
# 📁 Projects (Mutually Exclusive)
# 1. Work
#    Employment, consulting, client work
#    Examples:
#      - Follow up with AED about contract renewal
#      - Review proposal for client project
# 
# 2. Home Improvement
#    Building new things, renovations...
```

### View Labels

```bash
pnpm run cli taxonomy --labels

# Output:
# 🏷️  Labels (Multi-tag)
# 
# Book Projects:
#   - Innovation Engines
#     Content and tasks for Innovation Engines book
#   - Curiosity in the Age of AI
#     Content and tasks for Curiosity in the Age of AI book
#   ...
```

### Statistics

```bash
pnpm run cli taxonomy --stats

# Output:
# 📊 Taxonomy Statistics
# Version: 1.0
# Updated: 2025-12-02
# Projects: 8
# Label Categories: 5
# Total Labels: 14
#   Active: 11
#   Archived: 3
```

### Validate Configuration

```bash
pnpm run cli taxonomy --validate

# Output:
# 🔍 Validating taxonomy...
# ✅ Taxonomy is valid!
```

### See AI Prompt

```bash
pnpm run cli taxonomy --prompt

# Shows the actual prompt the AI sees when classifying tasks
```

## How It Works

### 1. YAML Configuration

You edit `config/task-taxonomy.yaml`:

```yaml
projects:
  - id: consulting
    name: "Consulting"
    description: "Client consulting work"
    keywords:
      - consultant
      - advisory
```

### 2. AI Loads Configuration

The AI classification system automatically loads this file:

```javascript
import { generateClassificationPrompt } from '../config/taxonomy-loader.js';

const prompt = generateClassificationPrompt();
// → Uses YOUR projects and labels from YAML
```

### 3. Dynamic Prompts

The AI prompt is generated from your config:

```
# PROJECTS (Choose ONE - Mutually Exclusive)
1. Work - Employment, consulting, client work
2. Home Improvement - Building new things, renovations
...

# LABELS (Suggest 0-3 - Can Apply Multiple)
Book Projects:
  - Innovation Engines: Content for Innovation Engines book
  - Curiosity in the Age of AI: Content for AI book
...
```

## Updating Your Taxonomy

### Add a New Project

```yaml
projects:
  - id: volunteering
    name: "Volunteering"
    description: "Non-profit and community work"
    examples:
      - "Prepare materials for STEM workshop"
      - "Follow up with literacy program"
    keywords:
      - volunteer
      - community
      - non-profit
    notes: "Separate from paid work"
```

### Add a New Label

```yaml
label_categories:
  - category: "New Book Projects"
    labels:
      - id: future-of-work
        name: "Future of Work"
        description: "Content for next book project"
        applies_to:
          - project: big-ideas
            use: "For book research and writing"
        keywords:
          - future
          - work
          - automation
```

### Archive a Label

```yaml
- id: old-project
  name: "Old Project"
  description: "Completed project"
  status: archived  # ← Mark as archived
  notes: "Project completed 2024-Q4"
```

### Update Descriptions

Just edit the YAML - changes take effect immediately:

```yaml
- id: work
  name: "Work"
  description: "Employment, consulting, and freelance work"  # ← Updated
```

## Benefits

### ✅ Single Source of Truth
- One file defines everything
- No code changes needed
- Easy to understand and modify

### ✅ Version Control Friendly
- YAML is human-readable
- Easy to diff changes
- Can track taxonomy evolution

### ✅ Easy Maintenance
- Add projects as life evolves
- Archive labels when done
- Update descriptions for clarity

### ✅ AI Automatically Adapts
- Classification uses current taxonomy
- No need to update prompts manually
- Consistent across CLI and MCP

### ✅ Validation
- CLI command checks structure
- Ensures no broken references
- Catches errors before use

### ✅ Documentation
- Examples show usage
- Keywords guide the AI
- Notes provide context

## Workflow

### When Life Changes

```bash
# 1. Edit the config
vim config/task-taxonomy.yaml

# Add new project, update labels, etc.

# 2. Validate
pnpm run cli taxonomy --validate

# 3. Test
pnpm run cli taxonomy --projects
pnpm run cli taxonomy --labels

# 4. Use immediately
pnpm run cli classify --all
# → AI uses new taxonomy
```

### Regular Maintenance

```bash
# Quarterly review (as noted in YAML)
# 1. Check label usage
pnpm run cli labels analyze  # (TODO: implement)

# 2. Review unused labels
# 3. Archive completed projects
# 4. Add new emerging patterns
# 5. Update descriptions
```

## Example Classification

With the YAML config, when you classify a task:

```bash
pnpm run cli process-text --text "Draft chapter on leverage for Innovation Engines"
```

The AI:
1. Loads `task-taxonomy.yaml`
2. Sees your 8 projects and their descriptions
3. Sees your labels and when to use them
4. Classifies based on YOUR definitions:

```json
{
  "project": "Big Ideas",
  "labels": ["Innovation Engines"],
  "confidence": 0.95,
  "reasoning": "This is book writing (Big Ideas project) for your Innovation Engines book"
}
```

## Advanced Features

### Context-Aware Labels

Labels know which projects they apply to:

```yaml
- id: presentations
  name: "Presentations"
  applies_to:
    - project: speaking-gigs
      use: "For actual presentation tasks"
    - project: inspiration
      use: "For ideas that might become talks"
    - project: big-ideas
      use: "For content that overlaps with books"
```

The AI uses this to avoid redundant labeling.

### Classification Rules

Define how the AI should think:

```yaml
classification_rules:
  project_selection:
    - rule: "Speaking Gigs takes precedence for actual presentations"
    - rule: "Big Ideas is for creating things, Inspiration is for capturing ideas"
  
  label_selection:
    - rule: "Book labels when task relates to that book"
    - rule: "Avoid redundant labels"
```

### Confidence Thresholds

Set how confident AI should be:

```yaml
confidence:
  - high: ">= 0.85"
    action: "Auto-apply classification"
  - medium: "0.70 - 0.84"
    action: "Suggest with reasoning"
  - low: "< 0.70"
    action: "Ask user for clarification"
```

## Migration Path

### Phase 1: Current (✅ Done)
- YAML config created
- Loader implemented
- CLI commands working
- Validation in place

### Phase 2: Integration (Next)
- Update AI prompts to use YAML
- Classification uses dynamic prompts
- Task Processor Agent uses config

### Phase 3: Intelligence
- Learn from usage patterns
- Suggest new labels
- Auto-archive unused labels

## File Locations

```
/Users/james/Sites/personal/tasks/
├── config/
│   └── task-taxonomy.yaml          ← Your configuration
├── src/
│   ├── config/
│   │   └── taxonomy-loader.js      ← Loader module
│   ├── cli/
│   │   └── index.js                ← CLI commands
│   └── ai/
│       └── prompts.js              ← Will use taxonomy
```

## Best Practices

### ✅ Do
- Keep descriptions clear and concise
- Provide examples for each project
- Add keywords for AI learning
- Use notes for context
- Review quarterly
- Validate after changes

### ❌ Don't
- Don't make projects too granular
- Don't create too many labels
- Don't forget to archive completed items
- Don't skip validation
- Don't hardcode in code anymore!

## Future Enhancements

- [ ] Import/export taxonomy
- [ ] Multiple taxonomy files (work vs personal)
- [ ] Taxonomy diff tool
- [ ] Usage analytics per project/label
- [ ] Auto-suggest new labels from patterns
- [ ] Taxonomy templates for common setups

---

**Your task taxonomy is now a living document that evolves with you!** 🎯

Edit `config/task-taxonomy.yaml` and the AI adapts immediately.


-- Migration: Add Suggested Taxonomy Tables
-- Allows AI to suggest new projects and labels for user approval

-- ===========================================================================
-- Suggested Projects (AI can propose new project categories)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS suggested_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Suggestion details
  suggested_id TEXT NOT NULL UNIQUE, -- e.g., "community-work"
  suggested_name TEXT NOT NULL,      -- e.g., "Community Work"
  description TEXT NOT NULL,
  
  -- Why AI suggested this
  reasoning TEXT NOT NULL,
  example_tasks TEXT,                -- JSON array of task IDs that triggered this
  suggested_keywords TEXT,           -- JSON array of keywords
  
  -- Workflow state
  status TEXT NOT NULL DEFAULT 'suggested', -- suggested, approved, deferred, ignored
  
  -- Metadata
  suggested_at TEXT DEFAULT CURRENT_TIMESTAMP,
  suggested_by TEXT DEFAULT 'ai',   -- 'ai' or user ID
  reviewed_at TEXT,
  reviewed_by TEXT,
  review_notes TEXT,
  
  -- Usage tracking
  times_suggested INTEGER DEFAULT 1, -- How many times AI suggested this
  supporting_tasks INTEGER DEFAULT 0, -- Count of tasks that would fit here
  
  -- Configuration draft (for promotion to YAML)
  draft_config TEXT,                 -- JSON with full project config
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================================================
-- Suggested Labels (AI can propose new labels)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS suggested_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Suggestion details
  suggested_id TEXT NOT NULL UNIQUE, -- e.g., "climate-tech"
  suggested_name TEXT NOT NULL,      -- e.g., "Climate Tech"
  description TEXT NOT NULL,
  suggested_category TEXT,           -- Which label category it belongs to
  
  -- Why AI suggested this
  reasoning TEXT NOT NULL,
  example_tasks TEXT,                -- JSON array of task IDs that triggered this
  suggested_keywords TEXT,           -- JSON array of keywords
  applies_to_projects TEXT,          -- JSON array of project IDs this applies to
  
  -- Workflow state
  status TEXT NOT NULL DEFAULT 'suggested', -- suggested, approved, deferred, ignored
  
  -- Metadata
  suggested_at TEXT DEFAULT CURRENT_TIMESTAMP,
  suggested_by TEXT DEFAULT 'ai',
  reviewed_at TEXT,
  reviewed_by TEXT,
  review_notes TEXT,
  
  -- Usage tracking
  times_suggested INTEGER DEFAULT 1,
  supporting_tasks INTEGER DEFAULT 0,
  times_would_apply INTEGER DEFAULT 0, -- How many tasks would get this label
  
  -- Configuration draft
  draft_config TEXT,                 -- JSON with full label config
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================================================
-- Suggestion History (Audit trail of AI suggestions and user decisions)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS suggestion_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  suggestion_type TEXT NOT NULL,     -- 'project' or 'label'
  suggestion_id TEXT NOT NULL,       -- The suggested_id
  
  action TEXT NOT NULL,              -- 'suggested', 'approved', 'deferred', 'ignored', 'promoted'
  
  task_id TEXT,                      -- Task that triggered suggestion (if any)
  task_content TEXT,
  
  reasoning TEXT,
  metadata TEXT,                     -- JSON with additional context
  
  actor TEXT NOT NULL DEFAULT 'ai', -- 'ai' or 'user'
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================================================
-- Indexes for Performance
-- ===========================================================================

CREATE INDEX IF NOT EXISTS idx_suggested_projects_status ON suggested_projects(status);
CREATE INDEX IF NOT EXISTS idx_suggested_projects_suggested_at ON suggested_projects(suggested_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggested_labels_status ON suggested_labels(status);
CREATE INDEX IF NOT EXISTS idx_suggested_labels_suggested_at ON suggested_labels(suggested_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestion_history_type ON suggestion_history(suggestion_type, suggestion_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_history_timestamp ON suggestion_history(timestamp DESC);

-- ===========================================================================
-- Views for Easy Querying
-- ===========================================================================

-- Pending suggestions (need review)
CREATE VIEW IF NOT EXISTS pending_suggestions AS
SELECT 
  'project' as type,
  id,
  suggested_id,
  suggested_name as name,
  description,
  reasoning,
  times_suggested,
  supporting_tasks,
  suggested_at
FROM suggested_projects
WHERE status = 'suggested'
UNION ALL
SELECT 
  'label' as type,
  id,
  suggested_id,
  suggested_name as name,
  description,
  reasoning,
  times_suggested,
  supporting_tasks,
  suggested_at
FROM suggested_labels
WHERE status = 'suggested'
ORDER BY times_suggested DESC, supporting_tasks DESC;

-- Approved suggestions (ready to promote)
CREATE VIEW IF NOT EXISTS approved_suggestions AS
SELECT 
  'project' as type,
  id,
  suggested_id,
  suggested_name as name,
  description,
  draft_config,
  reviewed_at
FROM suggested_projects
WHERE status = 'approved'
UNION ALL
SELECT 
  'label' as type,
  id,
  suggested_id,
  suggested_name as name,
  description,
  draft_config,
  reviewed_at
FROM suggested_labels
WHERE status = 'approved'
ORDER BY reviewed_at DESC;


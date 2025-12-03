-- Migration 003: Per-Field Timestamps for Task Metadata
-- 
-- This migration adds per-field timestamps to track when AI made recommendations
-- and when we last synced with Todoist. This enables conflict detection between
-- manual changes in Todoist and AI recommendations.
--
-- Key additions:
-- - recommended_category (AI suggestion) vs current project (actual location)
-- - Timestamps for each AI-classified field
-- - Last synced state from Todoist for change detection
-- - Recommendation applied status

-- Note: This migration file is handled specially by the migration runner
-- It will check for existing columns before attempting to add them
-- to avoid errors when columns already exist from previous development

-- This is a marker file - actual migration is handled in code
-- See src/storage/sqlite.js runMigrations() for implementation
SELECT 1;

-- Migrate existing data from old columns to new columns
-- This preserves existing AI classifications while moving to new schema
UPDATE task_metadata 
SET 
  recommended_category = category,
  category_classified_at = CURRENT_TIMESTAMP,
  recommendation_applied = TRUE
WHERE category IS NOT NULL;

-- Migrate time estimates if they exist
UPDATE task_metadata
SET
  time_estimate_minutes = CAST(timeEstimate AS INTEGER),
  estimate_classified_at = CURRENT_TIMESTAMP
WHERE timeEstimate IS NOT NULL;

-- Note: Old columns (category, timeEstimate, aiConfidence, aiReasoning) are kept
-- temporarily for rollback safety. They will be removed in a future migration
-- after the new system is validated in production.


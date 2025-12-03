/**
 * SQLite Storage Adapter
 * 
 * Local storage implementation using SQLite for development and single-user scenarios.
 * Optimized for fast local queries with file-based storage.
 * 
 * Database schema:
 * - tasks: Core Todoist task data
 * - task_metadata: AI-generated enhancements
 * - task_history: Completion tracking for learning
 * - projects: Todoist projects
 * - labels: Todoist labels
 * - sync_state: Sync metadata
 */

import Database from 'better-sqlite3';
import { StorageAdapter } from './interface.js';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import { mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class SQLiteAdapter extends StorageAdapter {
  /**
   * @param {string} dbPath - Path to SQLite database file
   */
  constructor(dbPath) {
    super();
    this.dbPath = dbPath;
    this.db = null;
  }

  async initialize() {
    // Ensure data directory exists
    const dir = dirname(this.dbPath);
    mkdirSync(dir, { recursive: true });

    // Open database
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL'); // Better performance
    this.db.pragma('foreign_keys = ON');

    // Create schema
    this._createSchema();

    // Run migrations
    await this.runMigrations();
  }

  async runMigrations() {
    // Create migrations table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get project root (go up from src/storage/ to root)
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const projectRoot = resolve(__dirname, '../..');
    const migrationsDir = join(projectRoot, 'migrations');

    if (!existsSync(migrationsDir)) {
      console.log('[Storage] No migrations directory found, skipping');
      return;
    }

    // Get all migration files
    const migrationFiles = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const migrationId = file.replace('.sql', '');
      
      // Check if already applied
      const applied = this.db.prepare(`
        SELECT id FROM migrations WHERE id = ?
      `).get(migrationId);

      if (applied) {
        continue;
      }

      console.log(`[Storage] Running migration: ${migrationId}`);
      
      try {
        // Special handling for migration 003 - add columns conditionally
        if (migrationId === '003-per-field-timestamps') {
          this._runMigration003();
        } else {
          // Read and execute regular migration
          const migrationPath = join(migrationsDir, file);
          const sql = readFileSync(migrationPath, 'utf8');
          this.db.exec(sql);
        }
        
        // Record migration as applied
        this.db.prepare(`
          INSERT INTO migrations (id) VALUES (?)
        `).run(migrationId);
        
        console.log(`[Storage] Migration ${migrationId} completed`);
      } catch (error) {
        console.error(`[Storage] Migration ${migrationId} failed:`, error.message);
        throw error;
      }
    }
  }

  _runMigration003() {
    // Migration 003: Add columns only if they don't exist
    const columns = [
      { name: 'recommended_category', type: 'TEXT' },
      { name: 'category_classified_at', type: 'TIMESTAMP' },
      { name: 'time_estimate_minutes', type: 'INTEGER' },
      { name: 'estimate_classified_at', type: 'TIMESTAMP' },
      { name: 'priority_score', type: 'INTEGER' },
      { name: 'priority_classified_at', type: 'TIMESTAMP' },
      { name: 'last_synced_state', type: 'TEXT' },
      { name: 'last_synced_at', type: 'TIMESTAMP' },
      { name: 'recommendation_applied', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'classification_source', type: 'TEXT' }  // 'ai' or 'manual'
    ];

    // Get existing columns
    const existingColumns = this.db.prepare(`
      PRAGMA table_info(task_metadata)
    `).all();
    
    const existingColumnNames = new Set(existingColumns.map(c => c.name));

    // Add only missing columns
    for (const column of columns) {
      if (!existingColumnNames.has(column.name)) {
        console.log(`[Storage] Adding column: ${column.name}`);
        this.db.exec(`
          ALTER TABLE task_metadata ADD COLUMN ${column.name} ${column.type}
        `);
      } else {
        console.log(`[Storage] Column ${column.name} already exists, skipping`);
      }
    }

    // Migrate existing data: copy category to recommended_category if not already done
    const needsMigration = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM task_metadata 
      WHERE category IS NOT NULL 
      AND recommended_category IS NULL
    `).get();

    if (needsMigration.count > 0) {
      console.log(`[Storage] Migrating ${needsMigration.count} existing category values`);
      this.db.exec(`
        UPDATE task_metadata
        SET recommended_category = category,
            category_classified_at = CURRENT_TIMESTAMP,
            recommendation_applied = TRUE
        WHERE category IS NOT NULL 
        AND recommended_category IS NULL
      `);
    }
  }

  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  _createSchema() {
    // Tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        description TEXT,
        project_id TEXT,
        parent_id TEXT,
        "order" INTEGER,
        priority INTEGER,
        due_string TEXT,
        due_date TEXT,
        due_datetime TEXT,
        due_timezone TEXT,
        labels TEXT, -- JSON array
        created_at TEXT,
        is_completed BOOLEAN DEFAULT 0,
        completed_at TEXT,
        content_hash TEXT, -- SHA256 hash for change detection
        raw_data TEXT, -- Full JSON from Todoist
        last_synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Task metadata table (AI enhancements)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_metadata (
        task_id TEXT PRIMARY KEY,
        category TEXT, -- Life area: work, home-repair, etc.
        time_estimate TEXT, -- Human-readable: "20-30min"
        size TEXT, -- XS, S, M, L, XL
        ai_confidence REAL, -- 0-1
        ai_reasoning TEXT,
        needs_supplies BOOLEAN DEFAULT 0,
        can_delegate BOOLEAN DEFAULT 0,
        energy_level TEXT, -- low, medium, high
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    // Task history table (learning)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT,
        task_content TEXT,
        action TEXT DEFAULT 'complete', -- Action type: complete, update, etc.
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP, -- When action occurred
        completed_at TEXT NOT NULL,
        actual_duration INTEGER, -- Minutes
        category TEXT,
        context TEXT, -- JSON
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Projects table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        parent_id TEXT,
        "order" INTEGER,
        is_favorite BOOLEAN DEFAULT 0,
        raw_data TEXT,
        last_synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Labels table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS labels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        "order" INTEGER,
        is_favorite BOOLEAN DEFAULT 0,
        raw_data TEXT,
        last_synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sync state table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(is_completed);
      CREATE INDEX IF NOT EXISTS idx_task_metadata_category ON task_metadata(category);
      CREATE INDEX IF NOT EXISTS idx_task_history_category ON task_history(category);
      CREATE INDEX IF NOT EXISTS idx_task_history_completed ON task_history(completed_at);
    `);
  }

  // ==================== Task Operations ====================

  async saveTasks(tasks) {
    if (!tasks || tasks.length === 0) return 0;

    const stmt = this.db.prepare(`
      INSERT INTO tasks (id, content, description, project_id, parent_id, 
        "order", priority, due_string, due_date, due_datetime, due_timezone,
        labels, created_at, is_completed, completed_at, content_hash, raw_data, last_synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        description = excluded.description,
        project_id = excluded.project_id,
        parent_id = excluded.parent_id,
        "order" = excluded."order",
        priority = excluded.priority,
        due_string = excluded.due_string,
        due_date = excluded.due_date,
        due_datetime = excluded.due_datetime,
        due_timezone = excluded.due_timezone,
        labels = excluded.labels,
        is_completed = excluded.is_completed,
        completed_at = excluded.completed_at,
        content_hash = excluded.content_hash,
        raw_data = excluded.raw_data,
        last_synced_at = CURRENT_TIMESTAMP
    `);

    const saveMany = this.db.transaction(() => {
      for (const task of tasks) {
        // Calculate content hash for change detection
        const contentToHash = JSON.stringify({
          content: task.content || '',
          description: task.description || '',
          labels: (task.labels || []).sort(),
          priority: task.priority,
          projectId: task.projectId
        });
        const contentHash = crypto.createHash('sha256').update(contentToHash).digest('hex');
        
        stmt.run(
          task.id,
          task.content,
          task.description || null,
          task.projectId || null,
          task.parentId || null,
          task.order || 0,
          task.priority || 1,
          task.due?.string || null,
          task.due?.date || null,
          task.due?.datetime || null,
          task.due?.timezone || null,
          JSON.stringify(task.labels || []),
          task.createdAt,
          task.isCompleted ? 1 : 0,
          task.completedAt || null,
          contentHash,
          JSON.stringify(task)
        );
      }
    });

    saveMany();
    return tasks.length;
  }

  async getTasks(filters = {}) {
    let query = `
      SELECT 
        t.*,
        m.category,
        m.time_estimate,
        m.size,
        m.ai_confidence,
        m.ai_reasoning,
        m.needs_supplies,
        m.can_delegate,
        m.energy_level
      FROM tasks t
      LEFT JOIN task_metadata m ON t.id = m.task_id
      WHERE 1=1
    `;

    const params = [];

    if (filters.category) {
      query += ' AND m.category = ?';
      params.push(filters.category);
    }

    if (filters.priority) {
      query += ' AND t.priority = ?';
      params.push(filters.priority);
    }

    if (filters.projectId) {
      query += ' AND t.project_id = ?';
      params.push(filters.projectId);
    }

    if (filters.completed !== undefined) {
      query += ' AND t.is_completed = ?';
      params.push(filters.completed ? 1 : 0);
    } else {
      // Default: only active tasks
      query += ' AND t.is_completed = 0';
    }

    query += ' ORDER BY t.priority DESC, t."order" ASC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = this.db.prepare(query).all(...params);
    return rows.map(row => this._rowToTask(row));
  }

  async getTask(taskId) {
    const row = this.db.prepare(`
      SELECT 
        t.*,
        m.category,
        m.time_estimate,
        m.size,
        m.ai_confidence,
        m.ai_reasoning,
        m.needs_supplies,
        m.can_delegate,
        m.energy_level
      FROM tasks t
      LEFT JOIN task_metadata m ON t.id = m.task_id
      WHERE t.id = ?
    `).get(taskId);

    return row ? this._rowToTask(row) : null;
  }

  async updateTask(taskId, updates) {
    const setClauses = [];
    const params = [];

    const allowedFields = [
      'content', 'description', 'project_id', 'parent_id', 'order',
      'priority', 'due_string', 'due_date', 'due_datetime', 'due_timezone',
      'labels', 'is_completed', 'completed_at'
    ];

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      if (allowedFields.includes(snakeKey)) {
        setClauses.push(`${snakeKey} = ?`);
        
        // Handle different value types
        if (value === null || value === undefined) {
          params.push(null);
        } else if (value instanceof Date) {
          params.push(value.toISOString());
        } else if (typeof value === 'object') {
          params.push(JSON.stringify(value));
        } else if (typeof value === 'boolean') {
          params.push(value ? 1 : 0);
        } else {
          params.push(value);
        }
      }
    }

    if (setClauses.length === 0) return false;

    setClauses.push('last_synced_at = CURRENT_TIMESTAMP');
    params.push(taskId);

    const query = `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`;
    const result = this.db.prepare(query).run(...params);

    return result.changes > 0;
  }

  async deleteTask(taskId) {
    const result = this.db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
    return result.changes > 0;
  }

  async queryTasksByMetadata(criteria) {
    let query = `
      SELECT 
        t.*,
        m.category,
        m.time_estimate,
        m.size,
        m.ai_confidence,
        m.needs_supplies,
        m.can_delegate,
        m.energy_level
      FROM tasks t
      INNER JOIN task_metadata m ON t.id = m.task_id
      WHERE t.is_completed = 0
    `;

    const params = [];

    if (criteria.needsSupplies !== undefined) {
      query += ' AND m.needs_supplies = ?';
      params.push(criteria.needsSupplies ? 1 : 0);
    }

    if (criteria.canDelegate !== undefined) {
      query += ' AND m.can_delegate = ?';
      params.push(criteria.canDelegate ? 1 : 0);
    }

    if (criteria.energyLevel) {
      query += ' AND m.energy_level = ?';
      params.push(criteria.energyLevel);
    }

    if (criteria.size) {
      query += ' AND m.size = ?';
      params.push(criteria.size);
    }

    const rows = this.db.prepare(query).all(...params);
    return rows.map(row => this._rowToTask(row));
  }

  // ==================== Task Metadata Operations ====================

  async saveTaskMetadata(taskId, metadata) {
    const stmt = this.db.prepare(`
      INSERT INTO task_metadata (
        task_id, category, time_estimate, size, ai_confidence,
        ai_reasoning, needs_supplies, can_delegate, energy_level, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(task_id) DO UPDATE SET
        category = excluded.category,
        time_estimate = excluded.time_estimate,
        size = excluded.size,
        ai_confidence = excluded.ai_confidence,
        ai_reasoning = excluded.ai_reasoning,
        needs_supplies = excluded.needs_supplies,
        can_delegate = excluded.can_delegate,
        energy_level = excluded.energy_level,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      taskId,
      metadata.category || null,
      metadata.timeEstimate || null,
      metadata.size || null,
      metadata.aiConfidence || null,
      metadata.aiReasoning || null,
      metadata.needsSupplies ? 1 : 0,
      metadata.canDelegate ? 1 : 0,
      metadata.energyLevel || null
    );
  }

  async getTaskMetadata(taskId) {
    const row = this.db.prepare(`
      SELECT * FROM task_metadata WHERE task_id = ?
    `).get(taskId);

    if (!row) return null;

    return {
      category: row.category,
      timeEstimate: row.time_estimate,
      size: row.size,
      aiConfidence: row.ai_confidence,
      aiReasoning: row.ai_reasoning,
      needsSupplies: row.needs_supplies === 1,
      canDelegate: row.can_delegate === 1,
      energyLevel: row.energy_level,
      updatedAt: row.updated_at,
      // New fields from migration 003
      recommended_category: row.recommended_category,
      category_classified_at: row.category_classified_at,
      time_estimate_minutes: row.time_estimate_minutes,
      estimate_classified_at: row.estimate_classified_at,
      priority_score: row.priority_score,
      priority_classified_at: row.priority_classified_at,
      last_synced_state: row.last_synced_state ? JSON.parse(row.last_synced_state) : null,
      last_synced_at: row.last_synced_at,
      recommendation_applied: row.recommendation_applied === 1,
      classification_source: row.classification_source  // 'ai' or 'manual'
    };
  }

  async saveFieldMetadata(taskId, fieldName, value, classifiedAt) {
    // Map field names to column names
    const fieldMap = {
      'recommended_category': 'recommended_category',
      'category': 'recommended_category',  // Alias for backward compatibility
      'time_estimate_minutes': 'time_estimate_minutes',
      'priority_score': 'priority_score',
      'recommendation_applied': 'recommendation_applied',
      'classification_source': 'classification_source'  // 'ai' or 'manual'
    };

    const timestampMap = {
      'recommended_category': 'category_classified_at',
      'category': 'category_classified_at',
      'time_estimate_minutes': 'estimate_classified_at',
      'priority_score': 'priority_classified_at'
    };

    const column = fieldMap[fieldName];
    const timestampColumn = timestampMap[fieldName];

    if (!column) {
      throw new Error(`Unknown field name: ${fieldName}`);
    }

    // Ensure metadata row exists
    this.db.prepare(`
      INSERT OR IGNORE INTO task_metadata (task_id, updated_at)
      VALUES (?, CURRENT_TIMESTAMP)
    `).run(taskId);

    // Convert boolean to integer for SQLite
    const sqlValue = typeof value === 'boolean' ? (value ? 1 : 0) : value;
    
    // Update the specific field and its timestamp
    if (timestampColumn) {
      this.db.prepare(`
        UPDATE task_metadata
        SET ${column} = ?,
            ${timestampColumn} = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE task_id = ?
      `).run(sqlValue, classifiedAt ? classifiedAt.toISOString() : null, taskId);
    } else {
      // Field without timestamp (like recommendation_applied)
      this.db.prepare(`
        UPDATE task_metadata
        SET ${column} = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE task_id = ?
      `).run(sqlValue, taskId);
    }
  }

  async getFieldMetadata(taskId, fieldName) {
    const fieldMap = {
      'recommended_category': ['recommended_category', 'category_classified_at'],
      'category': ['recommended_category', 'category_classified_at'],
      'time_estimate_minutes': ['time_estimate_minutes', 'estimate_classified_at'],
      'priority_score': ['priority_score', 'priority_classified_at'],
      'recommendation_applied': ['recommendation_applied', null]
    };

    const [valueColumn, timestampColumn] = fieldMap[fieldName] || [];
    if (!valueColumn) {
      throw new Error(`Unknown field name: ${fieldName}`);
    }

    const columns = timestampColumn 
      ? `${valueColumn}, ${timestampColumn}`
      : valueColumn;

    const row = this.db.prepare(`
      SELECT ${columns} FROM task_metadata WHERE task_id = ?
    `).get(taskId);

    if (!row) return null;

    return {
      value: row[valueColumn],
      classifiedAt: timestampColumn ? row[timestampColumn] : null
    };
  }

  async getLastSyncedState(taskId) {
    const row = this.db.prepare(`
      SELECT 
        last_synced_state,
        last_synced_at
      FROM task_metadata
      WHERE task_id = ?
    `).get(taskId);

    if (!row || !row.last_synced_state) return null;

    try {
      return {
        taskState: JSON.parse(row.last_synced_state),
        last_synced_at: row.last_synced_at ? new Date(row.last_synced_at) : null
      };
    } catch (error) {
      console.error(`[Storage] Failed to parse last_synced_state for task ${taskId}:`, error);
      return null;
    }
  }

  async saveLastSyncedState(taskId, taskState, syncedAt = null) {
    // Ensure metadata row exists
    this.db.prepare(`
      INSERT OR IGNORE INTO task_metadata (task_id, updated_at)
      VALUES (?, CURRENT_TIMESTAMP)
    `).run(taskId);

    // Serialize task state to JSON
    const stateJson = JSON.stringify(taskState);
    const timestamp = syncedAt ? syncedAt.toISOString() : new Date().toISOString();

    // Update last synced state
    this.db.prepare(`
      UPDATE task_metadata
      SET last_synced_state = ?,
          last_synced_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE task_id = ?
    `).run(stateJson, timestamp, taskId);
  }

  // ==================== Task History & Learning ====================

  async saveTaskCompletion(taskId, metadata) {
    const stmt = this.db.prepare(`
      INSERT INTO task_history (
        task_id, task_content, action, timestamp, completed_at, actual_duration, category, context
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    stmt.run(
      taskId,
      metadata.taskContent || null,
      metadata.action || 'complete',
      now,
      metadata.completedAt?.toISOString() || now,
      metadata.actualDuration || null,
      metadata.category || null,
      metadata.context ? JSON.stringify(metadata.context) : null
    );
  }

  async getTaskHistory(filters = {}) {
    let query = 'SELECT * FROM task_history WHERE 1=1';
    const params = [];

    if (filters.action) {
      query += ' AND action = ?';
      params.push(filters.action);
    }

    if (filters.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters.since) {
      query += ' AND timestamp >= ?';
      params.push(filters.since);
    }

    if (filters.startDate) {
      query += ' AND completed_at >= ?';
      params.push(filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query += ' AND completed_at <= ?';
      params.push(filters.endDate.toISOString());
    }

    query += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = this.db.prepare(query).all(...params);
    return rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      taskContent: row.task_content,
      task_content: row.task_content,
      timestamp: row.timestamp,
      action: row.action,
      details: row.context ? JSON.parse(row.context) : {},
      completedAt: new Date(row.completed_at),
      actualDuration: row.actual_duration,
      category: row.category,
      context: row.context ? JSON.parse(row.context) : null
    }));
  }

  async getCompletionPatterns(category) {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as count,
        AVG(actual_duration) as avg_duration,
        MIN(actual_duration) as min_duration,
        MAX(actual_duration) as max_duration
      FROM task_history
      WHERE category = ? AND actual_duration IS NOT NULL
    `).get(category);

    return {
      count: stats.count || 0,
      avgDuration: stats.avg_duration || null,
      minDuration: stats.min_duration || null,
      maxDuration: stats.max_duration || null,
      commonPatterns: [] // TODO: Implement pattern detection
    };
  }

  // ==================== Projects & Labels ====================

  async saveProjects(projects) {
    if (!projects || projects.length === 0) return 0;

    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, color, parent_id, "order", is_favorite, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        color = excluded.color,
        parent_id = excluded.parent_id,
        "order" = excluded."order",
        is_favorite = excluded.is_favorite,
        raw_data = excluded.raw_data,
        last_synced_at = CURRENT_TIMESTAMP
    `);

    const saveMany = this.db.transaction((projectList) => {
      for (const project of projectList) {
        stmt.run(
          project.id,
          project.name,
          project.color || null,
          project.parentId || null,
          project.order || 0,
          project.isFavorite ? 1 : 0,
          JSON.stringify(project)
        );
      }
    });

    saveMany(projects);
    return projects.length;
  }

  async getProjects() {
    const rows = this.db.prepare('SELECT * FROM projects ORDER BY "order"').all();
    return rows.map(row => JSON.parse(row.raw_data));
  }

  async saveLabels(labels) {
    if (!labels || labels.length === 0) return 0;

    const stmt = this.db.prepare(`
      INSERT INTO labels (id, name, color, "order", is_favorite, raw_data)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        color = excluded.color,
        "order" = excluded."order",
        is_favorite = excluded.is_favorite,
        raw_data = excluded.raw_data,
        last_synced_at = CURRENT_TIMESTAMP
    `);

    const saveMany = this.db.transaction((labelList) => {
      for (const label of labelList) {
        stmt.run(
          label.id,
          label.name,
          label.color || null,
          label.order || 0,
          label.isFavorite ? 1 : 0,
          JSON.stringify(label)
        );
      }
    });

    saveMany(labels);
    return labels.length;
  }

  async getLabels() {
    const rows = this.db.prepare('SELECT * FROM labels ORDER BY "order"').all();
    return rows.map(row => JSON.parse(row.raw_data));
  }

  // ==================== Sync State ====================

  async getLastSyncTime() {
    const row = this.db.prepare(
      "SELECT value FROM sync_state WHERE key = 'last_sync'"
    ).get();

    return row ? new Date(row.value) : null;
  }

  async setLastSyncTime(timestamp) {
    this.db.prepare(`
      INSERT INTO sync_state (key, value, updated_at)
      VALUES ('last_sync', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).run(timestamp.toISOString());
  }

  // ==================== Helper Methods ====================

  _rowToTask(row) {
    return {
      id: row.id,
      content: row.content,
      description: row.description,
      projectId: row.project_id,
      parentId: row.parent_id,
      order: row.order,
      priority: row.priority,
      due: row.due_string ? {
        string: row.due_string,
        date: row.due_date,
        datetime: row.due_datetime,
        timezone: row.due_timezone
      } : null,
      labels: row.labels ? JSON.parse(row.labels) : [],
      createdAt: row.created_at,
      isCompleted: row.is_completed === 1,
      completedAt: row.completed_at,
      // AI metadata
      metadata: {
        category: row.category,
        timeEstimate: row.time_estimate,
        size: row.size,
        aiConfidence: row.ai_confidence,
        aiReasoning: row.ai_reasoning,
        needsSupplies: row.needs_supplies === 1,
        canDelegate: row.can_delegate === 1,
        energyLevel: row.energy_level
      }
    };
  }
}


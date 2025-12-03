/**
 * SQLite Storage Adapter
 * 
 * Local storage implementation using SQLite for development and single-user scenarios.
 * Implements IStorageAdapter interface with full type safety.
 */

import { Injectable, Logger } from '@nestjs/common';
import Database from 'better-sqlite3';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { IStorageAdapter } from '../../common/interfaces/storage-adapter.interface';
import { Task, Project, Label, TaskFilters, TaskMetadata } from '../../common/interfaces/task.interface';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

@Injectable()
export class SQLiteAdapter implements IStorageAdapter {
  private readonly logger = new Logger(SQLiteAdapter.name);
  private db: Database.Database | null = null;
  private readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    // Ensure data directory exists
    const dir = dirname(this.dbPath);
    mkdirSync(dir, { recursive: true });

    // Open database
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL'); // Better performance
    this.db.pragma('foreign_keys = ON');

    this.logger.log(`SQLite database initialized at ${this.dbPath}`);

    // Create schema
    this.createSchema();

    // Run migrations
    await this.runMigrations();
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.logger.log('SQLite database connection closed');
    }
  }

  private getDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  private createSchema(): void {
    const db = this.getDb();
    
    // Tasks table
    db.exec(`
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
        content_hash TEXT,
        raw_data TEXT,
        last_synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Task metadata table
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_metadata (
        task_id TEXT PRIMARY KEY,
        category TEXT,
        time_estimate TEXT,
        time_estimate_minutes INTEGER,
        time_estimate_minutes_classified_at TIMESTAMP,
        size TEXT,
        ai_confidence REAL,
        ai_reasoning TEXT,
        needs_supplies BOOLEAN DEFAULT 0,
        can_delegate BOOLEAN DEFAULT 0,
        energy_level TEXT,
        classification_source TEXT,
        recommended_category TEXT,
        recommended_category_classified_at TIMESTAMP,
        priority_score INTEGER,
        priority_classified_at TIMESTAMP,
        last_synced_state TEXT,
        last_synced_at TIMESTAMP,
        recommendation_applied BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    // Task history table
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        content TEXT NOT NULL,
        completed_at TIMESTAMP NOT NULL,
        actual_duration INTEGER,
        estimated_duration INTEGER,
        category TEXT,
        context TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Projects table
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        parent_id TEXT,
        "order" INTEGER,
        is_shared BOOLEAN DEFAULT 0,
        is_favorite BOOLEAN DEFAULT 0,
        is_inbox_project BOOLEAN DEFAULT 0,
        raw_data TEXT,
        last_synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Labels table
    db.exec(`
      CREATE TABLE IF NOT EXISTS labels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        "order" INTEGER,
        is_favorite BOOLEAN DEFAULT 0,
        last_synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sync state table
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indices for performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_is_completed ON tasks(is_completed);
      CREATE INDEX IF NOT EXISTS idx_task_metadata_category ON task_metadata(category);
      CREATE INDEX IF NOT EXISTS idx_task_history_completed_at ON task_history(completed_at);
    `);

    // Ensure all columns exist (for backward compatibility and in-memory databases)
    this.ensureAllColumns();

    this.logger.log('Database schema created successfully');
  }

  /**
   * Ensure all columns exist in task_metadata table
   * This is called after schema creation to handle:
   * - In-memory databases (tests)
   * - Existing databases that need migration
   * - New databases (no-op, columns already exist)
   */
  private ensureAllColumns(): void {
    const db = this.getDb();

    const columns = [
      { name: 'recommended_category', type: 'TEXT' },
      { name: 'recommended_category_classified_at', type: 'TIMESTAMP' },
      { name: 'category_classified_at', type: 'TIMESTAMP' },
      { name: 'time_estimate_minutes', type: 'INTEGER' },
      { name: 'time_estimate_minutes_classified_at', type: 'TIMESTAMP' },
      { name: 'estimate_classified_at', type: 'TIMESTAMP' },
      { name: 'priority_score', type: 'INTEGER' },
      { name: 'priority_classified_at', type: 'TIMESTAMP' },
      { name: 'last_synced_state', type: 'TEXT' },
      { name: 'last_synced_at', type: 'TIMESTAMP' },
      { name: 'recommendation_applied', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'classification_source', type: 'TEXT' },
    ];

    const existingColumns = db.prepare('PRAGMA table_info(task_metadata)').all() as any[];
    const existingColumnNames = new Set(existingColumns.map((c) => c.name));

    for (const column of columns) {
      if (!existingColumnNames.has(column.name)) {
        this.logger.log(`Adding column: ${column.name}`);
        db.exec(`ALTER TABLE task_metadata ADD COLUMN ${column.name} ${column.type}`);
      }
    }
  }

  private async runMigrations(): Promise<void> {
    const db = this.getDb();

    // Create migrations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Find migrations directory (in parent directory)
    const projectRoot = resolve(__dirname, '../../../..');
    const migrationsDir = join(projectRoot, 'migrations');

    if (!existsSync(migrationsDir)) {
      this.logger.log('No migrations directory found, skipping');
      return;
    }

    const migrationFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const migrationId = file.replace('.sql', '');

      const applied = db.prepare('SELECT id FROM migrations WHERE id = ?').get(migrationId);

      if (applied) {
        continue;
      }

      this.logger.log(`Running migration: ${migrationId}`);

      try {
        if (migrationId === '003-per-field-timestamps') {
          this.runMigration003();
        } else {
          const migrationPath = join(migrationsDir, file);
          const sql = readFileSync(migrationPath, 'utf8');
          db.exec(sql);
        }

        db.prepare('INSERT INTO migrations (id) VALUES (?)').run(migrationId);
        this.logger.log(`Migration ${migrationId} completed`);
      } catch (error) {
        this.logger.error(`Migration ${migrationId} failed: ${error.message}`);
        throw error;
      }
    }
  }

  private runMigration003(): void {
    const db = this.getDb();

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
      { name: 'classification_source', type: 'TEXT' },
    ];

    const existingColumns = db.prepare('PRAGMA table_info(task_metadata)').all() as any[];
    const existingColumnNames = new Set(existingColumns.map((c) => c.name));

    for (const column of columns) {
      if (!existingColumnNames.has(column.name)) {
        this.logger.log(`Adding column: ${column.name}`);
        db.exec(`ALTER TABLE task_metadata ADD COLUMN ${column.name} ${column.type}`);
      }
    }

    // Migrate existing data
    const needsMigration = db
      .prepare(
        `SELECT COUNT(*) as count FROM task_metadata 
         WHERE category IS NOT NULL AND recommended_category IS NULL`,
      )
      .get() as { count: number };

    if (needsMigration.count > 0) {
      this.logger.log(`Migrating ${needsMigration.count} existing category values`);
      db.exec(`
        UPDATE task_metadata
        SET recommended_category = category,
            category_classified_at = CURRENT_TIMESTAMP,
            recommendation_applied = TRUE
        WHERE category IS NOT NULL AND recommended_category IS NULL
      `);
    }
  }

  // ==================== Task Operations ====================

  async saveTasks(tasks: Task[]): Promise<number> {
    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO tasks (
        id, content, description, project_id, parent_id, "order", priority,
        due_string, due_date, due_datetime, due_timezone, labels,
        created_at, is_completed, completed_at, content_hash, raw_data, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((tasks: Task[]) => {
      for (const task of tasks) {
        const contentHash = createHash('sha256').update(task.content).digest('hex');
        stmt.run(
          task.id,
          task.content,
          task.description || null,
          task.projectId,
          task.parentId || null,
          0, // order
          task.priority,
          task.due?.string || null,
          task.due?.date || null,
          task.due?.datetime || null,
          task.due?.timezone || null,
          JSON.stringify(task.labels || []),
          task.createdAt,
          task.isCompleted ? 1 : 0,
          task.completedAt || null,
          contentHash,
          JSON.stringify(task),
          new Date().toISOString(),
        );
      }
    });

    insertMany(tasks);
    return tasks.length;
  }

  async getTasks(filters: TaskFilters = {}): Promise<Task[]> {
    const db = this.getDb();
    let query = `
      SELECT t.*, m.* 
      FROM tasks t
      LEFT JOIN task_metadata m ON t.id = m.task_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.projectId) {
      query += ' AND t.project_id = ?';
      params.push(filters.projectId);
    }

    if (filters.category) {
      query += ' AND m.category = ?';
      params.push(filters.category);
    }

    if (filters.priority) {
      query += ' AND t.priority = ?';
      params.push(filters.priority);
    }

    if (filters.completed !== undefined) {
      query += ' AND t.is_completed = ?';
      params.push(filters.completed ? 1 : 0);
    }

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((row) => this.rowToTask(row));
  }

  async getTask(taskId: string): Promise<Task | null> {
    const db = this.getDb();
    const row = db
      .prepare(
        `SELECT t.*, m.* 
         FROM tasks t
         LEFT JOIN task_metadata m ON t.id = m.task_id
         WHERE t.id = ?`,
      )
      .get(taskId) as any;

    return row ? this.rowToTask(row) : null;
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<boolean> {
    const db = this.getDb();
    const setClauses: string[] = [];
    const params: any[] = [];

    if (updates.content !== undefined) {
      setClauses.push('content = ?');
      params.push(updates.content);
    }
    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      params.push(updates.description);
    }
    if (updates.projectId !== undefined) {
      setClauses.push('project_id = ?');
      params.push(updates.projectId);
    }
    if (updates.priority !== undefined) {
      setClauses.push('priority = ?');
      params.push(updates.priority);
    }
    if (updates.labels !== undefined) {
      setClauses.push('labels = ?');
      params.push(JSON.stringify(updates.labels));
    }

    if (setClauses.length === 0) {
      return false;
    }

    params.push(taskId);
    const result = db.prepare(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);

    return result.changes > 0;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const db = this.getDb();
    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
    return result.changes > 0;
  }

  async queryTasksByMetadata(criteria: Partial<TaskMetadata>): Promise<Task[]> {
    const db = this.getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (criteria.category) {
      conditions.push('m.category = ?');
      params.push(criteria.category);
    }
    if (criteria.needsSupplies !== undefined) {
      conditions.push('m.needs_supplies = ?');
      params.push(criteria.needsSupplies ? 1 : 0);
    }
    if (criteria.canDelegate !== undefined) {
      conditions.push('m.can_delegate = ?');
      params.push(criteria.canDelegate ? 1 : 0);
    }
    if (criteria.energyLevel) {
      conditions.push('m.energy_level = ?');
      params.push(criteria.energyLevel);
    }
    if (criteria.size) {
      conditions.push('m.size = ?');
      params.push(criteria.size);
    }

    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT t.*, m.*
      FROM tasks t
      INNER JOIN task_metadata m ON t.id = m.task_id
      WHERE t.is_completed = 0 ${whereClause}
    `;

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((row) => this.rowToTask(row));
  }

  // ==================== Task Metadata ====================

  async saveTaskMetadata(taskId: string, metadata: Partial<TaskMetadata>): Promise<void> {
    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT INTO task_metadata (
        task_id, category, time_estimate, time_estimate_minutes, size, ai_confidence, ai_reasoning,
        needs_supplies, can_delegate, energy_level, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(task_id) DO UPDATE SET
        category = excluded.category,
        time_estimate = excluded.time_estimate,
        time_estimate_minutes = excluded.time_estimate_minutes,
        size = excluded.size,
        ai_confidence = excluded.ai_confidence,
        ai_reasoning = excluded.ai_reasoning,
        needs_supplies = excluded.needs_supplies,
        can_delegate = excluded.can_delegate,
        energy_level = excluded.energy_level,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      taskId,
      metadata.category || null,
      metadata.timeEstimate || null,
      metadata.timeEstimateMinutes || null,
      metadata.size || null,
      metadata.aiConfidence || null,
      metadata.aiReasoning || null,
      metadata.needsSupplies ? 1 : 0,
      metadata.canDelegate ? 1 : 0,
      metadata.energyLevel || null,
      new Date().toISOString(),
    );
  }

  async getTaskMetadata(taskId: string): Promise<TaskMetadata | null> {
    const db = this.getDb();
    const row = db.prepare('SELECT * FROM task_metadata WHERE task_id = ?').get(taskId) as any;

    if (!row) {
      return null;
    }

    return {
      category: row.category,
      timeEstimate: row.time_estimate,
      timeEstimateMinutes: row.time_estimate_minutes,
      size: row.size,
      aiConfidence: row.ai_confidence,
      aiReasoning: row.ai_reasoning,
      needsSupplies: row.needs_supplies === 1,
      canDelegate: row.can_delegate === 1,
      energyLevel: row.energy_level,
      classificationSource: row.classification_source,
      recommendedCategory: row.recommended_category,
      recommendationApplied: row.recommendation_applied === 1,
    };
  }

  async saveFieldMetadata(
    taskId: string,
    fieldName: string,
    value: any,
    classifiedAt: Date,
  ): Promise<void> {
    const db = this.getDb();
    const fieldMap: Record<string, string> = {
      recommended_category: 'recommended_category',
      time_estimate_minutes: 'time_estimate_minutes',
      priority_score: 'priority_score',
      classification_source: 'classification_source',
      recommendation_applied: 'recommendation_applied',
    };

    // Fields that have corresponding _classified_at timestamp columns
    const fieldsWithTimestamps = new Set([
      'recommended_category',
      'time_estimate_minutes',
      'priority_score',
    ]);

    const dbField = fieldMap[fieldName] || fieldName;

    // Convert boolean to integer for SQLite
    let dbValue = value;
    if (typeof value === 'boolean') {
      dbValue = value ? 1 : 0;
    }

    // Ensure metadata row exists
    db.prepare(
      `INSERT OR IGNORE INTO task_metadata (task_id, updated_at) VALUES (?, ?)`,
    ).run(taskId, new Date().toISOString());

    // Update field and timestamp (if applicable)
    if (fieldsWithTimestamps.has(dbField)) {
      const timestampField = `${dbField}_classified_at`;
      const updateQuery = `UPDATE task_metadata SET ${dbField} = ?, ${timestampField} = ?, updated_at = ? WHERE task_id = ?`;
      db.prepare(updateQuery).run(dbValue, classifiedAt.toISOString(), new Date().toISOString(), taskId);
    } else {
      // No timestamp column for this field
      const updateQuery = `UPDATE task_metadata SET ${dbField} = ?, updated_at = ? WHERE task_id = ?`;
      db.prepare(updateQuery).run(dbValue, new Date().toISOString(), taskId);
    }
  }

  async getFieldMetadata(
    taskId: string,
    fieldName: string,
  ): Promise<{ value: any; classifiedAt: Date } | null> {
    const db = this.getDb();
    const fieldMap: Record<string, string> = {
      recommended_category: 'recommended_category',
      time_estimate_minutes: 'time_estimate_minutes',
      priority_score: 'priority_score',
    };

    const dbField = fieldMap[fieldName] || fieldName;
    const timestampField = `${dbField}_classified_at`;

    const row = db
      .prepare(`SELECT ${dbField} as value, ${timestampField} as classified_at FROM task_metadata WHERE task_id = ?`)
      .get(taskId) as any;

    if (!row || row.value === null) {
      return null;
    }

    return {
      value: row.value,
      classifiedAt: new Date(row.classified_at),
    };
  }

  async getLastSyncedState(
    taskId: string,
  ): Promise<{ taskState: any; syncedAt: Date } | null> {
    const db = this.getDb();
    const row = db
      .prepare('SELECT last_synced_state, last_synced_at FROM task_metadata WHERE task_id = ?')
      .get(taskId) as any;

    if (!row || !row.last_synced_state) {
      return null;
    }

    return {
      taskState: JSON.parse(row.last_synced_state),
      syncedAt: new Date(row.last_synced_at),
    };
  }

  async saveLastSyncedState(taskId: string, taskState: any, syncedAt?: Date): Promise<void> {
    const db = this.getDb();
    const timestamp = (syncedAt || new Date()).toISOString();

    // Ensure metadata row exists
    db.prepare(
      `INSERT OR IGNORE INTO task_metadata (task_id, updated_at) VALUES (?, ?)`,
    ).run(taskId, new Date().toISOString());

    db.prepare(
      `UPDATE task_metadata SET last_synced_state = ?, last_synced_at = ?, updated_at = ? WHERE task_id = ?`,
    ).run(JSON.stringify(taskState), timestamp, new Date().toISOString(), taskId);
  }

  // ==================== Task History ====================

  async saveTaskCompletion(
    taskId: string,
    metadata: {
      completedAt?: Date;
      actualDuration?: number;
      category?: string;
      context?: any;
    },
  ): Promise<void> {
    const db = this.getDb();
    const task = await this.getTask(taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    db.prepare(
      `INSERT INTO task_history (task_id, content, completed_at, actual_duration, category, context)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      taskId,
      task.content,
      (metadata.completedAt || new Date()).toISOString(),
      metadata.actualDuration || null,
      metadata.category || null,
      metadata.context ? JSON.stringify(metadata.context) : null,
    );
  }

  async getTaskHistory(filters: {
    category?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): Promise<
    Array<{
      taskId: string;
      content: string;
      completedAt: Date;
      actualDuration?: number;
      category?: string;
    }>
  > {
    const db = this.getDb();
    let query = 'SELECT * FROM task_history WHERE 1=1';
    const params: any[] = [];

    if (filters.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }
    if (filters.startDate) {
      query += ' AND completed_at >= ?';
      params.push(filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query += ' AND completed_at <= ?';
      params.push(filters.endDate.toISOString());
    }

    query += ' ORDER BY completed_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = db.prepare(query).all(...params) as any[];

    return rows.map((row) => ({
      taskId: row.task_id,
      content: row.content,
      completedAt: new Date(row.completed_at),
      actualDuration: row.actual_duration,
      category: row.category,
    }));
  }

  async getCompletionPatterns(
    category: string,
  ): Promise<{ count: number; avgDuration: number; commonPatterns: string[] }> {
    const db = this.getDb();

    const stats = db
      .prepare(
        `SELECT 
          COUNT(*) as count,
          AVG(actual_duration) as avgDuration
         FROM task_history
         WHERE category = ? AND actual_duration IS NOT NULL`,
      )
      .get(category) as any;

    // Get common words from completed tasks
    const tasks = db
      .prepare(
        `SELECT content FROM task_history WHERE category = ? ORDER BY completed_at DESC LIMIT 50`,
      )
      .all(category) as any[];

    const wordFreq = new Map<string, number>();
    for (const task of tasks) {
      const words = task.content.toLowerCase().match(/\b\w+\b/g) || [];
      for (const word of words) {
        if (word.length > 3) {
          wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
        }
      }
    }

    const commonPatterns = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map((entry) => entry[0]);

    return {
      count: stats.count || 0,
      avgDuration: stats.avgDuration || 0,
      commonPatterns,
    };
  }

  // ==================== Projects & Labels ====================

  async saveProjects(projects: Project[]): Promise<number> {
    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO projects (
        id, name, color, parent_id, "order", is_shared, is_favorite, is_inbox_project, raw_data, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((projects: Project[]) => {
      for (const project of projects) {
        stmt.run(
          project.id,
          project.name,
          project.color || null,
          project.parentId || null,
          project.order || 0,
          project.isShared ? 1 : 0,
          project.isFavorite ? 1 : 0,
          project.isInboxProject ? 1 : 0,
          JSON.stringify(project),
          new Date().toISOString(),
        );
      }
    });

    insertMany(projects);
    return projects.length;
  }

  async getProjects(): Promise<Project[]> {
    const db = this.getDb();
    const rows = db.prepare('SELECT * FROM projects').all() as any[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      parentId: row.parent_id,
      order: row.order,
      isShared: row.is_shared === 1,
      isFavorite: row.is_favorite === 1,
      isInboxProject: row.is_inbox_project === 1,
    }));
  }

  async saveLabels(labels: Label[]): Promise<number> {
    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO labels (id, name, color, "order", is_favorite, last_synced_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((labels: Label[]) => {
      for (const label of labels) {
        stmt.run(
          label.id,
          label.name,
          label.color || null,
          label.order || 0,
          label.isFavorite ? 1 : 0,
          new Date().toISOString(),
        );
      }
    });

    insertMany(labels);
    return labels.length;
  }

  async getLabels(): Promise<Label[]> {
    const db = this.getDb();
    const rows = db.prepare('SELECT * FROM labels').all() as any[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      order: row.order,
      isFavorite: row.is_favorite === 1,
    }));
  }

  // ==================== Sync State ====================

  async getLastSyncTime(): Promise<Date | null> {
    const db = this.getDb();
    const row = db
      .prepare(`SELECT value FROM sync_state WHERE key = 'last_sync_time'`)
      .get() as any;

    return row ? new Date(row.value) : null;
  }

  async setLastSyncTime(timestamp: Date): Promise<void> {
    const db = this.getDb();
    db.prepare(
      `INSERT OR REPLACE INTO sync_state (key, value, updated_at) VALUES ('last_sync_time', ?, ?)`,
    ).run(timestamp.toISOString(), new Date().toISOString());
  }

  // ==================== Helper Methods ====================

  private rowToTask(row: any): Task {
    return {
      id: row.id,
      content: row.content,
      description: row.description,
      projectId: row.project_id,
      parentId: row.parent_id,
      priority: row.priority,
      labels: row.labels ? JSON.parse(row.labels) : [],
      due: row.due_date
        ? {
            date: row.due_date,
            datetime: row.due_datetime,
            string: row.due_string,
            timezone: row.due_timezone,
            isRecurring: false,
          }
        : null,
      createdAt: row.created_at,
      updatedAt: row.last_synced_at,
      isCompleted: row.is_completed === 1,
      completedAt: row.completed_at,
      metadata: row.category
        ? {
            category: row.category,
            timeEstimate: row.time_estimate,
            timeEstimateMinutes: row.time_estimate_minutes,
            size: row.size,
            aiConfidence: row.ai_confidence,
            aiReasoning: row.ai_reasoning,
            needsSupplies: row.needs_supplies === 1,
            canDelegate: row.can_delegate === 1,
            energyLevel: row.energy_level,
            classificationSource: row.classification_source,
            recommendedCategory: row.recommended_category,
            recommendationApplied: row.recommendation_applied === 1,
          }
        : undefined,
    };
  }
}


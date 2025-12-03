/**
 * PostgreSQL Storage Adapter
 * 
 * Cloud-ready storage implementation using PostgreSQL for production deployment.
 * Optimized for GCP Cloud SQL with connection pooling and JSONB support.
 * 
 * This adapter implements the same interface as SQLite for seamless switching
 * between local development and cloud production environments.
 */

import pg from 'pg';
import { StorageAdapter } from './interface.js';

const { Pool } = pg;

export class PostgresAdapter extends StorageAdapter {
  /**
   * @param {string} connectionString - PostgreSQL connection string
   */
  constructor(connectionString) {
    super();
    this.connectionString = connectionString;
    this.pool = null;
  }

  async initialize() {
    // Create connection pool
    this.pool = new Pool({
      connectionString: this.connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    const client = await this.pool.connect();
    try {
      await client.query('SELECT NOW()');
    } finally {
      client.release();
    }

    // Create schema
    await this._createSchema();
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async _createSchema() {
    const client = await this.pool.connect();
    try {
      // Tasks table
      await client.query(`
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
          labels JSONB DEFAULT '[]',
          created_at TIMESTAMP,
          is_completed BOOLEAN DEFAULT FALSE,
          completed_at TIMESTAMP,
          raw_data JSONB,
          last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Task metadata table
      await client.query(`
        CREATE TABLE IF NOT EXISTS task_metadata (
          task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
          category TEXT,
          time_estimate TEXT,
          size TEXT,
          ai_confidence REAL,
          ai_reasoning TEXT,
          needs_supplies BOOLEAN DEFAULT FALSE,
          can_delegate BOOLEAN DEFAULT FALSE,
          energy_level TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Task history table
      await client.query(`
        CREATE TABLE IF NOT EXISTS task_history (
          id SERIAL PRIMARY KEY,
          task_id TEXT,
          task_content TEXT,
          completed_at TIMESTAMP NOT NULL,
          actual_duration INTEGER,
          category TEXT,
          context JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Projects table
      await client.query(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT,
          parent_id TEXT,
          "order" INTEGER,
          is_favorite BOOLEAN DEFAULT FALSE,
          raw_data JSONB,
          last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Labels table
      await client.query(`
        CREATE TABLE IF NOT EXISTS labels (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT,
          "order" INTEGER,
          is_favorite BOOLEAN DEFAULT FALSE,
          raw_data JSONB,
          last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Sync state table
      await client.query(`
        CREATE TABLE IF NOT EXISTS sync_state (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
        CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(is_completed);
        CREATE INDEX IF NOT EXISTS idx_task_metadata_category ON task_metadata(category);
        CREATE INDEX IF NOT EXISTS idx_task_history_category ON task_history(category);
        CREATE INDEX IF NOT EXISTS idx_task_history_completed ON task_history(completed_at);
      `);
    } finally {
      client.release();
    }
  }

  // ==================== Task Operations ====================

  async saveTasks(tasks) {
    if (!tasks || tasks.length === 0) return 0;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const task of tasks) {
        await client.query(`
          INSERT INTO tasks (
            id, content, description, project_id, parent_id, "order",
            priority, due_string, due_date, due_datetime, due_timezone,
            labels, created_at, is_completed, completed_at, raw_data, last_synced_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content,
            description = EXCLUDED.description,
            project_id = EXCLUDED.project_id,
            parent_id = EXCLUDED.parent_id,
            "order" = EXCLUDED."order",
            priority = EXCLUDED.priority,
            due_string = EXCLUDED.due_string,
            due_date = EXCLUDED.due_date,
            due_datetime = EXCLUDED.due_datetime,
            due_timezone = EXCLUDED.due_timezone,
            labels = EXCLUDED.labels,
            is_completed = EXCLUDED.is_completed,
            completed_at = EXCLUDED.completed_at,
            raw_data = EXCLUDED.raw_data,
            last_synced_at = CURRENT_TIMESTAMP
        `, [
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
          task.isCompleted || false,
          task.completedAt || null,
          JSON.stringify(task)
        ]);
      }

      await client.query('COMMIT');
      return tasks.length;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
    let paramIndex = 1;

    if (filters.category) {
      query += ` AND m.category = $${paramIndex++}`;
      params.push(filters.category);
    }

    if (filters.priority) {
      query += ` AND t.priority = $${paramIndex++}`;
      params.push(filters.priority);
    }

    if (filters.projectId) {
      query += ` AND t.project_id = $${paramIndex++}`;
      params.push(filters.projectId);
    }

    if (filters.completed !== undefined) {
      query += ` AND t.is_completed = $${paramIndex++}`;
      params.push(filters.completed);
    } else {
      query += ' AND t.is_completed = FALSE';
    }

    query += ' ORDER BY t.priority DESC, t."order" ASC';

    if (filters.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this._rowToTask(row));
  }

  async getTask(taskId) {
    const result = await this.pool.query(`
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
      WHERE t.id = $1
    `, [taskId]);

    return result.rows.length > 0 ? this._rowToTask(result.rows[0]) : null;
  }

  async updateTask(taskId, updates) {
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    const fieldMap = {
      content: 'content',
      description: 'description',
      projectId: 'project_id',
      parentId: 'parent_id',
      order: '"order"',
      priority: 'priority',
      dueString: 'due_string',
      dueDate: 'due_date',
      dueDatetime: 'due_datetime',
      dueTimezone: 'due_timezone',
      labels: 'labels',
      isCompleted: 'is_completed',
      completedAt: 'completed_at'
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (updates[key] !== undefined) {
        setClauses.push(`${dbField} = $${paramIndex++}`);
        const value = typeof updates[key] === 'object' ? JSON.stringify(updates[key]) : updates[key];
        params.push(value);
      }
    }

    if (setClauses.length === 0) return false;

    setClauses.push('last_synced_at = CURRENT_TIMESTAMP');
    params.push(taskId);

    const query = `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`;
    const result = await this.pool.query(query, params);

    return result.rowCount > 0;
  }

  async deleteTask(taskId) {
    const result = await this.pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
    return result.rowCount > 0;
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
      WHERE t.is_completed = FALSE
    `;

    const params = [];
    let paramIndex = 1;

    if (criteria.needsSupplies !== undefined) {
      query += ` AND m.needs_supplies = $${paramIndex++}`;
      params.push(criteria.needsSupplies);
    }

    if (criteria.canDelegate !== undefined) {
      query += ` AND m.can_delegate = $${paramIndex++}`;
      params.push(criteria.canDelegate);
    }

    if (criteria.energyLevel) {
      query += ` AND m.energy_level = $${paramIndex++}`;
      params.push(criteria.energyLevel);
    }

    if (criteria.size) {
      query += ` AND m.size = $${paramIndex++}`;
      params.push(criteria.size);
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this._rowToTask(row));
  }

  // ==================== Task Metadata Operations ====================

  async saveTaskMetadata(taskId, metadata) {
    await this.pool.query(`
      INSERT INTO task_metadata (
        task_id, category, time_estimate, size, ai_confidence,
        ai_reasoning, needs_supplies, can_delegate, energy_level, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT (task_id) DO UPDATE SET
        category = EXCLUDED.category,
        time_estimate = EXCLUDED.time_estimate,
        size = EXCLUDED.size,
        ai_confidence = EXCLUDED.ai_confidence,
        ai_reasoning = EXCLUDED.ai_reasoning,
        needs_supplies = EXCLUDED.needs_supplies,
        can_delegate = EXCLUDED.can_delegate,
        energy_level = EXCLUDED.energy_level,
        updated_at = CURRENT_TIMESTAMP
    `, [
      taskId,
      metadata.category || null,
      metadata.timeEstimate || null,
      metadata.size || null,
      metadata.aiConfidence || null,
      metadata.aiReasoning || null,
      metadata.needsSupplies || false,
      metadata.canDelegate || false,
      metadata.energyLevel || null
    ]);
  }

  async getTaskMetadata(taskId) {
    const result = await this.pool.query(
      'SELECT * FROM task_metadata WHERE task_id = $1',
      [taskId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      category: row.category,
      timeEstimate: row.time_estimate,
      size: row.size,
      aiConfidence: row.ai_confidence,
      aiReasoning: row.ai_reasoning,
      needsSupplies: row.needs_supplies,
      canDelegate: row.can_delegate,
      energyLevel: row.energy_level,
      updatedAt: row.updated_at,
      // New fields from migration 003
      recommended_category: row.recommended_category,
      category_classified_at: row.category_classified_at,
      time_estimate_minutes: row.time_estimate_minutes,
      estimate_classified_at: row.estimate_classified_at,
      priority_score: row.priority_score,
      priority_classified_at: row.priority_classified_at,
      last_synced_state: row.last_synced_state,
      last_synced_at: row.last_synced_at,
      recommendation_applied: row.recommendation_applied
    };
  }

  async saveFieldMetadata(taskId, fieldName, value, classifiedAt) {
    const fieldMap = {
      'recommended_category': 'recommended_category',
      'category': 'recommended_category',
      'time_estimate_minutes': 'time_estimate_minutes',
      'priority_score': 'priority_score',
      'recommendation_applied': 'recommendation_applied'
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
    await this.pool.query(`
      INSERT INTO task_metadata (task_id, created_at, updated_at)
      VALUES ($1, NOW(), NOW())
      ON CONFLICT (task_id) DO NOTHING
    `, [taskId]);

    // Update the specific field and its timestamp
    if (timestampColumn) {
      await this.pool.query(`
        UPDATE task_metadata
        SET ${column} = $1,
            ${timestampColumn} = $2,
            updated_at = NOW()
        WHERE task_id = $3
      `, [value, classifiedAt, taskId]);
    } else {
      await this.pool.query(`
        UPDATE task_metadata
        SET ${column} = $1,
            updated_at = NOW()
        WHERE task_id = $2
      `, [value, taskId]);
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

    const result = await this.pool.query(
      `SELECT ${columns} FROM task_metadata WHERE task_id = $1`,
      [taskId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      value: row[valueColumn],
      classifiedAt: timestampColumn ? row[timestampColumn] : null
    };
  }

  async getLastSyncedState(taskId) {
    const result = await this.pool.query(`
      SELECT 
        last_synced_state,
        last_synced_at
      FROM task_metadata
      WHERE task_id = $1
    `, [taskId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    
    if (!row.last_synced_state) return null;

    try {
      return {
        taskState: typeof row.last_synced_state === 'string' 
          ? JSON.parse(row.last_synced_state)
          : row.last_synced_state, // PostgreSQL JSONB returns as object
        last_synced_at: row.last_synced_at
      };
    } catch (error) {
      console.error(`[Storage] Failed to parse last_synced_state for task ${taskId}:`, error);
      return null;
    }
  }

  async saveLastSyncedState(taskId, taskState, syncedAt = null) {
    // Ensure metadata row exists
    await this.pool.query(`
      INSERT INTO task_metadata (task_id, created_at, updated_at)
      VALUES ($1, NOW(), NOW())
      ON CONFLICT (task_id) DO NOTHING
    `, [taskId]);

    // Serialize task state to JSON
    const stateJson = JSON.stringify(taskState);
    const timestamp = syncedAt || new Date();

    // Update last synced state
    await this.pool.query(`
      UPDATE task_metadata
      SET last_synced_state = $1::jsonb,
          last_synced_at = $2,
          updated_at = NOW()
      WHERE task_id = $3
    `, [stateJson, timestamp, taskId]);
  }

  // ==================== Task History & Learning ====================

  async saveTaskCompletion(taskId, metadata) {
    await this.pool.query(`
      INSERT INTO task_history (
        task_id, task_content, completed_at, actual_duration, category, context
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      taskId,
      metadata.taskContent || null,
      metadata.completedAt || new Date(),
      metadata.actualDuration || null,
      metadata.category || null,
      metadata.context ? JSON.stringify(metadata.context) : null
    ]);
  }

  async getTaskHistory(filters = {}) {
    let query = 'SELECT * FROM task_history WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(filters.category);
    }

    if (filters.startDate) {
      query += ` AND completed_at >= $${paramIndex++}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND completed_at <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    query += ' ORDER BY completed_at DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(row => ({
      taskId: row.task_id,
      taskContent: row.task_content,
      completedAt: row.completed_at,
      actualDuration: row.actual_duration,
      category: row.category,
      context: row.context
    }));
  }

  async getCompletionPatterns(category) {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as count,
        AVG(actual_duration) as avg_duration,
        MIN(actual_duration) as min_duration,
        MAX(actual_duration) as max_duration
      FROM task_history
      WHERE category = $1 AND actual_duration IS NOT NULL
    `, [category]);

    const stats = result.rows[0];
    return {
      count: parseInt(stats.count) || 0,
      avgDuration: parseFloat(stats.avg_duration) || null,
      minDuration: parseInt(stats.min_duration) || null,
      maxDuration: parseInt(stats.max_duration) || null,
      commonPatterns: []
    };
  }

  // ==================== Projects & Labels ====================

  async saveProjects(projects) {
    if (!projects || projects.length === 0) return 0;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const project of projects) {
        await client.query(`
          INSERT INTO projects (id, name, color, parent_id, "order", is_favorite, raw_data)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            color = EXCLUDED.color,
            parent_id = EXCLUDED.parent_id,
            "order" = EXCLUDED."order",
            is_favorite = EXCLUDED.is_favorite,
            raw_data = EXCLUDED.raw_data,
            last_synced_at = CURRENT_TIMESTAMP
        `, [
          project.id,
          project.name,
          project.color || null,
          project.parentId || null,
          project.order || 0,
          project.isFavorite || false,
          JSON.stringify(project)
        ]);
      }

      await client.query('COMMIT');
      return projects.length;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getProjects() {
    const result = await this.pool.query('SELECT raw_data FROM projects ORDER BY "order"');
    return result.rows.map(row => row.raw_data);
  }

  async saveLabels(labels) {
    if (!labels || labels.length === 0) return 0;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const label of labels) {
        await client.query(`
          INSERT INTO labels (id, name, color, "order", is_favorite, raw_data)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            color = EXCLUDED.color,
            "order" = EXCLUDED."order",
            is_favorite = EXCLUDED.is_favorite,
            raw_data = EXCLUDED.raw_data,
            last_synced_at = CURRENT_TIMESTAMP
        `, [
          label.id,
          label.name,
          label.color || null,
          label.order || 0,
          label.isFavorite || false,
          JSON.stringify(label)
        ]);
      }

      await client.query('COMMIT');
      return labels.length;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getLabels() {
    const result = await this.pool.query('SELECT raw_data FROM labels ORDER BY "order"');
    return result.rows.map(row => row.raw_data);
  }

  // ==================== Sync State ====================

  async getLastSyncTime() {
    const result = await this.pool.query(
      "SELECT value FROM sync_state WHERE key = 'last_sync'"
    );

    return result.rows.length > 0 ? new Date(result.rows[0].value) : null;
  }

  async setLastSyncTime(timestamp) {
    await this.pool.query(`
      INSERT INTO sync_state (key, value, updated_at)
      VALUES ('last_sync', $1, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP
    `, [timestamp.toISOString()]);
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
      labels: typeof row.labels === 'string' ? JSON.parse(row.labels) : row.labels,
      createdAt: row.created_at,
      isCompleted: row.is_completed,
      completedAt: row.completed_at,
      metadata: {
        category: row.category,
        timeEstimate: row.time_estimate,
        size: row.size,
        aiConfidence: row.ai_confidence,
        aiReasoning: row.ai_reasoning,
        needsSupplies: row.needs_supplies,
        canDelegate: row.can_delegate,
        energyLevel: row.energy_level
      }
    };
  }
}


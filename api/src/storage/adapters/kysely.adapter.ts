/**
 * Kysely Storage Adapter
 * 
 * Unified database adapter using Kysely for type-safe queries.
 * Supports both SQLite (local dev) and PostgreSQL (Neon prod).
 */

import { Injectable, Logger } from '@nestjs/common';
import { Kysely, SqliteDialect, PostgresDialect, sql } from 'kysely';
import BetterSqlite3 from 'better-sqlite3';
import { Pool } from 'pg';
import { dirname, resolve, join } from 'path';
import { mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import { createHash } from 'crypto';

import { IStorageAdapter } from '../../common/interfaces/storage-adapter.interface';
import { Task, Project, Label, TaskFilters, TaskMetadata, TimeConstraint, TaskInsightStats } from '../../common/interfaces/task.interface';
import { Database } from '../database.types';

export type DatabaseDialect = 'sqlite' | 'postgres';

export interface KyselyAdapterOptions {
  dialect: DatabaseDialect;
  // SQLite options
  sqlitePath?: string;
  // PostgreSQL options
  connectionString?: string;
}

@Injectable()
export class KyselyAdapter implements IStorageAdapter {
  private readonly logger = new Logger(KyselyAdapter.name);
  private db: Kysely<Database> | null = null;
  private readonly options: KyselyAdapterOptions;

  constructor(options: KyselyAdapterOptions) {
    this.options = options;
  }

  async initialize(): Promise<void> {
    if (this.options.dialect === 'sqlite') {
      await this.initializeSqlite();
    } else {
      await this.initializePostgres();
    }

    // Create schema
    await this.createSchema();
    
    // Run migrations
    await this.runMigrations();

    this.logger.log(`Kysely adapter initialized (${this.options.dialect})`);
  }

  private async initializeSqlite(): Promise<void> {
    const dbPath = this.options.sqlitePath;
    if (!dbPath) {
      throw new Error('SQLite path required for sqlite dialect');
    }

    // Ensure directory exists
    const dir = dirname(dbPath);
    mkdirSync(dir, { recursive: true });

    const sqliteDb = new BetterSqlite3(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');

    this.db = new Kysely<Database>({
      dialect: new SqliteDialect({ database: sqliteDb }),
    });

    this.logger.log(`SQLite database initialized at ${dbPath}`);
  }

  private async initializePostgres(): Promise<void> {
    const connectionString = this.options.connectionString;
    if (!connectionString) {
      throw new Error('Connection string required for postgres dialect');
    }

    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }, // Neon uses SSL
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.db = new Kysely<Database>({
      dialect: new PostgresDialect({ pool }),
    });

    // Test connection
    try {
      await sql`SELECT 1`.execute(this.db);
      this.logger.log('PostgreSQL connection successful');
    } catch (error: any) {
      this.logger.error(`PostgreSQL connection failed: ${error.message}`);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.destroy();
      this.db = null;
      this.logger.log('Database connection closed');
    }
  }

  private getDb(): Kysely<Database> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  private async createSchema(): Promise<void> {
    const db = this.getDb();
    const isPg = this.options.dialect === 'postgres';

    // Tasks table
    await db.schema
      .createTable('tasks')
      .ifNotExists()
      .addColumn('id', 'text', col => col.primaryKey())
      .addColumn('content', 'text', col => col.notNull())
      .addColumn('description', 'text')
      .addColumn('project_id', 'text')
      .addColumn('parent_id', 'text')
      .addColumn('order', 'integer')
      .addColumn('priority', 'integer')
      .addColumn('due_string', 'text')
      .addColumn('due_date', 'text')
      .addColumn('due_datetime', 'text')
      .addColumn('due_timezone', 'text')
      .addColumn('labels', isPg ? 'jsonb' : 'text')
      .addColumn('created_at', 'text')
      .addColumn('is_completed', 'integer', col => col.defaultTo(0))
      .addColumn('completed_at', 'text')
      .addColumn('content_hash', 'text')
      .addColumn('raw_data', isPg ? 'jsonb' : 'text')
      .addColumn('last_synced_at', 'text', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    // Task metadata table
    await db.schema
      .createTable('task_metadata')
      .ifNotExists()
      .addColumn('task_id', 'text', col => col.primaryKey().references('tasks.id').onDelete('cascade'))
      .addColumn('category', 'text')
      .addColumn('time_estimate', 'text')
      .addColumn('time_estimate_minutes', 'integer')
      .addColumn('time_estimate_minutes_classified_at', 'text')
      .addColumn('size', 'text')
      .addColumn('ai_confidence', 'real')
      .addColumn('ai_reasoning', 'text')
      .addColumn('needs_supplies', 'integer', col => col.defaultTo(0))
      .addColumn('can_delegate', 'integer', col => col.defaultTo(0))
      .addColumn('energy_level', 'text')
      .addColumn('classification_source', 'text')
      .addColumn('recommended_category', 'text')
      .addColumn('recommended_category_classified_at', 'text')
      .addColumn('category_classified_at', 'text')
      .addColumn('priority_score', 'integer')
      .addColumn('priority_classified_at', 'text')
      .addColumn('last_synced_state', 'text')
      .addColumn('last_synced_at', 'text')
      .addColumn('recommendation_applied', 'integer', col => col.defaultTo(0))
      .addColumn('requires_driving', 'integer', col => col.defaultTo(0))
      .addColumn('time_constraint', 'text')
      .addColumn('created_at', 'text', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn('updated_at', 'text', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    // Task history table
    await db.schema
      .createTable('task_history')
      .ifNotExists()
      .addColumn('id', isPg ? 'serial' : 'integer', col => isPg ? col.primaryKey() : col.primaryKey().autoIncrement())
      .addColumn('task_id', 'text', col => col.notNull())
      .addColumn('content', 'text', col => col.notNull())
      .addColumn('completed_at', 'text', col => col.notNull())
      .addColumn('actual_duration', 'integer')
      .addColumn('estimated_duration', 'integer')
      .addColumn('category', 'text')
      .addColumn('context', isPg ? 'jsonb' : 'text')
      .addColumn('created_at', 'text', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    // Projects table
    await db.schema
      .createTable('projects')
      .ifNotExists()
      .addColumn('id', 'text', col => col.primaryKey())
      .addColumn('name', 'text', col => col.notNull())
      .addColumn('color', 'text')
      .addColumn('parent_id', 'text')
      .addColumn('order', 'integer')
      .addColumn('is_shared', 'integer', col => col.defaultTo(0))
      .addColumn('is_favorite', 'integer', col => col.defaultTo(0))
      .addColumn('is_inbox_project', 'integer', col => col.defaultTo(0))
      .addColumn('raw_data', isPg ? 'jsonb' : 'text')
      .addColumn('last_synced_at', 'text', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    // Labels table
    await db.schema
      .createTable('labels')
      .ifNotExists()
      .addColumn('id', 'text', col => col.primaryKey())
      .addColumn('name', 'text', col => col.notNull())
      .addColumn('color', 'text')
      .addColumn('order', 'integer')
      .addColumn('is_favorite', 'integer', col => col.defaultTo(0))
      .addColumn('last_synced_at', 'text', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    // Sync state table
    await db.schema
      .createTable('sync_state')
      .ifNotExists()
      .addColumn('key', 'text', col => col.primaryKey())
      .addColumn('value', 'text')
      .addColumn('updated_at', 'text', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    // AI interactions logging table
    await db.schema
      .createTable('ai_interactions')
      .ifNotExists()
      .addColumn('id', isPg ? 'serial' : 'integer', col => isPg ? col.primaryKey() : col.primaryKey().autoIncrement())
      .addColumn('interaction_type', 'text', col => col.notNull())
      .addColumn('task_id', 'text')
      .addColumn('input_context', isPg ? 'jsonb' : 'text')
      .addColumn('prompt_used', 'text')
      .addColumn('ai_response', isPg ? 'jsonb' : 'text')
      .addColumn('action_taken', 'text')
      .addColumn('success', 'integer', col => col.defaultTo(1))
      .addColumn('error_message', 'text')
      .addColumn('latency_ms', 'integer')
      .addColumn('model_used', 'text')
      .addColumn('created_at', 'text', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    // Migrations table
    await db.schema
      .createTable('migrations')
      .ifNotExists()
      .addColumn('id', 'text', col => col.primaryKey())
      .addColumn('applied_at', 'text', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    // Dashboard views table
    await db.schema
      .createTable('views')
      .ifNotExists()
      .addColumn('id', isPg ? 'serial' : 'integer', col => isPg ? col.primaryKey() : col.primaryKey().autoIncrement())
      .addColumn('name', 'text', col => col.notNull())
      .addColumn('slug', 'text', col => col.notNull().unique())
      .addColumn('filter_config', isPg ? 'jsonb' : 'text', col => col.notNull())
      .addColumn('is_default', 'integer', col => col.defaultTo(0))
      .addColumn('order_index', 'integer', col => col.defaultTo(0))
      .addColumn('created_at', 'text', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn('updated_at', 'text', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    // Create indices
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_is_completed ON tasks(is_completed)`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS idx_task_metadata_category ON task_metadata(category)`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS idx_task_history_completed_at ON task_history(completed_at)`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS idx_ai_interactions_type ON ai_interactions(interaction_type)`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS idx_ai_interactions_created ON ai_interactions(created_at)`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS idx_views_slug ON views(slug)`.execute(db);

    this.logger.log('Database schema created successfully');

    // Seed default views if none exist
    await this.seedDefaultViews();
  }

  private async seedDefaultViews(): Promise<void> {
    const db = this.getDb();
    
    // Check if views already exist
    const existingViews = await db
      .selectFrom('views')
      .select('id')
      .limit(1)
      .execute();

    if (existingViews.length > 0) {
      return; // Views already seeded
    }

    const defaultViews = [
      {
        name: 'Today',
        slug: 'today',
        filter_config: JSON.stringify({
          dueWithin: 'today',
          completed: false,
        }),
        is_default: 1,
        order_index: 0,
      },
      {
        name: 'This Week',
        slug: 'this-week',
        filter_config: JSON.stringify({
          dueWithin: '7d',
          completed: false,
        }),
        is_default: 1,
        order_index: 1,
      },
      {
        name: 'High Priority',
        slug: 'high-priority',
        filter_config: JSON.stringify({
          priority: [3, 4], // P2 (high) and P1 (urgent) - higher number = higher priority
          completed: false,
        }),
        is_default: 1,
        order_index: 2,
      },
      {
        name: 'All Tasks',
        slug: 'all',
        filter_config: JSON.stringify({
          completed: false,
        }),
        is_default: 1,
        order_index: 3,
      },
    ];

    for (const view of defaultViews) {
      await db
        .insertInto('views')
        .values(view)
        .execute();
    }

    this.logger.log('Default views seeded');
  }

  private async runMigrations(): Promise<void> {
    const db = this.getDb();
    
    // Migration: Add scheduling fields (requires_driving, time_constraint)
    await this.runMigration('add_scheduling_fields', async () => {
      // Check if columns exist by trying to select them
      try {
        await sql`SELECT requires_driving FROM task_metadata LIMIT 1`.execute(db);
      } catch (error) {
        // Column doesn't exist, add it
        await sql`ALTER TABLE task_metadata ADD COLUMN requires_driving INTEGER DEFAULT 0`.execute(db);
        this.logger.log('Added requires_driving column to task_metadata');
      }
      
      try {
        await sql`SELECT time_constraint FROM task_metadata LIMIT 1`.execute(db);
      } catch (error) {
        // Column doesn't exist, add it
        await sql`ALTER TABLE task_metadata ADD COLUMN time_constraint TEXT`.execute(db);
        this.logger.log('Added time_constraint column to task_metadata');
      }
    });

    // Migration: Fix high-priority view filter (was [1,2] which is P4/P3, should be [3,4] for P2/P1)
    await this.runMigration('fix_high_priority_view', async () => {
      const wrongConfig = JSON.stringify({ priority: [1, 2], completed: false });
      const correctConfig = JSON.stringify({ priority: [3, 4], completed: false });
      
      await db
        .updateTable('views')
        .set({ filter_config: correctConfig })
        .where('slug', '=', 'high-priority')
        .where('filter_config', '=', wrongConfig)
        .execute();
      
      this.logger.log('Fixed high-priority view filter: [1,2] -> [3,4]');
    });
    
    this.logger.log('Migrations complete');
  }

  private async runMigration(migrationId: string, migrationFn: () => Promise<void>): Promise<void> {
    const db = this.getDb();
    
    // Check if migration already applied
    const applied = await db
      .selectFrom('migrations')
      .select('id')
      .where('id', '=', migrationId)
      .executeTakeFirst();
    
    if (applied) {
      return; // Migration already applied
    }
    
    // Run migration
    await migrationFn();
    
    // Record migration
    await db
      .insertInto('migrations')
      .values({
        id: migrationId,
        applied_at: new Date().toISOString(),
      })
      .execute();
    
    this.logger.log(`Migration ${migrationId} applied`);
  }

  // ==================== Task Operations ====================

  async saveTasks(tasks: Task[]): Promise<number> {
    const db = this.getDb();
    const now = new Date().toISOString();

    for (const task of tasks) {
      const contentHash = createHash('sha256').update(task.content).digest('hex');
      
      await db
        .insertInto('tasks')
        .values({
          id: task.id,
          content: task.content,
          description: task.description || null,
          project_id: task.projectId || null,
          parent_id: task.parentId || null,
          order: 0,
          priority: task.priority,
          due_string: task.due?.string || null,
          due_date: task.due?.date || null,
          due_datetime: task.due?.datetime || null,
          due_timezone: task.due?.timezone || null,
          labels: JSON.stringify(task.labels || []),
          created_at: task.createdAt || null,
          is_completed: task.isCompleted ? 1 : 0,
          completed_at: task.completedAt || null,
          content_hash: contentHash,
          raw_data: JSON.stringify(task),
          last_synced_at: now,
        })
        .onConflict(oc => oc.column('id').doUpdateSet({
          content: task.content,
          description: task.description || null,
          project_id: task.projectId || null,
          parent_id: task.parentId || null,
          priority: task.priority,
          due_string: task.due?.string || null,
          due_date: task.due?.date || null,
          due_datetime: task.due?.datetime || null,
          due_timezone: task.due?.timezone || null,
          labels: JSON.stringify(task.labels || []),
          is_completed: task.isCompleted ? 1 : 0,
          completed_at: task.completedAt || null,
          content_hash: contentHash,
          raw_data: JSON.stringify(task),
          last_synced_at: now,
        }))
        .execute();
    }

    return tasks.length;
  }

  async getTasks(filters: TaskFilters = {}): Promise<Task[]> {
    const db = this.getDb();
    
    let query = db
      .selectFrom('tasks as t')
      .leftJoin('task_metadata as m', 't.id', 'm.task_id')
      .selectAll('t')
      .select([
        'm.category',
        'm.time_estimate',
        'm.time_estimate_minutes',
        'm.size',
        'm.ai_confidence',
        'm.ai_reasoning',
        'm.needs_supplies',
        'm.can_delegate',
        'm.energy_level',
        'm.classification_source',
        'm.recommended_category',
        'm.recommendation_applied',
        'm.requires_driving',
        'm.time_constraint',
      ]);

    if (filters.projectId) {
      query = query.where('t.project_id', '=', filters.projectId);
    }
    if (filters.category) {
      query = query.where('m.category', '=', filters.category);
    }
    if (filters.priority) {
      query = query.where('t.priority', '=', filters.priority);
    }
    if (filters.completed !== undefined) {
      query = query.where('t.is_completed', '=', filters.completed ? 1 : 0);
    }
    if (filters.requiresDriving !== undefined) {
      query = query.where('m.requires_driving', '=', filters.requiresDriving ? 1 : 0);
    }
    if (filters.timeConstraint) {
      query = query.where('m.time_constraint', '=', filters.timeConstraint);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const rows = await query.execute();
    return rows.map(row => this.rowToTask(row));
  }

  async getTask(taskId: string): Promise<Task | null> {
    const db = this.getDb();
    
    const row = await db
      .selectFrom('tasks as t')
      .leftJoin('task_metadata as m', 't.id', 'm.task_id')
      .selectAll('t')
      .select([
        'm.category',
        'm.time_estimate',
        'm.time_estimate_minutes',
        'm.size',
        'm.ai_confidence',
        'm.ai_reasoning',
        'm.needs_supplies',
        'm.can_delegate',
        'm.energy_level',
        'm.classification_source',
        'm.recommended_category',
        'm.recommendation_applied',
        'm.requires_driving',
        'm.time_constraint',
      ])
      .where('t.id', '=', taskId)
      .executeTakeFirst();

    return row ? this.rowToTask(row) : null;
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<boolean> {
    const db = this.getDb();
    const updateData: Record<string, any> = {};

    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.projectId !== undefined) updateData.project_id = updates.projectId;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.labels !== undefined) updateData.labels = JSON.stringify(updates.labels);
    if (updates.isCompleted !== undefined) updateData.is_completed = updates.isCompleted ? 1 : 0;
    if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt;

    // Handle due date fields
    if (updates.due !== undefined) {
      if (updates.due === null) {
        // Clear due date
        updateData.due_string = null;
        updateData.due_date = null;
        updateData.due_datetime = null;
        updateData.due_timezone = null;
      } else {
        // Update due date fields
        updateData.due_string = updates.due.string || null;
        updateData.due_date = updates.due.date || null;
        updateData.due_datetime = updates.due.datetime || null;
        updateData.due_timezone = updates.due.timezone || null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return false;
    }

    const result = await db
      .updateTable('tasks')
      .set(updateData)
      .where('id', '=', taskId)
      .executeTakeFirst();

    return (result.numUpdatedRows ?? 0n) > 0n;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const db = this.getDb();
    
    const result = await db
      .deleteFrom('tasks')
      .where('id', '=', taskId)
      .executeTakeFirst();

    return (result.numDeletedRows ?? 0n) > 0n;
  }

  async queryTasksByMetadata(criteria: Partial<TaskMetadata>): Promise<Task[]> {
    const db = this.getDb();
    
    let query = db
      .selectFrom('tasks as t')
      .innerJoin('task_metadata as m', 't.id', 'm.task_id')
      .selectAll('t')
      .select([
        'm.category',
        'm.time_estimate',
        'm.time_estimate_minutes',
        'm.size',
        'm.ai_confidence',
        'm.ai_reasoning',
        'm.needs_supplies',
        'm.can_delegate',
        'm.energy_level',
        'm.classification_source',
        'm.recommended_category',
        'm.recommendation_applied',
        'm.requires_driving',
        'm.time_constraint',
      ])
      .where('t.is_completed', '=', 0);

    if (criteria.category) {
      query = query.where('m.category', '=', criteria.category);
    }
    if (criteria.needsSupplies !== undefined) {
      query = query.where('m.needs_supplies', '=', criteria.needsSupplies ? 1 : 0);
    }
    if (criteria.canDelegate !== undefined) {
      query = query.where('m.can_delegate', '=', criteria.canDelegate ? 1 : 0);
    }
    if (criteria.energyLevel) {
      query = query.where('m.energy_level', '=', criteria.energyLevel);
    }
    if (criteria.size) {
      query = query.where('m.size', '=', criteria.size);
    }
    if (criteria.requiresDriving !== undefined) {
      query = query.where('m.requires_driving', '=', criteria.requiresDriving ? 1 : 0);
    }
    if (criteria.timeConstraint) {
      query = query.where('m.time_constraint', '=', criteria.timeConstraint);
    }

    const rows = await query.execute();
    return rows.map(row => this.rowToTask(row));
  }

  // ==================== Task Metadata ====================

  async saveTaskMetadata(taskId: string, metadata: Partial<TaskMetadata>): Promise<void> {
    const db = this.getDb();
    const now = new Date().toISOString();

    await db
      .insertInto('task_metadata')
      .values({
        task_id: taskId,
        category: metadata.category || null,
        time_estimate: metadata.timeEstimate || null,
        time_estimate_minutes: metadata.timeEstimateMinutes || null,
        size: metadata.size || null,
        ai_confidence: metadata.aiConfidence || null,
        ai_reasoning: metadata.aiReasoning || null,
        needs_supplies: metadata.needsSupplies ? 1 : 0,
        can_delegate: metadata.canDelegate ? 1 : 0,
        energy_level: metadata.energyLevel || null,
        requires_driving: metadata.requiresDriving ? 1 : 0,
        time_constraint: metadata.timeConstraint || null,
        created_at: now,
        updated_at: now,
      })
      .onConflict(oc => oc.column('task_id').doUpdateSet({
        category: metadata.category || null,
        time_estimate: metadata.timeEstimate || null,
        time_estimate_minutes: metadata.timeEstimateMinutes || null,
        size: metadata.size || null,
        ai_confidence: metadata.aiConfidence || null,
        ai_reasoning: metadata.aiReasoning || null,
        needs_supplies: metadata.needsSupplies ? 1 : 0,
        can_delegate: metadata.canDelegate ? 1 : 0,
        energy_level: metadata.energyLevel || null,
        requires_driving: metadata.requiresDriving ? 1 : 0,
        time_constraint: metadata.timeConstraint || null,
        updated_at: now,
      }))
      .execute();
  }

  async getTaskMetadata(taskId: string): Promise<TaskMetadata | null> {
    const db = this.getDb();
    
    const row = await db
      .selectFrom('task_metadata')
      .selectAll()
      .where('task_id', '=', taskId)
      .executeTakeFirst();

    if (!row) return null;

    return {
      category: row.category || undefined,
      timeEstimate: row.time_estimate || undefined,
      timeEstimateMinutes: row.time_estimate_minutes || undefined,
      size: (row.size as 'XS' | 'S' | 'M' | 'L' | 'XL') || undefined,
      aiConfidence: row.ai_confidence || undefined,
      aiReasoning: row.ai_reasoning || undefined,
      needsSupplies: row.needs_supplies === 1,
      canDelegate: row.can_delegate === 1,
      energyLevel: (row.energy_level as 'low' | 'medium' | 'high') || undefined,
      classificationSource: (row.classification_source as 'ai' | 'manual') || undefined,
      recommendedCategory: row.recommended_category || undefined,
      recommendationApplied: row.recommendation_applied === 1,
      requiresDriving: (row as any).requires_driving === 1,
      timeConstraint: ((row as any).time_constraint as TimeConstraint) || undefined,
    };
  }

  async saveFieldMetadata(taskId: string, fieldName: string, value: any, classifiedAt: Date): Promise<void> {
    const db = this.getDb();
    const now = new Date().toISOString();
    const classifiedAtStr = classifiedAt.toISOString();

    // Check if task exists first (foreign key constraint requirement)
    const taskExists = await db
      .selectFrom('tasks')
      .select('id')
      .where('id', '=', taskId)
      .executeTakeFirst();

    if (!taskExists) {
      this.logger.warn(`Cannot save metadata for task ${taskId}: task does not exist`);
      throw new Error(`Task ${taskId} does not exist in storage`);
    }

    // Ensure metadata row exists
    await db
      .insertInto('task_metadata')
      .values({ task_id: taskId, updated_at: now })
      .onConflict(oc => oc.column('task_id').doNothing())
      .execute();

    // Build update based on field name
    const updateData: Record<string, any> = { updated_at: now };
    const dbValue = typeof value === 'boolean' ? (value ? 1 : 0) : value;

    switch (fieldName) {
      case 'recommended_category':
        updateData.recommended_category = dbValue;
        updateData.recommended_category_classified_at = classifiedAtStr;
        break;
      case 'time_estimate_minutes':
        updateData.time_estimate_minutes = dbValue;
        updateData.time_estimate_minutes_classified_at = classifiedAtStr;
        break;
      case 'priority_score':
        updateData.priority_score = dbValue;
        updateData.priority_classified_at = classifiedAtStr;
        break;
      default:
        updateData[fieldName] = dbValue;
    }

    await db
      .updateTable('task_metadata')
      .set(updateData)
      .where('task_id', '=', taskId)
      .execute();
  }

  async getFieldMetadata(taskId: string, fieldName: string): Promise<{ value: any; classifiedAt: Date } | null> {
    const db = this.getDb();
    
    const row = await db
      .selectFrom('task_metadata')
      .selectAll()
      .where('task_id', '=', taskId)
      .executeTakeFirst();

    if (!row) return null;

    let value: any;
    let classifiedAt: string | null = null;

    switch (fieldName) {
      case 'recommended_category':
        value = row.recommended_category;
        classifiedAt = row.recommended_category_classified_at;
        break;
      case 'time_estimate_minutes':
        value = row.time_estimate_minutes;
        classifiedAt = row.time_estimate_minutes_classified_at;
        break;
      case 'priority_score':
        value = row.priority_score;
        classifiedAt = row.priority_classified_at;
        break;
      default:
        return null;
    }

    if (value === null || !classifiedAt) return null;

    return { value, classifiedAt: new Date(classifiedAt) };
  }

  async getLastSyncedState(taskId: string): Promise<{ taskState: any; syncedAt: Date } | null> {
    const db = this.getDb();
    
    const row = await db
      .selectFrom('task_metadata')
      .select(['last_synced_state', 'last_synced_at'])
      .where('task_id', '=', taskId)
      .executeTakeFirst();

    if (!row || !row.last_synced_state) return null;

    return {
      taskState: (() => {
        try {
          return JSON.parse(row.last_synced_state);
        } catch (e) {
          return {};
        }
      })(),
      syncedAt: new Date(row.last_synced_at!),
    };
  }

  async saveLastSyncedState(taskId: string, taskState: any, syncedAt?: Date): Promise<void> {
    const db = this.getDb();
    const now = new Date().toISOString();
    const timestamp = (syncedAt || new Date()).toISOString();

    // Ensure metadata row exists
    await db
      .insertInto('task_metadata')
      .values({ task_id: taskId, updated_at: now })
      .onConflict(oc => oc.column('task_id').doNothing())
      .execute();

    await db
      .updateTable('task_metadata')
      .set({
        last_synced_state: JSON.stringify(taskState),
        last_synced_at: timestamp,
        updated_at: now,
      })
      .where('task_id', '=', taskId)
      .execute();
  }

  // ==================== Task History ====================

  async saveTaskCompletion(taskId: string, metadata: {
    completedAt?: Date;
    actualDuration?: number;
    category?: string;
    context?: any;
  }): Promise<void> {
    const db = this.getDb();
    const task = await this.getTask(taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    await db
      .insertInto('task_history')
      .values({
        task_id: taskId,
        content: task.content,
        completed_at: (metadata.completedAt || new Date()).toISOString(),
        actual_duration: metadata.actualDuration || null,
        category: metadata.category || null,
        context: metadata.context ? JSON.stringify(metadata.context) : null,
      })
      .execute();
  }

  async getTaskHistory(filters: {
    category?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): Promise<Array<{
    taskId: string;
    content: string;
    completedAt: Date;
    actualDuration?: number;
    category?: string;
  }>> {
    const db = this.getDb();
    
    let query = db
      .selectFrom('task_history')
      .selectAll()
      .orderBy('completed_at', 'desc');

    if (filters.category) {
      query = query.where('category', '=', filters.category);
    }
    if (filters.startDate) {
      query = query.where('completed_at', '>=', filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query = query.where('completed_at', '<=', filters.endDate.toISOString());
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const rows = await query.execute();

    return rows.map(row => ({
      taskId: row.task_id,
      content: row.content,
      completedAt: new Date(row.completed_at),
      actualDuration: row.actual_duration || undefined,
      category: row.category || undefined,
    }));
  }

  async getCompletionPatterns(category: string): Promise<{
    count: number;
    avgDuration: number;
    commonPatterns: string[];
  }> {
    const db = this.getDb();

    // Get stats
    const stats = await db
      .selectFrom('task_history')
      .select([
        sql<number>`COUNT(*)`.as('count'),
        sql<number>`AVG(actual_duration)`.as('avgDuration'),
      ])
      .where('category', '=', category)
      .where('actual_duration', 'is not', null)
      .executeTakeFirst();

    // Get recent tasks for pattern analysis
    const tasks = await db
      .selectFrom('task_history')
      .select('content')
      .where('category', '=', category)
      .orderBy('completed_at', 'desc')
      .limit(50)
      .execute();

    // Extract common words
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
      .map(entry => entry[0]);

    return {
      count: stats?.count || 0,
      avgDuration: stats?.avgDuration || 0,
      commonPatterns,
    };
  }

  /**
   * Get pre-computed statistics for task insights
   * All aggregations done in SQL for accuracy and efficiency
   */
  async getTaskInsightStats(): Promise<TaskInsightStats> {
    const db = this.getDb();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // 1. Get total active tasks count
    const activeCountResult = await db
      .selectFrom('tasks')
      .select(sql<number>`COUNT(*)`.as('count'))
      .where('is_completed', '=', 0)
      .executeTakeFirst();
    const totalActive = Number(activeCountResult?.count || 0);

    // 2. Get completed tasks count (last 30 days)
    const completedCountResult = await db
      .selectFrom('task_history')
      .select(sql<number>`COUNT(*)`.as('count'))
      .where('completed_at', '>=', thirtyDaysAgo.toISOString())
      .executeTakeFirst();
    const totalCompletedLast30Days = Number(completedCountResult?.count || 0);

    // 3. Active tasks by category
    const activeByCategoryRows = await db
      .selectFrom('tasks')
      .leftJoin('task_metadata', 'tasks.id', 'task_metadata.task_id')
      .select([
        sql<string>`COALESCE(task_metadata.category, 'inbox')`.as('category'),
        sql<number>`COUNT(*)`.as('count'),
      ])
      .where('tasks.is_completed', '=', 0)
      .groupBy(sql`COALESCE(task_metadata.category, 'inbox')`)
      .execute();
    
    const activeByCategory: Record<string, number> = {};
    for (const row of activeByCategoryRows) {
      activeByCategory[row.category || 'inbox'] = Number(row.count);
    }

    // 4. Completed tasks by category (last 30 days)
    const completedByCategoryRows = await db
      .selectFrom('task_history')
      .select([
        sql<string>`COALESCE(category, 'inbox')`.as('category'),
        sql<number>`COUNT(*)`.as('count'),
      ])
      .where('completed_at', '>=', thirtyDaysAgo.toISOString())
      .groupBy(sql`COALESCE(category, 'inbox')`)
      .execute();
    
    const completedByCategory: Record<string, number> = {};
    for (const row of completedByCategoryRows) {
      completedByCategory[row.category || 'inbox'] = Number(row.count);
    }

    // 5. Age distribution of active tasks
    const ageBucketsResult = await db
      .selectFrom('tasks')
      .select([
        sql<number>`SUM(CASE WHEN created_at >= ${sevenDaysAgo.toISOString()} THEN 1 ELSE 0 END)`.as('recent'),
        sql<number>`SUM(CASE WHEN created_at < ${sevenDaysAgo.toISOString()} AND created_at >= ${thirtyDaysAgo.toISOString()} THEN 1 ELSE 0 END)`.as('week'),
        sql<number>`SUM(CASE WHEN created_at < ${thirtyDaysAgo.toISOString()} AND created_at >= ${ninetyDaysAgo.toISOString()} THEN 1 ELSE 0 END)`.as('month'),
        sql<number>`SUM(CASE WHEN created_at < ${ninetyDaysAgo.toISOString()} THEN 1 ELSE 0 END)`.as('stale'),
      ])
      .where('is_completed', '=', 0)
      .executeTakeFirst();

    const taskAgeBuckets = {
      recent: Number(ageBucketsResult?.recent || 0),
      week: Number(ageBucketsResult?.week || 0),
      month: Number(ageBucketsResult?.month || 0),
      stale: Number(ageBucketsResult?.stale || 0),
    };

    // 6. Average completion time by category
    const avgCompletionRows = await db
      .selectFrom('task_history')
      .select([
        sql<string>`COALESCE(category, 'inbox')`.as('category'),
        sql<number>`AVG(actual_duration)`.as('avgDuration'),
      ])
      .where('actual_duration', 'is not', null)
      .groupBy(sql`COALESCE(category, 'inbox')`)
      .execute();

    const avgCompletionTimeByCategory: Record<string, number | null> = {};
    for (const row of avgCompletionRows) {
      avgCompletionTimeByCategory[row.category || 'inbox'] = row.avgDuration ? Number(row.avgDuration) : null;
    }

    // 7. Completion rates
    const tasksCreatedLast7Days = await db
      .selectFrom('tasks')
      .select(sql<number>`COUNT(*)`.as('count'))
      .where('created_at', '>=', sevenDaysAgo.toISOString())
      .executeTakeFirst();
    
    const tasksCompletedLast7Days = await db
      .selectFrom('task_history')
      .select(sql<number>`COUNT(*)`.as('count'))
      .where('completed_at', '>=', sevenDaysAgo.toISOString())
      .executeTakeFirst();

    const created7 = Number(tasksCreatedLast7Days?.count || 0);
    const completed7 = Number(tasksCompletedLast7Days?.count || 0);
    const completionRateLast7Days = created7 > 0 ? completed7 / created7 : 0;

    const tasksCreatedLast30Days = await db
      .selectFrom('tasks')
      .select(sql<number>`COUNT(*)`.as('count'))
      .where('created_at', '>=', thirtyDaysAgo.toISOString())
      .executeTakeFirst();
    
    const created30 = Number(tasksCreatedLast30Days?.count || 0);
    const completionRateLast30Days = created30 > 0 ? totalCompletedLast30Days / created30 : 0;

    // 8. Estimate coverage
    const estimateCoverageResult = await db
      .selectFrom('tasks')
      .leftJoin('task_metadata', 'tasks.id', 'task_metadata.task_id')
      .select([
        sql<number>`SUM(CASE WHEN task_metadata.time_estimate IS NOT NULL THEN 1 ELSE 0 END)`.as('withEstimates'),
        sql<number>`SUM(CASE WHEN task_metadata.time_estimate IS NULL THEN 1 ELSE 0 END)`.as('withoutEstimates'),
      ])
      .where('tasks.is_completed', '=', 0)
      .executeTakeFirst();

    const tasksWithEstimates = Number(estimateCoverageResult?.withEstimates || 0);
    const tasksWithoutEstimates = Number(estimateCoverageResult?.withoutEstimates || 0);

    // 9. Due date analysis
    const nowStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const overdueResult = await db
      .selectFrom('tasks')
      .select(sql<number>`COUNT(*)`.as('count'))
      .where('is_completed', '=', 0)
      .where('due_date', '<', nowStr)
      .where('due_date', 'is not', null)
      .executeTakeFirst();
    const overdueTasks = Number(overdueResult?.count || 0);

    const dueSoonResult = await db
      .selectFrom('tasks')
      .select(sql<number>`COUNT(*)`.as('count'))
      .where('is_completed', '=', 0)
      .where('due_date', '>=', nowStr)
      .where('due_date', '<=', sevenDaysFromNow)
      .executeTakeFirst();
    const dueSoon = Number(dueSoonResult?.count || 0);

    // 10. Top labels on active tasks
    const labelRows = await db
      .selectFrom('tasks')
      .select([
        sql<string>`labels`.as('labels'),
      ])
      .where('is_completed', '=', 0)
      .where('labels', 'is not', null)
      .execute();

    const labelCounts = new Map<string, number>();
    for (const row of labelRows) {
      if (row.labels) {
        try {
          const labels = JSON.parse(row.labels as string);
          if (Array.isArray(labels)) {
            for (const label of labels) {
              labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    const topLabels = Array.from(labelCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, count]) => ({ label, count }));

    // 11. Stalest tasks (for archival suggestions)
    const stalestTasksRows = await db
      .selectFrom('tasks')
      .leftJoin('task_metadata', 'tasks.id', 'task_metadata.task_id')
      .select([
        'tasks.id',
        'tasks.content',
        'tasks.created_at',
        sql<string>`COALESCE(task_metadata.category, 'inbox')`.as('category'),
      ])
      .where('tasks.is_completed', '=', 0)
      .where('tasks.created_at', '<', ninetyDaysAgo.toISOString())
      .orderBy('tasks.created_at', 'asc')
      .limit(10)
      .execute();

    const stalestTasks = stalestTasksRows.map(row => ({
      id: row.id,
      content: row.content.substring(0, 100), // Truncate for prompt
      ageInDays: row.created_at 
        ? Math.floor((now.getTime() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0,
      category: row.category || 'inbox',
    }));

    // 12. Completions by day of week (from task_history)
    const dayOfWeekRows = await db
      .selectFrom('task_history')
      .select([
        sql<string>`strftime('%w', completed_at)`.as('dayOfWeek'),
        sql<number>`COUNT(*)`.as('count'),
      ])
      .where('completed_at', '>=', thirtyDaysAgo.toISOString())
      .groupBy(sql`strftime('%w', completed_at)`)
      .execute();

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const completionsByDayOfWeek: Record<string, number> = {};
    for (const day of dayNames) {
      completionsByDayOfWeek[day] = 0;
    }
    for (const row of dayOfWeekRows) {
      const dayIndex = parseInt(row.dayOfWeek || '0', 10);
      if (dayIndex >= 0 && dayIndex < 7) {
        completionsByDayOfWeek[dayNames[dayIndex]] = Number(row.count);
      }
    }

    // 13. Daily completions for trend chart (last 30 days)
    const dailyCompletionsRows = await db
      .selectFrom('task_history')
      .select([
        sql<string>`date(completed_at)`.as('date'),
        sql<number>`COUNT(*)`.as('count'),
      ])
      .where('completed_at', '>=', thirtyDaysAgo.toISOString())
      .groupBy(sql`date(completed_at)`)
      .orderBy('date', 'asc')
      .execute();

    // Fill in missing dates with 0
    const dailyCompletions: Array<{ date: string; count: number }> = [];
    const dateMap = new Map(dailyCompletionsRows.map(r => [r.date, Number(r.count)]));
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      dailyCompletions.push({
        date: dateStr,
        count: dateMap.get(dateStr) || 0,
      });
    }

    // 14. Calculate streaks
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let lastCompletionDate: string | null = null;

    // Get completion dates in order
    const completionDatesRows = await db
      .selectFrom('task_history')
      .select(sql<string>`date(completed_at)`.as('date'))
      .groupBy(sql`date(completed_at)`)
      .orderBy('date', 'desc')
      .execute();

    if (completionDatesRows.length > 0) {
      lastCompletionDate = completionDatesRows[0].date;
      
      // Calculate current streak (consecutive days from today/yesterday)
      const today = now.toISOString().split('T')[0];
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      let checkDate = completionDatesRows[0].date === today ? today : 
                      completionDatesRows[0].date === yesterday ? yesterday : null;
      
      if (checkDate) {
        let currentCheckDate: string = checkDate;
        for (const row of completionDatesRows) {
          if (row.date === currentCheckDate) {
            currentStreak++;
            const prevDate = new Date(new Date(currentCheckDate).getTime() - 24 * 60 * 60 * 1000);
            currentCheckDate = prevDate.toISOString().split('T')[0];
          } else {
            break;
          }
        }
      }

      // Calculate longest streak
      const sortedDates = completionDatesRows.map(r => r.date).sort();
      tempStreak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = new Date(sortedDates[i - 1]);
        const currDate = new Date(sortedDates[i]);
        const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000));
        
        if (diffDays === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak, currentStreak);
    }

    // 15. Category velocity (avg days to complete by category)
    const velocityRows = await db
      .selectFrom('task_history')
      .innerJoin('tasks', 'task_history.task_id', 'tasks.id')
      .select([
        sql<string>`COALESCE(task_history.category, 'inbox')`.as('category'),
        sql<number>`COUNT(*)`.as('completed'),
        sql<number>`AVG(julianday(task_history.completed_at) - julianday(tasks.created_at))`.as('avgDays'),
      ])
      .where('task_history.completed_at', '>=', thirtyDaysAgo.toISOString())
      .groupBy(sql`COALESCE(task_history.category, 'inbox')`)
      .execute();

    const categoryVelocity: Record<string, { completed: number; avgDaysToComplete: number | null }> = {};
    for (const row of velocityRows) {
      categoryVelocity[row.category || 'inbox'] = {
        completed: Number(row.completed),
        avgDaysToComplete: row.avgDays ? Math.round(Number(row.avgDays) * 10) / 10 : null,
      };
    }

    // 16. Procrastination stats (tasks with due dates)
    const procrastinationRows = await db
      .selectFrom('task_history')
      .innerJoin('tasks', 'task_history.task_id', 'tasks.id')
      .select([
        sql<number>`SUM(CASE 
          WHEN tasks.due_date IS NOT NULL AND date(task_history.completed_at) < tasks.due_date THEN 1 
          ELSE 0 
        END)`.as('onTime'),
        sql<number>`SUM(CASE 
          WHEN tasks.due_date IS NOT NULL AND date(task_history.completed_at) = tasks.due_date THEN 1 
          ELSE 0 
        END)`.as('lastMinute'),
        sql<number>`SUM(CASE 
          WHEN tasks.due_date IS NOT NULL AND date(task_history.completed_at) > tasks.due_date THEN 1 
          ELSE 0 
        END)`.as('late'),
      ])
      .where('task_history.completed_at', '>=', thirtyDaysAgo.toISOString())
      .executeTakeFirst();

    const procrastinationStats = {
      completedOnTime: Number(procrastinationRows?.onTime || 0),
      completedLastMinute: Number(procrastinationRows?.lastMinute || 0),
      completedLate: Number(procrastinationRows?.late || 0),
    };

    // 17. Calculate productivity score (0-100)
    // Factors: completion rate, streak, estimate coverage, overdue ratio, stale ratio
    const completionScore = Math.min(completionRateLast30Days * 100, 40); // Max 40 points
    const streakScore = Math.min(currentStreak * 5, 20); // Max 20 points
    const estimateCoverage = totalActive > 0 ? (tasksWithEstimates / totalActive) : 0;
    const estimateScore = estimateCoverage * 15; // Max 15 points
    const overdueRatio = totalActive > 0 ? 1 - (overdueTasks / totalActive) : 1;
    const overdueScore = overdueRatio * 15; // Max 15 points
    const staleRatio = totalActive > 0 ? 1 - (taskAgeBuckets.stale / totalActive) : 1;
    const staleScore = staleRatio * 10; // Max 10 points
    
    const productivityScore = Math.round(
      completionScore + streakScore + estimateScore + overdueScore + staleScore
    );

    return {
      totalActive,
      totalCompletedLast30Days,
      activeByCategory,
      completedByCategory,
      taskAgeBuckets,
      avgCompletionTimeByCategory,
      completionRateLast7Days,
      completionRateLast30Days,
      tasksWithEstimates,
      tasksWithoutEstimates,
      overdueTasks,
      dueSoon,
      topLabels,
      stalestTasks,
      // New behavioral metrics
      completionsByDayOfWeek,
      dailyCompletions,
      currentStreak,
      longestStreak,
      lastCompletionDate,
      productivityScore,
      categoryVelocity,
      procrastinationStats,
    };
  }

  // ==================== Projects & Labels ====================

  async saveProjects(projects: Project[]): Promise<number> {
    const db = this.getDb();
    const now = new Date().toISOString();

    for (const project of projects) {
      await db
        .insertInto('projects')
        .values({
          id: project.id,
          name: project.name,
          color: project.color || null,
          parent_id: project.parentId || null,
          order: project.order || 0,
          is_shared: project.isShared ? 1 : 0,
          is_favorite: project.isFavorite ? 1 : 0,
          is_inbox_project: project.isInboxProject ? 1 : 0,
          raw_data: JSON.stringify(project),
          last_synced_at: now,
        })
        .onConflict(oc => oc.column('id').doUpdateSet({
          name: project.name,
          color: project.color || null,
          parent_id: project.parentId || null,
          order: project.order || 0,
          is_shared: project.isShared ? 1 : 0,
          is_favorite: project.isFavorite ? 1 : 0,
          is_inbox_project: project.isInboxProject ? 1 : 0,
          raw_data: JSON.stringify(project),
          last_synced_at: now,
        }))
        .execute();
    }

    return projects.length;
  }

  async getProjects(): Promise<Project[]> {
    const db = this.getDb();
    
    const rows = await db
      .selectFrom('projects')
      .selectAll()
      .execute();

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      color: row.color || undefined,
      parentId: row.parent_id || undefined,
      order: row.order || 0,
      isShared: row.is_shared === 1,
      isFavorite: row.is_favorite === 1,
      isInboxProject: row.is_inbox_project === 1,
    }));
  }

  async saveLabels(labels: Label[]): Promise<number> {
    const db = this.getDb();
    const now = new Date().toISOString();

    for (const label of labels) {
      await db
        .insertInto('labels')
        .values({
          id: label.id,
          name: label.name,
          color: label.color || null,
          order: label.order || 0,
          is_favorite: label.isFavorite ? 1 : 0,
          last_synced_at: now,
        })
        .onConflict(oc => oc.column('id').doUpdateSet({
          name: label.name,
          color: label.color || null,
          order: label.order || 0,
          is_favorite: label.isFavorite ? 1 : 0,
          last_synced_at: now,
        }))
        .execute();
    }

    return labels.length;
  }

  async getLabels(): Promise<Label[]> {
    const db = this.getDb();
    
    const rows = await db
      .selectFrom('labels')
      .selectAll()
      .execute();

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      color: row.color || undefined,
      order: row.order || 0,
      isFavorite: row.is_favorite === 1,
    }));
  }

  // ==================== Sync State ====================

  async getLastSyncTime(): Promise<Date | null> {
    const db = this.getDb();
    
    const row = await db
      .selectFrom('sync_state')
      .select('value')
      .where('key', '=', 'last_sync_time')
      .executeTakeFirst();

    return row?.value ? new Date(row.value) : null;
  }

  async setLastSyncTime(timestamp: Date): Promise<void> {
    const db = this.getDb();
    const now = new Date().toISOString();

    await db
      .insertInto('sync_state')
      .values({
        key: 'last_sync_time',
        value: timestamp.toISOString(),
        updated_at: now,
      })
      .onConflict(oc => oc.column('key').doUpdateSet({
        value: timestamp.toISOString(),
        updated_at: now,
      }))
      .execute();
  }

  async getSyncToken(): Promise<string> {
    const db = this.getDb();
    
    const row = await db
      .selectFrom('sync_state')
      .select('value')
      .where('key', '=', 'todoist_sync_token')
      .executeTakeFirst();

    return row?.value || '*';
  }

  async setSyncToken(token: string): Promise<void> {
    const db = this.getDb();
    const now = new Date().toISOString();

    await db
      .insertInto('sync_state')
      .values({
        key: 'todoist_sync_token',
        value: token,
        updated_at: now,
      })
      .onConflict(oc => oc.column('key').doUpdateSet({
        value: token,
        updated_at: now,
      }))
      .execute();
  }

  // ==================== AI Interaction Logging ====================

  async logAIInteraction(data: {
    interactionType: string;
    taskId?: string;
    inputContext?: any;
    promptUsed?: string;
    aiResponse?: any;
    actionTaken?: string;
    success: boolean;
    errorMessage?: string;
    latencyMs?: number;
    modelUsed?: string;
  }): Promise<void> {
    const db = this.getDb();

    await db
      .insertInto('ai_interactions')
      .values({
        interaction_type: data.interactionType,
        task_id: data.taskId || null,
        input_context: data.inputContext ? JSON.stringify(data.inputContext) : null,
        prompt_used: data.promptUsed || null,
        ai_response: data.aiResponse ? JSON.stringify(data.aiResponse) : null,
        action_taken: data.actionTaken || null,
        success: data.success ? 1 : 0,
        error_message: data.errorMessage || null,
        latency_ms: data.latencyMs || null,
        model_used: data.modelUsed || null,
      })
      .execute();
  }

  async getAIInteractions(filters: {
    interactionType?: string;
    taskId?: string;
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): Promise<Array<{
    id: number;
    interactionType: string;
    taskId?: string;
    inputContext?: any;
    promptUsed?: string;
    aiResponse?: any;
    actionTaken?: string;
    success: boolean;
    errorMessage?: string;
    latencyMs?: number;
    modelUsed?: string;
    createdAt: Date;
  }>> {
    const db = this.getDb();
    
    let query = db
      .selectFrom('ai_interactions')
      .selectAll()
      .orderBy('created_at', 'desc');

    if (filters.interactionType) {
      query = query.where('interaction_type', '=', filters.interactionType);
    }
    if (filters.taskId) {
      query = query.where('task_id', '=', filters.taskId);
    }
    if (filters.success !== undefined) {
      query = query.where('success', '=', filters.success ? 1 : 0);
    }
    if (filters.startDate) {
      query = query.where('created_at', '>=', filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query = query.where('created_at', '<=', filters.endDate.toISOString());
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const rows = await query.execute();

    return rows.map(row => ({
      id: row.id,
      interactionType: row.interaction_type,
      taskId: row.task_id || undefined,
      inputContext: row.input_context ? (() => {
        try {
          return JSON.parse(row.input_context as string);
        } catch (e) {
          return undefined;
        }
      })() : undefined,
      promptUsed: row.prompt_used || undefined,
      aiResponse: row.ai_response ? (() => {
        try {
          return JSON.parse(row.ai_response as string);
        } catch (e) {
          return undefined;
        }
      })() : undefined,
      actionTaken: row.action_taken || undefined,
      success: row.success === 1,
      errorMessage: row.error_message || undefined,
      latencyMs: row.latency_ms || undefined,
      modelUsed: row.model_used || undefined,
      createdAt: new Date(row.created_at),
    }));
  }

  // ==================== Views Operations ====================

  async getViews(): Promise<Array<{
    id: number;
    name: string;
    slug: string;
    filterConfig: any;
    isDefault: boolean;
    orderIndex: number;
  }>> {
    const db = this.getDb();
    
    const rows = await db
      .selectFrom('views')
      .selectAll()
      .orderBy('order_index', 'asc')
      .execute();

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      filterConfig: typeof row.filter_config === 'string' 
        ? (() => {
            try {
              return JSON.parse(row.filter_config);
            } catch (e) {
              return {};
            }
          })()
        : row.filter_config,
      isDefault: row.is_default === 1,
      orderIndex: row.order_index,
    }));
  }

  async getView(slugOrId: string | number): Promise<{
    id: number;
    name: string;
    slug: string;
    filterConfig: any;
    isDefault: boolean;
    orderIndex: number;
  } | null> {
    const db = this.getDb();
    
    let query = db.selectFrom('views').selectAll();
    
    if (typeof slugOrId === 'number') {
      query = query.where('id', '=', slugOrId);
    } else {
      query = query.where('slug', '=', slugOrId);
    }
    
    const row = await query.executeTakeFirst();

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      filterConfig: typeof row.filter_config === 'string' 
        ? (() => {
            try {
              return JSON.parse(row.filter_config);
            } catch (e) {
              return {};
            }
          })()
        : row.filter_config,
      isDefault: row.is_default === 1,
      orderIndex: row.order_index,
    };
  }

  async createView(data: {
    name: string;
    slug: string;
    filterConfig: any;
    orderIndex?: number;
  }): Promise<{
    id: number;
    name: string;
    slug: string;
    filterConfig: any;
    isDefault: boolean;
    orderIndex: number;
  }> {
    const db = this.getDb();
    const now = new Date().toISOString();

    // Get max order index
    const maxOrder = await db
      .selectFrom('views')
      .select(sql<number>`MAX(order_index)`.as('max'))
      .executeTakeFirst();

    const orderIndex = data.orderIndex ?? ((maxOrder?.max ?? -1) + 1);

    const result = await db
      .insertInto('views')
      .values({
        name: data.name,
        slug: data.slug,
        filter_config: JSON.stringify(data.filterConfig),
        is_default: 0,
        order_index: orderIndex,
        created_at: now,
        updated_at: now,
      })
      .returning(['id', 'name', 'slug', 'filter_config', 'is_default', 'order_index'])
      .executeTakeFirst();

    // For SQLite which doesn't support RETURNING well, fetch the created view
    if (!result) {
      const created = await db
        .selectFrom('views')
        .selectAll()
        .where('slug', '=', data.slug)
        .executeTakeFirst();

      if (!created) {
        throw new Error('Failed to create view');
      }

      return {
        id: created.id,
        name: created.name,
        slug: created.slug,
        filterConfig: typeof created.filter_config === 'string'
          ? JSON.parse(created.filter_config)
          : created.filter_config,
        isDefault: created.is_default === 1,
        orderIndex: created.order_index,
      };
    }

    return {
      id: result.id,
      name: result.name,
      slug: result.slug,
      filterConfig: typeof result.filter_config === 'string'
        ? JSON.parse(result.filter_config)
        : result.filter_config,
      isDefault: result.is_default === 1,
      orderIndex: result.order_index,
    };
  }

  async updateView(slugOrId: string | number, data: {
    name?: string;
    filterConfig?: any;
    orderIndex?: number;
  }): Promise<boolean> {
    const db = this.getDb();
    const now = new Date().toISOString();

    const updateData: Record<string, any> = { updated_at: now };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.filterConfig !== undefined) updateData.filter_config = JSON.stringify(data.filterConfig);
    if (data.orderIndex !== undefined) updateData.order_index = data.orderIndex;

    let query = db.updateTable('views').set(updateData);
    
    if (typeof slugOrId === 'number') {
      query = query.where('id', '=', slugOrId);
    } else {
      query = query.where('slug', '=', slugOrId);
    }

    const result = await query.executeTakeFirst();
    return (result.numUpdatedRows ?? 0n) > 0n;
  }

  async deleteView(slugOrId: string | number): Promise<boolean> {
    const db = this.getDb();
    
    let query = db.deleteFrom('views');
    
    if (typeof slugOrId === 'number') {
      query = query.where('id', '=', slugOrId);
    } else {
      query = query.where('slug', '=', slugOrId);
    }

    // Don't allow deleting default views
    query = query.where('is_default', '=', 0);

    const result = await query.executeTakeFirst();
    return (result.numDeletedRows ?? 0n) > 0n;
  }

  // ==================== Helper Methods ====================

  private rowToTask(row: any): Task {
    return {
      id: row.id,
      content: row.content,
      description: row.description || undefined,
      projectId: row.project_id || undefined,
      parentId: row.parent_id || undefined,
      priority: row.priority,
      labels: row.labels && typeof row.labels === 'string' && row.labels.trim() ? (() => {
        try {
          return JSON.parse(row.labels);
        } catch (e) {
          // If JSON parse fails, return empty array
          return [];
        }
      })() : (Array.isArray(row.labels) ? row.labels : []),
      due: row.due_date
        ? {
            date: row.due_date,
            datetime: row.due_datetime || undefined,
            string: row.due_string || undefined,
            timezone: row.due_timezone || undefined,
            isRecurring: false,
          }
        : undefined,
      createdAt: row.created_at || undefined,
      updatedAt: row.last_synced_at || undefined,
      isCompleted: row.is_completed === 1,
      completedAt: row.completed_at || undefined,
      // Include metadata if ANY metadata field is present (not just category)
      metadata: (row.category || row.time_estimate_minutes || row.time_estimate || row.size)
        ? {
            category: row.category || undefined,
            timeEstimate: row.time_estimate || undefined,
            timeEstimateMinutes: row.time_estimate_minutes || undefined,
            size: row.size || undefined,
            aiConfidence: row.ai_confidence || undefined,
            aiReasoning: row.ai_reasoning || undefined,
            needsSupplies: row.needs_supplies === 1,
            canDelegate: row.can_delegate === 1,
            energyLevel: row.energy_level || undefined,
            classificationSource: row.classification_source || undefined,
            recommendedCategory: row.recommended_category || undefined,
            recommendationApplied: row.recommendation_applied === 1,
            requiresDriving: row.requires_driving === 1,
            timeConstraint: (row.time_constraint as TimeConstraint) || undefined,
          }
        : undefined,
    };
  }
}


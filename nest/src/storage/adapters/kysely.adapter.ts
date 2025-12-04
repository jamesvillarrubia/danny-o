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
import { Task, Project, Label, TaskFilters, TaskMetadata } from '../../common/interfaces/task.interface';
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
      .addColumn('created_at', 'text', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn('updated_at', 'text', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute();

    // Task history table
    await db.schema
      .createTable('task_history')
      .ifNotExists()
      .addColumn('id', isPg ? 'serial' : 'integer', col => col.primaryKey().autoIncrement())
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
      .addColumn('id', isPg ? 'serial' : 'integer', col => col.primaryKey().autoIncrement())
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

    // Create indices
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_is_completed ON tasks(is_completed)`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS idx_task_metadata_category ON task_metadata(category)`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS idx_task_history_completed_at ON task_history(completed_at)`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS idx_ai_interactions_type ON ai_interactions(interaction_type)`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS idx_ai_interactions_created ON ai_interactions(created_at)`.execute(db);

    this.logger.log('Database schema created successfully');
  }

  private async runMigrations(): Promise<void> {
    // Migrations are handled by schema creation for now
    // Can add Kysely migrator later if needed
    this.logger.log('Migrations complete');
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
    };
  }

  async saveFieldMetadata(taskId: string, fieldName: string, value: any, classifiedAt: Date): Promise<void> {
    const db = this.getDb();
    const now = new Date().toISOString();
    const classifiedAtStr = classifiedAt.toISOString();

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
      taskState: JSON.parse(row.last_synced_state),
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
      inputContext: row.input_context ? JSON.parse(row.input_context as string) : undefined,
      promptUsed: row.prompt_used || undefined,
      aiResponse: row.ai_response ? JSON.parse(row.ai_response as string) : undefined,
      actionTaken: row.action_taken || undefined,
      success: row.success === 1,
      errorMessage: row.error_message || undefined,
      latencyMs: row.latency_ms || undefined,
      modelUsed: row.model_used || undefined,
      createdAt: new Date(row.created_at),
    }));
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
      labels: row.labels ? JSON.parse(row.labels) : [],
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
      metadata: row.category
        ? {
            category: row.category,
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
          }
        : undefined,
    };
  }
}


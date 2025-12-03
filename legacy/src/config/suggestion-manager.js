/**
 * Suggestion Manager
 * 
 * Manages AI-suggested projects and labels with human-in-the-loop approval workflow.
 * 
 * Workflow:
 * 1. AI suggests new project/label → stored in DB with status='suggested'
 * 2. User reviews → changes status to 'approved', 'deferred', or 'ignored'
 * 3. Approved items can be promoted → added to task-taxonomy.yaml
 * 4. Ignored items won't be suggested again
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TAXONOMY_PATH = resolve(__dirname, '../../config/task-taxonomy.yaml');

export class SuggestionManager {
  constructor(storage) {
    this.storage = storage;
  }

  // ==================== Suggest New Items ====================

  /**
   * AI suggests a new project
   */
  async suggestProject(suggestion) {
    const {
      id,
      name,
      description,
      reasoning,
      exampleTasks = [],
      keywords = []
    } = suggestion;

    // Check if already exists
    const existing = await this._getSuggestedProject(id);
    if (existing) {
      // Increment times_suggested
      await this._incrementSuggestionCount('project', id);
      return { exists: true, suggestion: existing };
    }

    // Create new suggestion
    const stmt = this.storage.db.prepare(`
      INSERT INTO suggested_projects (
        suggested_id, suggested_name, description, reasoning,
        example_tasks, suggested_keywords, supporting_tasks
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      name,
      description,
      reasoning,
      JSON.stringify(exampleTasks),
      JSON.stringify(keywords),
      exampleTasks.length
    );

    // Log to history
    await this._logSuggestionHistory('project', id, 'suggested', {
      reasoning,
      exampleTasks
    });

    return { exists: false, suggestion: { id, name, description } };
  }

  /**
   * AI suggests a new label
   */
  async suggestLabel(suggestion) {
    const {
      id,
      name,
      description,
      category,
      reasoning,
      exampleTasks = [],
      keywords = [],
      appliesToProjects = []
    } = suggestion;

    // Check if already exists
    const existing = await this._getSuggestedLabel(id);
    if (existing) {
      await this._incrementSuggestionCount('label', id);
      return { exists: true, suggestion: existing };
    }

    // Create new suggestion
    const stmt = this.storage.db.prepare(`
      INSERT INTO suggested_labels (
        suggested_id, suggested_name, description, suggested_category,
        reasoning, example_tasks, suggested_keywords, applies_to_projects,
        supporting_tasks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      name,
      description,
      category,
      reasoning,
      JSON.stringify(exampleTasks),
      JSON.stringify(keywords),
      JSON.stringify(appliesToProjects),
      exampleTasks.length
    );

    // Log to history
    await this._logSuggestionHistory('label', id, 'suggested', {
      reasoning,
      exampleTasks
    });

    return { exists: false, suggestion: { id, name, description } };
  }

  // ==================== Review Suggestions ====================

  /**
   * List all pending suggestions
   */
  async listPending() {
    const query = 'SELECT * FROM pending_suggestions';
    return this.storage.db.prepare(query).all();
  }

  /**
   * List approved suggestions
   */
  async listApproved() {
    const query = 'SELECT * FROM approved_suggestions';
    return this.storage.db.prepare(query).all();
  }

  /**
   * Get suggestion details
   */
  async getSuggestion(type, id) {
    if (type === 'project') {
      return this._getSuggestedProject(id);
    } else {
      return this._getSuggestedLabel(id);
    }
  }

  /**
   * Update suggestion status
   */
  async updateStatus(type, id, status, notes = null) {
    const validStatuses = ['suggested', 'approved', 'deferred', 'ignored'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const table = type === 'project' ? 'suggested_projects' : 'suggested_labels';
    const stmt = this.storage.db.prepare(`
      UPDATE ${table}
      SET status = ?,
          reviewed_at = CURRENT_TIMESTAMP,
          reviewed_by = 'user',
          review_notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE suggested_id = ?
    `);

    const result = stmt.run(status, notes, id);

    if (result.changes > 0) {
      await this._logSuggestionHistory(type, id, status, { notes });
    }

    return result.changes > 0;
  }

  /**
   * Approve a suggestion
   */
  async approve(type, id, notes = null) {
    return this.updateStatus(type, id, 'approved', notes);
  }

  /**
   * Defer a suggestion (maybe later)
   */
  async defer(type, id, notes = null) {
    return this.updateStatus(type, id, 'deferred', notes);
  }

  /**
   * Ignore a suggestion (don't suggest again)
   */
  async ignore(type, id, notes = null) {
    return this.updateStatus(type, id, 'ignored', notes);
  }

  // ==================== Promote to YAML ====================

  /**
   * Promote an approved suggestion to the YAML config
   */
  async promoteToYaml(type, id) {
    // Get the suggestion
    const suggestion = await this.getSuggestion(type, id);
    
    if (!suggestion) {
      throw new Error(`Suggestion not found: ${type}/${id}`);
    }

    if (suggestion.status !== 'approved') {
      throw new Error(`Can only promote approved suggestions. Current status: ${suggestion.status}`);
    }

    // Load current YAML
    const yamlContent = readFileSync(TAXONOMY_PATH, 'utf8');
    const taxonomy = yaml.parse(yamlContent);

    // Add to appropriate section
    if (type === 'project') {
      taxonomy.projects.push({
        id: suggestion.suggested_id,
        name: suggestion.suggested_name,
        description: suggestion.description,
        examples: [],
        keywords: JSON.parse(suggestion.suggested_keywords || '[]'),
        notes: suggestion.review_notes || 'AI-suggested and user-approved'
      });
    } else {
      // Find or create category
      const category = suggestion.suggested_category || 'AI Suggested';
      let categoryObj = taxonomy.label_categories.find(c => c.category === category);
      
      if (!categoryObj) {
        categoryObj = {
          category,
          description: 'AI-suggested labels',
          labels: []
        };
        taxonomy.label_categories.push(categoryObj);
      }

      categoryObj.labels.push({
        id: suggestion.suggested_id,
        name: suggestion.suggested_name,
        description: suggestion.description,
        keywords: JSON.parse(suggestion.suggested_keywords || '[]'),
        applies_to: [],
        notes: suggestion.review_notes || 'AI-suggested and user-approved'
      });
    }

    // Update version and timestamp
    const today = new Date().toISOString().split('T')[0];
    taxonomy.updated = today;
    const [major, minor] = taxonomy.version.split('.');
    taxonomy.version = `${major}.${parseInt(minor) + 1}`;

    // Write back to file
    const newYamlContent = yaml.stringify(taxonomy, {
      lineWidth: 0,
      indent: 2
    });
    writeFileSync(TAXONOMY_PATH, newYamlContent, 'utf8');

    // Mark as promoted in DB
    await this.updateStatus(type, id, 'promoted', 'Promoted to YAML config');
    await this._logSuggestionHistory(type, id, 'promoted', {
      yaml_version: taxonomy.version
    });

    return {
      success: true,
      version: taxonomy.version,
      suggestion: { id: suggestion.suggested_id, name: suggestion.suggested_name }
    };
  }

  // ==================== Cleanup ====================

  /**
   * Remove old ignored suggestions (soft delete completed)
   */
  async cleanupIgnored(olderThanDays = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoff = cutoffDate.toISOString();

    const projects = this.storage.db.prepare(`
      DELETE FROM suggested_projects
      WHERE status = 'ignored' AND reviewed_at < ?
    `).run(cutoff);

    const labels = this.storage.db.prepare(`
      DELETE FROM suggested_labels
      WHERE status = 'ignored' AND reviewed_at < ?
    `).run(cutoff);

    return {
      projects: projects.changes,
      labels: labels.changes
    };
  }

  // ==================== Statistics ====================

  /**
   * Get statistics about suggestions
   */
  async getStats() {
    const projectStats = this.storage.db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM suggested_projects
      GROUP BY status
    `).all();

    const labelStats = this.storage.db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM suggested_labels
      GROUP BY status
    `).all();

    return {
      projects: this._formatStats(projectStats),
      labels: this._formatStats(labelStats),
      total: {
        suggested: this._sumStatus([...projectStats, ...labelStats], 'suggested'),
        approved: this._sumStatus([...projectStats, ...labelStats], 'approved'),
        deferred: this._sumStatus([...projectStats, ...labelStats], 'deferred'),
        ignored: this._sumStatus([...projectStats, ...labelStats], 'ignored')
      }
    };
  }

  // ==================== Private Helpers ====================

  async _getSuggestedProject(id) {
    return this.storage.db.prepare(`
      SELECT * FROM suggested_projects WHERE suggested_id = ?
    `).get(id);
  }

  async _getSuggestedLabel(id) {
    return this.storage.db.prepare(`
      SELECT * FROM suggested_labels WHERE suggested_id = ?
    `).get(id);
  }

  async _incrementSuggestionCount(type, id) {
    const table = type === 'project' ? 'suggested_projects' : 'suggested_labels';
    this.storage.db.prepare(`
      UPDATE ${table}
      SET times_suggested = times_suggested + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE suggested_id = ?
    `).run(id);
  }

  async _logSuggestionHistory(type, id, action, metadata = {}) {
    this.storage.db.prepare(`
      INSERT INTO suggestion_history (
        suggestion_type, suggestion_id, action, metadata, actor
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      type,
      id,
      action,
      JSON.stringify(metadata),
      metadata.actor || 'ai'
    );
  }

  _formatStats(rows) {
    const stats = {
      suggested: 0,
      approved: 0,
      deferred: 0,
      ignored: 0
    };
    
    for (const row of rows) {
      stats[row.status] = row.count;
    }
    
    return stats;
  }

  _sumStatus(rows, status) {
    return rows.filter(r => r.status === status).reduce((sum, r) => sum + r.count, 0);
  }
}

export default SuggestionManager;


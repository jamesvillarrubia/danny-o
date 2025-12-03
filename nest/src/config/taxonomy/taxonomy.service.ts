/**
 * Taxonomy Service
 * 
 * Loads and manages the task taxonomy configuration from YAML.
 * Provides structured access to projects, labels, and classification rules.
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'yaml';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface TaxonomyProject {
  id: string;
  name: string;
  description: string;
  color?: string;
  examples?: string[];
}

export interface TaxonomyLabel {
  id: string;
  name: string;
  description: string;
  keywords?: string[];
  status?: 'active' | 'archived';
  category: string;
}

export interface TaxonomyLabelCategory {
  category: string;
  labels: TaxonomyLabel[];
}

export interface ClassificationRules {
  project_selection: Array<{ rule: string }>;
  label_selection: Array<{ rule: string }>;
}

export interface Taxonomy {
  version: string;
  updated: string;
  projects: TaxonomyProject[];
  label_categories: TaxonomyLabelCategory[];
  classification_rules: ClassificationRules;
}

@Injectable()
export class TaxonomyService implements OnModuleInit {
  private readonly logger = new Logger(TaxonomyService.name);
  private taxonomy: Taxonomy | null = null;
  private readonly taxonomyPath: string;

  constructor() {
    // Path to taxonomy file in nest config directory
    this.taxonomyPath = resolve(__dirname, '../../../config/task-taxonomy.yaml');
  }

  onModuleInit() {
    this.loadTaxonomy();
  }

  /**
   * Load taxonomy from YAML file
   */
  private loadTaxonomy(): void {
    try {
      const yamlContent = readFileSync(this.taxonomyPath, 'utf8');
      this.taxonomy = yaml.parse(yamlContent);
      this.logger.log(`Loaded taxonomy v${this.taxonomy?.version} from ${this.taxonomyPath}`);
    } catch (error) {
      this.logger.error(`Failed to load taxonomy: ${error.message}`);
      throw new Error(`Could not load task taxonomy: ${error.message}`);
    }
  }

  /**
   * Get full taxonomy
   */
  getTaxonomy(): Taxonomy {
    if (!this.taxonomy) {
      throw new Error('Taxonomy not loaded');
    }
    return this.taxonomy;
  }

  /**
   * Get all projects
   */
  getProjects(): TaxonomyProject[] {
    return this.getTaxonomy().projects;
  }

  /**
   * Get all active labels
   */
  getActiveLabels(): TaxonomyLabel[] {
    const allLabels: TaxonomyLabel[] = [];
    
    for (const category of this.getTaxonomy().label_categories) {
      for (const label of category.labels) {
        if (!label.status || label.status === 'active') {
          allLabels.push({
            ...label,
            category: category.category,
          });
        }
      }
    }
    
    return allLabels;
  }

  /**
   * Get all labels including archived
   */
  getAllLabels(): TaxonomyLabel[] {
    const allLabels: TaxonomyLabel[] = [];
    
    for (const category of this.getTaxonomy().label_categories) {
      for (const label of category.labels) {
        allLabels.push({
          ...label,
          category: category.category,
        });
      }
    }
    
    return allLabels;
  }

  /**
   * Get labels grouped by category
   */
  getLabelsByCategory(): TaxonomyLabelCategory[] {
    return this.getTaxonomy().label_categories;
  }

  /**
   * Get classification rules
   */
  getClassificationRules(): ClassificationRules {
    return this.getTaxonomy().classification_rules;
  }

  /**
   * Find a project by ID or name
   */
  findProject(identifier: string): TaxonomyProject | undefined {
    const projects = this.getProjects();
    return projects.find(
      (p) => p.id === identifier || p.name.toLowerCase() === identifier.toLowerCase(),
    );
  }

  /**
   * Find a label by ID or name
   */
  findLabel(identifier: string): TaxonomyLabel | undefined {
    const labels = this.getAllLabels();
    return labels.find(
      (l) => l.id === identifier || l.name.toLowerCase() === identifier.toLowerCase(),
    );
  }

  /**
   * Get project examples for learning
   */
  getProjectExamples(projectId: string): string[] {
    const project = this.findProject(projectId);
    return project?.examples || [];
  }

  /**
   * Get label keywords for pattern matching
   */
  getLabelKeywords(labelId: string): string[] {
    const label = this.findLabel(labelId);
    return label?.keywords || [];
  }

  /**
   * Generate AI classification prompt
   */
  generateClassificationPrompt(): string {
    const projects = this.getProjects();
    const labelCategories = this.getLabelsByCategory();
    const rules = this.getClassificationRules();

    const projectList = projects
      .map((p, i) => `${i + 1}. ${p.name} - ${p.description}`)
      .join('\n');

    const labelList = labelCategories
      .filter((cat) => cat.category !== 'Archived (Deprecated)')
      .map((cat) => {
        const labels = cat.labels
          .filter((l) => !l.status || l.status === 'active')
          .map((l) => `  - ${l.name}: ${l.description}`)
          .join('\n');
        return `${cat.category}:\n${labels}`;
      })
      .join('\n\n');

    const projectRules = rules.project_selection.map((r) => `- ${r.rule}`).join('\n');
    const labelRules = rules.label_selection.map((r) => `- ${r.rule}`).join('\n');

    return `
You are classifying tasks into projects and labels.

# PROJECTS (Choose ONE - Mutually Exclusive)
${projectList}

# LABELS (Suggest 0-3 - Can Apply Multiple)
${labelList}

# CLASSIFICATION RULES

## Project Selection:
${projectRules}

## Label Selection:
${labelRules}

# RESPONSE FORMAT

Return a JSON object with:
{
  "project": "Project Name",
  "labels": ["Label1", "Label2"],
  "confidence": 0.85,
  "reasoning": "Brief explanation of classification"
}
`;
  }

  /**
   * Validate taxonomy structure
   */
  validateTaxonomy(): { valid: boolean; errors: string[] } {
    try {
      const taxonomy = this.getTaxonomy();
      const errors: string[] = [];

      // Check required fields
      if (!taxonomy.version) errors.push('Missing version');
      if (!taxonomy.projects) errors.push('Missing projects');
      if (!taxonomy.label_categories) errors.push('Missing label_categories');

      // Check projects
      for (const project of taxonomy.projects || []) {
        if (!project.id) errors.push(`Project missing id: ${project.name}`);
        if (!project.name) errors.push(`Project missing name: ${project.id}`);
        if (!project.description) errors.push(`Project ${project.id} missing description`);
      }

      // Check labels
      for (const category of taxonomy.label_categories || []) {
        if (!category.category) errors.push('Label category missing name');
        for (const label of category.labels || []) {
          if (!label.id) errors.push(`Label missing id: ${label.name}`);
          if (!label.name) errors.push(`Label missing name: ${label.id}`);
        }
      }

      if (errors.length > 0) {
        this.logger.error(`Taxonomy validation errors: ${errors.join(', ')}`);
        return { valid: false, errors };
      }

      this.logger.log('Taxonomy validation passed');
      return { valid: true, errors: [] };
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  }

  /**
   * Get summary statistics
   */
  getTaxonomyStats() {
    const taxonomy = this.getTaxonomy();
    const activeLabels = this.getActiveLabels();

    return {
      version: taxonomy.version,
      updated: taxonomy.updated,
      projects: taxonomy.projects.length,
      labelCategories: taxonomy.label_categories.length,
      totalLabels: this.getAllLabels().length,
      activeLabels: activeLabels.length,
      archivedLabels: this.getAllLabels().length - activeLabels.length,
    };
  }
}


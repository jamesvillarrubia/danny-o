/**
 * Task Taxonomy Configuration Loader
 * 
 * Loads the task-taxonomy.yaml file and provides structured access
 * to projects, labels, and classification rules.
 * Used by AI agents for classification prompts.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to taxonomy config
const TAXONOMY_PATH = resolve(__dirname, '../../config/task-taxonomy.yaml');

let cachedTaxonomy = null;

/**
 * Load and parse the taxonomy configuration
 */
export function loadTaxonomy() {
  if (cachedTaxonomy) {
    return cachedTaxonomy;
  }

  try {
    const yamlContent = readFileSync(TAXONOMY_PATH, 'utf8');
    cachedTaxonomy = yaml.parse(yamlContent);
    console.log(`[Taxonomy] Loaded v${cachedTaxonomy.version} from ${TAXONOMY_PATH}`);
    return cachedTaxonomy;
  } catch (error) {
    console.error('[Taxonomy] Failed to load taxonomy:', error.message);
    throw new Error(`Could not load task taxonomy: ${error.message}`);
  }
}

/**
 * Get all projects with descriptions
 */
export function getProjects() {
  const taxonomy = loadTaxonomy();
  return taxonomy.projects;
}

/**
 * Get all active labels (excluding archived/deprecated)
 */
export function getActiveLabels() {
  const taxonomy = loadTaxonomy();
  const allLabels = [];

  for (const category of taxonomy.label_categories) {
    for (const label of category.labels) {
      if (!label.status || label.status === 'active') {
        allLabels.push({
          ...label,
          category: category.category
        });
      }
    }
  }

  return allLabels;
}

/**
 * Get all labels including archived (for reference)
 */
export function getAllLabels() {
  const taxonomy = loadTaxonomy();
  const allLabels = [];

  for (const category of taxonomy.label_categories) {
    for (const label of category.labels) {
      allLabels.push({
        ...label,
        category: category.category
      });
    }
  }

  return allLabels;
}

/**
 * Get labels grouped by category
 */
export function getLabelsByCategory() {
  const taxonomy = loadTaxonomy();
  return taxonomy.label_categories;
}

/**
 * Get classification rules
 */
export function getClassificationRules() {
  const taxonomy = loadTaxonomy();
  return taxonomy.classification_rules;
}

/**
 * Generate AI classification prompt
 */
export function generateClassificationPrompt() {
  const projects = getProjects();
  const labelCategories = getLabelsByCategory();
  const rules = getClassificationRules();

  const projectList = projects
    .map((p, i) => `${i + 1}. ${p.name} - ${p.description}`)
    .join('\n');

  const labelList = labelCategories
    .filter(cat => cat.category !== 'Archived (Deprecated)')
    .map(cat => {
      const labels = cat.labels
        .filter(l => !l.status || l.status === 'active')
        .map(l => `  - ${l.name}: ${l.description}`)
        .join('\n');
      return `${cat.category}:\n${labels}`;
    })
    .join('\n\n');

  const projectRules = rules.project_selection.map(r => `- ${r.rule}`).join('\n');
  const labelRules = rules.label_selection.map(r => `- ${r.rule}`).join('\n');

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
 * Find a project by ID or name
 */
export function findProject(identifier) {
  const projects = getProjects();
  return projects.find(
    p => p.id === identifier || 
         p.name.toLowerCase() === identifier.toLowerCase()
  );
}

/**
 * Find a label by ID or name
 */
export function findLabel(identifier) {
  const labels = getAllLabels();
  return labels.find(
    l => l.id === identifier || 
         l.name.toLowerCase() === identifier.toLowerCase()
  );
}

/**
 * Get project examples for learning
 */
export function getProjectExamples(projectId) {
  const project = findProject(projectId);
  return project ? project.examples : [];
}

/**
 * Get label keywords for pattern matching
 */
export function getLabelKeywords(labelId) {
  const label = findLabel(labelId);
  return label ? label.keywords : [];
}

/**
 * Validate taxonomy structure
 */
export function validateTaxonomy() {
  try {
    const taxonomy = loadTaxonomy();
    const errors = [];

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
      console.error('[Taxonomy] Validation errors:', errors);
      return { valid: false, errors };
    }

    console.log('[Taxonomy] Validation passed');
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}

/**
 * Get summary statistics
 */
export function getTaxonomyStats() {
  const taxonomy = loadTaxonomy();
  const activeLabels = getActiveLabels();
  
  return {
    version: taxonomy.version,
    updated: taxonomy.updated,
    projects: taxonomy.projects.length,
    labelCategories: taxonomy.label_categories.length,
    totalLabels: getAllLabels().length,
    activeLabels: activeLabels.length,
    archivedLabels: getAllLabels().length - activeLabels.length
  };
}

export default {
  loadTaxonomy,
  getProjects,
  getActiveLabels,
  getAllLabels,
  getLabelsByCategory,
  getClassificationRules,
  generateClassificationPrompt,
  findProject,
  findLabel,
  getProjectExamples,
  getLabelKeywords,
  validateTaxonomy,
  getTaxonomyStats
};


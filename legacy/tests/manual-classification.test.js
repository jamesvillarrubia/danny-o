/**
 * Manual Classification Test Suite
 * 
 * Tests the classification source tracking system:
 * - AI classifications are marked as 'ai'
 * - Manual changes detected during sync are marked as 'manual'
 * - classify --all skips manual tasks
 * - classify --force reclassifies manual tasks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TodoistClient } from '../src/todoist/client.js';
import { SyncEngine } from '../src/todoist/sync.js';
import { TaskEnrichment } from '../src/todoist/enrichment.js';
import { AIOperations } from '../src/ai/operations.js';
import { SQLiteAdapter } from '../src/storage/sqlite.js';
import { loadTaxonomy } from '../src/config/taxonomy-loader.js';

// Mock Todoist API responses
class MockTodoistAPI {
  constructor() {
    this.tasks = new Map();
    this.projects = new Map();
    this.labels = new Map();
    this.callLog = [];
    
    // Set up default projects from taxonomy
    const taxonomy = loadTaxonomy();
    taxonomy.projects.forEach((proj, idx) => {
      const projId = `proj_${idx}`;
      this.projects.set(projId, {
        id: projId,
        name: proj.name,
        color: proj.color || 'grey'
      });
    });
    
    // Add Inbox project
    this.projects.set('inbox_proj', {
      id: 'inbox_proj',
      name: 'Inbox',
      color: 'grey'
    });
  }
  
  createTask(taskData) {
    this.callLog.push({ method: 'createTask', data: taskData });
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task = {
      id: taskId,
      content: taskData.content,
      description: taskData.description || '',
      projectId: taskData.projectId || 'inbox_proj',
      labels: taskData.labels || [],
      priority: taskData.priority || 1,
      due: taskData.due || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isCompleted: false
    };
    this.tasks.set(taskId, task);
    return Promise.resolve(task);
  }
  
  getTasks() {
    this.callLog.push({ method: 'getTasks' });
    return Promise.resolve(Array.from(this.tasks.values()));
  }
  
  getProjects() {
    this.callLog.push({ method: 'getProjects' });
    return Promise.resolve(Array.from(this.projects.values()));
  }
  
  getLabels() {
    this.callLog.push({ method: 'getLabels' });
    return Promise.resolve(Array.from(this.labels.values()));
  }
  
  moveTask(taskId, updates) {
    this.callLog.push({ method: 'moveTask', taskId, updates });
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    
    task.projectId = updates.projectId;
    task.updatedAt = new Date().toISOString();
    this.tasks.set(taskId, task);
    return Promise.resolve(task);
  }
  
  updateTask(taskId, updates) {
    this.callLog.push({ method: 'updateTask', taskId, updates });
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    
    Object.assign(task, updates);
    task.updatedAt = new Date().toISOString();
    this.tasks.set(taskId, task);
    return Promise.resolve(task);
  }
  
  // Simulate manual change in Todoist UI
  simulateManualChange(taskId, changes) {
    console.log(`\n🔧 [Mock] Simulating manual change in Todoist UI for task ${taskId}`);
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    
    Object.assign(task, changes);
    task.updatedAt = new Date().toISOString();
    this.tasks.set(taskId, task);
    console.log(`   Changed:`, changes);
    return task;
  }
  
  clearCallLog() {
    this.callLog = [];
  }
  
  getCallLog() {
    return this.callLog;
  }
}

// Mock AI Agent
class MockAIAgent {
  constructor() {
    this.callCount = 0;
  }
  
  async classifyTasks(tasks) {
    this.callCount++;
    console.log(`\n🤖 [Mock AI] Classifying ${tasks.length} tasks...`);
    
    // Simple mock classification logic
    return tasks.map((task, idx) => ({
      category: idx % 2 === 0 ? 'work' : 'personal-family',
      timeEstimate: '20-30min',
      labels: [],
      confidence: 0.85,
      reasoning: 'Mock classification'
    }));
  }
}

// Vitest test suite
describe('Manual Classification Tracking', () => {
  let storage;
  let mockAPI;
  let todoistClient;
  let sync;
  let enrichment;
  let mockAI;
  
  beforeEach(async () => {
    // Set up in-memory test database
    storage = new SQLiteAdapter(':memory:');
    await storage.initialize();
    
    // Set up mock Todoist API
    mockAPI = new MockTodoistAPI();
    todoistClient = new TodoistClient('mock_token');
    todoistClient.api = mockAPI;
    
    // Set up components
    sync = new SyncEngine(todoistClient, storage);
    enrichment = new TaskEnrichment(storage, todoistClient);
    mockAI = new MockAIAgent();
  });
  
  it('should mark AI classifications as source="ai"', async () => {
    // Create a task in Inbox
    const task = await mockAPI.createTask({
      content: 'Review quarterly financials',
      projectId: 'inbox_proj'
    });
    
    // Sync to local DB
    await sync.syncNow();
    
    // Verify task is unclassified
    const unclassified = await enrichment.getUnclassifiedTasks();
    expect(unclassified).toHaveLength(1);
    
    // AI classifies it
    await enrichment.enrichTask(task.id, {
      category: 'work',
      timeEstimate: '30-45min'
    });
    
    // Check classification_source
    const metadata = await storage.getTaskMetadata(task.id);
    expect(metadata.classification_source).toBe('ai');
    expect(metadata.recommended_category).toBe('work');
  });
  
  it('should detect manual changes and mark as source="manual"', async () => {
    // Create and classify a task
    const task = await mockAPI.createTask({
      content: 'Review quarterly financials',
      projectId: 'inbox_proj'
    });
    await sync.syncNow();
    
    await enrichment.enrichTask(task.id, {
      category: 'work',
      timeEstimate: '30-45min'
    });
    
    // Wait for timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate user manually moving task in Todoist UI
    const personalProj = Array.from(mockAPI.projects.values())
      .find(p => p.name === 'Personal/Family');
    mockAPI.simulateManualChange(task.id, {
      projectId: personalProj.id
    });
    
    // Sync - should detect manual change
    await sync.syncNow();
    
    // Check classification_source was updated to 'manual'
    const metadata = await storage.getTaskMetadata(task.id);
    expect(metadata.classification_source).toBe('manual');
    expect(metadata.recommended_category).toBe('personal-family');
  });
  
  it('should skip manual tasks when getting unclassified (force=false)', async () => {
    // Create and classify a task
    const task1 = await mockAPI.createTask({
      content: 'Task 1',
      projectId: 'inbox_proj'
    });
    await sync.syncNow();
    
    await enrichment.enrichTask(task1.id, {
      category: 'work',
      timeEstimate: '30min'
    });
    
    // Manually change it
    await new Promise(resolve => setTimeout(resolve, 100));
    const personalProj = Array.from(mockAPI.projects.values())
      .find(p => p.name === 'Personal/Family');
    mockAPI.simulateManualChange(task1.id, {
      projectId: personalProj.id
    });
    await sync.syncNow();
    
    // Create another unclassified task
    const task2 = await mockAPI.createTask({
      content: 'Task 2',
      projectId: 'inbox_proj'
    });
    await sync.syncNow();
    
    // Get unclassified (without force) - should only return task2
    const unclassified = await enrichment.getUnclassifiedTasks({ force: false });
    
    expect(unclassified).toHaveLength(1);
    expect(unclassified[0].id).toBe(task2.id);
  });
  
  it('should include manual tasks when force=true', async () => {
    // Create and classify a task
    const task1 = await mockAPI.createTask({
      content: 'Task 1',
      projectId: 'inbox_proj'
    });
    await sync.syncNow();
    
    await enrichment.enrichTask(task1.id, {
      category: 'work',
      timeEstimate: '30min'
    });
    
    // Manually change it
    await new Promise(resolve => setTimeout(resolve, 100));
    const personalProj = Array.from(mockAPI.projects.values())
      .find(p => p.name === 'Personal/Family');
    mockAPI.simulateManualChange(task1.id, {
      projectId: personalProj.id
    });
    await sync.syncNow();
    
    // Create another unclassified task
    const task2 = await mockAPI.createTask({
      content: 'Task 2',
      projectId: 'inbox_proj'
    });
    await sync.syncNow();
    
    // Get unclassified with force=true - should return both
    const unclassified = await enrichment.getUnclassifiedTasks({ force: true });
    
    expect(unclassified).toHaveLength(2);
  });
  
  it('should reclassify manual tasks back to "ai" when forced', async () => {
    // Create, classify, and manually change a task
    const task = await mockAPI.createTask({
      content: 'Task 1',
      projectId: 'inbox_proj'
    });
    await sync.syncNow();
    
    await enrichment.enrichTask(task.id, {
      category: 'work',
      timeEstimate: '30min'
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    const personalProj = Array.from(mockAPI.projects.values())
      .find(p => p.name === 'Personal/Family');
    mockAPI.simulateManualChange(task.id, {
      projectId: personalProj.id
    });
    await sync.syncNow();
    
    // Verify it's marked as manual
    let metadata = await storage.getTaskMetadata(task.id);
    expect(metadata.classification_source).toBe('manual');
    
    // Reclassify with AI
    await enrichment.enrichTask(task.id, {
      category: 'work',
      timeEstimate: '30min'
    });
    
    // Should be marked as 'ai' again
    metadata = await storage.getTaskMetadata(task.id);
    expect(metadata.classification_source).toBe('ai');
  });
  
  it('should make content-changed tasks unclassified again', async () => {
    // Create and classify a task
    const task = await mockAPI.createTask({
      content: 'Original content',
      projectId: 'inbox_proj'
    });
    await sync.syncNow();
    
    await enrichment.enrichTask(task.id, {
      category: 'work',
      timeEstimate: '30min'
    });
    
    // Wait and change content
    await new Promise(resolve => setTimeout(resolve, 100));
    mockAPI.simulateManualChange(task.id, {
      content: 'Updated content (EDITED)'
    });
    await sync.syncNow();
    
    // Task should need reclassification
    const unclassified = await enrichment.getUnclassifiedTasks({ force: false });
    const hasTask = unclassified.some(t => t.id === task.id);
    
    expect(hasTask).toBe(true);
  });
});

export { MockTodoistAPI, MockAIAgent };


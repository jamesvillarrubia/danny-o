#!/usr/bin/env node
/**
 * Test reclassification of manually modified task
 */

import 'dotenv/config';
import { createStorage } from './src/storage/factory.js';
import { TodoistClient } from './src/todoist/client.js';
import { AIAgent } from './src/ai/agent.js';
import { AIOperations } from './src/ai/operations.js';
import { TaskEnrichment } from './src/todoist/enrichment.js';

const taskId = '657hCQg4qjr7Wphj';

async function main() {
  // Initialize
  const storage = await createStorage();
  const todoist = new TodoistClient(process.env.TODOIST_API_KEY);
  const aiAgent = new AIAgent(process.env.CLAUDE_API_KEY);
  const aiOps = new AIOperations(aiAgent, storage);
  const enrichment = new TaskEnrichment(storage, todoist);

  // Get the task
  const task = await storage.getTask(taskId);
  console.log('📋 Task to reclassify:');
  console.log(`   Content: ${task.content}`);
  console.log(`   Current Project: Work`);
  console.log(`   Current Labels: MIT, Presentations\n`);

  console.log('🤖 AI will now try to classify this task...\n');

  // Classify
  const results = await aiOps.classifyTasks([task]);
  
  if (results.length > 0) {
    const result = results[0];
    console.log('🎯 AI Classification Result:');
    console.log(`   Suggested Project: ${result.category}`);
    console.log(`   Suggested Labels: ${result.labels?.join(', ') || 'none'}`);
    console.log(`   Confidence: ${Math.round(result.confidence * 100)}%`);
    console.log(`   Reasoning: ${result.reasoning}\n`);

    // Try to enrich (this should respect manual changes)
    console.log('💾 Attempting to apply AI recommendations...');
    
    try {
      await enrichment.enrichTask(taskId, {
        category: result.category,
        labels: result.labels,
        aiConfidence: result.confidence,
        aiReasoning: result.reasoning
      });
      console.log('   ✅ Enrichment applied\n');
    } catch (error) {
      console.error('   ❌ Enrichment failed:', error.message, '\n');
    }
  }

  // Check final state
  const finalTask = await storage.getTask(taskId);
  const project = await storage.getProject(finalTask.projectId);
  
  console.log('📊 FINAL STATE:');
  console.log(`   Project: ${project.name}`);
  console.log(`   Labels: ${finalTask.labels?.join(', ') || 'none'}`);
  
  if (project.name === 'Work' && finalTask.labels.includes('MIT')) {
    console.log('\n✅ SUCCESS: Manual changes persisted!');
    console.log('   The task stayed in Work with MIT label despite AI wanting to move it.');
  } else {
    console.log('\n❌ FAIL: Manual changes were overwritten');
  }

  await storage.close();
}

main();


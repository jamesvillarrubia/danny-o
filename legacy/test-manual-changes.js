#!/usr/bin/env node
/**
 * Test script: Manually modify a task via Todoist API
 * This tests that our reconciliation system respects manual changes
 */

import 'dotenv/config';
import { TodoistClient } from './src/todoist/client.js';

const taskId = '657hCQg4qjr7Wphj'; // "Write a book about cloud farming"
const newProjectId = '6fQCHWfvw5Xx75Gm'; // Work
const newLabels = ['MIT', 'Presentations']; // Add some labels

async function main() {
  const todoist = new TodoistClient(process.env.TODOIST_API_KEY);

  console.log('📝 Manual modification test');
  console.log(`Task ID: ${taskId}`);
  console.log(`Moving to project: ${newProjectId} (Work)`);
  console.log(`Adding labels: ${newLabels.join(', ')}\n`);

  try {
    // Step 1: Move to different project
    console.log('1. Moving task to Work project...');
    await todoist.api.moveTask(taskId, { projectId: newProjectId });
    console.log('   ✅ Task moved\n');

    // Step 2: Add labels
    console.log('2. Adding labels...');
    await todoist.api.updateTask(taskId, { labels: newLabels });
    console.log('   ✅ Labels added\n');

    console.log('✅ Manual changes complete!');
    console.log('\nNext steps:');
    console.log('1. Run: pnpm run cli sync');
    console.log('2. Run: pnpm run cli classify --force --limit 1');
    console.log('3. Verify the task stays in Work with MIT/Presentations labels');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();


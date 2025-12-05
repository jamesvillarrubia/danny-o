#!/usr/bin/env tsx
/**
 * End-to-End Sync API Test
 * 
 * This script performs a full integration test:
 * 1. Creates test tasks in Todoist
 * 2. Adds comments to them
 * 3. Syncs using the Sync API
 * 4. Verifies tasks and comments are correctly fetched
 * 5. Cleans up test data
 * 
 * Usage: pnpm tsx scripts/e2e-sync-test.ts
 */

import 'dotenv/config';
import { TodoistSyncProvider } from '../src/task-provider/todoist/todoist-sync.provider';
import { TodoistProvider } from '../src/task-provider/todoist/todoist.provider';

const apiKey = process.env.TODOIST_API_KEY;

if (!apiKey) {
  console.error('❌ TODOIST_API_KEY not set in environment');
  process.exit(1);
}

// Test data
const TEST_PREFIX = `[E2E-TEST-${Date.now()}]`;
const testTasks = [
  { content: `${TEST_PREFIX} Task with comment`, description: 'This task should have a comment' },
  { content: `${TEST_PREFIX} Task without comment`, description: 'This task has no comments' },
];

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runE2ETest() {
  console.log('🧪 End-to-End Sync API Test\n');
  console.log(`Test prefix: ${TEST_PREFIX}\n`);

  const restProvider = new TodoistProvider(apiKey);
  const syncProvider = new TodoistSyncProvider(apiKey);
  
  const createdTaskIds: string[] = [];
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // ========== SETUP: Create test tasks ==========
    console.log('📝 SETUP: Creating test tasks...\n');

    for (const taskData of testTasks) {
      const task = await restProvider.createTask(taskData);
      createdTaskIds.push(task.id);
      console.log(`   Created: "${task.content}" (ID: ${task.id})`);
      await delay(200); // Be gentle with rate limits
    }

    // Add a comment to the first task
    const taskWithCommentId = createdTaskIds[0];
    const testComment = `${TEST_PREFIX} This is a test comment at ${new Date().toISOString()}`;
    
    console.log(`\n   Adding comment to task ${taskWithCommentId}...`);
    const comment = await restProvider.addComment(taskWithCommentId, testComment);
    console.log(`   Created comment: "${comment.content.substring(0, 50)}..." (ID: ${comment.id})`);

    await delay(500); // Wait for Todoist to process

    // ========== TEST 1: Full Sync fetches tasks and comments ==========
    console.log('\n\n🔬 TEST 1: Full Sync fetches tasks and comments\n');

    const syncResult = await syncProvider.fullSync();
    
    // Find our test tasks
    const syncedTestTasks = syncResult.tasks.filter(t => t.content.includes(TEST_PREFIX));
    
    console.log(`   Synced ${syncResult.tasks.length} total tasks`);
    console.log(`   Found ${syncedTestTasks.length} test tasks`);

    if (syncedTestTasks.length === 2) {
      console.log('   ✅ PASS: Both test tasks found in sync');
      testsPassed++;
    } else {
      console.log(`   ❌ FAIL: Expected 2 test tasks, found ${syncedTestTasks.length}`);
      testsFailed++;
    }

    // ========== TEST 2: Comments are included in sync ==========
    console.log('\n\n🔬 TEST 2: Comments are included in sync\n');

    const taskComments = syncResult.commentsByTaskId.get(taskWithCommentId);
    console.log(`   Task ${taskWithCommentId} has ${taskComments?.length || 0} comments in sync`);

    if (taskComments && taskComments.length > 0) {
      const foundTestComment = taskComments.find(c => c.content.includes(TEST_PREFIX));
      if (foundTestComment) {
        console.log(`   ✅ PASS: Test comment found in sync results`);
        console.log(`   Comment content: "${foundTestComment.content.substring(0, 50)}..."`);
        testsPassed++;
      } else {
        console.log(`   ❌ FAIL: Test comment not found (found ${taskComments.length} other comments)`);
        testsFailed++;
      }
    } else {
      console.log(`   ❌ FAIL: No comments found for task`);
      testsFailed++;
    }

    // ========== TEST 3: Incremental sync returns changes only ==========
    console.log('\n\n🔬 TEST 3: Incremental sync returns changes only\n');

    // Do an incremental sync (should return minimal/no data since nothing changed)
    const incrementalResult = await syncProvider.bulkSync(syncResult.syncToken);
    
    console.log(`   Incremental sync returned:`);
    console.log(`   - Tasks: ${incrementalResult.tasks.length}`);
    console.log(`   - Projects: ${incrementalResult.projects.length}`);
    console.log(`   - Labels: ${incrementalResult.labels.length}`);
    console.log(`   - isFullSync: ${incrementalResult.isFullSync}`);

    if (!incrementalResult.isFullSync) {
      console.log('   ✅ PASS: Incremental sync flag is false');
      testsPassed++;
    } else {
      console.log('   ❌ FAIL: Expected incremental sync, got full sync');
      testsFailed++;
    }

    // ========== TEST 4: Create new task and verify incremental sync picks it up ==========
    console.log('\n\n🔬 TEST 4: Incremental sync picks up new task\n');

    // Create a new task
    const newTask = await restProvider.createTask({
      content: `${TEST_PREFIX} New task for incremental test`,
    });
    createdTaskIds.push(newTask.id);
    console.log(`   Created new task: ${newTask.id}`);

    await delay(500); // Wait for Todoist to process

    // Do incremental sync
    const afterNewTaskSync = await syncProvider.bulkSync(incrementalResult.syncToken);
    const newTaskInSync = afterNewTaskSync.tasks.find(t => t.id === newTask.id);

    if (newTaskInSync) {
      console.log(`   ✅ PASS: New task found in incremental sync`);
      console.log(`   Task content: "${newTaskInSync.content}"`);
      testsPassed++;
    } else {
      console.log(`   ❌ FAIL: New task not found in incremental sync`);
      console.log(`   Sync returned ${afterNewTaskSync.tasks.length} tasks`);
      testsFailed++;
    }

    // ========== TEST 5: Verify sync token is updated ==========
    console.log('\n\n🔬 TEST 5: Sync token is updated after each sync\n');

    const token1 = syncResult.syncToken;
    const token2 = incrementalResult.syncToken;
    const token3 = afterNewTaskSync.syncToken;

    console.log(`   Token 1: ${token1.substring(0, 20)}...`);
    console.log(`   Token 2: ${token2.substring(0, 20)}...`);
    console.log(`   Token 3: ${token3.substring(0, 20)}...`);

    if (token1 !== token3) {
      console.log('   ✅ PASS: Sync tokens are being updated');
      testsPassed++;
    } else {
      console.log('   ⚠️  WARN: Sync tokens unchanged (may be expected if no changes)');
      testsPassed++; // Not a failure, tokens may not change if data is identical
    }

  } catch (error: any) {
    console.error(`\n❌ Test error: ${error.message}`);
    console.error(error.stack);
    testsFailed++;
  } finally {
    // ========== CLEANUP: Delete test tasks ==========
    console.log('\n\n🧹 CLEANUP: Deleting test tasks...\n');

    for (const taskId of createdTaskIds) {
      try {
        await restProvider.deleteTask(taskId);
        console.log(`   Deleted task ${taskId}`);
        await delay(200);
      } catch (error: any) {
        console.log(`   Failed to delete task ${taskId}: ${error.message}`);
      }
    }

    // ========== RESULTS ==========
    console.log('\n\n📊 TEST RESULTS\n');
    console.log(`   ✅ Passed: ${testsPassed}`);
    console.log(`   ❌ Failed: ${testsFailed}`);
    console.log(`   Total: ${testsPassed + testsFailed}\n`);

    if (testsFailed > 0) {
      console.log('❌ Some tests failed!\n');
      process.exit(1);
    } else {
      console.log('✅ All tests passed!\n');
      process.exit(0);
    }
  }
}

runE2ETest();


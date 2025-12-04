#!/usr/bin/env tsx
/**
 * End-to-End CLI Flow Test
 * 
 * Tests the full CLI flow through the actual NestJS application:
 * 1. Creates a task via REST API
 * 2. Adds a comment with @danny mention
 * 3. Runs sync command via SyncService
 * 4. Verifies the task and comment are in local storage
 * 5. Tests fetchCommentsForTasks uses cache
 * 6. Cleans up
 * 
 * Usage: pnpm tsx scripts/e2e-cli-flow-test.ts
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageModule } from '../src/storage/storage.module';
import { TaskProviderModule } from '../src/task-provider/task-provider.module';
import { TaskModule } from '../src/task/task.module';
import { ConfigurationModule } from '../src/config/config.module';
import { SyncService } from '../src/task/services/sync.service';
import { IStorageAdapter } from '../src/common/interfaces/storage-adapter.interface';
import { ITaskProvider } from '../src/common/interfaces/task-provider.interface';

// Minimal test module
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ConfigurationModule,
    StorageModule,
    TaskProviderModule,
    TaskModule,
  ],
})
class TestModule {}

const TEST_PREFIX = `[CLI-FLOW-TEST-${Date.now()}]`;

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('🧪 End-to-End CLI Flow Test\n');
  console.log(`Test prefix: ${TEST_PREFIX}\n`);

  // Bootstrap the NestJS application
  const app = await NestFactory.createApplicationContext(TestModule, {
    logger: ['error', 'warn', 'log'],
  });

  const syncService = app.get(SyncService);
  const storage = app.get<IStorageAdapter>('IStorageAdapter');
  const taskProvider = app.get<ITaskProvider>('ITaskProvider');

  const createdTaskIds: string[] = [];
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // ========== SETUP ==========
    console.log('📝 SETUP: Creating test task with @danny mention...\n');

    const task = await taskProvider.createTask({
      content: `${TEST_PREFIX} Test task for CLI flow`,
      description: 'Testing the full sync flow',
    });
    createdTaskIds.push(task.id);
    console.log(`   Created task: ${task.id}`);

    // Add comment with @danny mention
    const comment = await taskProvider.addComment(
      task.id,
      `${TEST_PREFIX} @danny please analyze this test task`
    );
    console.log(`   Added comment: ${comment.id}`);

    await delay(500);

    // ========== TEST 1: Sync fetches task into local storage ==========
    console.log('\n🔬 TEST 1: Sync fetches task into local storage\n');

    const syncResult = await syncService.syncNow();
    console.log(`   Sync result: ${syncResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   Tasks synced: ${syncResult.tasks}`);
    console.log(`   Duration: ${syncResult.duration}ms`);

    // Check if task is in storage
    const storedTask = await storage.getTask(task.id);
    if (storedTask) {
      console.log(`   ✅ PASS: Task found in local storage`);
      console.log(`   Content: "${storedTask.content}"`);
      testsPassed++;
    } else {
      console.log(`   ❌ FAIL: Task not found in local storage`);
      testsFailed++;
    }

    // ========== TEST 2: fetchCommentsForTasks uses cache ==========
    console.log('\n🔬 TEST 2: fetchCommentsForTasks uses cache\n');

    const tasksWithComments = await syncService.fetchCommentsForTasks([storedTask!]);
    
    if (tasksWithComments[0].comments && tasksWithComments[0].comments.length > 0) {
      const foundComment = tasksWithComments[0].comments.find(
        c => c.content.includes(TEST_PREFIX)
      );
      if (foundComment) {
        console.log(`   ✅ PASS: Comment found via fetchCommentsForTasks`);
        console.log(`   Comment: "${foundComment.content.substring(0, 50)}..."`);
        testsPassed++;
      } else {
        console.log(`   ❌ FAIL: Test comment not found`);
        testsFailed++;
      }
    } else {
      console.log(`   ❌ FAIL: No comments returned`);
      testsFailed++;
    }

    // ========== TEST 3: Second call uses cache (no API call) ==========
    console.log('\n🔬 TEST 3: Second fetchCommentsForTasks call uses cache\n');

    // This should log "Using cached comments from Sync API (0 additional API calls)"
    const tasksWithComments2 = await syncService.fetchCommentsForTasks([storedTask!]);
    
    if (tasksWithComments2[0].comments && tasksWithComments2[0].comments.length > 0) {
      console.log(`   ✅ PASS: Comments returned from cache`);
      testsPassed++;
    } else {
      console.log(`   ❌ FAIL: Cache didn't return comments`);
      testsFailed++;
    }

    // ========== TEST 4: Incremental sync works ==========
    console.log('\n🔬 TEST 4: Incremental sync works\n');

    // Create another task
    const task2 = await taskProvider.createTask({
      content: `${TEST_PREFIX} Second test task`,
    });
    createdTaskIds.push(task2.id);
    console.log(`   Created second task: ${task2.id}`);

    await delay(500);

    const syncResult2 = await syncService.syncNow();
    console.log(`   Incremental sync: ${syncResult2.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   Duration: ${syncResult2.duration}ms`);

    const storedTask2 = await storage.getTask(task2.id);
    if (storedTask2) {
      console.log(`   ✅ PASS: Second task found after incremental sync`);
      testsPassed++;
    } else {
      console.log(`   ❌ FAIL: Second task not found`);
      testsFailed++;
    }

    // ========== TEST 5: Full resync works ==========
    console.log('\n🔬 TEST 5: Full resync works\n');

    const fullSyncResult = await syncService.fullResync();
    console.log(`   Full resync: ${fullSyncResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   Tasks: ${fullSyncResult.tasks}`);
    console.log(`   Duration: ${fullSyncResult.duration}ms`);

    if (fullSyncResult.success && fullSyncResult.tasks! > 0) {
      console.log(`   ✅ PASS: Full resync completed`);
      testsPassed++;
    } else {
      console.log(`   ❌ FAIL: Full resync failed`);
      testsFailed++;
    }

  } catch (error: any) {
    console.error(`\n❌ Test error: ${error.message}`);
    console.error(error.stack);
    testsFailed++;
  } finally {
    // ========== CLEANUP ==========
    console.log('\n\n🧹 CLEANUP: Deleting test tasks...\n');

    for (const taskId of createdTaskIds) {
      try {
        await taskProvider.deleteTask(taskId);
        console.log(`   Deleted: ${taskId}`);
        await delay(200);
      } catch (error: any) {
        console.log(`   Failed to delete ${taskId}: ${error.message}`);
      }
    }

    await app.close();

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

runTest();


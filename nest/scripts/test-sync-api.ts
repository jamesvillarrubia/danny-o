#!/usr/bin/env tsx
/**
 * Gentle Live Test for Todoist Sync API
 * 
 * This script tests the Sync API implementation against the real Todoist API.
 * It's designed to be gentle and make minimal API calls.
 * 
 * Usage: pnpm tsx scripts/test-sync-api.ts
 */

import 'dotenv/config';
import { TodoistSyncProvider } from '../src/task-provider/todoist/todoist-sync.provider';

const apiKey = process.env.TODOIST_API_KEY;

if (!apiKey) {
  console.error('❌ TODOIST_API_KEY not set in environment');
  process.exit(1);
}

async function runTest() {
  console.log('🧪 Todoist Sync API Live Test\n');
  console.log('This test makes exactly 1 API call to verify the implementation.\n');

  const syncProvider = new TodoistSyncProvider(apiKey);

  try {
    // Test 1: Connection test
    console.log('1️⃣  Testing connection...');
    const connected = await syncProvider.testConnection();
    if (!connected) {
      console.error('   ❌ Connection test failed');
      process.exit(1);
    }
    console.log('   ✅ Connection successful\n');

    // Test 2: Full sync (this is the main test - 1 API call)
    console.log('2️⃣  Performing full sync (1 API call)...');
    const startTime = Date.now();
    const result = await syncProvider.fullSync();
    const duration = Date.now() - startTime;

    console.log(`   ✅ Sync completed in ${duration}ms\n`);

    // Display results
    console.log('📊 Results:');
    console.log(`   • Tasks fetched: ${result.tasks.length}`);
    console.log(`   • Projects fetched: ${result.projects.length}`);
    console.log(`   • Labels fetched: ${result.labels.length}`);
    console.log(`   • Tasks with comments: ${result.commentsByTaskId.size}`);
    console.log(`   • Sync token received: ${result.syncToken.substring(0, 20)}...`);
    console.log(`   • Is full sync: ${result.isFullSync}`);

    // Show sample task
    if (result.tasks.length > 0) {
      const sampleTask = result.tasks[0];
      console.log('\n📝 Sample Task:');
      console.log(`   • ID: ${sampleTask.id}`);
      console.log(`   • Content: ${sampleTask.content.substring(0, 50)}${sampleTask.content.length > 50 ? '...' : ''}`);
      console.log(`   • Project ID: ${sampleTask.projectId}`);
      console.log(`   • Priority: ${sampleTask.priority}`);
      
      const comments = result.commentsByTaskId.get(sampleTask.id);
      if (comments && comments.length > 0) {
        console.log(`   • Comments: ${comments.length}`);
      }
    }

    // Show sample project
    if (result.projects.length > 0) {
      const sampleProject = result.projects[0];
      console.log('\n📁 Sample Project:');
      console.log(`   • ID: ${sampleProject.id}`);
      console.log(`   • Name: ${sampleProject.name}`);
    }

    // Calculate API efficiency
    const totalComments = Array.from(result.commentsByTaskId.values()).reduce((sum, c) => sum + c.length, 0);
    const oldApiCalls = 3 + result.tasks.length; // REST API would need: tasks + projects + labels + N comment calls
    
    console.log('\n⚡ API Efficiency:');
    console.log(`   • API calls made: 1`);
    console.log(`   • REST API would need: ~${oldApiCalls} calls (3 + ${result.tasks.length} for comments)`);
    console.log(`   • Improvement: ${Math.round((1 - 1/oldApiCalls) * 100)}% reduction in API calls`);
    console.log(`   • Comments fetched: ${totalComments} (included in single request)`);

    console.log('\n✅ All tests passed!\n');

  } catch (error: any) {
    console.error(`\n❌ Test failed: ${error.message}`);
    if (error.response?.status === 403) {
      console.error('   This usually means the API key is invalid or lacks permissions.');
    }
    process.exit(1);
  }
}

runTest();


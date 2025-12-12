/**
 * Vitest Configuration
 * 
 * Unit tests only - contract tests use Step-CI.
 * @see test/TESTING_STRATEGY.md
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    
    // Unit tests only - pure logic and internal behavior
    // Contract tests are handled by Step-CI (pnpm test:step-ci:mock)
    include: ['test/unit/**/*.spec.ts'],
    
    // Exclude integration/e2e (now covered by Step-CI contracts)
    exclude: [
      'test/integration/**',
      'test/e2e/**',
      'node_modules/**',
    ],
    
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'test/',
        '**/*.interface.ts',
        '**/*.dto.ts',
        '**/*.module.ts',
        'src/main.ts',
      ],
    },
    
    // Fork pool for isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@common': resolve(__dirname, './src/common'),
      '@config': resolve(__dirname, './src/config'),
      '@storage': resolve(__dirname, './src/storage'),
      '@task-provider': resolve(__dirname, './src/task-provider'),
      '@task': resolve(__dirname, './src/task'),
      '@ai': resolve(__dirname, './src/ai'),
      '@mcp': resolve(__dirname, './src/mcp'),
      '@cli': resolve(__dirname, './src/cli'),
    },
  },
});

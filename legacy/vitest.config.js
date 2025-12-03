import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Disable automatic .env loading
  envDir: false,
  test: {
    // Don't load .env file in test environment
    env: {},
    // Use globals for easier test writing
    globals: true,
    // Run tests in node environment
    environment: 'node',
    // Set timeout for async operations
    testTimeout: 30000,
  },
});


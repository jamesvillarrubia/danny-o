/**
 * Main Application Entry Point
 * 
 * Bootstraps the NestJS application and determines execution mode:
 * - CLI mode: Run command-line interface
 * - MCP mode: Start Model Context Protocol server
 */

import 'dotenv/config'; // Load .env before anything else
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CommandFactory } from 'nest-commander';
import { MCPServerService } from './mcp/services/mcp-server.service';

async function bootstrap() {
  const runMode = process.env.RUN_MODE || 'cli';

  if (runMode === 'mcp') {
    // MCP Server mode
    console.error('[Bootstrap] Starting MCP Server...');
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    // Get MCP server service and start it
    const mcpServer = app.get(MCPServerService);
    await mcpServer.start();
  } else {
    // CLI mode
    console.error('[Bootstrap] Starting CLI...');
    // Import CLIModule directly for nest-commander
    const { CLIModule } = await import('./cli/cli.module');
    await CommandFactory.run(CLIModule, ['error', 'warn', 'log']);
  }
}

bootstrap().catch((error) => {
  console.error('[Bootstrap] Fatal error:', error);
  process.exit(1);
});


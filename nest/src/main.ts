/**
 * Main Application Entry Point
 * 
 * Bootstraps the NestJS application and determines execution mode:
 * - CLI mode: Run command-line interface
 * - MCP mode: Start Model Context Protocol server
 * - HTTP mode: Start HTTP server for API access and step-ci testing
 */

import 'dotenv/config'; // Load .env before anything else
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
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
  } else if (runMode === 'http' || runMode === 'api') {
    // HTTP Server mode (for step-ci testing and local development)
    console.error('[Bootstrap] Starting HTTP Server...');
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    // Enable CORS for API access
    app.enableCors({
      origin: true,
      credentials: true,
    });

    // Global prefix for API routes
    app.setGlobalPrefix('api', {
      exclude: ['/health', '/health/(.*)'],
    });

    // Enable validation pipes for DTOs
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: false,
      }),
    );

    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.error(`[Bootstrap] HTTP Server listening on port ${port}`);
    console.error(`[Bootstrap] API available at http://localhost:${port}/api/v1`);
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


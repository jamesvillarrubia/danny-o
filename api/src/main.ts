/**
 * Main Application Entry Point
 * 
 * Bootstraps the NestJS application and determines execution mode:
 * - CLI mode: Run command-line interface
 * - MCP mode: Start Model Context Protocol server
 * - HTTP mode: Start HTTP server for API access and step-ci testing
 * 
 * When USE_MOCKS=true, HTTP interceptors are enabled to mock external APIs
 * (Todoist, Anthropic) for contract testing without real API calls.
 */

import 'dotenv/config'; // Load .env before anything else
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, INestApplicationContext } from '@nestjs/common';
import { AppModule } from './app.module';
import { CommandFactory } from 'nest-commander';
import { MCPServerService } from './mcp/services/mcp-server.service';
import { VersionService } from './updates/version.service';
import { BackupService } from './backups/backup.service';

async function bootstrap() {
  const runMode = process.env.RUN_MODE || 'cli';
  const useMocks = process.env.USE_MOCKS === 'true';

  // Set up HTTP mocks if enabled (for contract testing)
  if (useMocks) {
    try {
      const { setupMocks } = await import('./mock-bootstrap');
      setupMocks();
    } catch (error) {
      console.error('[Bootstrap] Failed to set up mocks:', error);
      console.error('[Bootstrap] Make sure nock is installed: pnpm add -D nock');
      process.exit(1);
    }
  }

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
      bodyParser: true,
      rawBody: false,
    });

    // Check for updates and run migrations if AUTO_UPDATE is enabled
    if (process.env.AUTO_UPDATE !== 'false') {
      await runAutoUpdate(app);
    }

    // Configure body parser limits (default is 100kb which is too small)
    // - Chat messages with page context can include large HTML payloads
    // - Task descriptions might be lengthy
    app.use(
      require('express').json({ limit: '10mb' }),
      require('express').urlencoded({ limit: '10mb', extended: true })
    );

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
        transformOptions: {
          enableImplicitConversion: true,
        },
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

async function runAutoUpdate(app: INestApplicationContext): Promise<void> {
  const logger = new Logger('AutoUpdate');

  try {
    const versionService = app.get(VersionService);
    const backupService = app.get(BackupService);

    const needsUpdate = await versionService.checkForUpdates();

    if (needsUpdate) {
      logger.log('Update detected, creating backup before migration...');

      // Create backup if configured
      const backupBeforeUpdate = process.env.BACKUP_BEFORE_UPDATE !== 'false';
      if (backupBeforeUpdate) {
        try {
          const backupPath = await backupService.createBackup();
          logger.log(`Backup created: ${backupPath}`);
        } catch (error: any) {
          logger.error(`Backup failed: ${error.message}`);
          logger.warn('Continuing with update without backup (backup failed)');
        }
      }

      // Migrations are already run during KyselyAdapter.initialize()
      logger.log('Running migrations...');

      // Update version in database
      await versionService.updateVersion();
      logger.log('Update complete!');
    }
  } catch (error: any) {
    const logger = new Logger('AutoUpdate');
    logger.error(`Auto-update failed: ${error.message}`);
    // Don't fail startup, just log the error
  }
}

bootstrap().catch((error) => {
  console.error('[Bootstrap] Fatal error:', error);
  process.exit(1);
});


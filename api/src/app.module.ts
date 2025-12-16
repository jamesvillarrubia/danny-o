/**
 * Root Application Module
 * 
 * Imports all feature modules and configures global services.
 */

import { Module } from '@nestjs/common';
import { ConfigurationModule } from './config/config.module';
import { StorageModule } from './storage/storage.module';
import { TaskProviderModule } from './task-provider/task-provider.module';

// Feature modules
import { TaskModule } from './task/task.module';
import { AIModule } from './ai/ai.module';
import { MCPModule } from './mcp/mcp.module';
import { CLIModule } from './cli/cli.module';
import { HealthModule } from './health/health.module';
import { ApiModule } from './api/api.module';
import { SentryModule } from './sentry/sentry.module';
import { SetupModule } from './setup/setup.module';
import { UpdatesModule } from './updates/updates.module';
import { BackupsModule } from './backups/backups.module';

@Module({
  imports: [
    // Global configuration (includes env validation and taxonomy)
    ConfigurationModule,

    // Error tracking (Sentry)
    SentryModule,

    // Storage layer
    StorageModule,

    // Task provider (Todoist)
    TaskProviderModule,

    // Feature modules
    TaskModule,
    AIModule,
    MCPModule,
    CLIModule,

    // Setup wizard
    SetupModule,

    // Updates and backups
    UpdatesModule,
    BackupsModule,

    // API layer (HTTP endpoints for Vercel)
    ApiModule,

    // Health checks
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}


/**
 * CLI Module
 * 
 * Provides command-line interface using nestjs-commander.
 */

import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config/config.module';
import { StorageModule } from '../storage/storage.module';
import { TaskProviderModule } from '../task-provider/task-provider.module';
import { TaskModule } from '../task/task.module';
import { AIModule } from '../ai/ai.module';
import {
  SyncCommand,
  ListCommand,
  ClassifyCommand,
  PrioritizeCommand,
  CompleteCommand,
  PlanCommand,
  InsightsCommand,
} from './commands';

@Module({
  imports: [
    ConfigurationModule,
    StorageModule,
    TaskProviderModule,
    TaskModule, // This exports SyncService, EnrichmentService, ReconciliationService
    AIModule,   // This exports AIOperationsService
  ],
  providers: [
    // CLI Commands
    SyncCommand,
    ListCommand,
    ClassifyCommand,
    PrioritizeCommand,
    CompleteCommand,
    PlanCommand,
    InsightsCommand,
  ],
  exports: [
    // Export commands for nest-commander to find them
    SyncCommand,
    ListCommand,
    ClassifyCommand,
    PrioritizeCommand,
    CompleteCommand,
    PlanCommand,
    InsightsCommand,
  ],
})
export class CLIModule {}


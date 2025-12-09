/**
 * AI Module
 * 
 * Handles all AI-powered operations:
 * - Task classification
 * - Time estimation
 * - Prioritization
 * - Learning from history
 * - Agentic task processing
 * - Smart search with query expansion
 */

import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config/config.module';
import { StorageModule } from '../storage/storage.module';
import { TaskProviderModule } from '../task-provider/task-provider.module';
import { ClaudeService } from './services/claude.service';
import { AIOperationsService } from './services/operations.service';
import { LearningService } from './services/learning.service';
import { QueryExpansionService } from './services/query-expansion.service';
import { SearchService } from './services/search.service';
import { PromptsService } from './prompts/prompts.service';
import { TaskProcessorAgent } from './task-processor/task-processor.agent';

@Module({
  imports: [
    ConfigurationModule,
    StorageModule,
    TaskProviderModule, // Import TaskProviderModule for ITaskProvider
    // Note: TaskModule is imported by parent modules (ApiModule, CLIModule) 
    // Do not import it here to avoid circular dependencies
  ],
  providers: [
    PromptsService,
    ClaudeService,
    AIOperationsService,
    LearningService,
    QueryExpansionService,
    SearchService,
    TaskProcessorAgent,
  ],
  exports: [
    PromptsService,
    ClaudeService,
    AIOperationsService,
    LearningService,
    QueryExpansionService,
    SearchService,
    TaskProcessorAgent,
  ],
})
export class AIModule {}


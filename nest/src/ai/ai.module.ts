/**
 * AI Module
 * 
 * Handles all AI-powered operations:
 * - Task classification
 * - Time estimation
 * - Prioritization
 * - Learning from history
 * - Agentic task processing
 */

import { Module, forwardRef } from '@nestjs/common';
import { ConfigurationModule } from '../config/config.module';
import { StorageModule } from '../storage/storage.module';
import { ClaudeService } from './services/claude.service';
import { AIOperationsService } from './services/operations.service';
import { LearningService } from './services/learning.service';
import { PromptsService } from './prompts/prompts.service';
import { TaskProcessorAgent } from './task-processor/task-processor.agent';

@Module({
  imports: [
    ConfigurationModule,
    StorageModule,
    forwardRef(() => import('../task/task.module').then((m) => m.TaskModule)), // Import TaskModule for SyncService
  ],
  providers: [
    PromptsService,
    ClaudeService,
    AIOperationsService,
    LearningService,
    TaskProcessorAgent,
  ],
  exports: [
    PromptsService,
    ClaudeService,
    AIOperationsService,
    LearningService,
    TaskProcessorAgent,
  ],
})
export class AIModule {}


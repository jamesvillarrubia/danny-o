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

import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config/config.module';
import { StorageModule } from '../storage/storage.module';
import { ClaudeService } from './services/claude.service';
import { AIOperationsService } from './services/operations.service';
import { LearningService } from './services/learning.service';
import { PromptsService } from './prompts/prompts.service';

@Module({
  imports: [
    ConfigurationModule,
    StorageModule,
  ],
  providers: [
    PromptsService,
    ClaudeService,
    AIOperationsService,
    LearningService,
  ],
  exports: [
    PromptsService,
    ClaudeService,
    AIOperationsService,
    LearningService,
  ],
})
export class AIModule {}


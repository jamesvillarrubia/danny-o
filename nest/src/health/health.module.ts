/**
 * Health Check Module
 * 
 * Provides health check endpoints for monitoring application status,
 * database connectivity, and external API availability.
 */

import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './indicators/database.indicator';
import { TodoistHealthIndicator } from './indicators/todoist.indicator';
import { ClaudeHealthIndicator } from './indicators/claude.indicator';
import { StorageModule } from '../storage/storage.module';
import { TaskProviderModule } from '../task-provider/task-provider.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    StorageModule,
    TaskProviderModule,
    AIModule,
  ],
  controllers: [HealthController],
  providers: [
    DatabaseHealthIndicator,
    TodoistHealthIndicator,
    ClaudeHealthIndicator,
  ],
})
export class HealthModule {}


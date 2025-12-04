/**
 * API Module
 * 
 * HTTP API layer for Vercel deployment.
 * Exposes REST endpoints for sync, respond, classify, and webhooks.
 */

import { Module } from '@nestjs/common';
import { SyncController } from './controllers/sync.controller';
import { RespondController } from './controllers/respond.controller';
import { ClassifyController } from './controllers/classify.controller';
import { WebhookController } from './controllers/webhook.controller';
import { CronController } from './controllers/cron.controller';
import { AILogsController } from './controllers/ai-logs.controller';
import { TaskModule } from '../task/task.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [TaskModule, AIModule],
  controllers: [
    SyncController,
    RespondController,
    ClassifyController,
    WebhookController,
    CronController,
    AILogsController,
  ],
})
export class ApiModule {}


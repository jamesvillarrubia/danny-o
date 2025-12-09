/**
 * API Module
 * 
 * HTTP API layer for Vercel deployment and step-ci testing.
 * 
 * Exposes:
 * - Legacy endpoints: /api/sync, /api/classify, /api/respond, etc.
 * - V1 API (Google API Design Guide compliant):
 *   - /api/v1/tasks - Task resource (CRUD + custom methods)
 *   - /api/v1/projects - Project resource (read-only)
 *   - /api/v1/labels - Label resource (read-only)
 *   - /api/v1/ai - AI operations (RPC-style)
 *   - /api/v1/stats - Statistics endpoints
 */

import { Module, forwardRef } from '@nestjs/common';
// Legacy controllers
import { SyncController } from './controllers/sync.controller';
import { RespondController } from './controllers/respond.controller';
import { ClassifyController } from './controllers/classify.controller';
import { WebhookController } from './controllers/webhook.controller';
import { CronController } from './controllers/cron.controller';
import { AILogsController } from './controllers/ai-logs.controller';
// V1 Controllers (Google API Design Guide compliant)
import { TasksController } from './controllers/v1/tasks.controller';
import { ProjectsController } from './controllers/v1/projects.controller';
import { LabelsController } from './controllers/v1/labels.controller';
import { AIController } from './controllers/v1/ai.controller';
import { StatsController } from './controllers/v1/stats.controller';
import { ViewsController } from './controllers/v1/views.controller';
import { ChatController } from './controllers/v1/chat.controller';
// Modules
import { TaskModule } from '../task/task.module';
import { AIModule } from '../ai/ai.module';
import { ConfigurationModule } from '../config/config.module';

@Module({
  imports: [ConfigurationModule, forwardRef(() => TaskModule), forwardRef(() => AIModule)],
  controllers: [
    // Legacy endpoints
    SyncController,
    RespondController,
    ClassifyController,
    WebhookController,
    CronController,
    AILogsController,
    // V1 API endpoints
    TasksController,
    ProjectsController,
    LabelsController,
    AIController,
    StatsController,
    ViewsController,
    ChatController,
  ],
  providers: [],
  exports: [],
})
export class ApiModule {}

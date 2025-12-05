/**
 * Webhook Controller
 * 
 * Handles Todoist webhook events for real-time updates.
 * 
 * @see https://developer.todoist.com/sync/v9#webhooks
 */

import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { SyncService } from '../../task/services/sync.service';
import { AIOperationsService } from '../../ai/services/operations.service';

interface TodoistWebhookPayload {
  event_name: string;
  user_id: string;
  event_data: {
    id?: string;
    content?: string;
    project_id?: string;
    [key: string]: any;
  };
}

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly webhookSecret?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly syncService: SyncService,
    private readonly aiOps: AIOperationsService,
  ) {
    this.webhookSecret = this.configService.get<string>('TODOIST_WEBHOOK_SECRET');
  }

  @Post('todoist')
  @HttpCode(HttpStatus.OK)
  async handleTodoistWebhook(
    @Body() payload: TodoistWebhookPayload,
    @Headers('x-todoist-hmac-sha256') signature?: string,
  ) {
    // Verify webhook signature if secret is configured
    if (this.webhookSecret && signature) {
      const isValid = this.verifySignature(payload, signature);
      if (!isValid) {
        this.logger.warn('Invalid webhook signature');
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    this.logger.log(`Todoist webhook: ${payload.event_name}`);

    try {
      switch (payload.event_name) {
        case 'item:added':
          // New task - trigger classification
          if (payload.event_data?.id) {
            await this.handleNewTask(payload.event_data.id);
          }
          break;

        case 'item:updated':
          // Task updated - refresh sync
          await this.syncService.syncNow();
          break;

        case 'item:completed':
          // Task completed - log for learning
          if (payload.event_data?.id) {
            this.logger.log(`Task completed: ${payload.event_data.id}`);
          }
          break;

        case 'note:added':
          // New comment - check for @danny mentions
          if (payload.event_data?.content?.includes('@danny')) {
            await this.syncService.syncNow();
            // Get tasks and check for mentions
            // This is handled by the respond endpoint for now
          }
          break;

        default:
          this.logger.log(`Unhandled webhook event: ${payload.event_name}`);
      }

      return { success: true };
    } catch (error: any) {
      this.logger.error(`Webhook handler error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  private async handleNewTask(taskId: string): Promise<void> {
    // Sync to get the new task
    await this.syncService.syncNow();
    
    // Queue for classification
    this.logger.log(`New task ${taskId} synced, classification will happen on next classify run`);
  }

  private verifySignature(payload: any, signature: string): boolean {
    if (!this.webhookSecret) return true;

    const hmac = createHmac('sha256', this.webhookSecret);
    const rawBody = JSON.stringify(payload);
    const computedSignature = hmac.update(rawBody).digest('base64');

    return computedSignature === signature;
  }
}


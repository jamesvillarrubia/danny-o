/**
 * Respond Controller
 * 
 * HTTP endpoint for checking and responding to @danny mentions.
 */

import { Controller, Post, Body, HttpCode, HttpStatus, Logger, Inject } from '@nestjs/common';
import { SyncService } from '../../task/services/sync.service';
import { AIOperationsService } from '../../ai/services/operations.service';
import { IStorageAdapter } from '../../common/interfaces';

interface RespondRequestDto {
  taskId?: string;
}

@Controller('api/respond')
export class RespondController {
  private readonly logger = new Logger(RespondController.name);

  constructor(
    private readonly syncService: SyncService,
    private readonly aiOps: AIOperationsService,
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async respond(@Body() body: RespondRequestDto = {}) {
    this.logger.log(`Respond requested (taskId: ${body.taskId || 'all'})`);

    const startTime = Date.now();

    try {
      // Get tasks (specific or all active)
      let tasks;
      if (body.taskId) {
        const task = await this.storage.getTask(body.taskId);
        if (!task) {
          return {
            success: false,
            error: `Task ${body.taskId} not found`,
          };
        }
        tasks = [task];
      } else {
        tasks = await this.storage.getTasks({ completed: false });
      }

      // Fetch comments for tasks
      const tasksWithComments = await this.syncService.fetchCommentsForTasks(tasks);

      // Find and respond to @danny mentions
      const mentionResults = await this.aiOps.respondToMentions(tasksWithComments);
      const responded = mentionResults.filter(r => r.responded);

      // Add comments to Todoist for successful responses
      for (const result of responded) {
        if (result.comment) {
          await this.syncService.addCommentToTask(result.taskId, result.comment);
        }
      }

      return {
        success: true,
        data: {
          tasksChecked: tasks.length,
          mentionsFound: responded.length,
          responses: responded.map(r => ({
            taskId: r.taskId,
            action: r.action,
            comment: r.comment,
          })),
          duration: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      this.logger.error(`Respond failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }
}


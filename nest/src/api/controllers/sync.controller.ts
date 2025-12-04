/**
 * Sync Controller
 * 
 * HTTP endpoint for triggering Todoist sync.
 */

import { Controller, Post, Get, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { SyncService } from '../../task/services/sync.service';

interface SyncRequestDto {
  fullSync?: boolean;
}

@Controller('api/sync')
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(private readonly syncService: SyncService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async sync(@Body() body: SyncRequestDto = {}) {
    this.logger.log(`Sync requested (fullSync: ${body.fullSync || false})`);

    const startTime = Date.now();
    
    try {
      const result = body.fullSync 
        ? await this.syncService.fullResync()
        : await this.syncService.syncNow();

      return {
        success: result.success,
        data: {
          tasks: result.tasks,
          projects: result.projects,
          labels: result.labels,
          newTasks: result.newTasks,
          duration: Date.now() - startTime,
        },
        error: result.error,
      };
    } catch (error: any) {
      this.logger.error(`Sync failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  @Get('status')
  async status() {
    try {
      const lastSync = await this.syncService.getLastSyncTime();
      return {
        success: true,
        data: {
          lastSync: lastSync?.toISOString() || null,
          isHealthy: true,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}


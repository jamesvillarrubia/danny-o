/**
 * Settings Controller (V1 API)
 * 
 * Manages application-wide settings including sync mode configuration.
 */

import { Controller, Get, Post, Body, Inject, Logger } from '@nestjs/common';
import { Public } from '../../../common/guards/api-key.guard';
import { IStorageAdapter } from '../../../common/interfaces/storage-adapter.interface';
import { SyncService } from '../../../task/services/sync.service';

@Controller('v1/settings')
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
    private readonly syncService: SyncService,
  ) {}

  /**
   * Get current sync mode configuration (public for initial setup)
   */
  @Public()
  @Get('sync-mode')
  async getSyncMode() {
    const mode = await this.storage.getConfig('TASK_PROVIDER_MODE');
    const todoistApiKeySet = await this.storage.hasConfig('TODOIST_API_KEY');
    
    return { 
      mode: mode || 'standalone', 
      todoistApiKeySet 
    };
  }

  /**
   * Set sync mode (standalone or todoist) - public for initial setup
   */
  @Public()
  @Post('sync-mode')
  async setSyncMode(
    @Body('mode') mode: 'standalone' | 'todoist',
    @Body('todoistApiKey') todoistApiKey?: string,
  ) {
    try {
      this.logger.log(`Setting sync mode to: ${mode}`);

      // Validate mode
      if (!mode || !['standalone', 'todoist'].includes(mode)) {
        throw new Error('Invalid sync mode. Must be "standalone" or "todoist"');
      }

      // Save mode
      await this.storage.setConfig('TASK_PROVIDER_MODE', mode);

      // Handle Todoist mode
      if (mode === 'todoist') {
        if (!todoistApiKey || todoistApiKey.trim().length === 0) {
          throw new Error('Todoist API key is required for Todoist sync mode');
        }
        
        // Save API key (encrypted)
        await this.storage.setConfig('TODOIST_API_KEY', todoistApiKey, true);
        this.logger.log('Todoist API key saved (encrypted)');
        
        // Start sync service if not already running
        try {
          this.syncService.start();
        } catch (err) {
          this.logger.warn(`Failed to start sync service: ${err.message}`);
        }
      } else {
        // Standalone mode: clear API key and stop sync
        await this.storage.setConfig('TODOIST_API_KEY', '', true);
        try {
          this.syncService.stop();
          this.logger.log('Sync service stopped');
        } catch (err) {
          this.logger.warn(`Failed to stop sync service: ${err.message}`);
        }
      }

      return { 
        success: true, 
        mode 
      };
    } catch (error) {
      this.logger.error(`Failed to set sync mode: ${error.message}`, error.stack);
      throw error;
    }
  }
}


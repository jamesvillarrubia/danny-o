/**
 * Config Controller
 * 
 * Manages application configuration including API key generation and confirmation.
 */

import { Controller, Get, Post, Body, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorageAdapter } from '../common/interfaces/storage-adapter.interface';
import { Public } from '../common/guards/api-key.guard';
import { randomBytes } from 'crypto';

@Controller('v1/config')
export class ConfigController {
  private readonly logger = new Logger(ConfigController.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
  ) {}

  /**
   * Get or generate the Danny API key
   * Public endpoint for initial setup
   */
  @Public()
  @Get('api-key')
  async getApiKey(): Promise<{ apiKey: string; confirmed: boolean; firstTime: boolean }> {
    // Check if API key is set via environment variable
    const envKey = this.configService.get<string>('DANNY_API_KEY');
    
    if (envKey) {
      // If set via env, consider it confirmed
      return {
        apiKey: envKey,
        confirmed: true,
        firstTime: false,
      };
    }

    // Check if we have a generated key in storage
    const storedKey = await this.storage.getConfig('danny_api_key');
    const confirmed = await this.storage.getConfig('danny_api_key_confirmed');

    if (storedKey) {
      return {
        apiKey: storedKey,
        confirmed: confirmed === 'true',
        firstTime: false,
      };
    }

    // Generate a new secure API key
    const newKey = `danny_${randomBytes(32).toString('hex')}`;
    await this.storage.setConfig('danny_api_key', newKey);
    await this.storage.setConfig('danny_api_key_confirmed', 'false');

    this.logger.log('Generated new API key');

    return {
      apiKey: newKey,
      confirmed: false,
      firstTime: true,
    };
  }

  /**
   * Confirm that the user has saved the API key
   * Public endpoint for initial setup
   */
  @Public()
  @Post('api-key/confirm')
  async confirmApiKey(@Body('apiKey') apiKey: string): Promise<{ success: boolean }> {
    const storedKey = await this.storage.getConfig('danny_api_key');
    
    if (storedKey !== apiKey) {
      this.logger.warn('Attempted to confirm with invalid API key');
      return { success: false };
    }

    await this.storage.setConfig('danny_api_key_confirmed', 'true');
    this.logger.log('API key confirmed by user');

    return { success: true };
  }
}

/**
 * Setup Controller
 *
 * Handles first-run configuration endpoints for the setup wizard.
 */

import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SetupService, SetupConfig, SetupStatus } from './setup.service';
import { Public } from '../common/decorators/public.decorator';

class SetupCompleteDto {
  claudeApiKey: string;
  todoistApiKey: string;
  databaseType: 'embedded' | 'postgres';
  databaseUrl?: string;
}

@Controller('api/setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Public()
  @Get('status')
  async getStatus(): Promise<SetupStatus> {
    return this.setupService.getSetupStatus();
  }

  @Public()
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  async completeSetup(@Body() dto: SetupCompleteDto): Promise<{ success: boolean }> {
    await this.setupService.completeSetup(dto);
    return { success: true };
  }
}

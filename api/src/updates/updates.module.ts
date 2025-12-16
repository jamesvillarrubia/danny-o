/**
 * Updates Module
 *
 * Provides version management and auto-update functionality.
 */

import { Module } from '@nestjs/common';
import { VersionService } from './version.service';

@Module({
  providers: [VersionService],
  exports: [VersionService],
})
export class UpdatesModule {}

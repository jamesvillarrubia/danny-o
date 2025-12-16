/**
 * Backups Module
 *
 * Provides database backup and restore functionality.
 */

import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';

@Module({
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupsModule {}

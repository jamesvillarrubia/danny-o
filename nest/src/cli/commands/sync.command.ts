/**
 * Sync Command
 * 
 * Syncs tasks with Todoist API.
 */

import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { SyncService } from '../../task/services/sync.service';

interface SyncOptions {
  full?: boolean;
}

@Injectable()
@Command({
  name: 'sync',
  description: 'Sync tasks with Todoist',
})
export class SyncCommand extends CommandRunner {
  private readonly logger = new Logger(SyncCommand.name);

  constructor(@Inject(SyncService) private readonly syncService: SyncService) {
    super();
    // Dependency injection check will happen naturally when we try to use it
  }

  async run(passedParams: string[], options?: SyncOptions): Promise<void> {
    try {
      this.logger.log('🔄 Syncing with Todoist...\n');
      
      if (!this.syncService) {
        throw new Error('SyncService is undefined - dependency injection failed');
      }

      const result = options?.full
        ? await this.syncService.fullResync()
        : await this.syncService.syncNow();

      if (result.success) {
        console.log(`\n✅ Sync complete!`);
        console.log(`   Tasks: ${result.tasks}`);
        console.log(`   Projects: ${result.projects}`);
        console.log(`   Labels: ${result.labels}`);
        if (result.newTasks && result.newTasks > 0) {
          console.log(`   New tasks: ${result.newTasks}`);
        }
      } else {
        console.error(`\n❌ Sync failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  @Option({
    flags: '--full',
    description: 'Force full resync',
  })
  parseFull(): boolean {
    return true;
  }
}


/**
 * Task Module
 * 
 * Orchestrates core task operations including sync, enrichment, and reconciliation.
 * This module brings together:
 * - Sync: Todoist <-> Local storage synchronization
 * - Enrichment: AI metadata management
 * - Reconciliation: Conflict detection between manual and AI changes
 */

import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { TaskProviderModule } from '../task-provider/task-provider.module';
import { ConfigurationModule } from '../config/config.module';
import { SyncService } from './services/sync.service';
import { EnrichmentService } from './services/enrichment.service';
import { ReconciliationService } from './services/reconciliation.service';

@Module({
  imports: [
    StorageModule,
    TaskProviderModule,
    ConfigurationModule,
  ],
  providers: [
    ReconciliationService,  // Order matters - ReconciliationService first
    SyncService,            // Then SyncService (depends on ReconciliationService)
    EnrichmentService,      // Then EnrichmentService
  ],
  exports: [
    SyncService,
    EnrichmentService,
    ReconciliationService,
  ],
})
export class TaskModule {}


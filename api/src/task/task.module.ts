/**
 * Task Module
 * 
 * Orchestrates core task operations including sync, enrichment, and reconciliation.
 * This module brings together:
 * - Sync: Todoist <-> Local storage synchronization
 * - Enrichment: AI metadata management
 * - URL Enrichment: Fetching and contextualizing URL-heavy tasks
 * - Reconciliation: Conflict detection between manual and AI changes
 */

import { Module, forwardRef } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { TaskProviderModule } from '../task-provider/task-provider.module';
import { ConfigurationModule } from '../config/config.module';
import { AIModule } from '../ai/ai.module';
import { SyncService } from './services/sync.service';
import { EnrichmentService } from './services/enrichment.service';
import { ReconciliationService } from './services/reconciliation.service';
import { UrlEnrichmentService } from './services/url-enrichment.service';

@Module({
  imports: [
    StorageModule,
    TaskProviderModule,
    ConfigurationModule,
    forwardRef(() => AIModule), // Use forwardRef to avoid circular dependency
  ],
  providers: [
    ReconciliationService,  // Order matters - ReconciliationService first
    SyncService,            // Then SyncService (depends on ReconciliationService)
    EnrichmentService,      // Then EnrichmentService
    UrlEnrichmentService,   // URL enrichment (separate from classification)
  ],
  exports: [
    SyncService,
    EnrichmentService,
    ReconciliationService,
    UrlEnrichmentService,
  ],
})
export class TaskModule {}


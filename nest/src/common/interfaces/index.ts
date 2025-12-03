/**
 * Common Interfaces Export
 */

export * from './task.interface';
export * from './task-provider.interface';
export * from './storage-adapter.interface';

// Re-export SyncState type for convenience
export type SyncState = {
  taskState: any;
  syncedAt: Date;
};

// Re-export StorageAdapterState type for backward compatibility
export type StorageAdapterSyncState = {
  state: any;
  lastSyncedAt: Date;
};


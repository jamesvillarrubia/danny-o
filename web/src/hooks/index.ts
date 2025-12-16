/**
 * Hooks barrel export
 */

// Legacy hooks (maintained for backward compatibility)
export * from './useSettings';
export * from './useViews';
export * from './useTasks';
export * from './useAllTasks';
export * from './useChat';
export * from './useProjects';
export * from './useLabels';
export * from './usePageContext';
export * from './useBackendHealth';

// New TanStack Query-based hooks
export * from './queries';
export * from './mutations';
export * from './filters';

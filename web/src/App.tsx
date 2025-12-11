/**
 * Danny Web App
 * 
 * Main application component for the task dashboard.
 * Includes setup check and wizard for first-run configuration.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { TaskList } from './components/TaskList';
import { TaskDetail } from './components/TaskDetail';
import { TaskForm } from './components/TaskForm';
import { ChatInput } from './components/ChatInput';
import { ViewSelector } from './components/ViewSelector';
import { QuickFilters, type SortOption, type SortDirection } from './components/QuickFilters';
import { WelcomePanel } from './components/WelcomePanel';
import { SettingsPanel } from './components/SettingsPanel';
import { FilterDisplay } from './components/FilterDisplay';
import { DebugPanel } from './components/DebugPanel';
import { FillerPanel } from './components/FillerPanel';
import { InsightsView } from './components/InsightsView';
import { Setup } from './pages/Setup';
import { useViews } from './hooks/useViews';
import { useSettings } from './hooks/useSettings';
import { useProjects } from './hooks/useProjects';
import { useBackendHealth } from './hooks/useBackendHealth';
import { useTasksQuery, TASKS_QUERY_KEY } from './hooks/queries/useTasksQuery';
import { filterTasks, sortTasks, type SortConfig } from './lib/taskFilters';
import { createView, estimateTasksBatch, completeTask, reopenTask, fullResyncTasks, enrichUrlTasks, getProductivityInsights, getComprehensiveInsights, getSetupStatus } from './api/client';
import type { Task, View, ChatResponse, DebugPayload, ViewFilterConfig } from './types';

/** Duration in ms before completed tasks are removed from view (2 minutes) */
const COMPLETION_UNDO_WINDOW_MS = 2 * 60 * 1000;

/**
 * Backend Health Gate
 * 
 * Waits for backend to be healthy before rendering the main app.
 * This prevents connection refused errors during server restarts.
 */
function BackendHealthGate({ children }: { children: React.ReactNode }) {
  const { isBackendReady, isChecking, retryCount } = useBackendHealth();
  
  if (!isBackendReady) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center px-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-danny-100 mb-4">
            <svg 
              className={`w-8 h-8 text-danny-600 ${isChecking ? 'animate-spin' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24"
            >
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-zinc-800 mb-1">
            Connecting to server...
          </h2>
          <p className="text-sm text-zinc-500">
            {retryCount > 0 
              ? `Waiting for backend to start (attempt ${retryCount})` 
              : 'Checking backend health'}
          </p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

/**
 * Setup Check Gate
 * 
 * Checks if initial setup is completed and shows setup wizard if not.
 */
function SetupGate({ children }: { children: React.ReactNode }) {
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    async function checkSetup() {
      try {
        const status = await getSetupStatus();
        setSetupCompleted(status.setupCompleted);
      } catch (error) {
        console.error('Failed to check setup status:', error);
        // Assume setup is needed if check fails
        setSetupCompleted(false);
      } finally {
        setCheckingSetup(false);
      }
    }

    checkSetup();
  }, []);

  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!setupCompleted) {
    return <Setup onComplete={() => setSetupCompleted(true)} />;
  }

  return <>{children}</>;
}

/**
 * Main App Export with Health and Setup Gates
 */
export default function App() {
  return (
    <BackendHealthGate>
      <SetupGate>
        <AppContent />
      </SetupGate>
    </BackendHealthGate>
  );
}

/**
 * App Content - Only rendered when backend is healthy
 */
function AppContent() {
  const queryClient = useQueryClient();
  const { settings, updateApiKey, updateSettings, clearCache } = useSettings();
  const { views, isLoading: viewsLoading, refetch: refetchViews } = useViews();
  const { projectsMap, isLoading: projectsLoading, refetch: refetchProjects } = useProjects();
  
  // Use TanStack Query for all tasks - single source of truth
  const { data: allTasks = [], isLoading: tasksLoading, isFetching: tasksFetching } = useTasksQuery();
  
  // UI state
  const [currentView, setCurrentView] = useState<string>('today');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [, setTemporaryView] = useState<View | null>(null);
  const [activeFilter, setActiveFilter] = useState<ViewFilterConfig | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugData, setDebugData] = useState<DebugPayload | null>(null);
  
  // Filler panel state
  const [showFiller, setShowFiller] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [isGeneratingEstimates, setIsGeneratingEstimates] = useState(false);
  const [isSyncingTodoist, setIsSyncingTodoist] = useState(false);
  const [isEnrichingUrls, setIsEnrichingUrls] = useState(false);
  const [isGettingInsights, setIsGettingInsights] = useState(false);
  
  // Insights data - persisted at app level so it doesn't reload on tab switch
  // Also uses localStorage for persistence across page refreshes
  const INSIGHTS_CACHE_KEY = 'danny-insights-cache';
  const [insightsData, setInsightsData] = useState<Awaited<ReturnType<typeof getComprehensiveInsights>> | null>(() => {
    // Initialize from localStorage if available
    try {
      const cached = localStorage.getItem(INSIGHTS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Check if cache is less than 24 hours old
        const generatedAt = new Date(parsed.generatedAt).getTime();
        const isStale = Date.now() - generatedAt > 24 * 60 * 60 * 1000;
        if (!isStale) {
          return parsed;
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
    return null;
  });
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  
  // Quick filter state
  const [sortBy, setSortBy] = useState<SortOption>('due');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showCompleted, setShowCompleted] = useState(false);
  
  // Pending completions: tasks that were just completed and are in the undo window
  // We store full task objects WITH their original index so they stay in place
  const pendingCompletionTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [pendingCompletions, setPendingCompletions] = useState<Map<string, { task: Task; originalIndex: number }>>(new Map());

  // Derived loading state
  const isLoading = tasksLoading || tasksFetching;
  
  // Track if initial data load is complete
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Set initialized once both tasks and projects have loaded
  useEffect(() => {
    if (!tasksLoading && !projectsLoading && !hasInitialized) {
      setHasInitialized(true);
    }
  }, [tasksLoading, projectsLoading, hasInitialized]);
  
  /**
   * Refetch all tasks and wait for completion.
   * Use this after mutations to refresh the cache.
   * 
   * Note: Uses refetchQueries instead of invalidateQueries to ensure
   * the new data is available before the promise resolves. This fixes
   * issues where UI components (like FillerPanel) showed stale data.
   */
  const refetchTasks = useCallback(() => {
    return queryClient.refetchQueries({ queryKey: TASKS_QUERY_KEY });
  }, [queryClient]);

  // Get the effective filter: active filter from chat OR the current view's filter
  const effectiveFilter = useMemo((): ViewFilterConfig | null => {
    // If there's an active filter from chat, use it
    if (activeFilter) {
      return activeFilter;
    }
    // Otherwise, get the current view's filter config
    const currentViewConfig = views.find(v => v.slug === currentView)?.filterConfig;
    return currentViewConfig ?? null;
  }, [activeFilter, views, currentView]);

  // Sort config for the filter utilities
  const sortConfig = useMemo((): SortConfig => ({
    sortBy: sortBy as SortConfig['sortBy'],
    direction: sortDirection,
  }), [sortBy, sortDirection]);

  // Filter and sort tasks client-side, merging in pending completions at their original positions
  const sortedTasks = useMemo(() => {
    // Start with all tasks, excluding pending completions (we'll add them back at their original positions)
    const tasksToFilter = allTasks.filter(t => !pendingCompletions.has(t.id));
    
    // Apply completion filter based on showCompleted toggle
    // This overrides whatever the view's filter says about completed tasks
    const filterWithCompletedOverride: ViewFilterConfig = {
      ...effectiveFilter,
      completed: showCompleted ? undefined : false,
    };
    
    // Use the filter utilities
    const filtered = filterTasks(tasksToFilter, filterWithCompletedOverride);
    const sorted = sortTasks(filtered, sortConfig);
    
    // Insert pending completions back at their original positions
    // This keeps completed tasks exactly where they were before completion
    const pendingEntries = Array.from(pendingCompletions.entries())
      .map(([id, { task, originalIndex }]) => ({ id, task: { ...task, isCompleted: true }, originalIndex }))
      .sort((a, b) => a.originalIndex - b.originalIndex);
    
    for (const { task, originalIndex } of pendingEntries) {
      const insertIndex = Math.min(originalIndex, sorted.length);
      sorted.splice(insertIndex, 0, task);
    }
    
    return sorted;
  }, [allTasks, effectiveFilter, sortConfig, showCompleted, pendingCompletions]);

  // Memoize the Set of pending completion IDs to avoid creating new Set on each render
  const pendingCompletionIds = useMemo(() => 
    new Set(pendingCompletions.keys()), 
    [pendingCompletions]
  );

  const handleViewChange = useCallback((viewSlug: string) => {
    setCurrentView(viewSlug);
    setSelectedTask(null);
    setActiveFilter(null); // Clear active filter when manually changing views
    setTemporaryView(null);
    setShowFiller(false); // Exit filler mode when switching views
    setShowInsights(false); // Exit insights mode when switching views
  }, []);

  /**
   * Handle filler tab click - toggle filler panel
   */
  const handleFillerClick = useCallback(() => {
    setShowFiller(prev => !prev);
    setShowInsights(false);
    setSelectedTask(null);
  }, []);

  /**
   * Load comprehensive insights data
   * Only loads if not already loaded or if force refresh
   */
  const loadInsights = useCallback(async (forceRefresh = false) => {
    // Don't reload if we already have data (unless forcing refresh)
    if (insightsData && !forceRefresh) return;
    
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      // Pass forceRefresh to API to bypass server-side cache
      const data = await getComprehensiveInsights(forceRefresh);
      setInsightsData(data);
      // Save to localStorage for persistence across page refreshes
      try {
        localStorage.setItem(INSIGHTS_CACHE_KEY, JSON.stringify(data));
      } catch (e) {
        // Ignore storage errors (quota exceeded, etc.)
      }
    } catch (err) {
      console.error('Failed to load insights:', err);
      setInsightsError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setInsightsLoading(false);
    }
  }, [insightsData]);

  /**
   * Generate time estimates for tasks that don't have them
   */
  const handleGenerateEstimates = useCallback(async () => {
    setIsGeneratingEstimates(true);
    try {
      // Get task IDs without estimates from ALL tasks
      const tasksNeedingEstimates = allTasks.filter(
        t => !t.isCompleted && (!t.metadata?.timeEstimateMinutes || t.metadata.timeEstimateMinutes === 0)
      );
      
      if (tasksNeedingEstimates.length === 0) {
        return;
      }

      // Process in batches of 10
      const taskIds = tasksNeedingEstimates.slice(0, 10).map(t => t.id);
      
      await estimateTasksBatch({
        taskIds,
        batchSize: 10,
      });
      
      // Refetch tasks to get updated estimates
      await refetchTasks();
    } catch (error) {
      console.error('Failed to generate estimates:', error);
    } finally {
      setIsGeneratingEstimates(false);
    }
  }, [allTasks, refetchTasks]);

  /**
   * Full resync all tasks with Todoist
   */
  const handleResyncTodoist = useCallback(async () => {
    setIsSyncingTodoist(true);
    try {
      const result = await fullResyncTasks();
      console.log(`[App] Todoist resync complete: ${result.tasks} tasks, ${result.projects} projects, ${result.labels} labels in ${result.duration}ms`);
      
      // Refetch everything to update the UI
      await Promise.all([refetchTasks(), refetchViews(), refetchProjects()]);
    } catch (error) {
      console.error('Failed to resync with Todoist:', error);
    } finally {
      setIsSyncingTodoist(false);
    }
  }, [refetchTasks, refetchViews, refetchProjects]);

  /**
   * Enrich URL-heavy tasks with context from linked pages
   */
  const handleEnrichUrls = useCallback(async () => {
    setIsEnrichingUrls(true);
    try {
      const result = await enrichUrlTasks({ limit: 10 });
      console.log(`[App] URL enrichment complete: ${result.enriched}/${result.found} tasks enriched`);
      
      // Refetch to show updated task descriptions
      await refetchTasks();
    } catch (error) {
      console.error('Failed to enrich URLs:', error);
    } finally {
      setIsEnrichingUrls(false);
    }
  }, [refetchTasks]);

  /**
   * Get productivity insights from completed tasks
   */
  const handleGetInsights = useCallback(async () => {
    setIsGettingInsights(true);
    try {
      const insights = await getProductivityInsights({ days: 7 });
      console.log('[App] Productivity insights:', insights);
      
      // For now, just log to console - could show in a modal or panel
      alert(`📊 Productivity Insights (Last 7 days)\n\nTasks completed: ${insights.stats.tasksCompleted}\nMost productive: ${insights.stats.mostProductiveCategory || 'N/A'}\n\nRecommendations:\n${insights.recommendations.join('\n') || 'Keep up the good work!'}`);
    } catch (error) {
      console.error('Failed to get insights:', error);
    } finally {
      setIsGettingInsights(false);
    }
  }, []);

  const handleSortChange = useCallback((newSortBy: SortOption, newDirection: SortDirection) => {
    setSortBy(newSortBy);
    setSortDirection(newDirection);
  }, []);

  const handleShowCompletedChange = useCallback((show: boolean) => {
    setShowCompleted(show);
  }, []);

  const handleTaskSelect = useCallback((task: Task) => {
    // If clicking the same task that's already selected, close the details panel
    setSelectedTask(prev => prev?.id === task.id ? null : task);
  }, []);

  const handleTaskClose = useCallback(() => {
    setSelectedTask(null);
  }, []);

  const handleTaskComplete = useCallback(async (taskId: string) => {
    // Find the task and its current position in the displayed list
    const originalIndex = sortedTasks.findIndex(t => t.id === taskId);
    const taskToComplete = sortedTasks[originalIndex];
    
    if (!taskToComplete || originalIndex === -1) {
      console.error('Task not found:', taskId);
      return;
    }
    
    // OPTIMISTIC: Add to pending completions IMMEDIATELY (before API call)
    // This makes the strikethrough appear instantly
    setPendingCompletions(prev => {
      const next = new Map(prev);
      next.set(taskId, { task: taskToComplete, originalIndex });
      return next;
    });
    
    // Set timeout to remove from view after undo window expires
    const timeoutId = setTimeout(() => {
      // Remove from pending completions
      setPendingCompletions(prev => {
        const next = new Map(prev);
        next.delete(taskId);
        return next;
      });
      pendingCompletionTimeoutsRef.current.delete(taskId);
      // Refresh the task list (completed task will be filtered out naturally)
      refetchTasks();
    }, COMPLETION_UNDO_WINDOW_MS);
    
    // Store timeout ID so we can cancel on undo
    pendingCompletionTimeoutsRef.current.set(taskId, timeoutId);
    
    // Clear selection if the completed task was selected
    if (selectedTask?.id === taskId) {
      setSelectedTask(null);
    }
    
    // Call API in the background - if it fails, rollback
    try {
      await completeTask(taskId);
    } catch (err) {
      console.error('Failed to complete task:', err);
      // Rollback: remove from pending completions
      clearTimeout(timeoutId);
      pendingCompletionTimeoutsRef.current.delete(taskId);
      setPendingCompletions(prev => {
        const next = new Map(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, [sortedTasks, refetchTasks, selectedTask]);

  const handleTaskUndo = useCallback(async (taskId: string) => {
    // Cancel the pending removal timeout
    const timeoutId = pendingCompletionTimeoutsRef.current.get(taskId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      pendingCompletionTimeoutsRef.current.delete(taskId);
    }
    
    // OPTIMISTIC: Remove from pending completions immediately
    // The task will reappear as normal (not struck through) instantly
    setPendingCompletions(prev => {
      const next = new Map(prev);
      next.delete(taskId);
      return next;
    });
    
    // Call API to reopen the task in the background - no refetch needed
    // The task is still in our local state, just no longer marked as pending completion
    try {
      await reopenTask(taskId);
    } catch (err) {
      console.error('Failed to undo task completion:', err);
      // Note: We could add back to pendingCompletions here to rollback, 
      // but that might be confusing. The next refetch will sync state.
    }
  }, []);

  const handleChatResponse = useCallback((response?: ChatResponse) => {
    // Capture debug messages from response (The Net π)
    if (response?.debugMessages) {
      setDebugData(response.debugMessages);
    }

    // Check if response contains a filter action
    if (response?.filterConfig) {
      // Store the active filter - this will be applied client-side to cached tasks
      setActiveFilter(response.filterConfig);
      // Clear the current view to show the filtered results
      setCurrentView('all');
      setSelectedTask(null);
    }
    
    // Always refetch tasks after chat action (chat may have created/modified tasks)
    refetchTasks();
  }, [refetchTasks]);

  const handleClearFilter = useCallback(() => {
    setActiveFilter(null);
    setTemporaryView(null);
  }, []);

  const handleSaveFilter = useCallback(async () => {
    if (!activeFilter) return;
    
    const viewName = prompt('Enter a name for this view:');
    if (!viewName) return;

    try {
      const savedView = await createView({
        name: viewName,
        filterConfig: activeFilter,
      });
      
      // Clear temporary filter and switch to the new view
      setActiveFilter(null);
      setTemporaryView(null);
      setCurrentView(savedView.slug);
      
      // Refresh views list
      await refetchViews();
      
      alert(`View "${viewName}" saved successfully!`);
    } catch (error) {
      console.error('Failed to save view:', error);
      alert('Failed to save view. Please try again.');
    }
  }, [activeFilter, refetchViews]);

  const handleAddTask = useCallback(() => {
    setEditingTask(null);
    setShowTaskForm(true);
  }, []);

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  }, []);

  const handleCloseTaskForm = useCallback(() => {
    setShowTaskForm(false);
    setEditingTask(null);
  }, []);

  const handleSaveTask = useCallback(async () => {
    // Refetch tasks to get the updated data
    await refetchTasks();
    
    // If we're editing the currently selected task, find the updated version in allTasks
    // Note: allTasks will be updated after the refetch completes on the next render
    if (editingTask && selectedTask?.id === editingTask.id) {
      const updatedTask = allTasks.find(t => t.id === editingTask.id);
      if (updatedTask) {
        setSelectedTask(updatedTask);
      }
    }
    
    handleCloseTaskForm();
  }, [refetchTasks, handleCloseTaskForm, editingTask, selectedTask, allTasks]);

  /**
   * Handle inline task updates from TaskDetail
   * Updates the selected task immediately and refetches the list
   */
  const handleTaskUpdate = useCallback(async (updatedTask: Task) => {
    // Update selected task immediately for instant feedback
    setSelectedTask(updatedTask);
    // Refetch the task list to keep it in sync
    await refetchTasks();
  }, [refetchTasks]);

  /**
   * Handle task duplication from TaskDetail
   * Refreshes the list and selects the new task
   */
  const handleTaskDuplicate = useCallback(async (newTask: Task) => {
    // Refetch the task list to include the new task
    await refetchTasks();
    // Select the newly created task
    setSelectedTask(newTask);
  }, [refetchTasks]);

  /**
   * Handle task deletion/archival from TaskDetail
   * Removes the task from the local insights cache (stalestTasks) without
   * triggering a full refresh. The next natural insights refresh will repopulate.
   */
  const handleTaskDelete = useCallback(async (taskId: string) => {
    // Clear selection (the task will be gone)
    setSelectedTask(null);
    // Refetch the task list
    await refetchTasks();
    
    // Remove the deleted task from the local insights cache instead of
    // invalidating and refetching everything - that's wasteful.
    // The list will shrink, and the next natural refresh will repopulate.
    if (insightsData) {
      const updatedInsights = {
        ...insightsData,
        stats: {
          ...insightsData.stats,
          stalestTasks: insightsData.stats.stalestTasks.filter(t => t.id !== taskId),
        },
      };
      setInsightsData(updatedInsights);
      // Update localStorage cache too
      try {
        localStorage.setItem(INSIGHTS_CACHE_KEY, JSON.stringify(updatedInsights));
      } catch (e) {
        // Ignore storage errors
      }
    }
  }, [refetchTasks, insightsData]);

  /**
   * Handle API key save from welcome panel (onboarding)
   */
  const handleApiKeySave = useCallback((key: string) => {
    updateApiKey(key);
  }, [updateApiKey]);

  /**
   * Handle settings save from settings panel
   */
  const handleSettingsSave = useCallback((updates: Parameters<typeof updateSettings>[0]) => {
    updateSettings(updates);
  }, [updateSettings]);

  /**
   * Handle clear cache action from settings panel
   */
  const handleClearCache = useCallback(() => {
    clearCache();
  }, [clearCache]);

  // Show welcome/onboarding screen if no API key configured
  if (!settings.apiKey) {
    return (
      <Layout>
        <WelcomePanel onSave={handleApiKeySave} />
      </Layout>
    );
  }

  // Show loading screen until critical data is ready (tasks + projects)
  // Only show on first load, not on subsequent refetches
  const isInitializing = !hasInitialized;
  if (isInitializing) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-danny-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-zinc-500">Loading tasks...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout onSettingsClick={() => setShowSettings(true)}>
      <div className="flex flex-col h-full">
        {/* View Selector + Quick Filters */}
        <ViewSelector
          views={views}
          currentView={currentView}
          onViewChange={handleViewChange}
          isLoading={viewsLoading}
          showFillerTab={true}
          onFillerClick={handleFillerClick}
          isFillerActive={showFiller}
          showInsightsTab={true}
          onInsightsClick={() => {
            setShowFiller(false);
            setShowInsights(true);
            loadInsights(); // Load insights if not already loaded
          }}
          isInsightsActive={showInsights}
        />
        {/* Quick Filters - Hidden when in Filler mode */}
        {!showFiller && (
          <QuickFilters
            sortBy={sortBy}
            sortDirection={sortDirection}
            showCompleted={showCompleted}
            onSortChange={handleSortChange}
            onShowCompletedChange={handleShowCompletedChange}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Insights View - When insights mode is active */}
          {showInsights ? (
            <div className="flex-1 overflow-y-auto bg-zinc-50">
              <InsightsView
                data={insightsData}
                isLoading={insightsLoading}
                error={insightsError}
                onRefresh={() => loadInsights(true)}
                onTaskClick={(taskId) => {
                  // Could navigate to task or show task detail
                  const task = allTasks.find(t => t.id === taskId);
                  if (task) {
                    setSelectedTask(task);
                  }
                }}
              />
            </div>
          ) : showFiller ? (
            /* Filler Panel - When filler mode is active */
            <div className={`flex flex-col min-w-0 ${selectedTask ? 'hidden md:flex md:w-1/2 lg:w-2/5' : 'flex-1'}`}>
              <FillerPanel
                tasks={allTasks}
                isLoading={tasksLoading}
                onTaskSelect={handleTaskSelect}
                onGenerateEstimates={handleGenerateEstimates}
                isGeneratingEstimates={isGeneratingEstimates}
              />
            </div>
          ) : (
            /* Task List - Standard view */
            <div className={`flex flex-col min-w-0 ${selectedTask ? 'hidden md:flex md:w-1/2 lg:w-2/5' : 'flex-1'}`}>
              {/* Filter Display */}
              {activeFilter && (
                <FilterDisplay
                  filterConfig={activeFilter}
                  isTemporary={true}
                  onSave={handleSaveFilter}
                  onClear={handleClearFilter}
                />
              )}
              
              {/* Task List - Scrollable */}
              <div className="flex-1 overflow-y-auto">
                <TaskList
                  tasks={sortedTasks}
                  isLoading={isLoading}
                  onTaskSelect={handleTaskSelect}
                  selectedTaskId={selectedTask?.id}
                  onTaskComplete={handleTaskComplete}
                  onTaskUndo={handleTaskUndo}
                  pendingCompletions={pendingCompletionIds}
                  projectsMap={projectsMap}
                />
              </div>
            </div>
          )}

          {/* Task Detail Panel */}
          {selectedTask && (
            <div className="w-full md:w-1/2 lg:w-3/5 border-l border-zinc-200 bg-white flex flex-col">
              <TaskDetail
                task={selectedTask}
                onClose={handleTaskClose}
                onComplete={handleTaskComplete}
                onEdit={handleEditTask}
                onTaskUpdate={handleTaskUpdate}
                onDuplicate={handleTaskDuplicate}
                onDelete={handleTaskDelete}
                isPendingCompletion={pendingCompletionIds.has(selectedTask.id)}
              />
            </div>
          )}
        </div>

        {/* Chat Input */}
        <ChatInput onResponse={handleChatResponse} onAddTask={handleAddTask} />
      </div>

      {/* Task Form Modal */}
      {showTaskForm && (
        <TaskForm
          task={editingTask || undefined}
          onClose={handleCloseTaskForm}
          onSave={handleSaveTask}
        />
      )}

      {/* Settings Panel Modal */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onSave={handleSettingsSave}
          onClearCache={handleClearCache}
          onClose={() => setShowSettings(false)}
          onGenerateEstimates={handleGenerateEstimates}
          isGeneratingEstimates={isGeneratingEstimates}
          tasksWithoutEstimates={allTasks.filter(t => !t.isCompleted && (!t.metadata?.timeEstimateMinutes || t.metadata.timeEstimateMinutes === 0)).length}
          onResyncTodoist={handleResyncTodoist}
          isSyncingTodoist={isSyncingTodoist}
          onEnrichUrls={handleEnrichUrls}
          isEnrichingUrls={isEnrichingUrls}
          tasksNeedingUrlEnrichment={allTasks.filter(t => !t.isCompleted && (t.content.includes('http') || t.description?.includes('http'))).length}
          onGetInsights={handleGetInsights}
          isGettingInsights={isGettingInsights}
        />
      )}

      {/* Debug Panel (The Net π) - Hidden button in bottom right corner */}
      <button
        onClick={() => setShowDebugPanel(true)}
        className="fixed bottom-3 right-0 w-4 p-0 m-0 leading-none text-[0.7rem] text-zinc-400 hover:text-green-400 opacity-30 hover:opacity-100 transition-all cursor-pointer font-mono z-30"
        title="Debug Console (The Net)"
        aria-label="Open debug console"
      >
        π
      </button>

      {/* Debug Panel Modal */}
      {showDebugPanel && (
        <DebugPanel
          debugData={debugData}
          onClose={() => setShowDebugPanel(false)}
        />
      )}
    </Layout>
  );
}

/**
 * Danny Web App
 * 
 * Main application component for the task dashboard.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
import { useTasks } from './hooks/useTasks';
import { useViews } from './hooks/useViews';
import { useSettings } from './hooks/useSettings';
import { useProjects } from './hooks/useProjects';
import { useBackendHealth } from './hooks/useBackendHealth';
import { createView, estimateTasksBatch, completeTask, reopenTask, getViewTasks, fullResyncTasks, enrichUrlTasks, getProductivityInsights } from './api/client';
import type { Task, View, ChatResponse, DebugPayload } from './types';

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
 * Main App Export with Health Gate
 */
export default function App() {
  return (
    <BackendHealthGate>
      <AppContent />
    </BackendHealthGate>
  );
}

/**
 * App Content - Only rendered when backend is healthy
 */
function AppContent() {
  const { settings, updateApiKey, updateSettings, clearCache } = useSettings();
  const { views, isLoading: viewsLoading, refetch: refetchViews } = useViews();
  const { projectsMap, isLoading: projectsLoading, refetch: refetchProjects } = useProjects();
  const [currentView, setCurrentView] = useState<string>('today');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [temporaryView, setTemporaryView] = useState<View | null>(null);
  const [activeFilter, setActiveFilter] = useState<View['filterConfig'] | null>(null);
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
  
  // Quick filter state
  const [sortBy, setSortBy] = useState<SortOption>('due');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showCompleted, setShowCompleted] = useState(false);
  
  // Pending completions: tasks that were just completed and are in the undo window
  // We store full task objects WITH their original index so they stay in place
  const pendingCompletionTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [pendingCompletions, setPendingCompletions] = useState<Map<string, { task: Task; originalIndex: number }>>(new Map());

  const { tasks, isLoading, refetch } = useTasks(currentView);
  
  // Track if initial data load is complete
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Set initialized once both tasks and projects have loaded
  useEffect(() => {
    if (!isLoading && !projectsLoading && !hasInitialized) {
      setHasInitialized(true);
    }
  }, [isLoading, projectsLoading, hasInitialized]);
  
  // All tasks state for Filler panel
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [allTasksLoading, setAllTasksLoading] = useState(true);
  const allTasksFetchedRef = useRef(false);
  const allTasksLoadingRef = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  /**
   * Fetch ALL tasks in background for Filler panel.
   * Only updates state if the task list has actually changed.
   * Includes automatic retry with exponential backoff on failure.
   */
  const refetchAllTasks = useCallback(async (options?: { showLoading?: boolean; isRetry?: boolean }) => {
    if (!settings.apiKey) return;
    if (allTasksLoadingRef.current) return; // Prevent concurrent fetches
    
    allTasksLoadingRef.current = true;
    
    // Only show loading spinner on first fetch or if explicitly requested
    if (options?.showLoading || !allTasksFetchedRef.current) {
      setAllTasksLoading(true);
    }
    
    try {
      const data = await getViewTasks('all', { limit: 1000 });
      
      // Only update state if tasks have actually changed
      setAllTasks(prevTasks => {
        // Build signatures including id, updatedAt, isCompleted, and timeEstimateMinutes
        const buildSignature = (tasks: Task[]) => tasks.map(t => 
          `${t.id}:${t.updatedAt}:${t.isCompleted}:${t.metadata?.timeEstimateMinutes || 0}`
        ).join(',');
        
        const prevSignature = buildSignature(prevTasks);
        const newSignature = buildSignature(data.tasks);
        
        if (prevSignature === newSignature) {
          // No changes, return previous array to avoid re-render
          return prevTasks;
        }
        
        return data.tasks;
      });
      
      allTasksFetchedRef.current = true;
      retryCountRef.current = 0; // Reset retry count on success
    } catch (err) {
      console.error('[App] Failed to fetch all tasks:', err);
      
      // Schedule retry with exponential backoff (1s, 2s, 4s, 8s, max 30s)
      if (!allTasksFetchedRef.current) {
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
        retryCountRef.current++;
        console.log(`[App] Will retry fetching all tasks in ${delay}ms (attempt ${retryCountRef.current})`);
        
        // Clear any existing retry timeout
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        
        retryTimeoutRef.current = setTimeout(() => {
          allTasksLoadingRef.current = false; // Allow the retry to proceed
          refetchAllTasks({ isRetry: true });
        }, delay);
      }
    } finally {
      allTasksLoadingRef.current = false;
      setAllTasksLoading(false);
    }
  }, [settings.apiKey]);

  // Fetch all tasks ONCE on mount (when API key is available)
  // Also refetch on window focus if data is stale
  useEffect(() => {
    if (settings.apiKey && !allTasksFetchedRef.current) {
      refetchAllTasks();
    }
    
    // Cleanup retry timeout on unmount
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [settings.apiKey, refetchAllTasks]);
  
  // Refetch all tasks when window regains focus (if initial fetch failed)
  useEffect(() => {
    const handleFocus = () => {
      if (settings.apiKey && !allTasksFetchedRef.current) {
        console.log('[App] Window focused, retrying all tasks fetch');
        refetchAllTasks();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [settings.apiKey, refetchAllTasks]);

  // Sort and filter tasks client-side, merging in pending completions at their original positions
  const sortedTasks = useMemo(() => {
    // Start with tasks from API, excluding pending completions (we'll add them back at their original positions)
    let filtered = tasks.filter(t => !pendingCompletions.has(t.id));
    
    // Filter out completed tasks unless showCompleted is true
    if (!showCompleted) {
      filtered = filtered.filter((t) => !t.isCompleted);
    }
    
    // Sort the non-pending tasks
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'due': {
          // Tasks without due dates go to the end
          const aDate = a.due?.date ? new Date(a.due.date).getTime() : Infinity;
          const bDate = b.due?.date ? new Date(b.due.date).getTime() : Infinity;
          comparison = aDate - bDate;
          break;
        }
        case 'priority': {
          // Higher priority number = more important (4 is highest)
          comparison = b.priority - a.priority;
          break;
        }
        case 'created': {
          const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          comparison = aCreated - bCreated;
          break;
        }
        case 'title': {
          comparison = a.content.localeCompare(b.content);
          break;
        }
      }
      
      // Apply direction (for priority, desc is natural so we flip the logic)
      if (sortBy === 'priority') {
        return sortDirection === 'desc' ? comparison : -comparison;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    // Insert pending completions back at their original positions
    // This keeps completed tasks exactly where they were before completion
    const pendingEntries = Array.from(pendingCompletions.entries())
      .map(([id, { task, originalIndex }]) => ({ id, task: { ...task, isCompleted: true }, originalIndex }))
      .sort((a, b) => a.originalIndex - b.originalIndex); // Process in order of original index
    
    for (const { task, originalIndex } of pendingEntries) {
      // Clamp the index to valid range (in case list shrunk)
      const insertIndex = Math.min(originalIndex, sorted.length);
      sorted.splice(insertIndex, 0, task);
    }
    
    return sorted;
  }, [tasks, sortBy, sortDirection, showCompleted, pendingCompletions]);

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
      
      // Refetch both current view and all tasks to get updated estimates
      await Promise.all([refetch(), refetchAllTasks()]);
    } catch (error) {
      console.error('Failed to generate estimates:', error);
    } finally {
      setIsGeneratingEstimates(false);
    }
  }, [allTasks, refetch, refetchAllTasks]);

  /**
   * Full resync all tasks with Todoist
   */
  const handleResyncTodoist = useCallback(async () => {
    setIsSyncingTodoist(true);
    try {
      const result = await fullResyncTasks();
      console.log(`[App] Todoist resync complete: ${result.tasks} tasks, ${result.projects} projects, ${result.labels} labels in ${result.duration}ms`);
      
      // Refetch everything to update the UI
      await Promise.all([refetch(), refetchAllTasks({ showLoading: false }), refetchViews(), refetchProjects()]);
    } catch (error) {
      console.error('Failed to resync with Todoist:', error);
    } finally {
      setIsSyncingTodoist(false);
    }
  }, [refetch, refetchAllTasks, refetchViews, refetchProjects]);

  /**
   * Enrich URL-heavy tasks with context from linked pages
   */
  const handleEnrichUrls = useCallback(async () => {
    setIsEnrichingUrls(true);
    try {
      const result = await enrichUrlTasks({ limit: 10 });
      console.log(`[App] URL enrichment complete: ${result.enriched}/${result.found} tasks enriched`);
      
      // Refetch to show updated task descriptions
      await Promise.all([refetch(), refetchAllTasks({ showLoading: false })]);
    } catch (error) {
      console.error('Failed to enrich URLs:', error);
    } finally {
      setIsEnrichingUrls(false);
    }
  }, [refetch, refetchAllTasks]);

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
      refetch();
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
  }, [sortedTasks, refetch, selectedTask]);

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
      // Store the active filter
      setActiveFilter(response.filterConfig);
      // Switch to "all" view to show all tasks with the filter applied
      setCurrentView('all');
      setSelectedTask(null);
    } else {
      // Just refetch tasks after chat action
      refetch();
    }
  }, [refetch]);

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
    const updatedTasks = await refetch();
    
    // If we're editing the currently selected task, update it with fresh data
    if (editingTask && selectedTask?.id === editingTask.id) {
      const updatedTask = updatedTasks.find(t => t.id === editingTask.id);
      if (updatedTask) {
        setSelectedTask(updatedTask);
      }
    }
    
    handleCloseTaskForm();
  }, [refetch, handleCloseTaskForm, editingTask, selectedTask]);

  /**
   * Handle inline task updates from TaskDetail
   * Updates the selected task immediately and refetches the list
   */
  const handleTaskUpdate = useCallback(async (updatedTask: Task) => {
    // Update selected task immediately for instant feedback
    setSelectedTask(updatedTask);
    // Refetch the task list to keep it in sync
    await refetch();
  }, [refetch]);

  /**
   * Handle task duplication from TaskDetail
   * Refreshes the list and selects the new task
   */
  const handleTaskDuplicate = useCallback(async (newTask: Task) => {
    // Refetch the task list to include the new task
    await refetch();
    // Select the newly created task
    setSelectedTask(newTask);
  }, [refetch]);

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
                isLoading={allTasksLoading}
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

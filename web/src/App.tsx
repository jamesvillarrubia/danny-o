/**
 * Danny Web App
 * 
 * Main application component for the task dashboard.
 */

import { useState, useCallback } from 'react';
import clsx from 'clsx';
import { Layout } from './components/Layout';
import { TaskList } from './components/TaskList';
import { TaskDetail } from './components/TaskDetail';
import { TaskForm } from './components/TaskForm';
import { ChatInput } from './components/ChatInput';
import { ViewSelector } from './components/ViewSelector';
import { SettingsPanel } from './components/SettingsPanel';
import { FilterDisplay } from './components/FilterDisplay';
import { DebugPanel } from './components/DebugPanel';
import { useTasks } from './hooks/useTasks';
import { useViews } from './hooks/useViews';
import { useSettings } from './hooks/useSettings';
import { createView } from './api/client';
import type { Task, View, ChatResponse, DebugPayload } from './types';

export default function App() {
  const { settings, updateApiKey } = useSettings();
  const { views, isLoading: viewsLoading, refetch: refetchViews } = useViews();
  const [currentView, setCurrentView] = useState<string>('today');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showSettings, setShowSettings] = useState(!settings.apiKey);
  const [temporaryView, setTemporaryView] = useState<View | null>(null);
  const [activeFilter, setActiveFilter] = useState<View['filterConfig'] | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugData, setDebugData] = useState<DebugPayload | null>(null);

  const { tasks, isLoading, refetch } = useTasks(currentView);

  const handleViewChange = useCallback((viewSlug: string) => {
    setCurrentView(viewSlug);
    setSelectedTask(null);
    setActiveFilter(null); // Clear active filter when manually changing views
    setTemporaryView(null);
  }, []);

  const handleTaskSelect = useCallback((task: Task) => {
    setSelectedTask(task);
  }, []);

  const handleTaskClose = useCallback(() => {
    setSelectedTask(null);
  }, []);

  const handleTaskComplete = useCallback(async (taskId: string) => {
    // Will be handled by the detail panel
    await refetch();
    if (selectedTask?.id === taskId) {
      setSelectedTask(null);
    }
  }, [refetch, selectedTask]);

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
    await refetch();
    handleCloseTaskForm();
  }, [refetch, handleCloseTaskForm]);

  // Show settings if no API key configured
  if (showSettings || !settings.apiKey) {
    return (
      <Layout>
        <SettingsPanel
          apiKey={settings.apiKey}
          onSave={(key) => {
            updateApiKey(key);
            setShowSettings(false);
          }}
        />
      </Layout>
    );
  }

  return (
    <Layout onSettingsClick={() => setShowSettings(true)}>
      <div className="flex flex-col h-full">
        {/* View Selector */}
        <ViewSelector
          views={views}
          currentView={currentView}
          onViewChange={handleViewChange}
          isLoading={viewsLoading}
        />

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Task List */}
          <div className={`flex flex-col ${selectedTask ? 'hidden md:flex md:w-1/2 lg:w-2/5' : 'flex-1'}`}>
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
                tasks={tasks}
                isLoading={isLoading}
                onTaskSelect={handleTaskSelect}
                selectedTaskId={selectedTask?.id}
                onTaskComplete={handleTaskComplete}
              />
            </div>
          </div>

          {/* Task Detail Panel */}
          {selectedTask && (
            <div className="w-full md:w-1/2 lg:w-3/5 border-l border-zinc-200 bg-white flex flex-col">
              <TaskDetail
                task={selectedTask}
                onClose={handleTaskClose}
                onComplete={handleTaskComplete}
                onEdit={handleEditTask}
              />
            </div>
          )}
        </div>

        {/* Chat Input */}
        <ChatInput onResponse={handleChatResponse} />
      </div>

      {/* Add Task Button (Floating) - Left side to avoid conflicts */}
      <button
        onClick={handleAddTask}
        className={clsx(
          'fixed bottom-20 w-14 h-14 bg-gradient-to-br from-danny-500 to-danny-600 hover:from-danny-600 hover:to-danny-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all cursor-pointer hover:scale-110 z-40',
          selectedTask ? 'left-6' : 'right-6'
        )}
        aria-label="Add task"
        title="Add new task"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Task Form Modal */}
      {showTaskForm && (
        <TaskForm
          task={editingTask || undefined}
          onClose={handleCloseTaskForm}
          onSave={handleSaveTask}
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


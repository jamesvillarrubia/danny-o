/**
 * Danny Web App
 * 
 * Main application component for the task dashboard.
 */

import { useState, useCallback } from 'react';
import { Layout } from './components/Layout';
import { TaskList } from './components/TaskList';
import { TaskDetail } from './components/TaskDetail';
import { ChatInput } from './components/ChatInput';
import { ViewSelector } from './components/ViewSelector';
import { SettingsPanel } from './components/SettingsPanel';
import { FilterDisplay } from './components/FilterDisplay';
import { useTasks } from './hooks/useTasks';
import { useViews } from './hooks/useViews';
import { useSettings } from './hooks/useSettings';
import { createView } from './api/client';
import type { Task, View, ChatResponse } from './types';

export default function App() {
  const { settings, updateApiKey } = useSettings();
  const { views, isLoading: viewsLoading, refetch: refetchViews } = useViews();
  const [currentView, setCurrentView] = useState<string>('today');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showSettings, setShowSettings] = useState(!settings.apiKey);
  const [temporaryView, setTemporaryView] = useState<View | null>(null);
  const [activeFilter, setActiveFilter] = useState<View['filterConfig'] | null>(null);

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
          <div className={`flex-1 flex flex-col overflow-hidden ${selectedTask ? 'hidden md:block md:w-1/2 lg:w-2/5' : 'w-full'}`}>
            {/* Filter Display */}
            {activeFilter && (
              <FilterDisplay
                filterConfig={activeFilter}
                isTemporary={true}
                onSave={handleSaveFilter}
                onClear={handleClearFilter}
              />
            )}
            
            {/* Task List */}
            <div className="flex-1 overflow-y-auto">
              <TaskList
                tasks={tasks}
                isLoading={isLoading}
                onTaskSelect={handleTaskSelect}
                selectedTaskId={selectedTask?.id}
              />
            </div>
          </div>

          {/* Task Detail Panel */}
          {selectedTask && (
            <div className="w-full md:w-1/2 lg:w-3/5 border-l border-zinc-200 overflow-y-auto bg-white">
              <TaskDetail
                task={selectedTask}
                onClose={handleTaskClose}
                onComplete={handleTaskComplete}
              />
            </div>
          )}
        </div>

        {/* Chat Input */}
        <ChatInput onResponse={handleChatResponse} />
      </div>
    </Layout>
  );
}


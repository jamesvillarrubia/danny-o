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
import { useTasks } from './hooks/useTasks';
import { useViews } from './hooks/useViews';
import { useSettings } from './hooks/useSettings';
import type { Task } from './types';

export default function App() {
  const { settings, updateApiKey } = useSettings();
  const { views, isLoading: viewsLoading } = useViews();
  const [currentView, setCurrentView] = useState<string>('today');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showSettings, setShowSettings] = useState(!settings.apiKey);

  const { tasks, isLoading, refetch } = useTasks(currentView);

  const handleViewChange = useCallback((viewSlug: string) => {
    setCurrentView(viewSlug);
    setSelectedTask(null);
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

  const handleChatResponse = useCallback(() => {
    // Refetch tasks after chat action
    refetch();
  }, [refetch]);

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
          <div className={`flex-1 overflow-y-auto ${selectedTask ? 'hidden md:block md:w-1/2 lg:w-2/5' : 'w-full'}`}>
            <TaskList
              tasks={tasks}
              isLoading={isLoading}
              onTaskSelect={handleTaskSelect}
              selectedTaskId={selectedTask?.id}
            />
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


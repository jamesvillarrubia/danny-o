/**
 * Task Form Component
 * 
 * Form for creating or editing tasks.
 */

import { useState, useEffect } from 'react';
import { X, Calendar, Flag, Loader2, Sparkles, FolderKanban } from 'lucide-react';
import type { Task } from '../types';
import { createTask, updateTask } from '../api/client';
import { useProjects } from '../hooks/useProjects';
import { Select } from './Select';

interface TaskFormProps {
  task?: Task; // If provided, we're editing; otherwise creating
  onClose: () => void;
  onSave: () => void;
}

const priorityOptions = [
  { value: 4, label: 'P1 - Urgent', color: 'text-priority-1' },
  { value: 3, label: 'P2 - High', color: 'text-priority-2' },
  { value: 2, label: 'P3 - Medium', color: 'text-blue-600' },
  { value: 1, label: 'P4 - Low', color: 'text-zinc-600' },
];

export function TaskForm({ task, onClose, onSave }: TaskFormProps) {
  const { projects } = useProjects();
  const [content, setContent] = useState(task?.content || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 1);
  const [projectId, setProjectId] = useState(task?.projectId || '');
  const [dueDate, setDueDate] = useState(task?.due?.date || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isGettingSuggestions, setIsGettingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!task;

  // Sync form state when task prop changes (e.g., when editing an updated task)
  useEffect(() => {
    if (task) {
      setContent(task.content || '');
      setDescription(task.description || '');
      setPriority(task.priority || 1);
      setProjectId(task.projectId || '');
      setDueDate(task.due?.date || '');
    }
  }, [task]);

  const handleGetSuggestions = async () => {
    if (!content.trim()) {
      setError('Please enter a task title first');
      return;
    }

    setIsGettingSuggestions(true);
    setError(null);

    try {
      // Call AI to get suggestions based on task content and description
      const apiKey = localStorage.getItem('danny_api_key') || '';
      const API_BASE_URL = import.meta.env.VITE_API_URL || '';
      const API_BASE = `${API_BASE_URL}/api/v1`;
      
      const response = await fetch(`${API_BASE}/ai/suggest-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          content: content.trim(),
          description: description.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to get AI suggestions');
      }

      const suggestions = await response.json();

      // Apply suggestions
      if (suggestions.priority) setPriority(suggestions.priority);
      if (suggestions.projectId) setProjectId(suggestions.projectId);
      if (suggestions.dueDate) setDueDate(suggestions.dueDate);
      
      // Show success feedback
      console.log('AI Suggestions applied:', suggestions);
    } catch (err: any) {
      console.error('AI suggestion error:', err);
      setError(err.message || 'Failed to get AI suggestions');
    } finally {
      setIsGettingSuggestions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Task title is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const taskData = {
        content: content.trim(),
        description: description.trim() || undefined,
        priority,
        projectId: projectId || undefined,
        dueString: dueDate || undefined,
      };

      console.log('[TaskForm] Submitting task data:', taskData);

      if (isEditing) {
        const result = await updateTask(task.id, taskData);
        console.log('[TaskForm] Update result:', result);
      } else {
        const result = await createTask(taskData);
        console.log('[TaskForm] Create result:', result);
      }

      onSave();
      onClose();
    } catch (err: any) {
      console.error('[TaskForm] Save error:', err);
      setError(err.message || 'Failed to save task');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h2 className="text-lg font-semibold text-zinc-900">
            {isEditing ? 'Edit Task' : 'Add Task'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Task Title */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-zinc-700 mb-1">
              Task Title *
            </label>
            <input
              id="content"
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-danny-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-zinc-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details..."
              rows={4}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-danny-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Project */}
          <div>
            <label htmlFor="projectId" className="flex items-center gap-2 text-sm font-medium text-zinc-700 mb-1">
              <FolderKanban className="w-4 h-4" />
              Project
            </label>
            <Select
              id="projectId"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">No Project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Priority */}
          <div>
            <label htmlFor="priority" className="flex items-center gap-2 text-sm font-medium text-zinc-700 mb-1">
              <Flag className="w-4 h-4" />
              Priority
            </label>
            <Select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            >
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Due Date */}
          <div>
            <label htmlFor="dueDate" className="flex items-center gap-2 text-sm font-medium text-zinc-700 mb-1">
              <Calendar className="w-4 h-4" />
              Due Date
            </label>
            <input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-danny-500 focus:border-transparent cursor-pointer"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-zinc-200 bg-zinc-50">
          {/* AI Suggestions Button (left side) */}
          <button
            type="button"
            onClick={handleGetSuggestions}
            disabled={isGettingSuggestions || !content.trim()}
            className="px-4 py-2 text-sm font-medium text-danny-600 bg-danny-50 hover:bg-danny-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2 border border-danny-200"
            title="Let AI suggest priority, project, and due date"
          >
            {isGettingSuggestions ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Getting...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                AI Suggest
              </>
            )}
          </button>

          {/* Action buttons (right side) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSaving || !content.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-danny-500 hover:bg-danny-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>{isEditing ? 'Save Changes' : 'Add Task'}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


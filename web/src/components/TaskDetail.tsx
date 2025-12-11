/**
 * Task Detail Component
 * 
 * Expanded view of a task with full details and inline editing.
 * Click on any field to edit it inline.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  Calendar,
  Flag,
  Tag,
  Clock,
  MessageSquare,
  Loader2,
  AlertCircle,
  Edit,
  Pencil,
  FolderKanban,
  Plus,
  Copy,
  Archive,
  Eye,
  EyeOff,
  ClipboardCheck,
} from 'lucide-react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import clsx from 'clsx';
import type { Task } from '../types';
import { useProjects } from '../hooks/useProjects';
import { useLabels } from '../hooks/useLabels';
import { useTaskMutations } from '../hooks/mutations/useTaskMutations';
import { Select } from './Select';
import { MarkdownContent } from './MarkdownContent';

interface TaskDetailProps {
  task: Task;
  onClose: () => void;
  onComplete: (taskId: string) => void;
  onEdit?: (task: Task) => void;
  onTaskUpdate?: (updatedTask: Task) => void;
  onDuplicate?: (newTask: Task) => void;
  onDelete?: (taskId: string) => void;
  /** True if task is in pending completion state (recently completed, in undo window) */
  isPendingCompletion?: boolean;
}

const priorityLabels: Record<number, string> = {
  4: 'Urgent',
  3: 'High',
  2: 'Medium',
  1: 'Low',
};

const priorityColors: Record<number, string> = {
  4: 'text-priority-1 bg-red-50 border-priority-1/30',
  3: 'text-priority-2 bg-orange-50 border-priority-2/30',
  2: 'text-blue-600 bg-blue-50 border-blue-200',
  1: 'text-zinc-600 bg-zinc-50 border-zinc-200',
};

const priorityOptions = [
  { value: 4, label: 'Urgent', color: 'text-priority-1' },
  { value: 3, label: 'High', color: 'text-priority-2' },
  { value: 2, label: 'Medium', color: 'text-blue-600' },
  { value: 1, label: 'Low', color: 'text-zinc-600' },
];

type EditableField = 'priority' | 'dueDate' | 'description' | 'title' | 'project' | 'labels' | 'timeEstimate';

// Consistent height for grid cells
const GRID_CELL_CLASS = 'p-3 rounded-lg border min-h-[76px]';

// Time bucket labels that are managed by the Estimate field, not the Labels field
const TIME_ESTIMATE_LABELS = [
  '15-minutes',
  '30-minutes', 
  '45-minutes',
  '1-hour',
  '90-minutes',
  '2-hours',
  'needs-breakdown',
];

// Time estimate options for the dropdown (user-friendly labels)
const TIME_ESTIMATE_OPTIONS = [
  { value: '15-minutes', label: '15 minutes' },
  { value: '30-minutes', label: '30 minutes' },
  { value: '45-minutes', label: '45 minutes' },
  { value: '1-hour', label: '1 hour' },
  { value: '90-minutes', label: '90 minutes' },
  { value: '2-hours', label: '2 hours' },
  { value: 'needs-breakdown', label: 'Needs breakdown' },
];

/**
 * Check if a label is a time estimate label (case-insensitive)
 */
const isTimeEstimateLabel = (label: string): boolean => {
  const normalized = label.toLowerCase().replace(/\s+/g, '-');
  return TIME_ESTIMATE_LABELS.includes(normalized);
};

/**
 * Filter out time estimate labels from an array of labels
 */
const filterTimeLabels = (labels: string[]): string[] => {
  return labels.filter(l => !isTimeEstimateLabel(l));
};

export function TaskDetail({ task, onClose, onComplete, onEdit, onTaskUpdate, onDuplicate, onDelete, isPendingCompletion = false }: TaskDetailProps) {
  const { projects, projectsMap } = useProjects();
  const { labelNames: existingLabels } = useLabels();
  const {
    completeTaskAsync,
    updateTaskAsync,
    duplicateTaskAsync,
    deleteTaskAsync,
  } = useTaskMutations();
  
  const [isCompleting, setIsCompleting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [completionMinutes, setCompletionMinutes] = useState<string>('');
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  
  // Markdown view state - defaults to rendered markdown
  const [showMarkdown, setShowMarkdown] = useState(true);
  const [hasCopied, setHasCopied] = useState(false);
  
  // Inline editing state
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editPriority, setEditPriority] = useState(task.priority);
  const [editDueDate, setEditDueDate] = useState(task.due?.date || '');
  const [editDescription, setEditDescription] = useState(task.description || '');
  const [editTitle, setEditTitle] = useState(task.content);
  const [editProject, setEditProject] = useState(task.projectId || '');
  const [editTimeEstimate, setEditTimeEstimate] = useState(task.metadata?.timeEstimate || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Labels editing state (more complex - array-based with suggestions)
  const [selectedLabels, setSelectedLabels] = useState<string[]>(task.labels || []);
  const [labelInput, setLabelInput] = useState('');
  const [showLabelSuggestions, setShowLabelSuggestions] = useState(false);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(0);
  
  // Get current time estimate from labels
  const currentTimeEstimate = useMemo(() => {
    return (task.labels || []).find(l => isTimeEstimateLabel(l)) || '';
  }, [task.labels]);
  
  // Refs for focus management
  const priorityRef = useRef<HTMLSelectElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<HTMLSelectElement>(null);
  const labelsRef = useRef<HTMLInputElement>(null);
  const timeEstimateRef = useRef<HTMLSelectElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  // Filter out time estimate labels from existing labels for suggestions
  const availableLabels = useMemo(() => {
    return existingLabels.filter(l => !isTimeEstimateLabel(l));
  }, [existingLabels]);
  
  // Filter suggestions based on input
  const labelSuggestions = useMemo(() => {
    if (!labelInput.trim()) {
      // Show all existing labels not already selected (excluding time labels)
      return availableLabels.filter(l => !selectedLabels.includes(l)).slice(0, 8);
    }
    const query = labelInput.toLowerCase().trim();
    return availableLabels
      .filter(l => l.toLowerCase().includes(query) && !selectedLabels.includes(l))
      .slice(0, 8);
  }, [labelInput, availableLabels, selectedLabels]);
  
  // Check if current input could be a new label
  const canAddNewLabel = useMemo(() => {
    const trimmed = labelInput.trim();
    if (!trimmed) return false;
    // Don't suggest adding if it matches an existing label exactly
    const exactMatch = existingLabels.some(l => l.toLowerCase() === trimmed.toLowerCase());
    // Don't add if already selected
    const alreadySelected = selectedLabels.some(l => l.toLowerCase() === trimmed.toLowerCase());
    return !exactMatch && !alreadySelected;
  }, [labelInput, existingLabels, selectedLabels]);
  
  // Sync edit state when task changes
  useEffect(() => {
    setEditPriority(task.priority);
    setEditDueDate(task.due?.date || '');
    setEditDescription(task.description || '');
    setEditTitle(task.content);
    setEditProject(task.projectId || '');
    // Filter out time estimate labels - they're managed by the Estimate field
    setSelectedLabels(filterTimeLabels(task.labels || []));
    setLabelInput('');
    // Get time estimate from labels
    const timeLabel = (task.labels || []).find(l => isTimeEstimateLabel(l)) || '';
    setEditTimeEstimate(timeLabel);
    setEditingField(null);
  }, [task]);
  
  // Focus input when editing starts
  useEffect(() => {
    const focusMap: Record<EditableField, React.RefObject<HTMLElement | null>> = {
      priority: priorityRef,
      dueDate: dueDateRef,
      description: descriptionRef,
      title: titleRef,
      project: projectRef,
      labels: labelsRef,
      timeEstimate: timeEstimateRef,
    };
    
    if (editingField && focusMap[editingField]?.current) {
      const el = focusMap[editingField].current;
      el?.focus();
      
      // Special handling for date picker
      if (editingField === 'dueDate' && dueDateRef.current) {
        try {
          dueDateRef.current.showPicker?.();
        } catch {
          // Ignore - showPicker can throw if not user-activated
        }
      }
      
      // Select text for input fields
      if (editingField === 'title' && titleRef.current) {
        titleRef.current.select();
      }
      
      // Move cursor to end for textarea
      if (editingField === 'description' && descriptionRef.current) {
        const len = descriptionRef.current.value.length;
        descriptionRef.current.setSelectionRange(len, len);
      }
      
      // Show suggestions for labels
      if (editingField === 'labels') {
        setShowLabelSuggestions(true);
      }
    }
  }, [editingField]);

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      const minutes = completionMinutes ? parseInt(completionMinutes, 10) : undefined;
      await completeTaskAsync({ taskId: task.id, options: { actualMinutes: minutes } });
      onComplete(task.id);
    } catch (err) {
      console.error('Failed to complete task:', err);
    } finally {
      setIsCompleting(false);
    }
  };
  
  /**
   * Duplicate the current task
   */
  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      const newTask = await duplicateTaskAsync({ task });
      onDuplicate?.(newTask);
    } catch (err) {
      console.error('Failed to duplicate task:', err);
      setSaveError('Failed to duplicate task');
    } finally {
      setIsDuplicating(false);
    }
  };

  /**
   * Delete/archive the current task
   */
  const handleDelete = async () => {
    // Confirm before deleting
    const confirmed = window.confirm(
      `Are you sure you want to archive "${task.content}"?\n\nThis will permanently delete the task from your task list.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteTaskAsync({ taskId: task.id });
      onDelete?.(task.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete task:', err);
      setSaveError('Failed to archive task');
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Copy description to clipboard
   */
  const handleCopyDescription = async () => {
    if (!task.description) return;
    
    try {
      await navigator.clipboard.writeText(task.description);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy description:', err);
    }
  };
  
  /**
   * Save a single field inline
   */
  const saveField = async (field: EditableField, overrideValue?: string | number | string[]) => {
    // Get the current value for this field
    const getCurrentValue = (): string | number | string[] | undefined => {
      if (overrideValue !== undefined) return overrideValue;
      switch (field) {
        case 'priority': return editPriority;
        case 'dueDate': return editDueDate;
        case 'description': return editDescription;
        case 'title': return editTitle;
        case 'project': return editProject;
        case 'labels': return selectedLabels;
        case 'timeEstimate': return editTimeEstimate;
        default: return undefined;
      }
    };
    
    // Get the original value for comparison
    const getOriginalValue = (): string | number | string[] | undefined => {
      switch (field) {
        case 'priority': return task.priority;
        case 'dueDate': return task.due?.date || '';
        case 'description': return task.description || '';
        case 'title': return task.content;
        case 'project': return task.projectId || '';
        case 'labels': return filterTimeLabels(task.labels || []);
        case 'timeEstimate': return currentTimeEstimate;
        default: return undefined;
      }
    };
    
    const value = getCurrentValue();
    const original = getOriginalValue();
    
    // Check if value changed
    const hasChanged = field === 'labels' 
      ? JSON.stringify(value) !== JSON.stringify(original)
      : value !== original;
    
    if (!hasChanged) {
      setEditingField(null);
      setShowLabelSuggestions(false);
      return;
    }
    
    // Validate title
    if (field === 'title' && !String(value).trim()) {
      setSaveError('Task title cannot be empty');
      return;
    }
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const updates: Record<string, unknown> = {};
      
      switch (field) {
        case 'priority':
          updates.priority = value;
          break;
        case 'dueDate':
          updates.dueString = value || '';
          break;
        case 'description':
          updates.description = value || undefined;
          break;
        case 'title':
          updates.content = String(value).trim();
          break;
        case 'project':
          updates.projectId = value || undefined;
          break;
        case 'labels':
          // Preserve existing time estimate labels when saving custom labels
          const existingTimeLabels = (task.labels || []).filter(l => isTimeEstimateLabel(l));
          const newCustomLabels = value as string[];
          updates.labels = [...newCustomLabels, ...existingTimeLabels];
          break;
        case 'timeEstimate':
          // Time estimate is stored as a label - update labels array
          const customLabels = filterTimeLabels(task.labels || []);
          const newTimeLabel = value as string;
          updates.labels = newTimeLabel 
            ? [...customLabels, newTimeLabel]
            : customLabels; // Remove time label if cleared
          break;
      }
      
      const updatedTask = await updateTaskAsync({ taskId: task.id, updates });
      setEditingField(null);
      setShowLabelSuggestions(false);
      onTaskUpdate?.(updatedTask);
    } catch (err: any) {
      console.error(`Failed to update ${field}:`, err);
      setSaveError(err.message || `Failed to update ${field}`);
    } finally {
      setIsSaving(false);
    }
  };
  
  /**
   * Cancel editing and reset to original value
   */
  const cancelEdit = () => {
    setEditPriority(task.priority);
    setEditDueDate(task.due?.date || '');
    setEditDescription(task.description || '');
    setEditTitle(task.content);
    setEditProject(task.projectId || '');
    setSelectedLabels(filterTimeLabels(task.labels || []));
    setLabelInput('');
    // Get time estimate from labels
    const timeLabel = (task.labels || []).find(l => isTimeEstimateLabel(l)) || '';
    setEditTimeEstimate(timeLabel);
    setEditingField(null);
    setShowLabelSuggestions(false);
    setSaveError(null);
  };
  
  /**
   * Handle keyboard events for inline editing
   */
  const handleKeyDown = (e: React.KeyboardEvent, field: EditableField) => {
    if (e.key === 'Escape') {
      cancelEdit();
    } else if (e.key === 'Enter' && field !== 'description' && field !== 'labels') {
      e.preventDefault();
      saveField(field);
    } else if (e.key === 'Enter' && e.metaKey && field === 'description') {
      e.preventDefault();
      saveField(field);
    }
  };
  
  /**
   * Handle label-specific keyboard events
   */
  const handleLabelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      cancelEdit();
      return;
    }
    
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // If there's a highlighted suggestion, add it
      if (labelSuggestions.length > 0 && highlightedSuggestion < labelSuggestions.length) {
        addLabel(labelSuggestions[highlightedSuggestion]);
      } else if (canAddNewLabel) {
        // Add as new label
        addLabel(labelInput.trim());
      } else if (!labelInput.trim()) {
        // No input, save and close
        saveField('labels');
      }
      return;
    }
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const maxIndex = labelSuggestions.length + (canAddNewLabel ? 1 : 0) - 1;
      setHighlightedSuggestion(prev => Math.min(prev + 1, maxIndex));
      return;
    }
    
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedSuggestion(prev => Math.max(prev - 1, 0));
      return;
    }
    
    if (e.key === 'Backspace' && !labelInput && selectedLabels.length > 0) {
      // Remove last label when backspace on empty input
      setSelectedLabels(prev => prev.slice(0, -1));
      return;
    }
    
    if (e.key === 'Tab' && labelSuggestions.length > 0) {
      e.preventDefault();
      addLabel(labelSuggestions[highlightedSuggestion]);
      return;
    }
  };
  
  /**
   * Add a label to selection
   */
  const addLabel = (label: string) => {
    if (!label.trim()) return;
    const normalized = label.trim();
    if (!selectedLabels.includes(normalized)) {
      setSelectedLabels(prev => [...prev, normalized]);
    }
    setLabelInput('');
    setHighlightedSuggestion(0);
    labelsRef.current?.focus();
  };
  
  /**
   * Remove a label from selection
   */
  const removeLabel = (label: string) => {
    setSelectedLabels(prev => prev.filter(l => l !== label));
    labelsRef.current?.focus();
  };

  /**
   * Start editing a field (if not completed)
   */
  const startEdit = (field: EditableField) => {
    if (!task.isCompleted) {
      setEditingField(field);
    }
  };

  const dueDate = task.due?.date ? parseISO(task.due.date) : null;
  const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate);
  const isDueToday = dueDate && isToday(dueDate);

  // Get project name for display
  const projectName = task.projectId ? projectsMap[task.projectId]?.name : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-200">
        <h2 className="font-semibold text-zinc-900">Task Details</h2>
        <div className="flex items-center gap-1">
          {!task.isCompleted && (
            <button
              onClick={handleDuplicate}
              disabled={isDuplicating}
              className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Duplicate task"
              title="Duplicate task"
            >
              {isDuplicating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          )}
          {onEdit && !task.isCompleted && (
            <button
              onClick={() => onEdit(task)}
              className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500 cursor-pointer"
              aria-label="Edit task in modal"
              title="Open full edit form"
            >
              <Edit className="w-5 h-5" />
            </button>
          )}
          {!task.isCompleted && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors text-zinc-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Archive task"
              title="Archive task"
            >
              {isDeleting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Archive className="w-5 h-5" />
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Task Title & Completion */}
        <div className="flex items-start gap-3">
          <button
            onClick={() => setShowTimeInput(!showTimeInput)}
            disabled={isCompleting || task.isCompleted}
            className={clsx(
              'shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mt-1',
              task.isCompleted
                ? 'bg-danny-500 border-danny-500 text-white cursor-default'
                : 'border-zinc-300 hover:border-danny-400 hover:bg-danny-50 cursor-pointer'
            )}
          >
            {task.isCompleted && <Check className="w-4 h-4" />}
          </button>
          <div className="flex-1 min-w-0">
            {editingField === 'title' ? (
              <input
                ref={titleRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => saveField('title')}
                onKeyDown={(e) => handleKeyDown(e, 'title')}
                disabled={isSaving}
                className="w-full text-lg font-medium text-zinc-900 px-2 py-1 -mx-2 border border-danny-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-danny-500"
              />
            ) : (
              <h3 
                onClick={() => startEdit('title')}
                className={clsx(
                  'text-lg font-medium group',
                  // Show strikethrough only if truly completed (not in pending/undo state)
                  task.isCompleted && !isPendingCompletion
                    ? 'text-zinc-400 line-through cursor-default' 
                    : 'text-zinc-900 cursor-pointer hover:bg-zinc-50 rounded px-2 py-1 -mx-2 transition-colors'
                )}
              >
                {task.content}
                {!task.isCompleted && (
                  <Pencil className="w-3.5 h-3.5 inline-block ml-2 opacity-0 group-hover:opacity-50 transition-opacity" />
                )}
              </h3>
            )}
          </div>
        </div>

        {/* Completion Time Input */}
        {showTimeInput && !task.isCompleted && (
          <div className="animate-fade-in bg-danny-50 rounded-lg p-4 space-y-3">
            <p className="text-sm text-danny-700 font-medium">
              How long did this take?
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={completionMinutes}
                onChange={(e) => setCompletionMinutes(e.target.value)}
                placeholder="Minutes"
                className="flex-1 px-3 py-2 border border-danny-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-danny-500"
              />
              <button
                onClick={handleComplete}
                disabled={isCompleting}
                className="px-4 py-2 bg-danny-500 text-white rounded-lg font-medium text-sm hover:bg-danny-600 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {isCompleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Complete'
                )}
              </button>
            </div>
            <button
              onClick={handleComplete}
              disabled={isCompleting}
              className="text-xs text-danny-600 hover:text-danny-700 cursor-pointer"
            >
              Skip time tracking
            </button>
          </div>
        )}

        {/* Description - Editable */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-zinc-500 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Description
            </h4>
            {/* Toggle and Copy buttons - only show when there's a description and not editing */}
            {task.description && editingField !== 'description' && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowMarkdown(!showMarkdown)}
                  className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
                  title={showMarkdown ? 'Show raw text' : 'Show formatted'}
                  aria-label={showMarkdown ? 'Show raw text' : 'Show formatted markdown'}
                >
                  {showMarkdown ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={handleCopyDescription}
                  className={clsx(
                    'p-1.5 rounded-md transition-colors cursor-pointer',
                    hasCopied 
                      ? 'bg-green-50 text-green-600' 
                      : 'hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600'
                  )}
                  title={hasCopied ? 'Copied!' : 'Copy description'}
                  aria-label="Copy description to clipboard"
                >
                  {hasCopied ? (
                    <ClipboardCheck className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>
          {editingField === 'description' ? (
            <div className="space-y-2">
              <textarea
                ref={descriptionRef}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'description')}
                disabled={isSaving}
                rows={4}
                placeholder="Add a description..."
                className="w-full text-sm text-zinc-700 bg-white rounded-lg p-3 border border-danny-300 focus:outline-none focus:ring-2 focus:ring-danny-500 resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">⌘+Enter to save, Esc to cancel</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelEdit}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveField('description')}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-danny-500 hover:bg-danny-600 rounded transition-colors cursor-pointer flex items-center gap-1"
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => startEdit('description')}
              className={clsx(
                'bg-zinc-50 rounded-lg p-3 min-h-[60px] group',
                task.isCompleted 
                  ? 'cursor-default' 
                  : 'cursor-pointer hover:bg-zinc-100 hover:border-zinc-300 border border-transparent transition-colors'
              )}
            >
              {task.description ? (
                <div className="relative">
                  {showMarkdown ? (
                    <MarkdownContent 
                      content={task.description} 
                      className={task.isCompleted ? 'opacity-60' : ''} 
                    />
                  ) : (
                    <div className={clsx(
                      'text-sm whitespace-pre-wrap font-mono',
                      task.isCompleted ? 'text-zinc-400' : 'text-zinc-700'
                    )}>
                      {task.description}
                    </div>
                  )}
                  {!task.isCompleted && (
                    <Pencil className="w-3.5 h-3.5 absolute top-0 right-0 opacity-0 group-hover:opacity-50 transition-opacity text-zinc-400" />
                  )}
                </div>
              ) : (
                <span className="text-sm text-zinc-400 italic">
                  {task.isCompleted ? 'No description' : 'Click to add description...'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Metadata Grid - Consistent heights */}
        <div className="grid grid-cols-2 gap-3">
          {/* Due Date */}
          <div 
            onClick={() => editingField !== 'dueDate' && startEdit('dueDate')}
            className={clsx(
              GRID_CELL_CLASS,
              editingField === 'dueDate' 
                ? 'border-danny-300 bg-white' 
                : isOverdue ? 'bg-red-50 border-red-200' 
                : isDueToday ? 'bg-danny-50 border-danny-200' 
                : 'bg-zinc-50 border-zinc-200',
              !task.isCompleted && editingField !== 'dueDate' && 'cursor-pointer hover:border-danny-300 hover:shadow-sm group'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Calendar className={clsx(
                'w-4 h-4',
                editingField === 'dueDate' ? 'text-danny-500' :
                isOverdue ? 'text-red-500' :
                isDueToday ? 'text-danny-500' :
                'text-zinc-400'
              )} />
              <span className="text-xs font-medium text-zinc-500">Due</span>
              {!task.isCompleted && editingField !== 'dueDate' && (
                <Pencil className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 transition-opacity text-zinc-400" />
              )}
            </div>
            {editingField === 'dueDate' ? (
              <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                <input
                  ref={dueDateRef}
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  onBlur={() => saveField('dueDate')}
                  onKeyDown={(e) => handleKeyDown(e, 'dueDate')}
                  disabled={isSaving}
                  className="flex-1 px-2 py-1 text-sm border border-zinc-200 rounded focus:outline-none focus:ring-2 focus:ring-danny-500"
                />
                {editDueDate && (
                  <button
                    onClick={() => {
                      setEditDueDate('');
                      saveField('dueDate', '');
                    }}
                    className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                    aria-label="Clear date"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <p className={clsx(
                'text-sm font-medium truncate',
                isOverdue ? 'text-red-700' :
                isDueToday ? 'text-danny-700' :
                'text-zinc-900'
              )}>
                {dueDate ? (
                  <>
                    {isOverdue && <AlertCircle className="w-3 h-3 inline mr-1" />}
                    {format(dueDate, 'EEE, MMM d')}
                  </>
                ) : (
                  <span className="text-zinc-400">
                    {task.isCompleted ? 'No date' : 'Set date...'}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Priority */}
          <div 
            onClick={() => editingField !== 'priority' && startEdit('priority')}
            className={clsx(
              GRID_CELL_CLASS,
              editingField === 'priority' 
                ? 'border-danny-300 bg-white' 
                : priorityColors[task.priority],
              !task.isCompleted && editingField !== 'priority' && 'cursor-pointer hover:shadow-sm group'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Flag className={clsx('w-4 h-4', editingField === 'priority' && 'text-danny-500')} />
              <span className="text-xs font-medium opacity-75">Priority</span>
              {!task.isCompleted && editingField !== 'priority' && (
                <Pencil className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
              )}
            </div>
            {editingField === 'priority' ? (
              <div onClick={(e) => e.stopPropagation()}>
                <Select
                  ref={priorityRef}
                  size="sm"
                  value={editPriority}
                  onChange={(e) => setEditPriority(Number(e.target.value))}
                  onBlur={() => saveField('priority')}
                  onKeyDown={(e) => handleKeyDown(e, 'priority')}
                  disabled={isSaving}
                >
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <p className="text-sm font-medium">
                {priorityLabels[task.priority]}
              </p>
            )}
          </div>

          {/* Project */}
          <div 
            onClick={() => editingField !== 'project' && startEdit('project')}
            className={clsx(
              GRID_CELL_CLASS,
              editingField === 'project' 
                ? 'border-danny-300 bg-white' 
                : 'bg-zinc-50 border-zinc-200',
              !task.isCompleted && editingField !== 'project' && 'cursor-pointer hover:border-danny-300 hover:shadow-sm group'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <FolderKanban className={clsx('w-4 h-4', editingField === 'project' ? 'text-danny-500' : 'text-zinc-400')} />
              <span className="text-xs font-medium text-zinc-500">Project</span>
              {!task.isCompleted && editingField !== 'project' && (
                <Pencil className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 transition-opacity text-zinc-400" />
              )}
            </div>
            {editingField === 'project' ? (
              <div onClick={(e) => e.stopPropagation()}>
                <Select
                  ref={projectRef}
                  size="sm"
                  value={editProject}
                  onChange={(e) => setEditProject(e.target.value)}
                  onBlur={() => saveField('project')}
                  onKeyDown={(e) => handleKeyDown(e, 'project')}
                  disabled={isSaving}
                >
                  <option value="">No Project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <p className="text-sm font-medium text-zinc-900 truncate">
                {projectName || (
                  <span className="text-zinc-400">
                    {task.isCompleted ? 'No project' : 'Set project...'}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Time Estimate */}
          <div 
            onClick={() => editingField !== 'timeEstimate' && startEdit('timeEstimate')}
            className={clsx(
              GRID_CELL_CLASS,
              editingField === 'timeEstimate' 
                ? 'border-danny-300 bg-white' 
                : 'bg-zinc-50 border-zinc-200',
              !task.isCompleted && editingField !== 'timeEstimate' && 'cursor-pointer hover:border-danny-300 hover:shadow-sm group'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock className={clsx('w-4 h-4', editingField === 'timeEstimate' ? 'text-danny-500' : 'text-zinc-400')} />
              <span className="text-xs font-medium text-zinc-500">Estimate</span>
              {!task.isCompleted && editingField !== 'timeEstimate' && (
                <Pencil className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 transition-opacity text-zinc-400" />
              )}
            </div>
            {editingField === 'timeEstimate' ? (
              <div onClick={(e) => e.stopPropagation()}>
                <Select
                  ref={timeEstimateRef}
                  size="sm"
                  value={editTimeEstimate}
                  onChange={(e) => setEditTimeEstimate(e.target.value)}
                  onBlur={() => saveField('timeEstimate')}
                  onKeyDown={(e) => handleKeyDown(e, 'timeEstimate')}
                  disabled={isSaving}
                >
                  <option value="">No estimate</option>
                  {TIME_ESTIMATE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <p className="text-sm font-medium text-zinc-900">
                {currentTimeEstimate ? (
                  TIME_ESTIMATE_OPTIONS.find(o => o.value === currentTimeEstimate)?.label || currentTimeEstimate
                ) : (
                  <span className="text-zinc-400">
                    {task.isCompleted ? 'No estimate' : 'Set estimate...'}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Labels - Full width with suggestions */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-zinc-500 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Labels
          </h4>
          {editingField === 'labels' ? (
            <div className="relative">
              {/* Selected labels + input */}
              <div 
                className="flex flex-wrap gap-1.5 p-2 bg-white border border-danny-300 rounded-lg focus-within:ring-2 focus-within:ring-danny-500 min-h-[44px]"
                onClick={() => labelsRef.current?.focus()}
              >
                {selectedLabels.map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-danny-100 text-danny-700 rounded"
                  >
                    {label}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLabel(label);
                      }}
                      className="hover:text-danny-900 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  ref={labelsRef}
                  type="text"
                  value={labelInput}
                  onChange={(e) => {
                    setLabelInput(e.target.value);
                    setHighlightedSuggestion(0);
                    setShowLabelSuggestions(true);
                  }}
                  onKeyDown={handleLabelKeyDown}
                  onFocus={() => setShowLabelSuggestions(true)}
                  disabled={isSaving}
                  placeholder={selectedLabels.length === 0 ? "Type to search or add labels..." : ""}
                  className="flex-1 min-w-[120px] px-1 py-0.5 text-sm outline-none bg-transparent"
                />
              </div>
              
              {/* Suggestions dropdown */}
              {showLabelSuggestions && (labelSuggestions.length > 0 || canAddNewLabel) && (
                <div 
                  ref={suggestionsRef}
                  className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                >
                  {labelSuggestions.map((label, index) => (
                    <button
                      key={label}
                      onClick={() => addLabel(label)}
                      className={clsx(
                        'w-full px-3 py-2 text-left text-sm flex items-center gap-2 cursor-pointer',
                        index === highlightedSuggestion 
                          ? 'bg-danny-50 text-danny-700' 
                          : 'hover:bg-zinc-50'
                      )}
                    >
                      <Tag className="w-3.5 h-3.5 text-zinc-400" />
                      {label}
                    </button>
                  ))}
                  {canAddNewLabel && (
                    <button
                      onClick={() => addLabel(labelInput.trim())}
                      className={clsx(
                        'w-full px-3 py-2 text-left text-sm flex items-center gap-2 cursor-pointer border-t border-zinc-100',
                        highlightedSuggestion === labelSuggestions.length 
                          ? 'bg-danny-50 text-danny-700' 
                          : 'hover:bg-zinc-50'
                      )}
                    >
                      <Plus className="w-3.5 h-3.5 text-danny-500" />
                      Create "{labelInput.trim()}"
                    </button>
                  )}
                </div>
              )}
              
              {/* Action buttons */}
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-zinc-400">Enter to add, Backspace to remove</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelEdit}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveField('labels')}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-danny-500 hover:bg-danny-600 rounded transition-colors cursor-pointer flex items-center gap-1"
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            (() => {
              // Filter out time estimate labels for display
              const displayLabels = filterTimeLabels(task.labels || []);
              return (
                <div
                  onClick={() => startEdit('labels')}
                  className={clsx(
                    'flex flex-wrap gap-1.5 p-3 bg-zinc-50 rounded-lg min-h-[44px] max-h-[120px] overflow-y-auto group',
                    task.isCompleted 
                      ? 'cursor-default' 
                      : 'cursor-pointer hover:bg-zinc-100 border border-transparent hover:border-zinc-300 transition-colors'
                  )}
                >
                  {displayLabels.length > 0 ? (
                    <>
                      {displayLabels.map((label) => (
                        <span
                          key={label}
                          className="px-2 py-0.5 text-xs font-medium bg-zinc-200 text-zinc-700 rounded"
                        >
                          {label}
                        </span>
                      ))}
                      {!task.isCompleted && (
                        <Pencil className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-50 transition-opacity text-zinc-400 self-center" />
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-zinc-400">
                      {task.isCompleted ? 'No labels' : 'Click to add labels...'}
                    </span>
                  )}
                </div>
              );
            })()
          )}
        </div>

        {/* Save Error */}
        {saveError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {saveError}
          </div>
        )}

        {/* AI Confidence */}
        {task.metadata?.aiConfidence !== undefined && task.metadata.aiConfidence > 0 && (
          <div className="text-xs text-zinc-400 flex items-center gap-1">
            <span>AI classification confidence: {Math.round(task.metadata.aiConfidence * 100)}%</span>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {!task.isCompleted && !showTimeInput && (
        <div className="shrink-0 p-4 border-t border-zinc-200 bg-zinc-50">
          <button
            onClick={() => setShowTimeInput(true)}
            className="w-full py-2.5 bg-danny-500 text-white rounded-lg font-medium hover:bg-danny-600 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-5 h-5" />
            Mark Complete
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Task List Component
 * 
 * Displays a list of tasks with priority indicators, due dates, projects, and time estimates.
 * Supports "soft completion" where tasks stay visible for a period before disappearing,
 * allowing users to undo accidental completions.
 */

import { useRef } from 'react';
import { Check, Clock, Loader2, Undo2 } from 'lucide-react';
import { format, isPast, isToday, isTomorrow, parseISO } from 'date-fns';
import clsx from 'clsx';
import type { Task, Project } from '../types';

interface TaskListProps {
  tasks: Task[];
  isLoading: boolean;
  onTaskSelect: (task: Task) => void;
  selectedTaskId?: string;
  onTaskComplete?: (taskId: string) => void;
  onTaskUndo?: (taskId: string) => void;
  /** Set of task IDs that are pending completion (in undo window) */
  pendingCompletions?: Set<string>;
  /** Project lookup map - passed from parent to ensure data is loaded */
  projectsMap: Record<string, Project>;
}

// Priority colors for checkbox circle (Todoist-style: 4=urgent/red, 1=low/gray)
// Uses custom CSS properties from index.css for better color distinction
const priorityBorderColors: Record<number, string> = {
  4: 'border-priority-1 hover:bg-red-50', // P1 - Urgent (deep red)
  3: 'border-priority-2 hover:bg-orange-50', // P2 - High (orange)
  2: 'border-blue-500 hover:bg-blue-50', // P3 - Medium (blue)
  1: 'border-gray-300 hover:bg-gray-50', // P4 - Low (gray)
};

// Priority colors for hover checkmark icon
const priorityCheckColors: Record<number, string> = {
  4: 'text-red-600', // P1 - Urgent
  3: 'text-orange-500', // P2 - High
  2: 'text-blue-500', // P3 - Medium
  1: 'text-gray-400', // P4 - Low
};

// Priority filled colors for completed state (solid background matching priority)
const priorityFilledColors: Record<number, string> = {
  4: 'border-priority-1 bg-red-600', // P1 - Urgent
  3: 'border-priority-2 bg-orange-500', // P2 - High
  2: 'border-blue-500 bg-blue-500', // P3 - Medium
  1: 'border-gray-400 bg-gray-400', // P4 - Low
};

// Todoist project colors
const projectColors: Record<string, string> = {
  berry_red: 'bg-red-500',
  red: 'bg-red-600',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  olive_green: 'bg-lime-600',
  lime_green: 'bg-lime-500',
  green: 'bg-green-500',
  mint_green: 'bg-emerald-400',
  teal: 'bg-teal-500',
  sky_blue: 'bg-sky-400',
  light_blue: 'bg-blue-400',
  blue: 'bg-blue-500',
  grape: 'bg-purple-500',
  violet: 'bg-violet-500',
  lavender: 'bg-purple-400',
  magenta: 'bg-pink-500',
  salmon: 'bg-rose-400',
  charcoal: 'bg-gray-700',
  grey: 'bg-gray-500',
  taupe: 'bg-stone-500',
};


function formatDueDate(due: Task['due']): { text: string; isOverdue: boolean; isUrgent: boolean } {
  if (!due?.date) {
    return { text: '', isOverdue: false, isUrgent: false };
  }

  const dueDate = parseISO(due.date);
  const isOverdue = isPast(dueDate) && !isToday(dueDate);

  if (isToday(dueDate)) {
    return { text: 'Today', isOverdue: false, isUrgent: true };
  }
  if (isTomorrow(dueDate)) {
    return { text: 'Tomorrow', isOverdue: false, isUrgent: false };
  }
  if (isOverdue) {
    return { text: format(dueDate, 'MMM d'), isOverdue: true, isUrgent: true };
  }

  return { text: format(dueDate, 'MMM d'), isOverdue: false, isUrgent: false };
}

export function TaskList({ 
  tasks, 
  isLoading, 
  onTaskSelect, 
  selectedTaskId, 
  onTaskComplete,
  onTaskUndo,
  pendingCompletions = new Set(),
  projectsMap,
}: TaskListProps) {
  // Track recently completed tasks to prevent double-click issues
  // This prevents the undo from firing immediately after complete
  const recentlyCompletedRef = useRef<Set<string>>(new Set());

  const handleCheckboxClick = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation(); // Prevent opening the task detail
    e.preventDefault(); // Prevent any default button behavior
    
    const isPendingCompletion = pendingCompletions.has(task.id);
    const wasRecentlyCompleted = recentlyCompletedRef.current.has(task.id);
    
    // If task was recently completed, ignore clicks for a short time to prevent double-trigger
    if (wasRecentlyCompleted) {
      return;
    }
    
    if (isPendingCompletion) {
      // Clicking the circle on a pending completion undoes it
      if (onTaskUndo) {
        onTaskUndo(task.id);
      }
    } else if (!task.isCompleted && onTaskComplete) {
      // Clicking the circle on an incomplete task completes it
      
      // Mark as recently completed to prevent immediate undo
      recentlyCompletedRef.current.add(task.id);
      setTimeout(() => {
        recentlyCompletedRef.current.delete(task.id);
      }, 500); // 500ms debounce
      
      onTaskComplete(task.id);
    }
  };

  const handleUndoClick = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation(); // Prevent opening the task detail
    if (onTaskUndo) {
      onTaskUndo(taskId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 text-danny-500 animate-spin" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
        <Check className="w-12 h-12 text-zinc-300 mb-3" />
        <p className="text-sm font-medium">No tasks in this view</p>
        <p className="text-xs mt-1">Try a different view or add a task</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-100">
      {tasks.map((task) => {
        const dueInfo = formatDueDate(task.due);
        const isSelected = task.id === selectedTaskId;
        const priorityBorder = priorityBorderColors[task.priority] || priorityBorderColors[1];
        const project = task.projectId ? projectsMap[task.projectId] : null;
        const projectColor = project?.color ? projectColors[project.color] || 'bg-gray-400' : 'bg-gray-400';
        
        // Check if task is in "pending completion" state (recently completed, in undo window)
        const isPendingCompletion = pendingCompletions.has(task.id);
        const showAsCompleted = task.isCompleted || isPendingCompletion;

        return (
          <div
            key={task.id}
            onClick={() => onTaskSelect(task)}
            className={clsx(
              'task-item w-full px-3 py-2.5 flex items-start gap-2.5 text-left transition-all cursor-pointer',
              'hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none',
              isSelected 
                ? 'bg-danny-50 hover:bg-danny-50 border-l-4 border-danny-500 pl-2' 
                : 'border-l-4 border-transparent',
              task.priority === 4 && !showAsCompleted && 'priority-urgent',
              showAsCompleted && 'opacity-60'
            )}
          >
            {/* Priority Checkbox Circle - click to complete, click again to undo */}
            <button
              onClick={(e) => handleCheckboxClick(e, task)}
              className={clsx(
                'group mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer',
                showAsCompleted 
                  ? priorityFilledColors[task.priority] || priorityFilledColors[1]
                  : priorityBorder,
                // Only disable for permanently completed tasks (not pending ones)
                task.isCompleted && !isPendingCompletion && 'cursor-not-allowed opacity-50'
              )}
              aria-label={
                isPendingCompletion ? 'Undo completion' :
                task.isCompleted ? 'Completed' : 
                'Mark as complete'
              }
              disabled={task.isCompleted && !isPendingCompletion}
            >
              {/* Show checkmark when completed OR on hover */}
              {showAsCompleted ? (
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              ) : (
                <Check 
                  className={clsx(
                    'w-3 h-3 opacity-0 group-hover:opacity-70 transition-opacity duration-75',
                    priorityCheckColors[task.priority] || priorityCheckColors[1]
                  )}
                  strokeWidth={3} 
                />
              )}
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0 flex items-start gap-3 overflow-hidden">
              {/* Left side: Title and metadata */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className={clsx(
                  'text-sm font-medium truncate',
                  showAsCompleted ? 'text-zinc-400 line-through' : 'text-zinc-900'
                )}>
                  {task.content}
                </p>

                {/* Metadata Row */}
                <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                  {/* Project - only check if project exists, ignore loading state to prevent flicker during refetch */}
                  {project && (
                    <span className={clsx(
                      'flex items-center gap-1',
                      showAsCompleted ? 'text-zinc-400' : 'text-zinc-600'
                    )}>
                      <span className={clsx('w-2 h-2 rounded-full', projectColor)} />
                      <span className="truncate max-w-[120px]">{project.name}</span>
                    </span>
                  )}

                  {/* Time Estimate */}
                  {task.metadata?.timeEstimate && (
                    <span className={clsx(
                      'flex items-center gap-1',
                      showAsCompleted ? 'text-zinc-400' : 'text-zinc-500'
                    )}>
                      <Clock className="w-3 h-3" />
                      {task.metadata.timeEstimate}
                    </span>
                  )}
                </div>
              </div>

              {/* Right side: Due Date OR Undo button */}
              <div className="shrink-0 text-right min-w-[60px]">
                {isPendingCompletion ? (
                  /* Undo button for recently completed tasks */
                  <button
                    onClick={(e) => handleUndoClick(e, task.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-danny-600 hover:text-danny-700 transition-colors cursor-pointer"
                    aria-label="Undo completion"
                  >
                    <Undo2 className="w-3 h-3" />
                    Undo
                  </button>
                ) : (
                  <span className={clsx(
                    'inline-flex items-center gap-1 text-xs font-medium',
                    showAsCompleted ? 'text-zinc-400' :
                    dueInfo.isOverdue ? 'text-red-600' : 
                    dueInfo.isUrgent ? 'text-green-700' : 
                    'text-zinc-500'
                  )}>
                    {dueInfo.text ? (
                      <>
                        <Clock className="w-3 h-3" />
                        {dueInfo.text}
                      </>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


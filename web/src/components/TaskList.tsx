/**
 * Task List Component
 * 
 * Displays a list of tasks with priority indicators and due dates.
 */

import { CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { format, isPast, isToday, isTomorrow, parseISO } from 'date-fns';
import clsx from 'clsx';
import type { Task } from '../types';

interface TaskListProps {
  tasks: Task[];
  isLoading: boolean;
  onTaskSelect: (task: Task) => void;
  selectedTaskId?: string;
}

// Priority colors (Todoist-style: 1=urgent/red, 4=low/gray)
const priorityColors: Record<number, string> = {
  4: 'text-priority-1 border-priority-1', // Urgent
  3: 'text-priority-2 border-priority-2', // High
  2: 'text-priority-3 border-priority-3', // Medium
  1: 'text-priority-4 border-priority-4', // Low (default)
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

export function TaskList({ tasks, isLoading, onTaskSelect, selectedTaskId }: TaskListProps) {
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
        <CheckCircle2 className="w-12 h-12 text-zinc-300 mb-3" />
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
        const priorityColor = priorityColors[task.priority] || priorityColors[1];

        return (
          <button
            key={task.id}
            onClick={() => onTaskSelect(task)}
            className={clsx(
              'task-item w-full px-4 py-3 flex items-start gap-3 text-left transition-all',
              'hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none',
              isSelected && 'bg-danny-50 hover:bg-danny-50',
              task.priority === 4 && 'priority-urgent'
            )}
          >
            {/* Priority Circle */}
            <div className={clsx(
              'mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center',
              priorityColor,
              task.isCompleted && 'bg-current'
            )}>
              {task.isCompleted && (
                <CheckCircle2 className="w-4 h-4 text-white" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={clsx(
                'text-sm font-medium truncate',
                task.isCompleted ? 'text-zinc-400 line-through' : 'text-zinc-900'
              )}>
                {task.content}
              </p>

              {/* Metadata Row */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {/* Category Badge */}
                {task.metadata?.category && (
                  <span className="text-xs px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-full">
                    {task.metadata.category}
                  </span>
                )}

                {/* Due Date */}
                {dueInfo.text && (
                  <span className={clsx(
                    'flex items-center gap-1 text-xs',
                    dueInfo.isOverdue ? 'text-red-600 font-medium' : 
                    dueInfo.isUrgent ? 'text-danny-600 font-medium' : 
                    'text-zinc-500'
                  )}>
                    {dueInfo.isOverdue && <AlertCircle className="w-3 h-3" />}
                    {!dueInfo.isOverdue && <Clock className="w-3 h-3" />}
                    {dueInfo.text}
                  </span>
                )}

                {/* Time Estimate */}
                {task.metadata?.timeEstimate && (
                  <span className="text-xs text-zinc-400">
                    ~{task.metadata.timeEstimate}
                  </span>
                )}
              </div>
            </div>

            {/* Priority indicator for high priority */}
            {task.priority >= 3 && (
              <div className={clsx(
                'flex-shrink-0 w-2 h-2 rounded-full',
                task.priority === 4 ? 'bg-red-500' : 'bg-orange-400'
              )} />
            )}
          </button>
        );
      })}
    </div>
  );
}


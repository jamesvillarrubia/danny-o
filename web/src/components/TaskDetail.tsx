/**
 * Task Detail Component
 * 
 * Expanded view of a task with full details, similar to Todoist.
 */

import { useState } from 'react';
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
} from 'lucide-react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import clsx from 'clsx';
import type { Task } from '../types';
import { completeTask } from '../api/client';

interface TaskDetailProps {
  task: Task;
  onClose: () => void;
  onComplete: (taskId: string) => void;
}

const priorityLabels: Record<number, string> = {
  4: 'Urgent',
  3: 'High',
  2: 'Medium',
  1: 'Low',
};

const priorityColors: Record<number, string> = {
  4: 'text-red-600 bg-red-50 border-red-200',
  3: 'text-orange-600 bg-orange-50 border-orange-200',
  2: 'text-blue-600 bg-blue-50 border-blue-200',
  1: 'text-zinc-600 bg-zinc-50 border-zinc-200',
};

export function TaskDetail({ task, onClose, onComplete }: TaskDetailProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionMinutes, setCompletionMinutes] = useState<string>('');
  const [showTimeInput, setShowTimeInput] = useState(false);

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      const minutes = completionMinutes ? parseInt(completionMinutes, 10) : undefined;
      await completeTask(task.id, { actualMinutes: minutes });
      onComplete(task.id);
    } catch (err) {
      console.error('Failed to complete task:', err);
    } finally {
      setIsCompleting(false);
    }
  };

  const dueDate = task.due?.date ? parseISO(task.due.date) : null;
  const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate);
  const isDueToday = dueDate && isToday(dueDate);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-200">
        <h2 className="font-semibold text-zinc-900">Task Details</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Task Title & Completion */}
        <div className="flex items-start gap-3">
          <button
            onClick={() => setShowTimeInput(!showTimeInput)}
            disabled={isCompleting || task.isCompleted}
            className={clsx(
              'flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
              task.isCompleted
                ? 'bg-danny-500 border-danny-500 text-white'
                : 'border-zinc-300 hover:border-danny-400 hover:bg-danny-50'
            )}
          >
            {task.isCompleted && <Check className="w-4 h-4" />}
          </button>
          <div className="flex-1">
            <h3 className={clsx(
              'text-lg font-medium',
              task.isCompleted ? 'text-zinc-400 line-through' : 'text-zinc-900'
            )}>
              {task.content}
            </h3>
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
                className="px-4 py-2 bg-danny-500 text-white rounded-lg font-medium text-sm hover:bg-danny-600 transition-colors disabled:opacity-50"
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
              className="text-xs text-danny-600 hover:text-danny-700"
            >
              Skip time tracking
            </button>
          </div>
        )}

        {/* Description */}
        {task.description && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-zinc-500 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Description
            </h4>
            <p className="text-sm text-zinc-700 whitespace-pre-wrap bg-zinc-50 rounded-lg p-3">
              {task.description}
            </p>
          </div>
        )}

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Due Date */}
          <div className={clsx(
            'p-3 rounded-lg border',
            isOverdue ? 'bg-red-50 border-red-200' :
            isDueToday ? 'bg-danny-50 border-danny-200' :
            'bg-zinc-50 border-zinc-200'
          )}>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className={clsx(
                'w-4 h-4',
                isOverdue ? 'text-red-500' :
                isDueToday ? 'text-danny-500' :
                'text-zinc-400'
              )} />
              <span className="text-xs font-medium text-zinc-500">Due</span>
            </div>
            <p className={clsx(
              'text-sm font-medium',
              isOverdue ? 'text-red-700' :
              isDueToday ? 'text-danny-700' :
              'text-zinc-900'
            )}>
              {dueDate ? (
                <>
                  {isOverdue && <AlertCircle className="w-3 h-3 inline mr-1" />}
                  {format(dueDate, 'EEEE, MMM d')}
                  {task.due?.datetime && (
                    <span className="text-zinc-500 ml-1">
                      at {format(parseISO(task.due.datetime), 'h:mm a')}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-zinc-400">No due date</span>
              )}
            </p>
          </div>

          {/* Priority */}
          <div className={clsx(
            'p-3 rounded-lg border',
            priorityColors[task.priority]
          )}>
            <div className="flex items-center gap-2 mb-1">
              <Flag className="w-4 h-4" />
              <span className="text-xs font-medium opacity-75">Priority</span>
            </div>
            <p className="text-sm font-medium">
              {priorityLabels[task.priority]}
            </p>
          </div>

          {/* Category */}
          {task.metadata?.category && (
            <div className="p-3 rounded-lg border bg-zinc-50 border-zinc-200">
              <div className="flex items-center gap-2 mb-1">
                <Tag className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-medium text-zinc-500">Category</span>
              </div>
              <p className="text-sm font-medium text-zinc-900">
                {task.metadata.category}
              </p>
            </div>
          )}

          {/* Time Estimate */}
          {task.metadata?.timeEstimate && (
            <div className="p-3 rounded-lg border bg-zinc-50 border-zinc-200">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-medium text-zinc-500">Estimate</span>
              </div>
              <p className="text-sm font-medium text-zinc-900">
                {task.metadata.timeEstimate}
                {task.metadata.size && (
                  <span className="ml-2 text-zinc-400">({task.metadata.size})</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Labels */}
        {task.labels && task.labels.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-zinc-500">Labels</h4>
            <div className="flex flex-wrap gap-2">
              {task.labels.map((label) => (
                <span
                  key={label}
                  className="px-2.5 py-1 text-xs font-medium bg-zinc-100 text-zinc-700 rounded-full"
                >
                  {label}
                </span>
              ))}
            </div>
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
        <div className="flex-shrink-0 p-4 border-t border-zinc-200 bg-zinc-50">
          <button
            onClick={() => setShowTimeInput(true)}
            className="w-full py-2.5 bg-danny-500 text-white rounded-lg font-medium hover:bg-danny-600 transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            Mark Complete
          </button>
        </div>
      )}
    </div>
  );
}


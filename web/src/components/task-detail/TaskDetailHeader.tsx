/**
 * Task Detail Header Component
 *
 * Header section of the task detail panel with:
 * - Title
 * - Duplicate button
 * - Edit button
 * - Close button
 */

import { X, Edit, Copy, Loader2 } from 'lucide-react';
import type { Task } from '../../types';

interface TaskDetailHeaderProps {
  task: Task;
  isDuplicating: boolean;
  onDuplicate: () => void;
  onEdit?: (task: Task) => void;
  onClose: () => void;
}

export function TaskDetailHeader({
  task,
  isDuplicating,
  onDuplicate,
  onEdit,
  onClose,
}: TaskDetailHeaderProps) {
  return (
    <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-200">
      <h2 className="font-semibold text-zinc-900">Task Details</h2>
      <div className="flex items-center gap-1">
        {!task.isCompleted && (
          <button
            onClick={onDuplicate}
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
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500 cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

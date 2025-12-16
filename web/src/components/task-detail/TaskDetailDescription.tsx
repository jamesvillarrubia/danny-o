/**
 * Task Detail Description Component
 *
 * Editable description section for tasks.
 */

import { useRef, useEffect, type KeyboardEvent } from 'react';
import { MessageSquare, Pencil, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { Task } from '../../types';

interface TaskDetailDescriptionProps {
  task: Task;
  isEditing: boolean;
  editValue: string;
  isSaving: boolean;
  onStartEdit: () => void;
  onEditChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function TaskDetailDescription({
  task,
  isEditing,
  editValue,
  isSaving,
  onStartEdit,
  onEditChange,
  onSave,
  onCancel,
}: TaskDetailDescriptionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [isEditing]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSave();
    }
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-zinc-500 flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />
        Description
      </h4>
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            rows={4}
            placeholder="Add a description..."
            className="w-full text-sm text-zinc-700 bg-white rounded-lg p-3 border border-danny-300 focus:outline-none focus:ring-2 focus:ring-danny-500 resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">⌘+Enter to save, Esc to cancel</span>
            <div className="flex items-center gap-2">
              <button
                onClick={onCancel}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
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
          onClick={() => !task.isCompleted && onStartEdit()}
          className={clsx(
            'text-sm whitespace-pre-wrap bg-zinc-50 rounded-lg p-3 min-h-[60px] group',
            task.isCompleted
              ? 'text-zinc-400 cursor-default'
              : 'text-zinc-700 cursor-pointer hover:bg-zinc-100 hover:border-zinc-300 border border-transparent transition-colors'
          )}
        >
          {task.description || (
            <span className="text-zinc-400 italic">
              {task.isCompleted ? 'No description' : 'Click to add description...'}
            </span>
          )}
          {!task.isCompleted && task.description && (
            <Pencil className="w-3.5 h-3.5 inline-block ml-2 opacity-0 group-hover:opacity-50 transition-opacity" />
          )}
        </div>
      )}
    </div>
  );
}

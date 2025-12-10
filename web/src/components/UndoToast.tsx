/**
 * Undo Toast Component
 * 
 * Shows a temporary notification with an undo action after completing a task.
 */

import { useEffect, useState } from 'react';
import { Check, Undo2, X } from 'lucide-react';
import clsx from 'clsx';

interface UndoToastProps {
  taskContent: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number; // in milliseconds
}

export function UndoToast({ taskContent, onUndo, onDismiss, duration = 10000 }: UndoToastProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration, onDismiss]);

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className="bg-white rounded-lg shadow-lg border border-zinc-200 overflow-hidden max-w-md">
        {/* Progress bar */}
        <div className="h-1 bg-zinc-100">
          <div
            className="h-full bg-danny-500 transition-all duration-50 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-4 flex items-center gap-3">
          {/* Check icon */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="w-5 h-5 text-green-600" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900">Task completed</p>
            <p className="text-xs text-zinc-500 truncate mt-0.5">{taskContent}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onUndo}
              className="px-3 py-1.5 text-sm font-medium text-danny-600 hover:text-danny-700 hover:bg-danny-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo
            </button>
            <button
              onClick={onDismiss}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


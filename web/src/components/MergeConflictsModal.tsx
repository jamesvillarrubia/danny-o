/**
 * Merge Conflicts Modal
 * 
 * Shows orphaned tasks when enabling Todoist sync.
 * Allows users to decide what to do with tasks that exist on one side but not the other.
 */

import { useState } from 'react';
import { X, Download, Upload, EyeOff, AlertTriangle } from 'lucide-react';

interface Task {
  id: string;
  content: string;
  description?: string;
  projectId: string;
  priority: number;
  labels?: string[];
  due?: {
    date: string;
    string?: string;
  };
  createdAt: string;
}

interface OrphanedTasksReport {
  localOnly: Task[];
  todoistOnly: Task[];
  requiresUserDecision: boolean;
}

interface MergeDecision {
  task: Task;
  action: 'import_to_local' | 'push_to_todoist' | 'ignore';
}

interface MergeConflictsModalProps {
  orphans: OrphanedTasksReport;
  onResolve: (decisions: MergeDecision[]) => void;
  onCancel: () => void;
}

export function MergeConflictsModal({ orphans, onResolve, onCancel }: MergeConflictsModalProps) {
  const [decisions, setDecisions] = useState<Map<string, 'import_to_local' | 'push_to_todoist' | 'ignore'>>(new Map());

  const setDecision = (taskId: string, action: 'import_to_local' | 'push_to_todoist' | 'ignore') => {
    setDecisions(new Map(decisions.set(taskId, action)));
  };

  const handleApply = () => {
    const allDecisions: MergeDecision[] = [];

    // Process Todoist-only tasks
    for (const task of orphans.todoistOnly) {
      const action = decisions.get(task.id) || 'import_to_local'; // Default: import
      allDecisions.push({ task, action });
    }

    // Process local-only tasks
    for (const task of orphans.localOnly) {
      const action = decisions.get(task.id) || 'push_to_todoist'; // Default: push
      allDecisions.push({ task, action });
    }

    onResolve(allDecisions);
  };

  const handleSelectAll = (tasks: Task[], action: 'import_to_local' | 'push_to_todoist' | 'ignore') => {
    const newDecisions = new Map(decisions);
    tasks.forEach(task => newDecisions.set(task.id, action));
    setDecisions(newDecisions);
  };

  const totalTasks = orphans.localOnly.length + orphans.todoistOnly.length;
  const decidedCount = decisions.size;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-900">Sync Conflicts Detected</h2>
              <p className="text-sm text-zinc-600">
                {totalTasks} task{totalTasks !== 1 ? 's' : ''} need your attention before syncing
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Todoist-only tasks */}
          {orphans.todoistOnly.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900">
                    Tasks in Todoist Only ({orphans.todoistOnly.length})
                  </h3>
                  <p className="text-sm text-zinc-600">
                    These tasks exist in Todoist but not in your local database
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSelectAll(orphans.todoistOnly, 'import_to_local')}
                    className="text-sm px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100"
                  >
                    Import All
                  </button>
                  <button
                    onClick={() => handleSelectAll(orphans.todoistOnly, 'ignore')}
                    className="text-sm px-3 py-1.5 bg-zinc-100 text-zinc-600 rounded-md hover:bg-zinc-200"
                  >
                    Ignore All
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {orphans.todoistOnly.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    selected={decisions.get(task.id) || 'import_to_local'}
                    onSelect={(action) => setDecision(task.id, action)}
                    actions={[
                      { value: 'import_to_local', label: 'Import to Local', icon: Download },
                      { value: 'ignore', label: 'Ignore', icon: EyeOff },
                    ]}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Local-only tasks */}
          {orphans.localOnly.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900">
                    Local Tasks Only ({orphans.localOnly.length})
                  </h3>
                  <p className="text-sm text-zinc-600">
                    These tasks exist locally but not in Todoist
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSelectAll(orphans.localOnly, 'push_to_todoist')}
                    className="text-sm px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100"
                  >
                    Push All
                  </button>
                  <button
                    onClick={() => handleSelectAll(orphans.localOnly, 'ignore')}
                    className="text-sm px-3 py-1.5 bg-zinc-100 text-zinc-600 rounded-md hover:bg-zinc-200"
                  >
                    Keep Local Only
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {orphans.localOnly.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    selected={decisions.get(task.id) || 'push_to_todoist'}
                    onSelect={(action) => setDecision(task.id, action)}
                    actions={[
                      { value: 'push_to_todoist', label: 'Push to Todoist', icon: Upload },
                      { value: 'ignore', label: 'Keep Local Only', icon: EyeOff },
                    ]}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="text-sm text-zinc-600">
            {decidedCount} of {totalTasks} decisions made
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-zinc-600 hover:bg-zinc-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Decisions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  selected: string;
  onSelect: (action: any) => void;
  actions: Array<{ value: string; label: string; icon: any }>;
}

function TaskRow({ task, selected, onSelect, actions }: TaskRowProps) {
  return (
    <div className="p-4 bg-white border border-zinc-200 rounded-lg hover:border-zinc-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-zinc-900 truncate">{task.content}</h4>
          {task.description && (
            <p className="text-sm text-zinc-600 mt-1 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
            {task.priority > 1 && (
              <span className="px-2 py-1 bg-priority-{task.priority} rounded-md">
                P{5 - task.priority}
              </span>
            )}
            {task.due && (
              <span>{new Date(task.due.date).toLocaleDateString()}</span>
            )}
            {task.labels && task.labels.length > 0 && (
              <span>{task.labels.length} label{task.labels.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {actions.map(action => {
            const Icon = action.icon;
            const isSelected = selected === action.value;
            return (
              <button
                key={action.value}
                onClick={() => onSelect(action.value)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


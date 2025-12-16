/**
 * Task Detail Meta Component
 *
 * Displays and allows editing of task metadata:
 * - Due date
 * - Priority
 * - Project
 * - Time estimate
 */

import { Calendar, Flag, FolderKanban, Clock, Pencil } from 'lucide-react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import clsx from 'clsx';
import type { Task, Project } from '../../types';
import { Select } from '../Select';

/** Shared grid cell styling */
const GRID_CELL_CLASS = 'border rounded-lg p-3 transition-colors min-h-[72px]';

interface TaskDetailMetaProps {
  task: Task;
  projects: Project[];
  projectsMap: Record<string, Project>;
  // Due date editing
  editingDueDate: boolean;
  dueDateValue: string;
  onDueDateStartEdit: () => void;
  onDueDateChange: (value: string) => void;
  onDueDateSave: () => void;
  onDueDateCancel: () => void;
  // Priority editing
  editingPriority: boolean;
  priorityValue: number;
  onPriorityStartEdit: () => void;
  onPriorityChange: (value: number) => void;
  onPrioritySave: () => void;
  // Project editing
  editingProject: boolean;
  projectValue: string;
  onProjectStartEdit: () => void;
  onProjectChange: (value: string) => void;
  onProjectSave: () => void;
  // Time estimate editing
  editingTimeEstimate: boolean;
  timeEstimateValue: string;
  onTimeEstimateStartEdit: () => void;
  onTimeEstimateChange: (value: string) => void;
  onTimeEstimateSave: () => void;
  // Shared
  isSaving: boolean;
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

const timeEstimateOptions = [
  { value: '', label: 'No estimate' },
  { value: '⏱️15m', label: '15 minutes' },
  { value: '⏱️30m', label: '30 minutes' },
  { value: '⏱️1h', label: '1 hour' },
  { value: '⏱️2h', label: '2 hours' },
  { value: '⏱️4h', label: '4 hours' },
  { value: '⏱️1d', label: '1 day' },
];

export function TaskDetailMeta({
  task,
  projects,
  projectsMap,
  editingDueDate,
  dueDateValue,
  onDueDateStartEdit,
  onDueDateChange,
  onDueDateSave,
  onDueDateCancel,
  editingPriority,
  priorityValue,
  onPriorityStartEdit,
  onPriorityChange,
  onPrioritySave,
  editingProject,
  projectValue,
  onProjectStartEdit,
  onProjectChange,
  onProjectSave,
  editingTimeEstimate,
  timeEstimateValue,
  onTimeEstimateStartEdit,
  onTimeEstimateChange,
  onTimeEstimateSave,
  isSaving,
}: TaskDetailMetaProps) {
  const dueDate = task.due?.date ? parseISO(task.due.date) : null;
  const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate);
  const isDueToday = dueDate && isToday(dueDate);
  const projectName = task.projectId ? projectsMap[task.projectId]?.name : null;

  // Get current time estimate display
  const currentTimeEstimate = (task.labels || []).find((l) => l.startsWith('⏱️')) || '';
  const timeEstimateDisplay = timeEstimateOptions.find(
    (opt) => opt.value === currentTimeEstimate
  )?.label;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Due Date */}
      <div
        onClick={() => !editingDueDate && !task.isCompleted && onDueDateStartEdit()}
        className={clsx(
          GRID_CELL_CLASS,
          editingDueDate
            ? 'border-danny-300 bg-white'
            : isOverdue
            ? 'bg-red-50 border-red-200'
            : isDueToday
            ? 'bg-danny-50 border-danny-200'
            : 'bg-zinc-50 border-zinc-200',
          !task.isCompleted && !editingDueDate && 'cursor-pointer hover:border-danny-300 hover:shadow-sm group'
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <Calendar
            className={clsx(
              'w-4 h-4',
              editingDueDate
                ? 'text-danny-500'
                : isOverdue
                ? 'text-red-500'
                : isDueToday
                ? 'text-danny-500'
                : 'text-zinc-500'
            )}
          />
          <span className="text-xs font-medium text-zinc-500">Due Date</span>
          {!task.isCompleted && !editingDueDate && (
            <Pencil className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 text-zinc-400 transition-opacity" />
          )}
        </div>
        {editingDueDate ? (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dueDateValue}
              onChange={(e) => onDueDateChange(e.target.value)}
              onBlur={onDueDateSave}
              onKeyDown={(e) => {
                if (e.key === 'Escape') onDueDateCancel();
                if (e.key === 'Enter') onDueDateSave();
              }}
              disabled={isSaving}
              autoFocus
              className="flex-1 text-sm px-2 py-1 border border-danny-200 rounded focus:outline-none focus:ring-2 focus:ring-danny-500"
            />
          </div>
        ) : (
          <p
            className={clsx(
              'text-sm font-medium',
              isOverdue ? 'text-red-600' : isDueToday ? 'text-danny-600' : 'text-zinc-700'
            )}
          >
            {dueDate ? format(dueDate, 'MMM d, yyyy') : 'No due date'}
          </p>
        )}
      </div>

      {/* Priority */}
      <div
        onClick={() => !editingPriority && !task.isCompleted && onPriorityStartEdit()}
        className={clsx(
          GRID_CELL_CLASS,
          editingPriority ? 'border-danny-300 bg-white' : priorityColors[task.priority] || 'bg-zinc-50 border-zinc-200',
          !task.isCompleted && !editingPriority && 'cursor-pointer hover:border-danny-300 hover:shadow-sm group'
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <Flag className={clsx('w-4 h-4', editingPriority ? 'text-danny-500' : 'text-current opacity-75')} />
          <span className="text-xs font-medium text-zinc-500">Priority</span>
          {!task.isCompleted && !editingPriority && (
            <Pencil className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 text-zinc-400 transition-opacity" />
          )}
        </div>
        {editingPriority ? (
          <Select
            value={String(priorityValue)}
            onChange={(e) => onPriorityChange(Number(e.target.value))}
            onBlur={onPrioritySave}
            disabled={isSaving}
            autoFocus
            size="sm"
          >
            <option value="4">Urgent</option>
            <option value="3">High</option>
            <option value="2">Medium</option>
            <option value="1">Low</option>
          </Select>
        ) : (
          <p className="text-sm font-medium">{priorityLabels[task.priority]}</p>
        )}
      </div>

      {/* Project */}
      <div
        onClick={() => !editingProject && !task.isCompleted && onProjectStartEdit()}
        className={clsx(
          GRID_CELL_CLASS,
          editingProject ? 'border-danny-300 bg-white' : 'bg-zinc-50 border-zinc-200',
          !task.isCompleted && !editingProject && 'cursor-pointer hover:border-danny-300 hover:shadow-sm group'
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <FolderKanban className={clsx('w-4 h-4', editingProject ? 'text-danny-500' : 'text-zinc-500')} />
          <span className="text-xs font-medium text-zinc-500">Project</span>
          {!task.isCompleted && !editingProject && (
            <Pencil className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 text-zinc-400 transition-opacity" />
          )}
        </div>
        {editingProject ? (
          <Select
            value={projectValue}
            onChange={(e) => onProjectChange(e.target.value)}
            onBlur={onProjectSave}
            disabled={isSaving}
            autoFocus
            size="sm"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        ) : (
          <p className="text-sm font-medium text-zinc-700">{projectName || 'No project'}</p>
        )}
      </div>

      {/* Time Estimate */}
      <div
        onClick={() => !editingTimeEstimate && !task.isCompleted && onTimeEstimateStartEdit()}
        className={clsx(
          GRID_CELL_CLASS,
          editingTimeEstimate ? 'border-danny-300 bg-white' : 'bg-zinc-50 border-zinc-200',
          !task.isCompleted && !editingTimeEstimate && 'cursor-pointer hover:border-danny-300 hover:shadow-sm group'
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <Clock className={clsx('w-4 h-4', editingTimeEstimate ? 'text-danny-500' : 'text-zinc-500')} />
          <span className="text-xs font-medium text-zinc-500">Estimate</span>
          {!task.isCompleted && !editingTimeEstimate && (
            <Pencil className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 text-zinc-400 transition-opacity" />
          )}
        </div>
        {editingTimeEstimate ? (
          <Select
            value={timeEstimateValue}
            onChange={(e) => onTimeEstimateChange(e.target.value)}
            onBlur={onTimeEstimateSave}
            disabled={isSaving}
            autoFocus
            size="sm"
          >
            {timeEstimateOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        ) : (
          <p className="text-sm font-medium text-zinc-700">{timeEstimateDisplay || 'No estimate'}</p>
        )}
      </div>
    </div>
  );
}

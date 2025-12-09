/**
 * Filter Display Component
 * 
 * Shows the active filter criteria above the task list.
 */

import { X, Save, Filter } from 'lucide-react';
import type { ViewFilterConfig } from '../types';

interface FilterDisplayProps {
  filterConfig: ViewFilterConfig;
  isTemporary?: boolean;
  onSave?: () => void;
  onClear: () => void;
}

export function FilterDisplay({
  filterConfig,
  isTemporary = false,
  onSave,
  onClear,
}: FilterDisplayProps) {
  // Convert filter config to human-readable format
  const filterParts: string[] = [];

  if (filterConfig.dueWithin) {
    const duePeriods: Record<string, string> = {
      today: 'Due Today',
      '7d': 'Due This Week',
      '14d': 'Due Next 2 Weeks',
      '30d': 'Due This Month',
    };
    filterParts.push(duePeriods[filterConfig.dueWithin] || `Due within ${filterConfig.dueWithin}`);
  }

  if (filterConfig.overdue) {
    filterParts.push('Overdue');
  }

  if (filterConfig.priority && filterConfig.priority.length > 0) {
    const priorities = filterConfig.priority.sort((a, b) => b - a);
    if (priorities.length === 1) {
      filterParts.push(`Priority ${priorities[0]}`);
    } else {
      filterParts.push(`Priority ${priorities.join(', ')}`);
    }
  }

  if (filterConfig.categories && filterConfig.categories.length > 0) {
    if (filterConfig.categories.length === 1) {
      filterParts.push(`Category: ${filterConfig.categories[0]}`);
    } else {
      filterParts.push(`Categories: ${filterConfig.categories.join(', ')}`);
    }
  }

  if (filterConfig.projectId) {
    filterParts.push(`Project: ${filterConfig.projectId}`);
  }

  if (filterConfig.completed !== undefined) {
    filterParts.push(filterConfig.completed ? 'Completed' : 'Incomplete');
  }

  if (filterConfig.limit) {
    filterParts.push(`Limit: ${filterConfig.limit}`);
  }

  const filterText = filterParts.length > 0 ? filterParts.join(' • ') : 'Custom Filter';

  return (
    <div className="px-4 py-2 bg-danny-50 border-b border-danny-100 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Filter className="w-4 h-4 text-danny-600 flex-shrink-0" />
        <span className="text-sm font-medium text-danny-900 truncate">
          {filterText}
        </span>
        {isTemporary && (
          <span className="text-xs px-2 py-0.5 bg-danny-100 text-danny-700 rounded-full flex-shrink-0">
            Temporary
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {isTemporary && onSave && (
          <button
            onClick={onSave}
            className="px-3 py-1 text-sm font-medium text-danny-700 hover:text-danny-900 hover:bg-danny-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            aria-label="Save view"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
        )}
        <button
          onClick={onClear}
          className="p-1 text-danny-600 hover:text-danny-900 hover:bg-danny-100 rounded-lg transition-colors cursor-pointer"
          aria-label="Clear filter"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}


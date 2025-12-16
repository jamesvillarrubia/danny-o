/**
 * Quick Filters Component
 * 
 * Compact toolbar for sorting and filtering tasks.
 * Designed to sit alongside or below the view tabs.
 */

import { ArrowUpDown, Check, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

export type SortOption = 'due' | 'priority' | 'created' | 'title';
export type SortDirection = 'asc' | 'desc';

export interface QuickFiltersProps {
  sortBy: SortOption;
  sortDirection: SortDirection;
  showCompleted: boolean;
  onSortChange: (sortBy: SortOption, direction: SortDirection) => void;
  onShowCompletedChange: (show: boolean) => void;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'due', label: 'Due Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'created', label: 'Created' },
  { value: 'title', label: 'Title' },
];

export function QuickFilters({
  sortBy,
  sortDirection,
  showCompleted,
  onSortChange,
  onShowCompletedChange,
}: QuickFiltersProps) {
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentSortLabel = sortOptions.find((o) => o.value === sortBy)?.label || 'Sort';

  const handleSortSelect = (option: SortOption) => {
    // If clicking the same option, toggle direction
    if (option === sortBy) {
      onSortChange(option, sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New option, default to descending for priority, ascending for others
      const defaultDirection = option === 'priority' ? 'desc' : 'asc';
      onSortChange(option, defaultDirection);
    }
    setIsSortOpen(false);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-zinc-50 border-b border-zinc-200">
      {/* Sort Dropdown */}
      <div className="relative" ref={sortRef}>
        <button
          onClick={() => setIsSortOpen(!isSortOpen)}
          className={clsx(
            'flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors cursor-pointer',
            'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
          )}
        >
          <ArrowUpDown className="w-3 h-3" />
          <span>{currentSortLabel}</span>
          <span className="text-zinc-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
          <ChevronDown className={clsx('w-3 h-3 text-zinc-400 transition-transform', isSortOpen && 'rotate-180')} />
        </button>

        {isSortOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-zinc-200 rounded-md shadow-lg z-50 min-w-[120px] py-1 animate-fade-in">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSortSelect(option.value)}
                className={clsx(
                  'w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors cursor-pointer',
                  sortBy === option.value
                    ? 'bg-danny-50 text-danny-700'
                    : 'text-zinc-700 hover:bg-zinc-50'
                )}
              >
                <span>{option.label}</span>
                {sortBy === option.value && (
                  <span className="text-danny-500 text-[10px]">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-zinc-200" />

      {/* Show Completed Toggle */}
      <button
        onClick={() => onShowCompletedChange(!showCompleted)}
        className={clsx(
          'flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors cursor-pointer',
          showCompleted
            ? 'text-danny-700 bg-danny-50'
            : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
        )}
      >
        <div className={clsx(
          'w-3 h-3 rounded border flex items-center justify-center transition-colors',
          showCompleted
            ? 'bg-danny-500 border-danny-500'
            : 'border-zinc-300 bg-white'
        )}>
          {showCompleted && <Check className="w-2 h-2 text-white" />}
        </div>
        <span>Done</span>
      </button>
    </div>
  );
}

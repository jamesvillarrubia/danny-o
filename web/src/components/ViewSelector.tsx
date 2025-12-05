/**
 * View Selector Component
 * 
 * Dropdown/tabs to switch between saved task views.
 */

import { Calendar, Star, ListTodo, Clock, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import type { View } from '../types';

interface ViewSelectorProps {
  views: View[];
  currentView: string;
  onViewChange: (viewSlug: string) => void;
  isLoading?: boolean;
}

// Icon mapping for default views
const viewIcons: Record<string, React.ReactNode> = {
  today: <Calendar className="w-4 h-4" />,
  'this-week': <Clock className="w-4 h-4" />,
  'high-priority': <Star className="w-4 h-4" />,
  all: <ListTodo className="w-4 h-4" />,
};

export function ViewSelector({
  views,
  currentView,
  onViewChange,
  isLoading,
}: ViewSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeView = views.find((v) => v.slug === currentView) || views[0];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show tabs on desktop, dropdown on mobile
  return (
    <div className="flex-shrink-0 bg-white border-b border-zinc-200">
      {/* Desktop: Tab-style view */}
      <div className="hidden sm:flex items-center gap-1 px-4 py-2">
        {views.map((view) => (
          <button
            key={view.slug}
            onClick={() => onViewChange(view.slug)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
              currentView === view.slug
                ? 'bg-danny-50 text-danny-700 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
            )}
          >
            <span className={clsx(
              currentView === view.slug ? 'text-danny-500' : 'text-zinc-400'
            )}>
              {viewIcons[view.slug] || <ListTodo className="w-4 h-4" />}
            </span>
            {view.name}
          </button>
        ))}
      </div>

      {/* Mobile: Dropdown */}
      <div className="sm:hidden relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          disabled={isLoading}
        >
          <div className="flex items-center gap-2">
            <span className="text-danny-500">
              {viewIcons[activeView?.slug] || <ListTodo className="w-4 h-4" />}
            </span>
            <span className="font-medium text-zinc-900">
              {activeView?.name || 'Select View'}
            </span>
          </div>
          <ChevronDown
            className={clsx(
              'w-5 h-5 text-zinc-400 transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-zinc-200 shadow-lg z-50 animate-fade-in">
            {views.map((view) => (
              <button
                key={view.slug}
                onClick={() => {
                  onViewChange(view.slug);
                  setIsOpen(false);
                }}
                className={clsx(
                  'w-full flex items-center gap-2 px-4 py-3 text-left transition-colors',
                  currentView === view.slug
                    ? 'bg-danny-50 text-danny-700'
                    : 'text-zinc-700 hover:bg-zinc-50'
                )}
              >
                <span className={clsx(
                  currentView === view.slug ? 'text-danny-500' : 'text-zinc-400'
                )}>
                  {viewIcons[view.slug] || <ListTodo className="w-4 h-4" />}
                </span>
                {view.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


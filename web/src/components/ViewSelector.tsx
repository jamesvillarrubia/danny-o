/**
 * View Selector Component
 * 
 * Dropdown/tabs to switch between saved task views.
 * Includes special "Filler" tab for time-based suggestions.
 */

import { Calendar, Star, ListTodo, Clock, ChevronDown, Hourglass, BarChart3 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import type { View } from '../types';

interface ViewSelectorProps {
  views: View[];
  currentView: string;
  onViewChange: (viewSlug: string) => void;
  isLoading?: boolean;
  /** Whether to show the special Filler tab */
  showFillerTab?: boolean;
  /** Called when Filler tab is selected */
  onFillerClick?: () => void;
  /** Whether Filler tab is currently active */
  isFillerActive?: boolean;
  /** Whether to show the Insights tab */
  showInsightsTab?: boolean;
  /** Called when Insights tab is selected */
  onInsightsClick?: () => void;
  /** Whether Insights tab is currently active */
  isInsightsActive?: boolean;
}

// Icon mapping for default views (using smaller icons for compact design)
const viewIcons: Record<string, React.ReactNode> = {
  today: <Calendar className="w-3.5 h-3.5" />,
  'this-week': <Clock className="w-3.5 h-3.5" />,
  'high-priority': <Star className="w-3.5 h-3.5" />,
  all: <ListTodo className="w-3.5 h-3.5" />,
};

export function ViewSelector({
  views,
  currentView,
  onViewChange,
  isLoading,
  showFillerTab = true,
  onFillerClick,
  isFillerActive = false,
  showInsightsTab = true,
  onInsightsClick,
  isInsightsActive = false,
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
      {/* Desktop: Compact tab-style view */}
      <div className="hidden sm:flex items-center gap-0.5 px-3 py-1">
        {views.map((view) => (
          <button
            key={view.slug}
            onClick={() => {
              onViewChange(view.slug);
            }}
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer',
              currentView === view.slug && !isFillerActive
                ? 'bg-danny-50 text-danny-700'
                : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
            )}
          >
            <span className={clsx(
              currentView === view.slug && !isFillerActive ? 'text-danny-500' : 'text-zinc-400'
            )}>
              {viewIcons[view.slug] || <ListTodo className="w-3.5 h-3.5" />}
            </span>
            {view.name}
          </button>
        ))}
        
        {/* Filler Tab - Special tab for time-based suggestions */}
        {showFillerTab && (
          <>
            <div className="w-px h-4 bg-zinc-200 mx-1" />
            <button
              onClick={onFillerClick}
              className={clsx(
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer',
                isFillerActive
                  ? 'bg-gradient-to-r from-danny-50 to-orange-50 text-danny-700 ring-1 ring-danny-200'
                  : 'text-zinc-500 hover:text-zinc-800 hover:bg-gradient-to-r hover:from-zinc-50 hover:to-orange-50'
              )}
            >
              <span className={clsx(
                isFillerActive ? 'text-danny-500' : 'text-zinc-400'
              )}>
                <Hourglass className="w-3.5 h-3.5" />
              </span>
              Filler
            </button>
          </>
        )}

        {/* Insights Tab - Productivity analytics */}
        {showInsightsTab && (
          <>
            <div className="w-px h-4 bg-zinc-200 mx-1" />
            <button
              onClick={onInsightsClick}
              className={clsx(
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer',
                isInsightsActive
                  ? 'bg-gradient-to-r from-blue-50 to-violet-50 text-blue-700 ring-1 ring-blue-200'
                  : 'text-zinc-500 hover:text-zinc-800 hover:bg-gradient-to-r hover:from-blue-50 hover:to-violet-50'
              )}
            >
              <span className={clsx(
                isInsightsActive ? 'text-blue-500' : 'text-zinc-400'
              )}>
                <BarChart3 className="w-3.5 h-3.5" />
              </span>
              Insights
            </button>
          </>
        )}
      </div>

      {/* Mobile: Compact dropdown */}
      <div className="sm:hidden relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-left cursor-pointer hover:bg-zinc-50 transition-colors disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-danny-500">
              {isFillerActive 
                ? <Hourglass className="w-3.5 h-3.5" />
                : viewIcons[activeView?.slug] || <ListTodo className="w-3.5 h-3.5" />
              }
            </span>
            <span className="font-medium text-zinc-900 text-sm">
              {isFillerActive ? 'Filler' : (activeView?.name || 'Select View')}
            </span>
          </div>
          <ChevronDown
            className={clsx(
              'w-4 h-4 text-zinc-400 transition-transform',
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
                  'w-full flex items-center gap-1.5 px-3 py-2 text-left text-sm transition-colors cursor-pointer',
                  currentView === view.slug && !isFillerActive
                    ? 'bg-danny-50 text-danny-700'
                    : 'text-zinc-700 hover:bg-zinc-50'
                )}
              >
                <span className={clsx(
                  currentView === view.slug && !isFillerActive ? 'text-danny-500' : 'text-zinc-400'
                )}>
                  {viewIcons[view.slug] || <ListTodo className="w-3.5 h-3.5" />}
                </span>
                {view.name}
              </button>
            ))}
            
            {/* Filler Tab in Mobile */}
            {showFillerTab && (
              <>
                <div className="h-px bg-zinc-200" />
                <button
                  onClick={() => {
                    onFillerClick?.();
                    setIsOpen(false);
                  }}
                  className={clsx(
                    'w-full flex items-center gap-1.5 px-3 py-2 text-left text-sm transition-colors cursor-pointer',
                    isFillerActive
                      ? 'bg-gradient-to-r from-danny-50 to-orange-50 text-danny-700'
                      : 'text-zinc-700 hover:bg-zinc-50'
                  )}
                >
                  <span className={clsx(
                    isFillerActive ? 'text-danny-500' : 'text-zinc-400'
                  )}>
                    <Hourglass className="w-3.5 h-3.5" />
                  </span>
                  Filler
                </button>
              </>
            )}

            {/* Insights Tab in Mobile */}
            {showInsightsTab && (
              <>
                <div className="h-px bg-zinc-200" />
                <button
                  onClick={() => {
                    onInsightsClick?.();
                    setIsOpen(false);
                  }}
                  className={clsx(
                    'w-full flex items-center gap-1.5 px-3 py-2 text-left text-sm transition-colors cursor-pointer',
                    isInsightsActive
                      ? 'bg-gradient-to-r from-blue-50 to-violet-50 text-blue-700'
                      : 'text-zinc-700 hover:bg-zinc-50'
                  )}
                >
                  <span className={clsx(
                    isInsightsActive ? 'text-blue-500' : 'text-zinc-400'
                  )}>
                    <BarChart3 className="w-3.5 h-3.5" />
                  </span>
                  Insights
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


/**
 * Filter Context
 *
 * Manages filter and view state for task filtering:
 * - Current view selection
 * - Active filter (from chat or temporary)
 * - Sort configuration
 * - Show completed toggle
 */

import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react';
import type { ViewFilterConfig } from '../types';
import type { SortConfig } from '../lib/taskFilters';

// ==================== Types ====================

/**
 * Sort options for tasks.
 */
type SortOption = 'due' | 'priority' | 'created' | 'title';
type SortDirection = 'asc' | 'desc';

/**
 * Filter state shape.
 */
interface FilterState {
  /** Current view slug */
  currentView: string;
  /** Active filter (from chat, overrides view filter) */
  activeFilter: ViewFilterConfig | null;
  /** Sort field */
  sortBy: SortOption;
  /** Sort direction */
  sortDirection: SortDirection;
  /** Whether to show completed tasks */
  showCompleted: boolean;
}

/**
 * Filter actions.
 */
type FilterAction =
  | { type: 'SET_VIEW'; viewSlug: string }
  | { type: 'SET_ACTIVE_FILTER'; filter: ViewFilterConfig | null }
  | { type: 'CLEAR_ACTIVE_FILTER' }
  | { type: 'SET_SORT'; sortBy: SortOption; direction: SortDirection }
  | { type: 'SET_SHOW_COMPLETED'; show: boolean }
  | { type: 'RESET_FILTERS' };

/**
 * Filter context value.
 */
interface FilterContextValue {
  state: FilterState;
  /** Get the current sort config */
  sortConfig: SortConfig;
  // View management
  setCurrentView: (viewSlug: string) => void;
  // Filter management
  setActiveFilter: (filter: ViewFilterConfig | null) => void;
  clearActiveFilter: () => void;
  // Sort management
  setSortBy: (sortBy: SortOption) => void;
  setSortDirection: (direction: SortDirection) => void;
  setSort: (sortBy: SortOption, direction: SortDirection) => void;
  // Completed toggle
  setShowCompleted: (show: boolean) => void;
  toggleShowCompleted: () => void;
  // Reset
  resetFilters: () => void;
}

// ==================== Initial State ====================

const initialState: FilterState = {
  currentView: 'today',
  activeFilter: null,
  sortBy: 'due',
  sortDirection: 'asc',
  showCompleted: false,
};

// ==================== Reducer ====================

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'SET_VIEW':
      // Clear active filter when changing views
      return { 
        ...state, 
        currentView: action.viewSlug,
        activeFilter: null,
      };
    
    case 'SET_ACTIVE_FILTER':
      return { ...state, activeFilter: action.filter };
    
    case 'CLEAR_ACTIVE_FILTER':
      return { ...state, activeFilter: null };
    
    case 'SET_SORT':
      return { 
        ...state, 
        sortBy: action.sortBy,
        sortDirection: action.direction,
      };
    
    case 'SET_SHOW_COMPLETED':
      return { ...state, showCompleted: action.show };
    
    case 'RESET_FILTERS':
      return initialState;
    
    default:
      return state;
  }
}

// ==================== Context ====================

const FilterContext = createContext<FilterContextValue | null>(null);

// ==================== Provider ====================

interface FilterProviderProps {
  children: ReactNode;
  /** Optional initial view slug */
  initialView?: string;
}

export function FilterProvider({ children, initialView }: FilterProviderProps) {
  const [state, dispatch] = useReducer(filterReducer, {
    ...initialState,
    currentView: initialView ?? initialState.currentView,
  });

  // Derived sort config
  const sortConfig: SortConfig = {
    sortBy: state.sortBy,
    direction: state.sortDirection,
  };

  // View management
  const setCurrentView = useCallback((viewSlug: string) => {
    dispatch({ type: 'SET_VIEW', viewSlug });
  }, []);

  // Filter management
  const setActiveFilter = useCallback((filter: ViewFilterConfig | null) => {
    dispatch({ type: 'SET_ACTIVE_FILTER', filter });
  }, []);

  const clearActiveFilter = useCallback(() => {
    dispatch({ type: 'CLEAR_ACTIVE_FILTER' });
  }, []);

  // Sort management
  const setSortBy = useCallback((sortBy: SortOption) => {
    dispatch({ type: 'SET_SORT', sortBy, direction: state.sortDirection });
  }, [state.sortDirection]);

  const setSortDirection = useCallback((direction: SortDirection) => {
    dispatch({ type: 'SET_SORT', sortBy: state.sortBy, direction });
  }, [state.sortBy]);

  const setSort = useCallback((sortBy: SortOption, direction: SortDirection) => {
    dispatch({ type: 'SET_SORT', sortBy, direction });
  }, []);

  // Completed toggle
  const setShowCompleted = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_COMPLETED', show });
  }, []);

  const toggleShowCompleted = useCallback(() => {
    dispatch({ type: 'SET_SHOW_COMPLETED', show: !state.showCompleted });
  }, [state.showCompleted]);

  // Reset
  const resetFilters = useCallback(() => {
    dispatch({ type: 'RESET_FILTERS' });
  }, []);

  const value: FilterContextValue = {
    state,
    sortConfig,
    setCurrentView,
    setActiveFilter,
    clearActiveFilter,
    setSortBy,
    setSortDirection,
    setSort,
    setShowCompleted,
    toggleShowCompleted,
    resetFilters,
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

// ==================== Hook ====================

/**
 * Hook to access filter context.
 *
 * @throws Error if used outside of FilterProvider
 *
 * @example
 * ```tsx
 * const { state, setCurrentView, setActiveFilter, sortConfig } = useFilter();
 *
 * // Change view
 * setCurrentView('today');
 *
 * // Apply a filter from chat
 * setActiveFilter({ priority: [3, 4], completed: false });
 *
 * // Use sort config with filterTasks
 * const sorted = sortTasks(tasks, sortConfig);
 * ```
 */
export function useFilter(): FilterContextValue {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
}

// Export types for consumers
export type { FilterState, SortOption, SortDirection };

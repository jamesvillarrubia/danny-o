/**
 * UI Context
 *
 * Manages UI state for the application including:
 * - Selected task
 * - Modal/panel visibility
 * - Active panel (tasks, filler, insights)
 */

import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react';
import type { Task, DebugPayload } from '../types';

// ==================== Types ====================

/**
 * The active main panel in the app.
 */
type ActivePanel = 'tasks' | 'filler' | 'insights';

/**
 * UI state shape.
 */
interface UIState {
  /** Currently selected task (shown in detail panel) */
  selectedTask: Task | null;
  /** Which main panel is active */
  activePanel: ActivePanel;
  /** Whether settings modal is open */
  showSettings: boolean;
  /** Whether task form modal is open */
  showTaskForm: boolean;
  /** Whether debug panel is open */
  showDebugPanel: boolean;
  /** Task being edited (in form) */
  editingTask: Task | null;
  /** Debug data for the debug panel */
  debugData: DebugPayload | null;
}

/**
 * UI actions.
 */
type UIAction =
  | { type: 'SELECT_TASK'; task: Task | null }
  | { type: 'SET_ACTIVE_PANEL'; panel: ActivePanel }
  | { type: 'SHOW_SETTINGS'; show: boolean }
  | { type: 'SHOW_TASK_FORM'; show: boolean; editingTask?: Task | null }
  | { type: 'SHOW_DEBUG_PANEL'; show: boolean }
  | { type: 'SET_DEBUG_DATA'; data: DebugPayload | null }
  | { type: 'CLOSE_ALL_MODALS' };

/**
 * UI context value.
 */
interface UIContextValue {
  state: UIState;
  // Task selection
  selectTask: (task: Task | null) => void;
  clearSelectedTask: () => void;
  // Panel navigation
  setActivePanel: (panel: ActivePanel) => void;
  showTasksPanel: () => void;
  showFillerPanel: () => void;
  showInsightsPanel: () => void;
  // Modals
  openSettings: () => void;
  closeSettings: () => void;
  openTaskForm: (editingTask?: Task | null) => void;
  closeTaskForm: () => void;
  openDebugPanel: () => void;
  closeDebugPanel: () => void;
  setDebugData: (data: DebugPayload | null) => void;
  closeAllModals: () => void;
}

// ==================== Initial State ====================

const initialState: UIState = {
  selectedTask: null,
  activePanel: 'tasks',
  showSettings: false,
  showTaskForm: false,
  showDebugPanel: false,
  editingTask: null,
  debugData: null,
};

// ==================== Reducer ====================

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'SELECT_TASK':
      return { ...state, selectedTask: action.task };
    
    case 'SET_ACTIVE_PANEL':
      // Clear task selection when switching panels
      return { 
        ...state, 
        activePanel: action.panel,
        selectedTask: null,
      };
    
    case 'SHOW_SETTINGS':
      return { ...state, showSettings: action.show };
    
    case 'SHOW_TASK_FORM':
      return { 
        ...state, 
        showTaskForm: action.show,
        editingTask: action.show ? (action.editingTask ?? null) : null,
      };
    
    case 'SHOW_DEBUG_PANEL':
      return { ...state, showDebugPanel: action.show };
    
    case 'SET_DEBUG_DATA':
      return { ...state, debugData: action.data };
    
    case 'CLOSE_ALL_MODALS':
      return {
        ...state,
        showSettings: false,
        showTaskForm: false,
        showDebugPanel: false,
        editingTask: null,
      };
    
    default:
      return state;
  }
}

// ==================== Context ====================

const UIContext = createContext<UIContextValue | null>(null);

// ==================== Provider ====================

interface UIProviderProps {
  children: ReactNode;
}

export function UIProvider({ children }: UIProviderProps) {
  const [state, dispatch] = useReducer(uiReducer, initialState);

  // Task selection
  const selectTask = useCallback((task: Task | null) => {
    dispatch({ type: 'SELECT_TASK', task });
  }, []);

  const clearSelectedTask = useCallback(() => {
    dispatch({ type: 'SELECT_TASK', task: null });
  }, []);

  // Panel navigation
  const setActivePanel = useCallback((panel: ActivePanel) => {
    dispatch({ type: 'SET_ACTIVE_PANEL', panel });
  }, []);

  const showTasksPanel = useCallback(() => {
    dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'tasks' });
  }, []);

  const showFillerPanel = useCallback(() => {
    dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'filler' });
  }, []);

  const showInsightsPanel = useCallback(() => {
    dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'insights' });
  }, []);

  // Modals
  const openSettings = useCallback(() => {
    dispatch({ type: 'SHOW_SETTINGS', show: true });
  }, []);

  const closeSettings = useCallback(() => {
    dispatch({ type: 'SHOW_SETTINGS', show: false });
  }, []);

  const openTaskForm = useCallback((editingTask?: Task | null) => {
    dispatch({ type: 'SHOW_TASK_FORM', show: true, editingTask });
  }, []);

  const closeTaskForm = useCallback(() => {
    dispatch({ type: 'SHOW_TASK_FORM', show: false });
  }, []);

  const openDebugPanel = useCallback(() => {
    dispatch({ type: 'SHOW_DEBUG_PANEL', show: true });
  }, []);

  const closeDebugPanel = useCallback(() => {
    dispatch({ type: 'SHOW_DEBUG_PANEL', show: false });
  }, []);

  const setDebugData = useCallback((data: DebugPayload | null) => {
    dispatch({ type: 'SET_DEBUG_DATA', data });
  }, []);

  const closeAllModals = useCallback(() => {
    dispatch({ type: 'CLOSE_ALL_MODALS' });
  }, []);

  const value: UIContextValue = {
    state,
    selectTask,
    clearSelectedTask,
    setActivePanel,
    showTasksPanel,
    showFillerPanel,
    showInsightsPanel,
    openSettings,
    closeSettings,
    openTaskForm,
    closeTaskForm,
    openDebugPanel,
    closeDebugPanel,
    setDebugData,
    closeAllModals,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

// ==================== Hook ====================

/**
 * Hook to access UI context.
 *
 * @throws Error if used outside of UIProvider
 *
 * @example
 * ```tsx
 * const { state, selectTask, openSettings } = useUI();
 *
 * // Check if a task is selected
 * if (state.selectedTask) {
 *   // Show task detail
 * }
 *
 * // Open settings modal
 * openSettings();
 * ```
 */
export function useUI(): UIContextValue {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}

// Export types for consumers
export type { UIState, ActivePanel };

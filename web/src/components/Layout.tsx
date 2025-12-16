/**
 * Layout Component
 * 
 * Main layout shell for the dashboard with sync status indicator.
 */

import { useState, useEffect } from 'react';
import { Settings, Cloud, CloudOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { getSyncMode, syncTasks } from '../api/client';
import type { SyncMode } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  onSettingsClick?: () => void;
}

export function Layout({ children, onSettingsClick }: LayoutProps) {
  const [syncMode, setSyncMode] = useState<SyncMode | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Load sync mode on mount
  useEffect(() => {
    loadSyncMode();
  }, []);

  // Auto-sync in Todoist mode every 5 minutes
  useEffect(() => {
    if (syncMode?.mode === 'todoist') {
      const interval = setInterval(() => {
        handleAutoSync();
      }, 5 * 60 * 1000); // 5 minutes

      return () => clearInterval(interval);
    }
  }, [syncMode]);

  const loadSyncMode = async () => {
    try {
      const mode = await getSyncMode();
      setSyncMode(mode);
    } catch (err) {
      console.error('Failed to load sync mode:', err);
    }
  };

  const handleAutoSync = async () => {
    if (syncStatus === 'syncing') return; // Don't sync if already syncing

    setSyncStatus('syncing');
    try {
      await syncTasks();
      setSyncStatus('success');
      setLastSyncTime(new Date());
      // Reset to idle after 2 seconds
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (err) {
      setSyncStatus('error');
      // Reset to idle after 5 seconds
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  const handleManualSync = async () => {
    if (syncMode?.mode !== 'todoist' || syncStatus === 'syncing') return;
    await handleAutoSync();
  };

  return (
    <div className="h-screen flex flex-col bg-surface">
      {/* Header */}
      <header className="flex-shrink-0 h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          {/* Danny Logo */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-danny-400 to-danny-600 flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <h1 className="font-semibold text-zinc-900 text-lg">Danny</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Sync Status Indicator */}
          {syncMode && (
            <button
              onClick={handleManualSync}
              disabled={syncMode.mode !== 'todoist' || syncStatus === 'syncing'}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${syncMode.mode === 'todoist' 
                  ? 'hover:bg-zinc-100 text-zinc-700' 
                  : 'text-zinc-400 cursor-default'
                }
                ${syncStatus === 'syncing' ? 'cursor-wait' : ''}
              `}
              title={
                syncMode.mode === 'standalone' 
                  ? 'Local mode - no sync'
                  : lastSyncTime 
                    ? `Last synced: ${lastSyncTime.toLocaleTimeString()}`
                    : 'Click to sync now'
              }
            >
              {syncStatus === 'syncing' && (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              )}
              {syncStatus === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              )}
              {syncStatus === 'error' && (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
              {syncStatus === 'idle' && (
                syncMode.mode === 'todoist' 
                  ? <Cloud className="w-4 h-4" />
                  : <CloudOff className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {syncMode.mode === 'standalone' ? 'Local' : 'Todoist'}
              </span>
            </button>
          )}

          {/* Settings Button */}
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="p-2 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500 hover:text-zinc-700"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}


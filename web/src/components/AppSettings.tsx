/**
 * App Settings Component
 * 
 * Manages application-wide settings including Todoist sync mode.
 */

import { useState, useEffect } from 'react';
import { Settings, RefreshCw, Check, AlertCircle, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { getSyncMode, setSyncMode, detectOrphans, applyMergeDecisions, syncTasks } from '../api/client';
import { MergeConflictsModal } from './MergeConflictsModal';
import type { SyncMode, OrphanedTasksReport, MergeDecision } from '../types';

interface AppSettingsProps {
  onClose?: () => void;
}

export function AppSettings({ onClose }: AppSettingsProps) {
  const [syncMode, setSyncModeState] = useState<SyncMode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [todoistApiKey, setTodoistApiKey] = useState('');
  const [orphans, setOrphans] = useState<OrphanedTasksReport | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);

  // Load current sync mode
  useEffect(() => {
    loadSyncMode();
  }, []);

  const loadSyncMode = async () => {
    setIsLoading(true);
    try {
      const mode = await getSyncMode();
      setSyncModeState(mode);
    } catch (err: any) {
      setError(`Failed to load sync settings: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSync = async (newMode: 'standalone' | 'todoist') => {
    if (newMode === 'todoist' && !todoistApiKey.trim()) {
      setError('Please enter your Todoist API key');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // If enabling Todoist sync, check for orphans first
      if (newMode === 'todoist' && syncMode?.mode === 'standalone') {
        const orphanReport = await detectOrphans();
        if (orphanReport.requiresUserDecision) {
          setOrphans(orphanReport);
          setShowMergeModal(true);
          setIsSaving(false);
          return;
        }
      }

      await setSyncMode(newMode, newMode === 'todoist' ? todoistApiKey : undefined);
      await loadSyncMode();
      setSuccess(`Sync mode changed to ${newMode}`);
      setTodoistApiKey(''); // Clear the input after saving
    } catch (err: any) {
      setError(`Failed to update sync mode: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMergeDecisions = async (decisions: MergeDecision[]) => {
    try {
      await applyMergeDecisions(decisions);
      setShowMergeModal(false);
      setOrphans(null);

      // Now enable Todoist sync
      await setSyncMode('todoist', todoistApiKey);
      await loadSyncMode();
      setSuccess('Sync mode changed to Todoist and merge decisions applied');
      setTodoistApiKey('');
    } catch (err: any) {
      setError(`Failed to apply merge decisions: ${err.message}`);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await syncTasks();
      setSuccess(`Synced ${result.synced} tasks in ${result.duration}ms`);
    } catch (err: any) {
      setError(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-danny-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-danny-100 rounded-lg">
            <Settings className="w-6 h-6 text-danny-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
            <p className="text-sm text-zinc-600">Manage your sync preferences</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            Close
          </button>
        )}
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Sync Mode Section */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900">Sync Mode</h2>
        <p className="text-sm text-zinc-600">
          Choose how Danny syncs your tasks. Standalone mode keeps everything local, 
          while Todoist mode syncs bidirectionally with your Todoist account.
        </p>

        {/* Mode Options */}
        <div className="space-y-3">
          {/* Standalone Mode */}
          <div
            onClick={() => !isSaving && handleToggleSync('standalone')}
            className={`
              p-4 border-2 rounded-lg cursor-pointer transition-all
              ${syncMode?.mode === 'standalone'
                ? 'border-danny-500 bg-danny-50'
                : 'border-zinc-200 hover:border-zinc-300'
              }
              ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <div className="flex items-start gap-3">
              <div className={`
                p-2 rounded-lg
                ${syncMode?.mode === 'standalone' ? 'bg-danny-100' : 'bg-zinc-100'}
              `}>
                <CloudOff className={`w-5 h-5 ${syncMode?.mode === 'standalone' ? 'text-danny-600' : 'text-zinc-600'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-zinc-900">Standalone Mode</h3>
                  {syncMode?.mode === 'standalone' && (
                    <Check className="w-5 h-5 text-danny-600" />
                  )}
                </div>
                <p className="text-sm text-zinc-600 mt-1">
                  All tasks stored locally. No external sync. Best for privacy.
                </p>
              </div>
            </div>
          </div>

          {/* Todoist Mode */}
          <div
            className={`
              p-4 border-2 rounded-lg transition-all
              ${syncMode?.mode === 'todoist'
                ? 'border-danny-500 bg-danny-50'
                : 'border-zinc-200'
              }
            `}
          >
            <div className="flex items-start gap-3">
              <div className={`
                p-2 rounded-lg
                ${syncMode?.mode === 'todoist' ? 'bg-danny-100' : 'bg-zinc-100'}
              `}>
                <Cloud className={`w-5 h-5 ${syncMode?.mode === 'todoist' ? 'text-danny-600' : 'text-zinc-600'}`} />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-zinc-900">Todoist Sync</h3>
                    {syncMode?.mode === 'todoist' && (
                      <Check className="w-5 h-5 text-danny-600" />
                    )}
                  </div>
                  <p className="text-sm text-zinc-600 mt-1">
                    Bi-directional sync with Todoist. Changes flow in both directions.
                  </p>
                </div>

                {/* API Key Input (show if not in Todoist mode or no key set) */}
                {(syncMode?.mode !== 'todoist' || !syncMode?.todoistApiKeySet) && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700">
                      Todoist API Token
                    </label>
                    <input
                      type="password"
                      value={todoistApiKey}
                      onChange={(e) => setTodoistApiKey(e.target.value)}
                      placeholder="Enter your Todoist API token"
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-danny-500 text-sm"
                    />
                    <p className="text-xs text-zinc-500">
                      Get your API token from{' '}
                      <a
                        href="https://todoist.com/prefs/integrations"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-danny-600 hover:underline"
                      >
                        Todoist Settings
                      </a>
                    </p>
                  </div>
                )}

                {/* Enable/Disable Button */}
                {syncMode?.mode !== 'todoist' && (
                  <button
                    onClick={() => handleToggleSync('todoist')}
                    disabled={isSaving || !todoistApiKey.trim()}
                    className="w-full px-4 py-2 bg-danny-500 text-white rounded-lg hover:bg-danny-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enabling...
                      </>
                    ) : (
                      <>
                        <Cloud className="w-4 h-4" />
                        Enable Todoist Sync
                      </>
                    )}
                  </button>
                )}

                {/* Sync Now Button (show if in Todoist mode) */}
                {syncMode?.mode === 'todoist' && (
                  <button
                    onClick={handleSyncNow}
                    disabled={isSyncing}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Sync Now
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Merge Modal */}
      {showMergeModal && orphans && (
        <MergeConflictsModal
          orphans={orphans}
          onResolve={handleMergeDecisions}
          onCancel={() => {
            setShowMergeModal(false);
            setOrphans(null);
            setIsSaving(false);
          }}
        />
      )}
    </div>
  );
}


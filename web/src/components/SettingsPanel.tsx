/**
 * Settings Panel Component
 * 
 * Full settings modal for configuring API key, environment, and clearing cache.
 * This is shown when user clicks the settings icon (not for onboarding).
 */

import { useState, useCallback } from 'react';
import { 
  X, 
  Key, 
  Eye, 
  EyeOff, 
  Server, 
  Trash2, 
  Loader2, 
  Check, 
  AlertCircle,
  Sparkles,
  Clock,
  RefreshCw,
  Link,
  BarChart3
} from 'lucide-react';
import { testApiKey } from '../api/client';
import type { Settings, ApiEnvironment } from '../types';

interface SettingsPanelProps {
  settings: Settings;
  onSave: (settings: Partial<Settings>) => void;
  onClearCache: () => void;
  onClose: () => void;
  /** Handler to trigger estimate generation */
  onGenerateEstimates?: () => void;
  /** Whether estimates are currently being generated */
  isGeneratingEstimates?: boolean;
  /** Number of tasks without time estimates */
  tasksWithoutEstimates?: number;
  /** Handler to trigger full resync with Todoist */
  onResyncTodoist?: () => Promise<void>;
  /** Whether Todoist sync is currently in progress */
  isSyncingTodoist?: boolean;
  /** Handler to enrich URL-heavy tasks */
  onEnrichUrls?: () => Promise<void>;
  /** Whether URL enrichment is in progress */
  isEnrichingUrls?: boolean;
  /** Number of tasks that could benefit from URL enrichment */
  tasksNeedingUrlEnrichment?: number;
  /** Handler to get productivity insights */
  onGetInsights?: () => Promise<void>;
  /** Whether insights are being generated */
  isGettingInsights?: boolean;
}

/**
 * Renders the full settings panel/modal.
 * 
 * Features:
 * - API key display with visibility toggle
 * - Environment switcher (local dev vs production)
 * - Production URL configuration
 * - Clear local cache button
 */
export function SettingsPanel({ 
  settings, 
  onSave, 
  onClearCache, 
  onClose,
  onGenerateEstimates,
  isGeneratingEstimates,
  tasksWithoutEstimates = 0,
  onResyncTodoist,
  isSyncingTodoist = false,
  onEnrichUrls,
  isEnrichingUrls = false,
  tasksNeedingUrlEnrichment = 0,
  onGetInsights,
  isGettingInsights = false
}: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [environment, setEnvironment] = useState<ApiEnvironment>(settings.environment);
  const [productionUrl, setProductionUrl] = useState(settings.productionUrl || '');
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const hasChanges = 
    apiKey !== settings.apiKey || 
    environment !== settings.environment ||
    productionUrl !== (settings.productionUrl || '');

  /**
   * Validates the API key against the current environment
   */
  const handleValidateApiKey = useCallback(async () => {
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }

    setIsValidating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const isValid = await testApiKey(apiKey.trim());
      if (isValid) {
        setSuccessMessage('API key is valid!');
      } else {
        setError('Invalid API key. Please check and try again.');
      }
    } catch (err) {
      setError('Could not connect to the API. Is the server running?');
    } finally {
      setIsValidating(false);
    }
  }, [apiKey]);

  /**
   * Saves all settings changes
   */
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Validate API key if it changed
      if (apiKey !== settings.apiKey) {
        const isValid = await testApiKey(apiKey.trim());
        if (!isValid) {
          setError('Invalid API key. Please check and try again.');
          setIsSaving(false);
          return;
        }
      }

      onSave({
        apiKey: apiKey.trim(),
        environment,
        productionUrl: productionUrl.trim() || undefined,
      });

      setSuccessMessage('Settings saved!');
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      setError('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [apiKey, environment, productionUrl, settings.apiKey, onSave, onClose]);

  /**
   * Handles the clear cache action with confirmation
   */
  const handleClearCache = useCallback(() => {
    const confirmed = window.confirm(
      'This will clear all locally cached data and refetch everything from the database. Your settings will be preserved.\n\nContinue?'
    );
    
    if (confirmed) {
      onClearCache();
      setSuccessMessage('Cache cleared! Data will be refetched.');
    }
  }, [onClearCache]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
          <h2 className="text-lg font-semibold text-zinc-900">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500 hover:text-zinc-700 cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-4">
          {/* API Key + Environment Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                <Key className="w-3.5 h-3.5 inline-block mr-1" />
                API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  placeholder="Enter API key"
                  className="w-full pl-3 pr-9 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-danny-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  aria-label={showApiKey ? 'Hide' : 'Show'}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Environment */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                <Server className="w-3.5 h-3.5 inline-block mr-1" />
                Environment
              </label>
              <div className="flex rounded-lg border border-zinc-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setEnvironment('local');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-2 px-3 text-sm font-medium cursor-pointer transition-colors ${
                    environment === 'local'
                      ? 'bg-danny-500 text-white'
                      : 'bg-white text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  Local
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnvironment('production');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-2 px-3 text-sm font-medium cursor-pointer transition-colors border-l border-zinc-300 ${
                    environment === 'production'
                      ? 'bg-danny-500 text-white'
                      : 'bg-white text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  Production
                </button>
              </div>
            </div>
          </div>

          {/* Production URL - Only show when production is selected */}
          {environment === 'production' && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Production API URL
              </label>
              <input
                type="url"
                value={productionUrl}
                onChange={(e) => {
                  setProductionUrl(e.target.value);
                  setError(null);
                  setSuccessMessage(null);
                }}
                placeholder="https://your-danny-api.vercel.app"
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-danny-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {successMessage && (
            <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
              <Check className="w-4 h-4 shrink-0" />
              {successMessage}
            </div>
          )}

          {/* Operations Section - Compact inline cards */}
          <div className="pt-3 border-t border-zinc-200">
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              <Sparkles className="w-3.5 h-3.5 inline-block mr-1" />
              Operations
            </label>
            <div className="grid grid-cols-2 gap-2">
              {/* Todoist Sync */}
              {onResyncTodoist && (
                <button
                  type="button"
                  onClick={onResyncTodoist}
                  disabled={isSyncingTodoist}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  {isSyncingTodoist ? (
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-blue-600 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-zinc-800">Resync Todoist</span>
                </button>
              )}

              {/* Generate Estimates */}
              {onGenerateEstimates && (
                <button
                  type="button"
                  onClick={onGenerateEstimates}
                  disabled={isGeneratingEstimates || tasksWithoutEstimates === 0}
                  className="flex items-center gap-2 px-3 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  {isGeneratingEstimates ? (
                    <Loader2 className="w-4 h-4 text-danny-600 animate-spin shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-danny-600 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-zinc-800">
                    Estimates
                    {tasksWithoutEstimates > 0 && (
                      <span className="ml-1 text-xs text-danny-600">({tasksWithoutEstimates})</span>
                    )}
                  </span>
                </button>
              )}

              {/* Enrich URLs */}
              {onEnrichUrls && (
                <button
                  type="button"
                  onClick={onEnrichUrls}
                  disabled={isEnrichingUrls}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  {isEnrichingUrls ? (
                    <Loader2 className="w-4 h-4 text-purple-600 animate-spin shrink-0" />
                  ) : (
                    <Link className="w-4 h-4 text-purple-600 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-zinc-800">
                    Enrich URLs
                    {tasksNeedingUrlEnrichment > 0 && (
                      <span className="ml-1 text-xs text-purple-600">({tasksNeedingUrlEnrichment})</span>
                    )}
                  </span>
                </button>
              )}

              {/* Productivity Insights */}
              {onGetInsights && (
                <button
                  type="button"
                  onClick={onGetInsights}
                  disabled={isGettingInsights}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  {isGettingInsights ? (
                    <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
                  ) : (
                    <BarChart3 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-zinc-800">Insights</span>
                </button>
              )}
            </div>
          </div>

          {/* Clear Cache - Inline with reduced prominence */}
          <div className="pt-3 border-t border-zinc-200">
            <button
              type="button"
              onClick={handleClearCache}
              className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Clear local cache
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-200 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="flex-1 py-2 bg-danny-500 text-white rounded-lg text-sm font-medium hover:bg-danny-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

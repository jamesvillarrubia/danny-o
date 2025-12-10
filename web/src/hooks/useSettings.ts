/**
 * Settings Hook
 * 
 * Manages application settings stored in localStorage.
 * Includes API key, environment configuration, and cache management.
 */

import { useState, useCallback, useEffect } from 'react';
import type { Settings, ApiEnvironment } from '../types';
import { setApiKey as setApiKeyInClient, clearApiKey, setEnvironment as setEnvInClient } from '../api/client';

const SETTINGS_KEY = 'danny_settings';

/** Local storage keys for cached data */
const CACHE_KEYS = [
  'danny_views_cache',
  'danny_tasks_cache',
  'danny_projects_cache',
];

const defaultSettings: Settings = {
  apiKey: '',
  theme: 'light',
  environment: 'local',
  productionUrl: '',
};

/**
 * Load settings from localStorage with fallback to defaults
 */
function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultSettings, ...parsed };
    }
    // Check for legacy API key storage
    const legacyKey = localStorage.getItem('danny_api_key');
    if (legacyKey) {
      return { ...defaultSettings, apiKey: legacyKey };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return defaultSettings;
}

/**
 * Save settings to localStorage and sync with API client
 */
function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    
    // Sync API key with client
    if (settings.apiKey) {
      setApiKeyInClient(settings.apiKey);
    } else {
      clearApiKey();
    }
    
    // Sync environment with client
    setEnvInClient(settings.environment, settings.productionUrl);
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

/**
 * Clear all cached data from localStorage
 */
function clearCachedData(): void {
  CACHE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error(`Failed to clear cache key ${key}:`, e);
    }
  });
}

/**
 * Hook for managing application settings
 * 
 * @returns Settings state and update functions
 * 
 * @example
 * ```tsx
 * const { settings, updateApiKey, updateEnvironment, clearCache } = useSettings();
 * 
 * // Update API key
 * updateApiKey('new-api-key');
 * 
 * // Switch to production
 * updateEnvironment('production', 'https://api.example.com');
 * 
 * // Clear cache and trigger refetch
 * clearCache();
 * ```
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  // Sync settings changes to localStorage and API client
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  /**
   * Update the API key
   */
  const updateApiKey = useCallback((apiKey: string) => {
    setSettings((prev) => ({ ...prev, apiKey }));
  }, []);

  /**
   * Update the color theme
   */
  const updateTheme = useCallback((theme: Settings['theme']) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  /**
   * Update environment settings
   * 
   * @param environment - 'local' or 'production'
   * @param productionUrl - Production API URL (required if environment is 'production')
   */
  const updateEnvironment = useCallback((environment: ApiEnvironment, productionUrl?: string) => {
    setSettings((prev) => ({ 
      ...prev, 
      environment,
      productionUrl: productionUrl || prev.productionUrl,
    }));
  }, []);

  /**
   * Update multiple settings at once
   */
  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * Clear all cached data and trigger a refetch.
   * Settings are preserved.
   */
  const clearCache = useCallback(() => {
    clearCachedData();
    // Trigger a page reload to refetch all data
    window.location.reload();
  }, []);

  /**
   * Clear all settings and reset to defaults
   */
  const clearSettings = useCallback(() => {
    setSettings(defaultSettings);
    clearApiKey();
    localStorage.removeItem(SETTINGS_KEY);
  }, []);

  return {
    settings,
    updateApiKey,
    updateTheme,
    updateEnvironment,
    updateSettings,
    clearCache,
    clearSettings,
  };
}

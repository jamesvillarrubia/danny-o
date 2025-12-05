/**
 * Settings Hook
 * 
 * Manages application settings stored in localStorage.
 */

import { useState, useCallback, useEffect } from 'react';
import type { Settings } from '../types';
import { setApiKey, clearApiKey } from '../api/client';

const SETTINGS_KEY = 'danny_settings';

const defaultSettings: Settings = {
  apiKey: '',
  theme: 'light',
};

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
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

function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    // Also update the API key in the legacy location for the client
    if (settings.apiKey) {
      setApiKey(settings.apiKey);
    } else {
      clearApiKey();
    }
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  // Sync settings changes to localStorage
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateApiKey = useCallback((apiKey: string) => {
    setSettings((prev) => ({ ...prev, apiKey }));
  }, []);

  const updateTheme = useCallback((theme: Settings['theme']) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const clearSettings = useCallback(() => {
    setSettings(defaultSettings);
    clearApiKey();
    localStorage.removeItem(SETTINGS_KEY);
  }, []);

  return {
    settings,
    updateApiKey,
    updateTheme,
    clearSettings,
  };
}


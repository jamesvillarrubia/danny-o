/**
 * Setup Wizard Page
 *
 * First-run configuration wizard for Danny Tasks.
 * Collects API keys and optional database configuration.
 * 
 * For deployed backends (postgres), database selection is hidden since
 * it's configured via environment variables on the server.
 */

import { useState, useEffect } from 'react';
import { getSetupStatus } from '../api/client';

interface SetupFormData {
  claudeApiKey: string;
  todoistApiKey: string;
  databaseType: 'embedded' | 'postgres';
  databaseUrl: string;
}

interface SetupProps {
  onComplete: () => void;
}

export function Setup({ onComplete }: SetupProps) {
  const [formData, setFormData] = useState<SetupFormData>({
    claudeApiKey: '',
    todoistApiKey: '',
    databaseType: 'embedded',
    databaseUrl: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Backend configuration - determines what options to show
  const [backendDbType, setBackendDbType] = useState<'pglite' | 'postgres' | null>(null);
  const [checkingBackend, setCheckingBackend] = useState(true);
  
  // Check backend database type on mount
  useEffect(() => {
    async function checkBackend() {
      try {
        const status = await getSetupStatus();
        setBackendDbType(status.databaseType);
        // If backend is postgres, pre-select it and hide the option
        if (status.databaseType === 'postgres') {
          setFormData(prev => ({ ...prev, databaseType: 'postgres' }));
        }
      } catch (err) {
        console.error('Failed to check backend status:', err);
        // Default to showing all options if we can't reach backend
      } finally {
        setCheckingBackend(false);
      }
    }
    checkBackend();
  }, []);
  
  // For deployed postgres backends, database is already configured
  const isDeployedBackend = backendDbType === 'postgres';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Setup failed');
      }

      // Call completion callback to re-render app
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Welcome to Danny Tasks 🎯
          </h1>
          <p className="text-gray-600">
            Let's get you set up in just a few steps
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Claude API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Claude API Key
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="password"
              required
              value={formData.claudeApiKey}
              onChange={(e) => setFormData({ ...formData, claudeApiKey: e.target.value })}
              placeholder="sk-ant-..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Get your API key from{' '}
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                console.anthropic.com
              </a>
            </p>
          </div>

          {/* Todoist API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Todoist API Key
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="password"
              required
              value={formData.todoistApiKey}
              onChange={(e) => setFormData({ ...formData, todoistApiKey: e.target.value })}
              placeholder="Your Todoist API token"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Find your token in{' '}
              <a
                href="https://todoist.com/app/settings/integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Todoist Settings → Integrations
              </a>
            </p>
          </div>

          {/* Database Selection - Only shown for self-hosted (pglite) backends */}
          {!isDeployedBackend && !checkingBackend && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Database Storage
              </label>
              
              <div className="space-y-3">
                {/* Embedded Option */}
                <label className="flex items-start p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                  <input
                    type="radio"
                    name="databaseType"
                    value="embedded"
                    checked={formData.databaseType === 'embedded'}
                    onChange={() => setFormData({ ...formData, databaseType: 'embedded', databaseUrl: '' })}
                    className="mt-1"
                  />
                  <div className="ml-3">
                    <div className="font-medium text-gray-900">
                      Embedded Database (Recommended)
                    </div>
                    <div className="text-sm text-gray-600">
                      No setup required. Perfect for personal use and getting started quickly.
                    </div>
                  </div>
                </label>

                {/* Cloud Postgres Option */}
                <label className="flex items-start p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                  <input
                    type="radio"
                    name="databaseType"
                    value="postgres"
                    checked={formData.databaseType === 'postgres'}
                    onChange={() => setFormData({ ...formData, databaseType: 'postgres' })}
                    className="mt-1"
                  />
                  <div className="ml-3">
                    <div className="font-medium text-gray-900">Cloud PostgreSQL</div>
                    <div className="text-sm text-gray-600">
                      For production or team use. Requires external database (Neon, Supabase, etc.)
                    </div>
                  </div>
                </label>
              </div>

              {/* Postgres URL Input */}
              {formData.databaseType === 'postgres' && (
                <div className="mt-3">
                  <input
                    type="text"
                    required
                    value={formData.databaseUrl}
                    onChange={(e) => setFormData({ ...formData, databaseUrl: e.target.value })}
                    placeholder="postgresql://user:password@host:5432/database"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Free PostgreSQL databases:{' '}
                    <a href="https://neon.tech" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Neon
                    </a>
                    {', '}
                    <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Supabase
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Info banner for deployed backends */}
          {isDeployedBackend && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Cloud Backend Detected:</strong> Database is already configured on the server. 
                Only API keys need to be set up.
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Setting up...' : 'Complete Setup →'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-500">
          Your API keys are encrypted and stored securely in your database.
        </div>
      </div>
    </div>
  );
}


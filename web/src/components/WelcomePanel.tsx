/**
 * Welcome Panel Component
 * 
 * Onboarding screen for new users to enter their API key.
 * This is shown only when no API key is configured.
 */

import { useState } from 'react';
import { Key, Loader2, Check, AlertCircle } from 'lucide-react';
import { testApiKey } from '../api/client';

interface WelcomePanelProps {
  onSave: (apiKey: string) => void;
}

/**
 * Renders the welcome/onboarding screen for first-time setup.
 * 
 * @param onSave - Callback when user successfully enters a valid API key
 */
export function WelcomePanel({ onSave }: WelcomePanelProps) {
  const [inputKey, setInputKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setError('API key is required');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const isValid = await testApiKey(inputKey.trim());
      if (isValid) {
        onSave(inputKey.trim());
      } else {
        setError('Invalid API key. Please check and try again.');
      }
    } catch (err) {
      setError('Could not connect to the API. Is the server running?');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-full p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-danny-400 to-danny-600 flex items-center justify-center shadow-lg mb-4">
            <span className="text-white font-bold text-2xl">D</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Welcome to Danny</h1>
          <p className="text-zinc-500 mt-1">Your AI-powered task assistant</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="apiKey"
              className="block text-sm font-medium text-zinc-700 mb-2"
            >
              API Key
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                id="apiKey"
                type="password"
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value);
                  setError(null);
                }}
                placeholder="Enter your Danny API key"
                className="w-full pl-10 pr-4 py-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-danny-500 focus:border-transparent"
                autoFocus
              />
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isValidating || !inputKey.trim()}
            className="w-full py-3 bg-danny-500 text-white rounded-lg font-medium hover:bg-danny-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          >
            {isValidating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Connect
              </>
            )}
          </button>
        </form>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-zinc-50 rounded-lg">
          <h3 className="font-medium text-zinc-900 mb-2">How to get your API key</h3>
          <ol className="text-sm text-zinc-600 space-y-2">
            <li>1. Set the <code className="bg-zinc-200 px-1 rounded">DANNY_API_KEY</code> environment variable on your server</li>
            <li>2. Use that same key here to authenticate</li>
            <li>3. For Vercel, set it in your project's Environment Variables</li>
          </ol>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-zinc-400">
          Your API key is stored locally in your browser
        </p>
      </div>
    </div>
  );
}

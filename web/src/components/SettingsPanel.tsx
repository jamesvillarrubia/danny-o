/**
 * Settings Panel Component
 * 
 * Configure API key and other settings.
 */

import { useState, useEffect } from 'react';
import { Key, Loader2, Check, AlertCircle, Copy, CheckCheck } from 'lucide-react';
import { getOrGenerateApiKey, confirmApiKey } from '../api/client';

interface SettingsPanelProps {
  apiKey: string;
  onSave: (apiKey: string) => void;
}

export function SettingsPanel({ apiKey, onSave }: SettingsPanelProps) {
  const [generatedKey, setGeneratedKey] = useState<string>('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getOrGenerateApiKey();
      setGeneratedKey(result.apiKey);
      setIsFirstTime(result.firstTime);
      
      // If already confirmed, save it immediately
      if (result.confirmed) {
        onSave(result.apiKey);
      }
    } catch (err) {
      setError('Could not connect to the API. Is the server running?');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    setError(null);

    try {
      const result = await confirmApiKey(generatedKey);
      if (result.success) {
        onSave(generatedKey);
      } else {
        setError('Failed to confirm API key. Please try again.');
      }
    } catch (err) {
      setError('Could not confirm API key. Please try again.');
    } finally {
      setIsConfirming(false);
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
    <div className="flex items-center justify-center h-full p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-danny-400 to-danny-600 flex items-center justify-center shadow-lg mb-4">
            <span className="text-white font-bold text-2xl">D</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">
            {isFirstTime ? 'Welcome to Danny' : 'Your API Key'}
          </h1>
          <p className="text-zinc-500 mt-1">
            {isFirstTime ? 'Your AI-powered task assistant' : 'Copy and save this key'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* API Key Display */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Your API Key
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="text"
                value={generatedKey}
                readOnly
                className="w-full pl-10 pr-12 py-3 border border-zinc-300 rounded-lg bg-zinc-50 font-mono text-sm"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-zinc-200 rounded transition-colors"
                title="Copy to clipboard"
              >
                {copied ? (
                  <CheckCheck className="w-5 h-5 text-green-600" />
                ) : (
                  <Copy className="w-5 h-5 text-zinc-600" />
                )}
              </button>
            </div>
          </div>

          {/* Warning Box */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">Save this key securely!</p>
                <p>Copy and store this API key in a safe place. You'll need it to connect to Danny.</p>
              </div>
            </div>
          </div>

          {/* Confirm Button */}
          <button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="w-full py-3 bg-danny-500 text-white rounded-lg font-medium hover:bg-danny-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isConfirming ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                I've Saved My Key
              </>
            )}
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-zinc-50 rounded-lg">
          <h3 className="font-medium text-zinc-900 mb-2">What is this?</h3>
          <p className="text-sm text-zinc-600">
            This API key secures your Danny instance. It's generated automatically and
            stored in your database. Keep it safe and don't share it with anyone.
          </p>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-zinc-400">
          Your API key is stored locally in your browser
        </p>
      </div>
    </div>
  );
}


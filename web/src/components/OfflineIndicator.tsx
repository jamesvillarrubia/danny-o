/**
 * Offline Indicator Component
 * 
 * Shows offline status and queued mutation count in the UI.
 */

import { WifiOff, Upload, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useOfflineQueue } from '../hooks/useOfflineQueue';

export function OfflineIndicator() {
  const { isOnline, queueCount, isProcessing, processQueue, lastProcessResult } = useOfflineQueue();

  // Don't show anything if online and no queue
  if (isOnline && queueCount === 0 && !lastProcessResult) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white border-2 border-zinc-200 rounded-lg shadow-lg overflow-hidden max-w-sm">
        {/* Offline Status */}
        {!isOnline && (
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">You're offline</p>
              <p className="text-xs text-amber-700">Changes will sync when you're back online</p>
            </div>
          </div>
        )}

        {/* Queue Status */}
        {queueCount > 0 && (
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              {isProcessing ? (
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              ) : (
                <Upload className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-zinc-900">
                {isProcessing ? 'Syncing changes...' : `${queueCount} pending change${queueCount !== 1 ? 's' : ''}`}
              </p>
              {isOnline && !isProcessing && (
                <button
                  onClick={processQueue}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-0.5"
                >
                  Sync now
                </button>
              )}
            </div>
          </div>
        )}

        {/* Last Process Result */}
        {lastProcessResult && (
          <div
            className={`px-4 py-2 text-xs flex items-center gap-2 ${
              lastProcessResult.failed > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            }`}
          >
            {lastProcessResult.failed > 0 ? (
              <>
                <XCircle className="w-4 h-4" />
                {lastProcessResult.success} synced, {lastProcessResult.failed} failed
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                All changes synced successfully
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


/**
 * Layout Component
 * 
 * Main layout shell for the dashboard.
 */

import { Settings } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onSettingsClick?: () => void;
}

export function Layout({ children, onSettingsClick }: LayoutProps) {
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

        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            className="p-2 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500 hover:text-zinc-700"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}


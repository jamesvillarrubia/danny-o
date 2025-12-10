/**
 * Debug Panel Component
 * 
 * Hidden debug panel for inspecting raw AI messages.
 * Inspired by "The Net" (1995) - click the π symbol to reveal.
 */

import { useState } from 'react';
import { X, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import type { DebugPayload } from '../types';

interface DebugPanelProps {
  debugData: DebugPayload | null;
  onClose: () => void;
}

type TabType = 'full' | 'system' | 'messages' | 'tools';

/**
 * Collapsible JSON section component
 */
function CollapsibleSection({ 
  title, 
  data, 
  defaultOpen = false 
}: { 
  title: string; 
  data: unknown; 
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-zinc-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800 hover:bg-zinc-750 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          )}
          <span className="font-mono text-sm text-zinc-200">{title}</span>
        </div>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded hover:bg-zinc-700 transition-colors"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4 text-zinc-400" />
          )}
        </button>
      </button>
      {isOpen && (
        <pre className="p-4 bg-zinc-900 overflow-x-auto text-xs font-mono text-green-400 max-h-96 overflow-y-auto">
          {jsonString}
        </pre>
      )}
    </div>
  );
}

export function DebugPanel({ debugData, onClose }: DebugPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('messages');
  const [copied, setCopied] = useState(false);

  const handleCopyAll = async () => {
    if (!debugData) return;
    await navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'messages', label: 'Messages' },
    { id: 'tools', label: 'Tools' },
    { id: 'system', label: 'System' },
    { id: 'full', label: 'Full JSON' },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-zinc-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-zinc-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700 bg-zinc-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl" title="The Net (1995)">π</span>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                Debug Console
              </h2>
              <p className="text-xs text-zinc-400">
                Raw AI message payload
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy All
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-zinc-200 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-700 bg-zinc-850">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'text-green-400 border-b-2 border-green-400 bg-zinc-800'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!debugData ? (
            <div className="text-center py-12 text-zinc-500">
              <p className="text-lg">No debug data available</p>
              <p className="text-sm mt-2">Send a message to Danny to capture debug data</p>
            </div>
          ) : (
            <>
              {activeTab === 'full' && (
                <pre className="p-4 bg-zinc-950 rounded-lg overflow-x-auto text-xs font-mono text-green-400 max-h-[60vh] overflow-y-auto border border-zinc-700">
                  {JSON.stringify(debugData, null, 2)}
                </pre>
              )}

              {activeTab === 'system' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-zinc-300 mb-2">System Prompt</h3>
                  <pre className="p-4 bg-zinc-950 rounded-lg overflow-x-auto text-xs font-mono text-amber-400 whitespace-pre-wrap border border-zinc-700">
                    {debugData.systemPrompt}
                  </pre>
                </div>
              )}

              {activeTab === 'messages' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-zinc-300">
                      Conversation ({debugData.messages.length} messages)
                    </h3>
                  </div>
                  {debugData.messages.map((msg, idx) => (
                    <CollapsibleSection
                      key={idx}
                      title={`[${idx + 1}] ${msg.role.toUpperCase()}`}
                      data={msg}
                      defaultOpen={idx === 0 || idx === debugData.messages.length - 1}
                    />
                  ))}
                </div>
              )}

              {activeTab === 'tools' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-zinc-300 mb-2">
                    Available Tools ({debugData.tools.length})
                  </h3>
                  {debugData.tools.map((tool, idx) => (
                    <CollapsibleSection
                      key={idx}
                      title={tool.name}
                      data={tool}
                      defaultOpen={false}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-700 bg-zinc-800">
          <p className="text-xs text-zinc-500 text-center">
            "Just because you're paranoid doesn't mean they're not after you." - The Net (1995)
          </p>
        </div>
      </div>
    </div>
  );
}

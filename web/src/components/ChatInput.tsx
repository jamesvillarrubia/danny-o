/**
 * Chat Input Component
 * 
 * Input for sending messages to Danny.
 */

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, X, ChevronUp, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useChat } from '../hooks/useChat';
import type { ChatResponse } from '../types';

interface ChatInputProps {
  onResponse?: (response?: ChatResponse) => void;
}

export function ChatInput({ onResponse }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, sendMessage, clearMessages } = useChat();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [input]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current && isExpanded) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isExpanded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    setIsExpanded(true);

    const response = await sendMessage(message);
    if (response?.success && onResponse) {
      onResponse(response);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex-shrink-0 border-t border-zinc-200 bg-white">
      {/* Expanded Chat History */}
      {isExpanded && messages.length > 0 && (
        <div className="border-b border-zinc-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-50">
            <span className="text-xs font-medium text-zinc-500">
              Chat with Danny
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={clearMessages}
                className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
                aria-label="Clear chat"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
                aria-label="Collapse chat"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={chatContainerRef}
            className="max-h-64 overflow-y-auto p-4 space-y-3"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={clsx(
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={clsx(
                    'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                    msg.role === 'user'
                      ? 'bg-danny-500 text-white'
                      : 'bg-zinc-100 text-zinc-900'
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-zinc-200/20 space-y-1">
                      {msg.actions.map((action, i) => (
                        <p key={i} className="text-xs opacity-75">
                          ✓ {action.description}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-zinc-100 rounded-lg px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-3">
        <div className="relative">
          {/* Collapsed indicator */}
          {!isExpanded && messages.length > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-danny-100 text-danny-600 rounded-t-lg text-xs font-medium flex items-center gap-1 hover:bg-danny-200 transition-colors"
            >
              <ChevronUp className="w-3 h-3" />
              {messages.length} messages
            </button>
          )}

          <div className="flex items-end gap-2 bg-zinc-50 rounded-xl border border-zinc-200 focus-within:border-danny-300 focus-within:ring-2 focus-within:ring-danny-100 transition-all">
            {/* Danny Icon */}
            <div className="flex-shrink-0 p-2.5">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-danny-400 to-danny-600 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Danny anything... (Shift+Enter for new line)"
              rows={1}
              className="chat-input flex-1 py-2.5 pr-2 bg-transparent resize-none focus:outline-none text-sm text-zinc-900 placeholder:text-zinc-400"
              disabled={isLoading}
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={clsx(
                'flex-shrink-0 p-2.5 rounded-lg transition-colors',
                input.trim() && !isLoading
                  ? 'text-danny-500 hover:bg-danny-50'
                  : 'text-zinc-300'
              )}
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}


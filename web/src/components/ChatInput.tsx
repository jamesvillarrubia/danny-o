/**
 * Chat Input Component
 * 
 * Input for sending messages to Danny.
 * Includes a resizable chat history panel.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles, X, ChevronUp, ChevronDown, Globe, Plus, GripHorizontal } from 'lucide-react';
import clsx from 'clsx';
import { useChat } from '../hooks/useChat';
import { usePageContext } from '../hooks/usePageContext';
import type { ChatResponse } from '../types';

/** localStorage key for persisting chat panel height */
const CHAT_HEIGHT_KEY = 'danny-chat-height';
/** Default chat history height in pixels */
const DEFAULT_CHAT_HEIGHT = 256;
/** Minimum chat history height */
const MIN_CHAT_HEIGHT = 100;
/** Maximum chat history height */
const MAX_CHAT_HEIGHT = 500;

interface ChatInputProps {
  onResponse?: (response?: ChatResponse) => void;
  onAddTask?: () => void;
}

export function ChatInput({ onResponse, onAddTask }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [chatHeight, setChatHeight] = useState(() => {
    const saved = localStorage.getItem(CHAT_HEIGHT_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_CHAT_HEIGHT;
  });
  const [isResizing, setIsResizing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

  const { messages, isLoading, sendMessage, clearMessages } = useChat();
  const { pageContext, isExtension } = usePageContext();

  // Handle resize drag
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = chatHeight;
  }, [chatHeight]);

  // Handle mouse move during resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Dragging up increases height, dragging down decreases
      const delta = resizeStartY.current - e.clientY;
      const newHeight = Math.min(MAX_CHAT_HEIGHT, Math.max(MIN_CHAT_HEIGHT, resizeStartHeight.current + delta));
      setChatHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Persist height to localStorage
      localStorage.setItem(CHAT_HEIGHT_KEY, chatHeight.toString());
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, chatHeight]);

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

    // Include page context if available from extension
    // Send HTML for server-side Readability extraction, with text as fallback
    const context = pageContext ? {
      url: pageContext.url,
      title: pageContext.title,
      html: pageContext.html?.slice(0, 100000), // HTML for Readability parsing
      text: pageContext.text?.slice(0, 5000), // Fallback plain text
      selection: pageContext.selection,
    } : undefined;

    const response = await sendMessage(message, context);
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
    <div className={clsx('flex-shrink-0 border-t border-zinc-200 bg-white', isResizing && 'select-none')}>
      {/* Resize Handle - only visible when expanded */}
      {isExpanded && messages.length > 0 && (
        <div
          onMouseDown={handleResizeMouseDown}
          className={clsx(
            'h-2 flex items-center justify-center cursor-ns-resize border-b border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition-colors group',
            isResizing && 'bg-danny-50'
          )}
          title="Drag to resize"
        >
          <GripHorizontal className={clsx(
            'w-4 h-4 text-zinc-300 group-hover:text-zinc-400 transition-colors',
            isResizing && 'text-danny-400'
          )} />
        </div>
      )}

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
                className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
                aria-label="Clear chat"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
                aria-label="Collapse chat"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={chatContainerRef}
            className="overflow-y-auto p-4 space-y-3"
            style={{ height: chatHeight }}
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
                  {msg.role === 'user' && msg.hasPageContext && (
                    <div className="flex items-center gap-1 mb-1 text-xs opacity-75">
                      <Globe className="w-3 h-3" />
                      <span>with page context</span>
                    </div>
                  )}
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
          {/* Page context indicator */}
          {isExtension && pageContext && (
            <div className="mb-2 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-xs text-blue-700">
              <Globe className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">
                Context: {pageContext.title || pageContext.url || 'Current page'}
              </span>
              {pageContext.selection && (
                <span className="flex-shrink-0 px-1.5 py-0.5 bg-blue-100 rounded text-blue-600">
                  Selected text
                </span>
              )}
            </div>
          )}

          {/* Collapsed indicator */}
          {!isExpanded && messages.length > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-danny-100 text-danny-600 rounded-t-lg text-xs font-medium flex items-center gap-1 hover:bg-danny-200 transition-colors cursor-pointer"
            >
              <ChevronUp className="w-3 h-3" />
              {messages.length} messages
            </button>
          )}

          <div className="flex items-stretch gap-2">
            {/* Add Task Button */}
            {onAddTask && (
              <button
                type="button"
                onClick={onAddTask}
                className="flex-shrink-0 px-3 rounded-xl bg-danny-500 hover:bg-danny-600 text-white transition-colors cursor-pointer flex items-center justify-center"
                aria-label="Add task"
                title="Add new task"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}

            {/* Chat Input Container */}
            <div className="flex-1 flex items-center gap-2 bg-zinc-50 rounded-xl border border-zinc-200 focus-within:border-danny-300 focus-within:ring-2 focus-within:ring-danny-100 transition-all">
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
                placeholder="Ask Danny anything..."
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
                    ? 'text-danny-500 hover:bg-danny-50 cursor-pointer'
                    : 'text-zinc-300 cursor-not-allowed'
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
        </div>
      </form>
    </div>
  );
}


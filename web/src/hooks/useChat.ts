/**
 * Chat Hook
 * 
 * Manages chat state with Danny, including conversation history
 * that's sent to the backend for context continuity.
 */

import { useState, useCallback, useRef } from 'react';
import type { ChatResponse, ChatAction, ConversationMessage } from '../types';
import { sendChatMessage, ChatMessageOptions } from '../api/client';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: ChatAction[];
  hasPageContext?: boolean;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  /**
   * Conversation history for the API.
   * This is the simplified format sent to Claude for context.
   * Uses a ref to avoid stale closure issues in callbacks.
   */
  const historyRef = useRef<ConversationMessage[]>([]);

  /**
   * Convert UI messages to API history format.
   * Excludes metadata like timestamps and actions - just role + content.
   */
  const getHistoryForApi = useCallback((): ConversationMessage[] => {
    return historyRef.current;
  }, []);

  const sendMessage = useCallback(async (
    content: string,
    pageContext?: ChatMessageOptions['pageContext']
  ): Promise<ChatResponse | null> => {
    if (!content.trim()) return null;

    const trimmedContent = content.trim();

    // Add user message to UI
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedContent,
      timestamp: new Date(),
      hasPageContext: !!pageContext,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    // Get current history to send with request
    const currentHistory = getHistoryForApi();

    try {
      // Send message with conversation history for context
      const response = await sendChatMessage(trimmedContent, pageContext, currentHistory);

      // Add assistant response to UI
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        actions: response.actions,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update history for next request
      if (response.summarizedHistory) {
        // Backend summarized the history - use the compressed version
        // Add the new exchange to the summarized history
        historyRef.current = [
          ...response.summarizedHistory,
          { role: 'user', content: trimmedContent },
          { role: 'assistant', content: response.response },
        ];
        console.log('Conversation history was summarized by backend');
      } else {
        // Normal case - append to existing history
        historyRef.current = [
          ...currentHistory,
          { role: 'user', content: trimmedContent },
          { role: 'assistant', content: response.response },
        ];
      }

      return response;
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMsg);

      // Add error message as assistant response (but don't add to history)
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I ran into an issue: ${errorMsg}`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      
      // Don't add failed exchanges to history - they'd confuse the AI
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getHistoryForApi]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    historyRef.current = [];
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    /** Current history length (for debugging) */
    historyLength: historyRef.current.length,
  };
}


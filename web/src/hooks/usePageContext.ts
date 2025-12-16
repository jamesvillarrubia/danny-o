/**
 * Page Context Hook
 * 
 * Receives page context from the browser extension via postMessage.
 * This allows the chat to have context about the current webpage.
 */

import { useState, useEffect, useCallback } from 'react';

export interface PageContext {
  url: string;
  title: string;
  text: string;
  html: string;
  meta: Record<string, string>;
  selection: string;
  timestamp: number;
}

/**
 * Hook to receive page context from the browser extension
 */
export function usePageContext() {
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [isExtension, setIsExtension] = useState(false);

  useEffect(() => {
    // Check if we're running inside an iframe (likely the extension)
    const inIframe = window !== window.parent;
    setIsExtension(inIframe);

    // Listen for page context messages from the extension
    const handleMessage = (event: MessageEvent) => {
      // Accept messages from any origin when in iframe (extension)
      if (event.data?.type === 'PAGE_CONTEXT') {
        console.log('Received page context:', event.data.context?.url);
        setPageContext(event.data.context);
      }
    };

    window.addEventListener('message', handleMessage);

    // Request initial context if we're in an iframe
    if (inIframe) {
      try {
        window.parent.postMessage({ type: 'REQUEST_PAGE_CONTEXT' }, '*');
      } catch (e) {
        console.log('Could not request page context from parent');
      }
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Request fresh context
  const refreshContext = useCallback(() => {
    if (isExtension) {
      try {
        window.parent.postMessage({ type: 'REQUEST_PAGE_CONTEXT' }, '*');
      } catch (e) {
        console.log('Could not request page context refresh');
      }
    }
  }, [isExtension]);

  // Format context for inclusion in chat message
  const formatContextForChat = useCallback((): string | null => {
    if (!pageContext) return null;

    const parts: string[] = [];

    if (pageContext.url) {
      parts.push(`URL: ${pageContext.url}`);
    }

    if (pageContext.title) {
      parts.push(`Title: ${pageContext.title}`);
    }

    // Include selected text if any
    if (pageContext.selection) {
      parts.push(`Selected text: "${pageContext.selection}"`);
    }

    // Include meta description if available
    if (pageContext.meta?.description) {
      parts.push(`Description: ${pageContext.meta.description}`);
    }

    // Include truncated page text (first 2000 chars)
    if (pageContext.text) {
      const truncatedText = pageContext.text.slice(0, 2000);
      parts.push(`Page content:\n${truncatedText}${pageContext.text.length > 2000 ? '...' : ''}`);
    }

    return parts.length > 0 ? parts.join('\n\n') : null;
  }, [pageContext]);

  return {
    pageContext,
    isExtension,
    refreshContext,
    formatContextForChat,
  };
}

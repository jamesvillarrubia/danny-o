/**
 * Content Extractor Utility
 * 
 * Uses Mozilla's Readability to extract clean, readable content from HTML.
 * Falls back to raw text when Readability can't extract sufficient content.
 */

import { Readability } from '@mozilla/readability';
import { JSDOM, VirtualConsole } from 'jsdom';

// Create a virtual console that suppresses CSS parsing errors
// JSDOM doesn't fully support CSS and logs many benign warnings
const virtualConsole = new VirtualConsole();
virtualConsole.on('error', () => { /* suppress */ });

/**
 * Result of content extraction
 */
export interface ExtractedContent {
  /** Clean, readable text content */
  content: string;
  /** Article title if detected */
  title?: string;
  /** Article byline/author if detected */
  byline?: string;
  /** Excerpt/summary if available */
  excerpt?: string;
  /** Whether Readability successfully extracted content */
  usedReadability: boolean;
}

/**
 * Options for content extraction
 */
export interface ExtractOptions {
  /** Minimum content length to consider Readability successful (default: 100) */
  minContentLength?: number;
  /** Maximum content length to return (default: 5000) */
  maxContentLength?: number;
  /** URL of the page (used for resolving relative links) */
  url?: string;
}

const DEFAULT_OPTIONS: Required<ExtractOptions> = {
  minContentLength: 100,
  maxContentLength: 5000,
  url: '',
};

/**
 * Extract clean, readable content from HTML using Readability.
 * Falls back to provided plain text if Readability fails.
 * 
 * @param html - Raw HTML content
 * @param fallbackText - Plain text fallback (e.g., innerText)
 * @param options - Extraction options
 * @returns Extracted content with metadata
 */
export function extractReadableContent(
  html: string | undefined,
  fallbackText: string | undefined,
  options: ExtractOptions = {},
): ExtractedContent {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // If no HTML, use fallback immediately
  if (!html || html.trim().length === 0) {
    return {
      content: truncateContent(fallbackText || '', opts.maxContentLength),
      usedReadability: false,
    };
  }

  try {
    // Parse HTML with JSDOM (suppress CSS parsing errors)
    const dom = new JSDOM(html, {
      url: opts.url || 'https://example.com',
      virtualConsole,
    });

    // Run Readability
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    // Check if Readability found enough content
    if (article && article.textContent && article.textContent.length >= opts.minContentLength) {
      return {
        content: truncateContent(article.textContent, opts.maxContentLength),
        title: article.title || undefined,
        byline: article.byline || undefined,
        excerpt: article.excerpt || undefined,
        usedReadability: true,
      };
    }

    // Readability didn't find enough - fall back to plain text
    return {
      content: truncateContent(fallbackText || '', opts.maxContentLength),
      usedReadability: false,
    };
  } catch (error) {
    // Parsing failed - fall back to plain text
    console.error('Readability parsing failed:', error);
    return {
      content: truncateContent(fallbackText || '', opts.maxContentLength),
      usedReadability: false,
    };
  }
}

/**
 * Truncate content to max length, trying to break at word boundaries
 */
function truncateContent(text: string, maxLength: number): string {
  // Clean up whitespace
  const cleaned = text.replace(/\s+/g, ' ').trim();
  
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Try to break at a word boundary
  const truncated = cleaned.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

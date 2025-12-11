/**
 * MarkdownContent Component
 * 
 * Renders markdown text with proper styling for task descriptions.
 * Uses react-markdown for parsing and rendering.
 */

import ReactMarkdown from 'react-markdown';
import clsx from 'clsx';

interface MarkdownContentProps {
  /** The markdown content to render */
  content: string;
  /** Additional CSS classes to apply */
  className?: string;
}

/**
 * Renders markdown content with consistent styling.
 * Supports common markdown features: headings, lists, code, links, etc.
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={clsx('markdown-content', className)}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

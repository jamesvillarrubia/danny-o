/**
 * URL Enrichment Service
 * 
 * Enriches URL-heavy tasks by:
 * 1. Fetching and extracting content from URLs
 * 2. Using AI to generate context summaries and clarifying questions
 * 3. Preventing loss of task context/intent
 * 
 * This service is separate from classification to allow independent execution.
 */

import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { extractReadableContent, ExtractedContent } from '../../common/utils/content-extractor';
import { 
  analyzeTaskForUrls, 
  extractUrls, 
  UrlDetectionResult,
  needsUrlEnrichment,
} from '../../common/utils/url-detector';
import { ClaudeService } from '../../ai/services/claude.service';
import { IStorageAdapter } from '../../common/interfaces/storage-adapter.interface';
import { ITaskProvider } from '../../common/interfaces/task-provider.interface';
import { Task } from '../../common/interfaces';

/**
 * Result of fetching URL content
 */
export interface UrlFetchResult {
  url: string;
  success: boolean;
  title?: string;
  excerpt?: string;
  content?: string;
  error?: string;
  statusCode?: number;
}

/**
 * AI-generated context for a URL task
 */
export interface UrlContext {
  /** Summary of what the URL content is about */
  summary: string;
  /** Suggested clarifying questions for the user */
  questions?: string[];
  /** Suggested task title (if current one is just a URL) */
  suggestedTitle?: string;
  /** Whether the AI is confident about the task's purpose */
  isAmbiguous: boolean;
}

/**
 * Complete enrichment result for a task
 */
export interface UrlEnrichmentResult {
  taskId: string;
  /** Whether enrichment was needed/performed */
  enriched: boolean;
  /** URL analysis results */
  urlAnalysis: UrlDetectionResult;
  /** Results from fetching each URL */
  fetchResults: UrlFetchResult[];
  /** AI-generated context */
  context?: UrlContext;
  /** New title (if updated) */
  newTitle?: string;
  /** New description (if updated) */
  newDescription?: string;
  /** Error message if enrichment failed */
  error?: string;
}

/**
 * Options for URL enrichment
 */
export interface UrlEnrichmentOptions {
  /** Whether to update the task in storage/provider (default: true) */
  applyChanges?: boolean;
  /** Whether to add clarifying questions (default: true) */
  includeQuestions?: boolean;
  /** Maximum URLs to fetch per task (default: 3) */
  maxUrlsToFetch?: number;
  /** Timeout for URL fetch in ms (default: 10000) */
  fetchTimeout?: number;
  /** Whether to force enrichment even if task doesn't appear URL-heavy */
  force?: boolean;
}

const DEFAULT_OPTIONS: Required<UrlEnrichmentOptions> = {
  applyChanges: true,
  includeQuestions: true,
  maxUrlsToFetch: 3,
  fetchTimeout: 10000,
  force: false,
};

@Injectable()
export class UrlEnrichmentService {
  private readonly logger = new Logger(UrlEnrichmentService.name);

  constructor(
    @Optional() @Inject(ClaudeService) private readonly claude?: ClaudeService,
    @Optional() @Inject('IStorageAdapter') private readonly storage?: IStorageAdapter,
    @Optional() @Inject('ITaskProvider') private readonly taskProvider?: ITaskProvider,
  ) {}

  /**
   * Enrich a single task with URL context
   */
  async enrichTask(
    task: Task,
    options: UrlEnrichmentOptions = {},
  ): Promise<UrlEnrichmentResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    this.logger.log(`Analyzing task ${task.id} for URL enrichment...`);

    // Analyze task for URLs
    const urlAnalysis = analyzeTaskForUrls(task.content, task.description);

    // Check if enrichment is needed
    if (!opts.force && !needsUrlEnrichment(task.content, task.description)) {
      this.logger.log(`Task ${task.id} doesn't need URL enrichment (score: ${urlAnalysis.enrichmentScore.toFixed(2)})`);
      return {
        taskId: task.id,
        enriched: false,
        urlAnalysis,
        fetchResults: [],
      };
    }

    this.logger.log(`Task ${task.id} needs enrichment - ${urlAnalysis.urls.length} URL(s) found`);

    // Fetch content from URLs
    const urlsToFetch = urlAnalysis.urls.slice(0, opts.maxUrlsToFetch);
    const fetchResults = await this.fetchUrls(urlsToFetch, opts.fetchTimeout);

    // Generate AI context
    let context: UrlContext | undefined;
    if (this.claude) {
      try {
        context = await this.generateContext(task, urlAnalysis, fetchResults, opts);
      } catch (error: any) {
        this.logger.warn(`Failed to generate AI context: ${error.message}`);
      }
    }

    // Build new description
    const newDescription = this.buildEnrichedDescription(
      task,
      urlAnalysis,
      fetchResults,
      context,
    );

    // Determine new title if current one is URL-heavy
    const newTitle = this.determineNewTitle(task, urlAnalysis, fetchResults, context);

    // Apply changes if requested
    if (opts.applyChanges && this.taskProvider) {
      try {
        const updates: { content?: string; description?: string } = {};
        
        if (newTitle && newTitle !== task.content) {
          updates.content = newTitle;
          this.logger.log(`Updating task ${task.id} title: "${task.content}" → "${newTitle}"`);
        }
        
        if (newDescription) {
          updates.description = newDescription;
        }

        if (Object.keys(updates).length > 0) {
          await this.taskProvider.updateTask(task.id, updates);
          this.logger.log(`Updated task ${task.id} with enriched content`);
          
          // Also update local storage if available
          if (this.storage) {
            await this.storage.updateTask(task.id, updates as any);
          }
        }
      } catch (error: any) {
        this.logger.error(`Failed to update task: ${error.message}`);
        return {
          taskId: task.id,
          enriched: false,
          urlAnalysis,
          fetchResults,
          context,
          error: `Failed to update task: ${error.message}`,
        };
      }
    }

    return {
      taskId: task.id,
      enriched: true,
      urlAnalysis,
      fetchResults,
      context,
      newTitle,
      newDescription,
    };
  }

  /**
   * Enrich multiple tasks in batch
   */
  async enrichTasks(
    tasks: Task[],
    options: UrlEnrichmentOptions = {},
  ): Promise<UrlEnrichmentResult[]> {
    this.logger.log(`Batch enriching ${tasks.length} tasks...`);

    const results: UrlEnrichmentResult[] = [];
    
    for (const task of tasks) {
      try {
        const result = await this.enrichTask(task, options);
        results.push(result);
      } catch (error: any) {
        this.logger.error(`Failed to enrich task ${task.id}: ${error.message}`);
        results.push({
          taskId: task.id,
          enriched: false,
          urlAnalysis: analyzeTaskForUrls(task.content, task.description),
          fetchResults: [],
          error: error.message,
        });
      }
    }

    const enrichedCount = results.filter(r => r.enriched).length;
    this.logger.log(`Batch complete: ${enrichedCount}/${tasks.length} enriched`);

    return results;
  }

  /**
   * Find tasks that need URL enrichment
   */
  async findTasksNeedingEnrichment(): Promise<Task[]> {
    if (!this.storage) {
      throw new Error('Storage adapter not available');
    }

    const allTasks = await this.storage.getTasks({ completed: false });
    
    return allTasks.filter(task => 
      needsUrlEnrichment(task.content, task.description)
    );
  }

  /**
   * Fetch content from multiple URLs
   */
  private async fetchUrls(
    urls: string[],
    timeout: number,
  ): Promise<UrlFetchResult[]> {
    const results: UrlFetchResult[] = [];

    for (const url of urls) {
      results.push(await this.fetchUrl(url, timeout));
    }

    return results;
  }

  /**
   * Fetch and extract content from a single URL
   */
  async fetchUrl(url: string, timeout: number = 10000): Promise<UrlFetchResult> {
    this.logger.log(`Fetching URL: ${url}`);

    try {
      const response = await axios.get(url, {
        timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TaskBot/1.0; +https://github.com/danny-tasks)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 500, // Accept 4xx for error handling
      });

      // Handle error status codes
      if (response.status >= 400) {
        return {
          url,
          success: false,
          statusCode: response.status,
          error: this.getErrorMessage(response.status),
        };
      }

      // Extract readable content
      const html = response.data;
      const extracted = extractReadableContent(html, undefined, { url });

      return {
        url,
        success: true,
        statusCode: response.status,
        title: extracted.title,
        excerpt: extracted.excerpt,
        content: extracted.content.slice(0, 2000), // Limit content size
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      
      return {
        url,
        success: false,
        statusCode: axiosError.response?.status,
        error: this.getErrorMessage(axiosError.response?.status, axiosError.message),
      };
    }
  }

  /**
   * Generate human-friendly error message
   */
  private getErrorMessage(statusCode?: number, fallbackMessage?: string): string {
    if (statusCode === 404) {
      return 'Page not found (404) - the URL may have moved or been deleted';
    }
    if (statusCode === 403) {
      return 'Access denied (403) - you may need to visit this page directly and copy relevant content';
    }
    if (statusCode === 401) {
      return 'Authentication required (401) - this content is behind a login';
    }
    if (statusCode && statusCode >= 500) {
      return `Server error (${statusCode}) - try again later`;
    }
    if (fallbackMessage?.includes('timeout')) {
      return 'Request timed out - the site may be slow or unreachable';
    }
    if (fallbackMessage?.includes('ENOTFOUND')) {
      return 'Domain not found - check if the URL is correct';
    }
    return fallbackMessage || 'Failed to fetch content';
  }

  /**
   * Generate AI context for the task
   */
  private async generateContext(
    task: Task,
    urlAnalysis: UrlDetectionResult,
    fetchResults: UrlFetchResult[],
    options: Required<UrlEnrichmentOptions>,
  ): Promise<UrlContext> {
    if (!this.claude) {
      throw new Error('Claude service not available');
    }

    // Build prompt with fetched content
    const successfulFetches = fetchResults.filter(r => r.success);
    const failedFetches = fetchResults.filter(r => !r.success);

    let urlContent = '';
    if (successfulFetches.length > 0) {
      urlContent = successfulFetches
        .map(f => `**${f.title || f.url}**\n${f.excerpt || f.content?.slice(0, 500) || 'No content extracted'}`)
        .join('\n\n');
    }

    const prompt = `You are helping a user clarify the purpose of a task they saved (probably for later action).

**Task Title:** ${task.content}
**Current Description:** ${task.description || '(none)'}
**Non-URL Text:** ${urlAnalysis.textWithoutUrls || '(just a link)'}

**URLs in Task:** ${urlAnalysis.urls.join(', ')}

${urlContent ? `**Content from URL(s):**\n${urlContent}` : ''}

${failedFetches.length > 0 ? `**Note:** Could not fetch: ${failedFetches.map(f => `${f.url} (${f.error})`).join(', ')}` : ''}

Provide:
1. **summary**: A brief summary of what the linked content is about (1-2 sentences)
2. **questions**: ${options.includeQuestions ? '1-2 clarifying questions asking what the user wants to DO with this (read? buy? share? research?)' : 'Empty array'}
3. **suggestedTitle**: If the task title is mostly a URL, suggest a SKIMMABLE, ACTIONABLE title. The title should:
   - Be scannable in a task list (max ~60 chars)
   - Hint at what action might be needed (e.g., "Read: ...", "Review: ...", "Consider: ...", "Check out: ...")
   - NOT just be the page title verbatim
   - If it's an article/blog, use "Read: [topic]"
   - If it's a product/project, use "Check out: [name]" or "Consider: [name]"
   - If it's unclear, use "Review: [brief description]"
   - Return null only if the current title is already descriptive
4. **isAmbiguous**: true if the task purpose is unclear and needs user clarification

Respond in JSON format:
{
  "summary": "Brief summary...",
  "questions": ["What do you want to do with this?"],
  "suggestedTitle": "Read: Article about X" or null,
  "isAmbiguous": true/false
}`;

    const response = await this.claude.query(prompt, {
      temperature: 0.3,
      interactionType: 'url_enrichment',
      taskId: task.id,
    });

    return {
      summary: response.summary || 'Unable to summarize content',
      questions: options.includeQuestions ? response.questions : undefined,
      suggestedTitle: response.suggestedTitle || undefined,
      isAmbiguous: response.isAmbiguous ?? false,
    };
  }

  /**
   * Build enriched description from gathered data
   */
  private buildEnrichedDescription(
    task: Task,
    urlAnalysis: UrlDetectionResult,
    fetchResults: UrlFetchResult[],
    context?: UrlContext,
  ): string {
    const parts: string[] = [];

    // Keep existing description if present
    if (task.description && task.description.trim()) {
      parts.push(task.description.trim());
      parts.push(''); // Blank line separator
    }

    // Add AI summary if available
    if (context?.summary) {
      parts.push('---');
      parts.push('📎 **Link Context:**');
      parts.push(context.summary);
    }

    // Add clarifying questions if present and task is ambiguous
    if (context?.isAmbiguous && context.questions && context.questions.length > 0) {
      parts.push('');
      parts.push('❓ **Questions to clarify:**');
      context.questions.forEach(q => parts.push(`- ${q}`));
    }

    // Add fetch errors as notes
    const failedFetches = fetchResults.filter(r => !r.success);
    if (failedFetches.length > 0) {
      parts.push('');
      parts.push('⚠️ **Note:**');
      failedFetches.forEach(f => {
        parts.push(`- ${f.url}: ${f.error}`);
      });
    }

    // Preserve original URLs at the bottom
    if (urlAnalysis.urls.length > 0) {
      parts.push('');
      parts.push('🔗 **Source:**');
      urlAnalysis.urls.forEach(url => parts.push(url));
    }

    return parts.join('\n').trim();
  }

  /**
   * Determine a new title for the task if the current one is URL-heavy
   * or is a markdown link that could be cleaner.
   * 
   * Priority:
   * 1. AI-suggested title (if available and not null)
   * 2. Markdown link text (cleaned up with action prefix)
   * 3. Page title from fetch (cleaned up)
   * 4. Fallback: "Review: [domain]" or "Unclear link: [domain]"
   */
  private determineNewTitle(
    task: Task,
    urlAnalysis: UrlDetectionResult,
    fetchResults: UrlFetchResult[],
    context?: UrlContext,
  ): string | undefined {
    const isMarkdownLink = urlAnalysis.markdownLink?.isMarkdownLink;
    const isUrlHeavy = urlAnalysis.urlRatio >= 0.5 && urlAnalysis.textWithoutUrls.length <= 30;

    // Only update title if it's URL-heavy or a markdown link
    if (!isUrlHeavy && !isMarkdownLink) {
      // Task already has meaningful non-URL, non-markdown-link text
      return undefined;
    }

    // Priority 1: AI-suggested title (if we fetched content and got a suggestion)
    if (context?.suggestedTitle) {
      return this.cleanTitle(context.suggestedTitle);
    }

    // Priority 2: For markdown links, extract and clean up the link text
    if (isMarkdownLink && urlAnalysis.markdownLink?.linkText) {
      const linkText = urlAnalysis.markdownLink.linkText;
      // Add action prefix if the text doesn't already suggest an action
      if (this.needsActionPrefix(linkText)) {
        return this.cleanTitle(`Read: ${linkText}`);
      }
      return this.cleanTitle(linkText);
    }

    // Priority 3: Page title from successful fetch
    const successfulFetch = fetchResults.find(r => r.success && r.title);
    if (successfulFetch?.title) {
      return this.cleanTitle(successfulFetch.title);
    }

    // Priority 4: Generate fallback from URL
    const firstUrl = urlAnalysis.urls[0];
    if (firstUrl) {
      const domain = this.extractDomain(firstUrl);
      const failedFetch = fetchResults.find(r => !r.success);
      
      if (failedFetch) {
        // Couldn't fetch, indicate it needs attention
        return `Review link: ${domain}`;
      } else {
        // Fetched but no title found
        return `Unclear link: ${domain}`;
      }
    }

    return undefined;
  }

  /**
   * Check if a title text needs an action prefix like "Read:"
   * Returns false if the text already starts with an action verb
   */
  private needsActionPrefix(text: string): boolean {
    const actionPrefixes = [
      'read', 'review', 'check', 'watch', 'listen', 'buy', 'consider',
      'try', 'look', 'explore', 'investigate', 'research', 'learn',
      'sign up', 'subscribe', 'download', 'install', 'setup', 'configure',
    ];
    const lowerText = text.toLowerCase().trim();
    return !actionPrefixes.some(prefix => lowerText.startsWith(prefix));
  }

  /**
   * Clean up a title string
   */
  private cleanTitle(title: string): string {
    return title
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .replace(/^\s*[-|:]\s*/, '')    // Remove leading separators
      .replace(/\s*[-|:]\s*$/, '')    // Remove trailing separators
      .trim()
      .slice(0, 150);                 // Limit length
  }

  /**
   * Extract domain from URL for fallback titles
   */
  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url.slice(0, 30);
    }
  }

  /**
   * Check if a task needs URL enrichment (public utility method)
   */
  needsEnrichment(task: Task): boolean {
    return needsUrlEnrichment(task.content, task.description);
  }

  /**
   * Analyze a task for URLs (public utility method)
   */
  analyzeTask(task: Task): UrlDetectionResult {
    return analyzeTaskForUrls(task.content, task.description);
  }
}

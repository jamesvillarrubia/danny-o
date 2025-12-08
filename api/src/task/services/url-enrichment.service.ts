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

    // Apply changes if requested
    if (opts.applyChanges && newDescription && this.taskProvider) {
      try {
        await this.taskProvider.updateTask(task.id, {
          description: newDescription,
        });
        this.logger.log(`Updated task ${task.id} with enriched description`);
        
        // Also update local storage if available
        if (this.storage) {
          await this.storage.updateTask(task.id, { description: newDescription } as any);
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

    const prompt = `You are helping a user clarify the purpose of a task they created.

**Task Title:** ${task.content}
**Current Description:** ${task.description || '(none)'}
**Non-URL Text:** ${urlAnalysis.textWithoutUrls || '(just a link)'}

**URLs in Task:** ${urlAnalysis.urls.join(', ')}

${urlContent ? `**Content from URL(s):**\n${urlContent}` : ''}

${failedFetches.length > 0 ? `**Note:** Could not fetch: ${failedFetches.map(f => `${f.url} (${f.error})`).join(', ')}` : ''}

Based on the task title and URL content, provide:
1. A brief summary of what the linked content is about (1-2 sentences)
2. ${options.includeQuestions ? '1-2 clarifying questions to ask the user about what they want to do with this' : 'Skip questions'}
3. If the task title is just a URL, suggest a better title
4. Indicate if the task purpose is ambiguous (needs user clarification)

Respond in JSON format:
{
  "summary": "Brief summary of the URL content...",
  "questions": ["Question 1?", "Question 2?"],
  "suggestedTitle": "Better title if current is just URL, or null",
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

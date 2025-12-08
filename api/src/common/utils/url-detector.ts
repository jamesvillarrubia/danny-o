/**
 * URL Detection Utility
 * 
 * Detects whether a task is "URL-heavy" - meaning it's primarily a link
 * that would benefit from content enrichment to prevent losing context.
 */

/**
 * Regex to match URLs in text
 * Matches http/https URLs with optional path, query, fragment
 */
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

/**
 * Result of URL detection analysis
 */
export interface UrlDetectionResult {
  /** Whether the task is considered URL-heavy */
  isUrlHeavy: boolean;
  /** Extracted URLs from content */
  urls: string[];
  /** Percentage of content that is URLs (0-1) */
  urlRatio: number;
  /** Non-URL text in the content */
  textWithoutUrls: string;
  /** Whether the description is sparse/empty */
  hasLightDescription: boolean;
  /** Overall score indicating how much this task needs enrichment (0-1) */
  enrichmentScore: number;
}

/**
 * Options for URL detection
 */
export interface UrlDetectionOptions {
  /** 
   * Ratio threshold above which content is considered URL-heavy (default: 0.5)
   * A ratio of 0.5 means if URLs make up more than 50% of content length
   */
  urlRatioThreshold?: number;
  /** 
   * Minimum non-URL text length to consider content "light" (default: 50)
   */
  minTextLength?: number;
  /**
   * Maximum description length to consider "light" (default: 20)
   */
  maxLightDescriptionLength?: number;
}

const DEFAULT_OPTIONS: Required<UrlDetectionOptions> = {
  urlRatioThreshold: 0.5,
  minTextLength: 50,
  maxLightDescriptionLength: 20,
};

/**
 * Extract all URLs from a text string
 */
export function extractUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(URL_REGEX);
  return matches ? [...new Set(matches)] : []; // Dedupe URLs
}

/**
 * Remove URLs from text, leaving just the surrounding content
 */
export function removeUrls(text: string): string {
  if (!text) return '';
  return text.replace(URL_REGEX, '').replace(/\s+/g, ' ').trim();
}

/**
 * Check if a string is a valid URL
 */
export function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Analyze task content and description to determine if it's URL-heavy
 * and would benefit from content enrichment.
 * 
 * A task is considered URL-heavy if:
 * - The content is mostly a URL (high URL ratio)
 * - The non-URL text is minimal
 * - The description is light or empty
 * 
 * @param content - Task title/content
 * @param description - Task description (optional)
 * @param options - Detection options
 * @returns Analysis result
 */
export function analyzeTaskForUrls(
  content: string,
  description?: string,
  options: UrlDetectionOptions = {},
): UrlDetectionResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Extract URLs and calculate metrics
  const contentUrls = extractUrls(content);
  const descriptionUrls = extractUrls(description || '');
  const allUrls = [...new Set([...contentUrls, ...descriptionUrls])];

  const textWithoutUrls = removeUrls(content);
  const descriptionWithoutUrls = removeUrls(description || '');

  // Calculate URL ratio in content
  const totalUrlLength = contentUrls.reduce((sum, url) => sum + url.length, 0);
  const urlRatio = content.length > 0 ? totalUrlLength / content.length : 0;

  // Check if description is light
  const hasLightDescription = !description || 
    descriptionWithoutUrls.length <= opts.maxLightDescriptionLength;

  // Determine if URL-heavy
  const isUrlHeavy = urlRatio >= opts.urlRatioThreshold && 
    textWithoutUrls.length < opts.minTextLength;

  // Calculate enrichment score (0-1)
  // Higher score = more benefit from enrichment
  let enrichmentScore = 0;

  if (allUrls.length > 0) {
    // Base score from URL ratio
    enrichmentScore += urlRatio * 0.4;

    // Bonus for light text content
    if (textWithoutUrls.length < opts.minTextLength) {
      enrichmentScore += 0.3;
    }

    // Bonus for light description
    if (hasLightDescription) {
      enrichmentScore += 0.3;
    }
  }

  return {
    isUrlHeavy,
    urls: allUrls,
    urlRatio,
    textWithoutUrls,
    hasLightDescription,
    enrichmentScore: Math.min(1, enrichmentScore),
  };
}

/**
 * Quick check if a task needs URL enrichment
 * 
 * @param content - Task title/content
 * @param description - Task description (optional)
 * @returns true if task would benefit from URL enrichment
 */
export function needsUrlEnrichment(
  content: string,
  description?: string,
): boolean {
  const analysis = analyzeTaskForUrls(content, description);
  // Consider enrichment if score is above 0.5 and there are URLs
  return analysis.urls.length > 0 && analysis.enrichmentScore >= 0.5;
}

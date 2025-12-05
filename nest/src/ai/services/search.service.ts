/**
 * Smart Search Service
 * 
 * Provides intelligent task search using a hybrid approach:
 * 1. Query expansion (cheap Claude call to get variations)
 * 2. Fuzzy keyword matching against expanded queries
 * 3. Fallback to full semantic search for hard cases
 * 
 * This approach gives ~90% of semantic search quality at ~10% of the cost.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { QueryExpansionService, ExpandedQuery } from './query-expansion.service';
import { AIOperationsService } from './operations.service';
import { IStorageAdapter, Task } from '../../common/interfaces';

export interface SearchMatch {
  task: Task;
  score: number;
  matchedOn: string; // Which variation or method matched
  reasoning?: string;
}

export interface SearchResult {
  matches: SearchMatch[];
  query: ExpandedQuery;
  method: 'exact' | 'fuzzy' | 'semantic';
  searchTimeMs: number;
}

export interface SearchOptions {
  /** Maximum results to return */
  limit?: number;
  /** Minimum score threshold (0-1) */
  minScore?: number;
  /** Skip query expansion (for testing) */
  skipExpansion?: boolean;
  /** Force semantic search even if fuzzy finds results */
  forceSemantic?: boolean;
  /** Include completed tasks in search */
  includeCompleted?: boolean;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly queryExpansion: QueryExpansionService,
    private readonly aiOps: AIOperationsService,
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
  ) {}

  /**
   * Search for tasks using the hybrid approach
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const startTime = Date.now();
    const limit = options.limit ?? 10;
    const minScore = options.minScore ?? 0.3;

    this.logger.log(`Searching for: "${query}"`);

    // Step 1: Expand the query
    let expanded: ExpandedQuery;
    if (options.skipExpansion) {
      expanded = this.queryExpansion.fallbackExpansion(query);
    } else {
      expanded = await this.queryExpansion.expandQuery(query);
    }

    // Step 2: Get tasks to search
    const tasks = await this.storage.getTasks({
      completed: options.includeCompleted ?? false,
    });

    if (tasks.length === 0) {
      return {
        matches: [],
        query: expanded,
        method: 'fuzzy',
        searchTimeMs: Date.now() - startTime,
      };
    }

    // Step 3: Try exact ID match first
    if (expanded.strategy === 'exact') {
      const exactMatch = tasks.find(t => t.id === query);
      if (exactMatch) {
        return {
          matches: [{ task: exactMatch, score: 1.0, matchedOn: 'id' }],
          query: expanded,
          method: 'exact',
          searchTimeMs: Date.now() - startTime,
        };
      }
    }

    // Step 4: Fuzzy search against all variations
    const fuzzyMatches = this.fuzzySearch(tasks, expanded, minScore);

    // Step 5: If fuzzy search found good matches, return them
    if (fuzzyMatches.length > 0 && !options.forceSemantic) {
      const topScore = fuzzyMatches[0]?.score ?? 0;
      
      // If we have a strong match (>0.6), trust it
      if (topScore > 0.6) {
        this.logger.log(`Fuzzy search found ${fuzzyMatches.length} matches (top score: ${topScore.toFixed(2)})`);
        return {
          matches: fuzzyMatches.slice(0, limit),
          query: expanded,
          method: 'fuzzy',
          searchTimeMs: Date.now() - startTime,
        };
      }
    }

    // Step 6: Fall back to semantic search for hard cases
    if (fuzzyMatches.length === 0 || options.forceSemantic) {
      this.logger.log('Falling back to semantic search...');
      const semanticResult = await this.semanticSearch(query, tasks, limit);
      
      return {
        matches: semanticResult,
        query: expanded,
        method: 'semantic',
        searchTimeMs: Date.now() - startTime,
      };
    }

    // Return fuzzy matches if semantic wasn't needed
    return {
      matches: fuzzyMatches.slice(0, limit),
      query: expanded,
      method: 'fuzzy',
      searchTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Fuzzy search using expanded query variations
   */
  private fuzzySearch(tasks: Task[], expanded: ExpandedQuery, minScore: number): SearchMatch[] {
    const matches: Map<string, SearchMatch> = new Map();

    for (const task of tasks) {
      const taskText = this.getSearchableText(task);
      let bestScore = 0;
      let bestMatch = '';

      // Check each variation
      for (const variation of expanded.variations) {
        const score = this.calculateMatchScore(taskText, variation);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = variation;
        }
      }

      // Also check entities directly (names, topics)
      for (const entity of expanded.entities) {
        const score = this.calculateMatchScore(taskText, entity.toLowerCase());
        // Boost entity matches slightly
        const boostedScore = Math.min(1, score * 1.2);
        if (boostedScore > bestScore) {
          bestScore = boostedScore;
          bestMatch = `entity:${entity}`;
        }
      }

      if (bestScore >= minScore) {
        matches.set(task.id, {
          task,
          score: bestScore,
          matchedOn: bestMatch,
        });
      }
    }

    // Sort by score descending
    return Array.from(matches.values())
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate match score between task text and query
   * Returns 0-1 where 1 is perfect match
   */
  private calculateMatchScore(taskText: string, query: string): number {
    const taskLower = taskText.toLowerCase();
    const queryLower = query.toLowerCase();

    // Exact substring match
    if (taskLower.includes(queryLower)) {
      // Score based on what percentage of the task is the match
      const coverage = queryLower.length / taskLower.length;
      return Math.min(1, 0.7 + (coverage * 0.3));
    }

    // Word-based matching
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);
    const taskWords = taskLower.split(/\s+/).filter(w => w.length > 1);
    
    if (queryWords.length === 0) return 0;

    let matchedWords = 0;
    let partialMatches = 0;

    for (const qWord of queryWords) {
      // Exact word match
      if (taskWords.some(tWord => tWord === qWord)) {
        matchedWords++;
      } 
      // Partial word match (handles typos like John/Jon)
      else if (taskWords.some(tWord => this.fuzzyWordMatch(tWord, qWord))) {
        partialMatches++;
      }
    }

    // Calculate score
    const exactScore = matchedWords / queryWords.length;
    const partialScore = (partialMatches / queryWords.length) * 0.7; // Partial matches worth 70%
    
    return Math.min(1, exactScore + partialScore);
  }

  /**
   * Check if two words are fuzzy matches (handles typos)
   */
  private fuzzyWordMatch(word1: string, word2: string): boolean {
    // If either is very short, require exact match
    if (word1.length < 3 || word2.length < 3) {
      return word1 === word2;
    }

    // Check if one contains the other
    if (word1.includes(word2) || word2.includes(word1)) {
      return true;
    }

    // Levenshtein distance check for typos
    const distance = this.levenshteinDistance(word1, word2);
    const maxLength = Math.max(word1.length, word2.length);
    
    // Allow 1 edit for short words, 2 for longer words
    const threshold = maxLength <= 4 ? 1 : 2;
    return distance <= threshold;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    
    // Create distance matrix
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],     // deletion
            dp[i][j - 1],     // insertion
            dp[i - 1][j - 1]  // substitution
          );
        }
      }
    }
    
    return dp[m][n];
  }

  /**
   * Get searchable text from a task
   */
  private getSearchableText(task: Task): string {
    const parts = [
      task.content,
      task.description || '',
    ];
    return parts.join(' ').toLowerCase();
  }

  /**
   * Semantic search using Claude (expensive fallback)
   */
  private async semanticSearch(query: string, tasks: Task[], limit: number): Promise<SearchMatch[]> {
    try {
      const result = await this.aiOps.filterTasksByIntent(query, tasks);
      
      return result.matches.slice(0, limit).map((m: any) => ({
        task: m.task,
        score: m.relevanceScore || 0.5,
        matchedOn: 'semantic',
        reasoning: m.reasoning,
      }));
    } catch (error: any) {
      this.logger.error(`Semantic search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Quick search without query expansion (for simple lookups)
   */
  async quickSearch(query: string, tasks: Task[]): Promise<Task[]> {
    const expanded = this.queryExpansion.fallbackExpansion(query);
    const matches = this.fuzzySearch(tasks, expanded, 0.3);
    return matches.map(m => m.task);
  }
}


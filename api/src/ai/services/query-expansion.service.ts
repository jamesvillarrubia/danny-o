/**
 * Query Expansion Service
 * 
 * Uses Claude to expand natural language search queries into multiple
 * keyword variations for better fuzzy matching. This is a cheap alternative
 * to full vector search - one small API call to improve search quality.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ClaudeService } from './claude.service';

export interface ExpandedQuery {
  /** Original user query */
  original: string;
  /** Normalized/cleaned version of the query */
  normalized: string;
  /** Alternative phrasings and keyword combinations */
  variations: string[];
  /** Key entities extracted (names, topics, etc.) */
  entities: string[];
  /** Search strategy hint */
  strategy: 'exact' | 'fuzzy' | 'semantic';
}

const QUERY_EXPANSION_PROMPT = `You are a search query optimizer. Given a natural language search query, expand it into variations that would help find matching tasks.

IMPORTANT: Be generous with variations. Users often:
- Misremember exact wording ("send out" vs "send note")  
- Use nicknames or typos for names ("John" vs "Jon")
- Paraphrase ("email about" vs "message regarding")
- Use different word order

Return JSON with this structure:
{
  "normalized": "cleaned up version of the query",
  "variations": ["variation1", "variation2", ...],
  "entities": ["person names", "key topics", "project names"],
  "strategy": "exact|fuzzy|semantic"
}

Guidelines:
- normalized: Fix obvious typos, expand abbreviations
- variations: Generate 5-10 alternative phrasings, including:
  - Different word orders
  - Synonyms (send/email/message, about/regarding/re)
  - Partial matches (just key words)
  - Common typos of names
- entities: Extract proper nouns, names, specific topics
- strategy: "exact" if query looks like an ID, "fuzzy" for most queries, "semantic" if very abstract

Example:
Query: "send out to John about interns and data requests"
{
  "normalized": "send note to John about interns and data request",
  "variations": [
    "send John interns data",
    "email John intern",
    "Jon interns data request",
    "note to John about intern",
    "John data request",
    "send note Jon",
    "intern data request"
  ],
  "entities": ["John", "Jon", "interns", "data request"],
  "strategy": "fuzzy"
}`;

@Injectable()
export class QueryExpansionService {
  private readonly logger = new Logger(QueryExpansionService.name);

  constructor(private readonly claude: ClaudeService) {}

  /**
   * Expand a search query into multiple variations for better matching
   */
  async expandQuery(query: string): Promise<ExpandedQuery> {
    this.logger.debug(`Expanding query: "${query}"`);

    // Quick check - if it looks like a task ID, skip expansion
    if (this.looksLikeTaskId(query)) {
      return {
        original: query,
        normalized: query,
        variations: [query],
        entities: [],
        strategy: 'exact',
      };
    }

    try {
      const prompt = `${QUERY_EXPANSION_PROMPT}\n\nQuery: "${query}"`;
      
      const result = await this.claude.query(prompt, {
        temperature: 0.3, // Lower temperature for more consistent expansions
        maxTokens: 500,   // Small response expected
        interactionType: 'query_expansion',
      });

      const expanded: ExpandedQuery = {
        original: query,
        normalized: result.normalized || query,
        variations: result.variations || [],
        entities: result.entities || [],
        strategy: result.strategy || 'fuzzy',
      };

      // Always include the original and normalized in variations
      if (!expanded.variations.includes(query.toLowerCase())) {
        expanded.variations.unshift(query.toLowerCase());
      }
      if (!expanded.variations.includes(expanded.normalized.toLowerCase())) {
        expanded.variations.unshift(expanded.normalized.toLowerCase());
      }

      this.logger.debug(`Expanded to ${expanded.variations.length} variations`);
      return expanded;

    } catch (error: any) {
      this.logger.warn(`Query expansion failed, using original: ${error.message}`);
      // Fallback: just use the original query with basic tokenization
      return this.fallbackExpansion(query);
    }
  }

  /**
   * Quick local expansion without API call (for fallback or simple queries)
   */
  fallbackExpansion(query: string): ExpandedQuery {
    const normalized = query.toLowerCase().trim();
    const words = normalized.split(/\s+/).filter(w => w.length > 2);
    
    const variations = [
      normalized,
      ...words,
      // Pairs of adjacent words
      ...words.slice(0, -1).map((w, i) => `${w} ${words[i + 1]}`),
    ];

    return {
      original: query,
      normalized,
      variations: [...new Set(variations)], // dedupe
      entities: [],
      strategy: 'fuzzy',
    };
  }

  /**
   * Check if the query looks like a task ID (UUID or Todoist ID)
   */
  private looksLikeTaskId(query: string): boolean {
    // UUID pattern
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // Todoist task ID pattern (numeric)
    const todoistIdPattern = /^\d{10,}$/;
    
    return uuidPattern.test(query) || todoistIdPattern.test(query);
  }
}


/**
 * Search Service Unit Tests
 * 
 * Tests the smart search functionality including:
 * - Query expansion
 * - Fuzzy matching
 * - Typo tolerance
 * - The specific failing case from the bug report
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from '../../src/ai/services/search.service';
import { QueryExpansionService } from '../../src/ai/services/query-expansion.service';
import { AIOperationsService } from '../../src/ai/services/operations.service';
import { Task } from '../../src/common/interfaces';

// Mock task data
const mockTasks: Task[] = [
  {
    id: '1',
    content: 'Send note to Jon about Interns and Data Request',
    description: '',
    priority: 2,
    isCompleted: false,
    projectId: 'proj1',
    createdAt: new Date(),
    metadata: { category: 'work' },
  },
  {
    id: '2',
    content: 'Email John Kavalausky about Coworking Space',
    description: 'Follow up on coworking arrangements',
    priority: 1,
    isCompleted: false,
    projectId: 'proj1',
    createdAt: new Date(),
    metadata: { category: 'work' },
  },
  {
    id: '3',
    content: 'Buy groceries',
    description: 'Milk, eggs, bread',
    priority: 1,
    isCompleted: false,
    projectId: 'proj2',
    createdAt: new Date(),
    metadata: { category: 'personal-family' },
  },
  {
    id: '4',
    content: 'Fix the kitchen sink',
    description: 'Leaking faucet needs repair',
    priority: 3,
    isCompleted: false,
    projectId: 'proj2',
    createdAt: new Date(),
    metadata: { category: 'home-repair' },
  },
];

describe('SearchService', () => {
  let searchService: SearchService;
  let queryExpansion: QueryExpansionService;
  let mockStorage: any;
  let mockAiOps: any;
  let mockClaude: any;

  beforeEach(() => {
    // Mock storage
    mockStorage = {
      getTasks: vi.fn().mockResolvedValue(mockTasks),
    };

    // Mock Claude service for query expansion
    mockClaude = {
      query: vi.fn().mockImplementation(async (prompt: string) => {
        // Simulate Claude's query expansion response
        if (prompt.includes('send out to John about interns')) {
          return {
            normalized: 'send note to john about interns and data request',
            variations: [
              'send john interns data',
              'email john intern',
              'jon interns data request',
              'note to john about intern',
              'john data request',
              'send note jon',
            ],
            entities: ['John', 'Jon', 'interns', 'data request'],
            strategy: 'fuzzy',
          };
        }
        // Default expansion
        const words = prompt.split(/\s+/).filter(w => w.length > 2);
        return {
          normalized: prompt.toLowerCase(),
          variations: words,
          entities: [],
          strategy: 'fuzzy',
        };
      }),
    };

    // Mock AI operations for semantic search fallback
    mockAiOps = {
      filterTasksByIntent: vi.fn().mockResolvedValue({
        matches: [],
        interpretation: '',
      }),
    };

    queryExpansion = new QueryExpansionService(mockClaude);
    searchService = new SearchService(queryExpansion, mockAiOps, mockStorage);
  });

  describe('The Reported Bug Case', () => {
    it('should find "Send note to Jon about Interns and Data Request" when searching for "send out to John about interns and data requests"', async () => {
      const result = await searchService.search('send out to John about interns and data requests');

      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].task.content).toBe('Send note to Jon about Interns and Data Request');
      expect(result.matches[0].score).toBeGreaterThan(0.5);
    });

    it('should handle typos in names (John vs Jon)', async () => {
      // Test with local fuzzy matching (skip expansion to test base algorithm)
      const result = await searchService.search('Jon interns data', { skipExpansion: true });

      expect(result.matches.length).toBeGreaterThan(0);
      const taskContents = result.matches.map(m => m.task.content);
      expect(taskContents).toContain('Send note to Jon about Interns and Data Request');
    });
  });

  describe('Fuzzy Matching', () => {
    it('should match partial keywords', async () => {
      const result = await searchService.search('fix sink', { skipExpansion: true });

      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches.some(m => m.task.content.includes('sink'))).toBe(true);
    });

    it('should match tasks by description', async () => {
      const result = await searchService.search('leaking faucet', { skipExpansion: true });

      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].task.id).toBe('4'); // Kitchen sink task
    });

    it('should return high scores for exact matches', async () => {
      const result = await searchService.search('Buy groceries', { skipExpansion: true });

      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].task.content).toBe('Buy groceries');
      expect(result.matches[0].score).toBeGreaterThan(0.7);
    });
  });

  describe('Query Expansion Integration', () => {
    it('should expand queries and search against variations', async () => {
      const result = await searchService.search('email Jon about Coworking');

      // Should have query expansion info
      expect(result.query.original).toBe('email Jon about Coworking');
      expect(result.query.variations.length).toBeGreaterThan(0);
    });

    it('should report which method was used', async () => {
      const result = await searchService.search('groceries');

      expect(['exact', 'fuzzy', 'semantic']).toContain(result.method);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty task list', async () => {
      mockStorage.getTasks.mockResolvedValueOnce([]);
      
      const result = await searchService.search('anything');

      expect(result.matches).toHaveLength(0);
    });

    it('should handle task IDs directly', async () => {
      // UUID-like string should trigger exact strategy (when using query expansion)
      const result = await searchService.search('12345678-1234-1234-1234-123456789012');

      // Should recognize it's a UUID and use exact strategy
      expect(result.query.strategy).toBe('exact');
      expect(result.method).toBe('semantic'); // Falls back since ID doesn't exist
    });

    it('should respect limit option', async () => {
      const result = await searchService.search('task', { limit: 2, skipExpansion: true });

      expect(result.matches.length).toBeLessThanOrEqual(2);
    });
  });
});

describe('QueryExpansionService', () => {
  let queryExpansion: QueryExpansionService;
  let mockClaude: any;

  beforeEach(() => {
    mockClaude = {
      query: vi.fn().mockResolvedValue({
        normalized: 'test query',
        variations: ['test', 'query', 'test query'],
        entities: [],
        strategy: 'fuzzy',
      }),
    };

    queryExpansion = new QueryExpansionService(mockClaude);
  });

  it('should recognize task IDs and skip expansion', async () => {
    const result = await queryExpansion.expandQuery('12345678-1234-1234-1234-123456789012');

    expect(result.strategy).toBe('exact');
    expect(mockClaude.query).not.toHaveBeenCalled();
  });

  it('should fall back gracefully on API error', async () => {
    mockClaude.query.mockRejectedValueOnce(new Error('API Error'));

    const result = await queryExpansion.expandQuery('test query');

    expect(result.variations.length).toBeGreaterThan(0);
    expect(result.original).toBe('test query');
  });

  it('should perform local expansion without API', () => {
    const result = queryExpansion.fallbackExpansion('send email to John');

    expect(result.variations).toContain('send email to john');
    expect(result.variations.some(v => v.includes('send'))).toBe(true);
    expect(result.variations.some(v => v.includes('john'))).toBe(true);
  });
});


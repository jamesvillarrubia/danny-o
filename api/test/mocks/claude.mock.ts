/**
 * Mock Claude Service
 * 
 * Mock implementation of ClaudeService for testing.
 * 
 * Used as a FALLBACK when no API key is available (e.g., CI without credentials).
 * When API keys are available, prefer real deterministic calls with:
 *   - AI_DETERMINISTIC=true
 *   - AI_TEMPERATURE=0.0
 *   - AI_SEED=12345 (optional)
 * 
 * @see test/TESTING_STRATEGY.md for full documentation
 */

import { Logger } from '@nestjs/common';
import { vi } from 'vitest';

// Import fixtures for fallback responses
let aiFixtures: any = null;
try {
  // Dynamic import to handle cases where fixtures don't exist
  aiFixtures = require('../fixtures/ai-responses');
} catch {
  // Fixtures not available - will use inline defaults
}

export class MockClaudeService {
  private readonly logger = new Logger(MockClaudeService.name);
  
  /**
   * Override responses for specific prompt types
   * Takes precedence over fixture-based responses
   */
  private overrideResponses: Map<string, any> = new Map();

  /**
   * Simulated deterministic mode (mirrors real ClaudeService)
   */
  private deterministicMode: boolean;
  private temperature: number;
  private seed?: number;

  constructor() {
    this.deterministicMode = process.env.AI_DETERMINISTIC === 'true';
    this.temperature = this.deterministicMode ? 0.0 : 0.7;
    this.seed = process.env.AI_SEED ? parseInt(process.env.AI_SEED, 10) : undefined;
  }

  /**
   * Query the mock Claude service
   * Returns deterministic responses based on prompt type detection
   */
  async query(prompt: string, options: any = {}): Promise<any> {
    this.logger.debug(`Mock query: ${prompt.substring(0, 60)}...`);

    // Check for override responses first
    for (const [key, value] of this.overrideResponses.entries()) {
      if (prompt.toLowerCase().includes(key.toLowerCase())) {
        return this.transformResponse(key, value);
      }
    }

    // Use fixture-based responses if available
    if (aiFixtures?.detectPromptType && aiFixtures?.getAIResponse) {
      const promptType = aiFixtures.detectPromptType(prompt);
      if (promptType) {
        return aiFixtures.getAIResponse(promptType);
      }
    }

    // Inline fallback responses (when fixtures not available)
    return this.getInlineResponse(prompt);
  }

  /**
   * Get inline fallback response based on prompt content
   */
  private getInlineResponse(prompt: string): any {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('classify') || lowerPrompt.includes('categorize')) {
      return [
        { taskIndex: 0, taskId: 'task_1', category: 'work', confidence: 0.9, reasoning: 'Mock classification' },
      ];
    }
    
    if (lowerPrompt.includes('estimate') || lowerPrompt.includes('duration')) {
      return { estimate: '30-45 minutes', timeEstimateMinutes: 37, size: 'M', confidence: 0.8, reasoning: 'Mock estimate' };
    }
    
    if (lowerPrompt.includes('prioritize')) {
      return { 
        prioritized: [{ taskIndex: 0, taskId: 'task_1', priority: 'high', suggestedOrder: 1, reasoning: 'Mock priority' }],
        recommendations: { startWith: 'task_1', defer: [], delegate: [] },
      };
    }
    
    if (lowerPrompt.includes('subtask') || lowerPrompt.includes('break down') || lowerPrompt.includes('breakdown')) {
      return { 
        subtasks: [{ content: 'Mock subtask', order: 1, timeEstimate: '30 min', needsSupplies: false, supplies: [] }],
        totalEstimate: '30 minutes',
        supplyList: [],
        notes: 'Mock breakdown',
      };
    }
    
    if (lowerPrompt.includes('plan') || lowerPrompt.includes('schedule')) {
      return { 
        summary: 'Mock plan',
        notes: 'Mock planning notes',
        today: { tasks: [], totalTime: '0min' },
        thisWeek: { tasks: [], reasoning: '' },
        needsSupplies: { tasks: [], shoppingList: [], suggestion: '' },
        delegateToSpouse: { tasks: [], reasoning: '' },
      };
    }
    
    if (lowerPrompt.includes('filter') || lowerPrompt.includes('search')) {
      return { matches: [], interpretation: 'Mock search' };
    }
    
    if (lowerPrompt.includes('insight') || lowerPrompt.includes('productivity')) {
      return { 
        insights: [{ type: 'pattern', description: 'Mock insight', data: {} }],
        recommendations: ['Mock recommendation'],
      };
    }

    // Default empty response
    this.logger.warn('No matching mock response, returning empty object');
    return {};
  }

  /**
   * Transform override response to match service expectations
   */
  private transformResponse(key: string, value: any): any {
    // Classification response - add taskIndex
    if (value?.tasks) {
      return value.tasks.map((t: any, idx: number) => ({ ...t, taskIndex: idx }));
    }
    
    // Estimate response - transform field names
    if (value?.timeEstimate) {
      return {
        estimate: value.timeEstimate,
        timeEstimateMinutes: value.timeEstimateMinutes,
        size: value.size,
        confidence: value.confidence,
        reasoning: value.reasoning,
      };
    }
    
    // Prioritize response - add taskIndex
    if (value?.prioritized) {
      return {
        prioritized: value.prioritized.map((p: any, idx: number) => ({ ...p, taskIndex: idx })),
        recommendations: value.recommendations,
      };
    }
    
    return value;
  }

  /**
   * Batch query multiple prompts
   */
  async batchQuery(prompts: string[], options: any = {}): Promise<any[]> {
    return Promise.all(prompts.map((prompt) => this.query(prompt, options)));
  }

  /**
   * Mock streaming query
   */
  async *queryStream(prompt: string, options: any = {}): AsyncGenerator<string> {
    const response = await this.query(prompt, options);
    const text = typeof response === 'string' ? response : JSON.stringify(response);
    for (const word of text.split(' ')) {
      yield word + ' ';
    }
  }

  /**
   * Estimate token count
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Test connection (always succeeds in mock)
   */
  async testConnection(): Promise<boolean> {
    return true;
  }

  /**
   * Get mock Anthropic client
   */
  getClient(): any {
    const mockResponse = this.getInlineResponse('classify');
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
          stop_reason: 'end_turn',
        }),
      },
    };
  }

  /**
   * Get model name
   */
  getModel(): string {
    return 'claude-3-5-sonnet-20241022';
  }

  /**
   * Get model info (mirrors real service)
   */
  getModelInfo(): { model: string; maxTokens: number; temperature: number; deterministicMode: boolean; seed?: number } {
    return {
      model: this.getModel(),
      maxTokens: 4096,
      temperature: this.temperature,
      deterministicMode: this.deterministicMode,
      seed: this.seed,
    };
  }

  /**
   * Check if deterministic mode is enabled
   */
  isDeterministic(): boolean {
    return this.deterministicMode;
  }

  // ============================================================
  // Override methods (for tests that need specific responses)
  // ============================================================

  /**
   * Set a custom response for a specific prompt key
   */
  setMockResponse(promptKey: string, response: any): void {
    this.overrideResponses.set(promptKey, response);
  }

  /**
   * Clear all override responses
   */
  clearMockResponses(): void {
    this.overrideResponses.clear();
  }

  /**
   * Check if there are any override responses set
   */
  hasOverrides(): boolean {
    return this.overrideResponses.size > 0;
  }
}

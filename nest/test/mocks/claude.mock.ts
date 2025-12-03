/**
 * Mock Claude Service
 * 
 * Mock implementation of ClaudeService for testing.
 */

import { Logger } from '@nestjs/common';

export class MockClaudeService {
  private readonly logger = new Logger(MockClaudeService.name);
  private mockResponses: Map<string, any> = new Map();

  /**
   * Mock query method
   */
  async query(prompt: string, options: any = {}): Promise<any> {
    this.logger.log(`Mock query called with prompt: ${prompt.substring(0, 80)}...`);

    const lowerPrompt = prompt.toLowerCase();

    // Check if we have a specific mock response for this prompt
    for (const [key, value] of this.mockResponses.entries()) {
      const lowerKey = key.toLowerCase();
      // Handle both "breakdown" and "break down" variations
      // Also check if the prompt contains the key with spaces removed
      const promptNoSpaces = lowerPrompt.replace(/\s+/g, '');
      const keyNoSpaces = lowerKey.replace(/\s+/g, '');
      
      if (lowerPrompt.includes(lowerKey) || promptNoSpaces.includes(keyNoSpaces)) {
        // If the value has a 'tasks' property (classification response), return with taskIndex
        if (value && value.tasks) {
          return value.tasks.map((t: any, idx: number) => ({
            ...t,
            taskIndex: idx,
          }));
        }
        // Transform estimate response to match service expectations
        if (value && value.timeEstimate) {
          return {
            estimate: value.timeEstimate,
            timeEstimateMinutes: value.timeEstimateMinutes,
            size: value.size,
            confidence: value.confidence,
            reasoning: value.reasoning,
          };
        }
        // Transform prioritize response to use taskIndex
        if (value && value.prioritized) {
          return {
            prioritized: value.prioritized.map((p: any, idx: number) => ({
              ...p,
              taskIndex: idx,
            })),
            recommendations: value.recommendations,
          };
        }
        return value;
      }
    }

    // Intelligent defaults based on prompt content
    if (lowerPrompt.includes('classify')) {
      return []; // Empty classification results
    }
    if (lowerPrompt.includes('estimate') || lowerPrompt.includes('duration')) {
      return { estimate: '1-2 hours', size: 'M', confidence: 0.7, reasoning: 'Mock estimate' };
    }
    if (lowerPrompt.includes('prioritize')) {
      return { prioritized: [], recommendations: { startWith: '', defer: [], delegate: [] } };
    }
    if (lowerPrompt.includes('subtask') || lowerPrompt.includes('break down') || lowerPrompt.includes('breakdown')) {
      return { subtasks: [], totalEstimate: '0 hours', supplyList: [], notes: '' };
    }
    if (lowerPrompt.includes('plan') || lowerPrompt.includes('schedule') || lowerPrompt.includes('daily plan')) {
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
      return { matches: [], interpretation: '' };
    }
    if (lowerPrompt.includes('insight') || lowerPrompt.includes('productivity') || lowerPrompt.includes('analyze patterns')) {
      return { 
        insights: [{ type: 'pattern', description: 'Mock insight', data: {} }],
        recommendations: ['Mock recommendation'],
      };
    }

    // Default mock response
    return {};
  }

  /**
   * Mock batch query method
   */
  async batchQuery(prompts: string[], options: any = {}): Promise<any[]> {
    return Promise.all(prompts.map((prompt) => this.query(prompt, options)));
  }

  /**
   * Mock streaming query
   */
  async *queryStream(prompt: string, options: any = {}): AsyncGenerator<string> {
    yield 'Mock ';
    yield 'streaming ';
    yield 'response';
  }

  /**
   * Mock token estimation
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Mock connection test
   */
  async testConnection(): Promise<boolean> {
    return true;
  }

  /**
   * Get the mock client (for agentic tools)
   */
  getClient(): any {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Mock response' }],
          stop_reason: 'end_turn',
        }),
      },
    };
  }

  /**
   * Get the model name
   */
  getModel(): string {
    return 'claude-3-5-sonnet-20241022';
  }

  // Helper methods for testing
  setMockResponse(promptKey: string, response: any): void {
    this.mockResponses.set(promptKey, response);
  }

  clearMockResponses(): void {
    this.mockResponses.clear();
  }
}


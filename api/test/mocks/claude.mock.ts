/**
 * Mock Claude Service
 * 
 * Mock implementation of ClaudeService for testing.
 * Uses static fixtures for deterministic responses by default.
 */

import { Logger } from '@nestjs/common';
import { vi } from 'vitest';
import { detectPromptType, getAIResponse, AIPromptType } from '../fixtures/ai-responses';

export class MockClaudeService {
  private readonly logger = new Logger(MockClaudeService.name);
  
  /**
   * Override responses for specific prompt types (for backward compatibility)
   * If set, these take precedence over static fixtures
   */
  private overrideResponses: Map<string, any> = new Map();

  /**
   * Query the mock Claude service
   * Returns static fixture responses based on prompt type detection
   */
  async query(prompt: string, options: any = {}): Promise<any> {
    this.logger.debug(`Mock query called with prompt: ${prompt.substring(0, 80)}...`);

    // Check for override responses first (backward compatibility)
    for (const [key, value] of this.overrideResponses.entries()) {
      if (prompt.toLowerCase().includes(key.toLowerCase())) {
        return this.transformResponse(key, value);
      }
    }

    // Use static fixtures based on prompt type detection
    const promptType = detectPromptType(prompt);
    if (promptType) {
      return getAIResponse(promptType);
    }

    // Fallback empty response
    this.logger.warn(`No fixture found for prompt, returning empty response`);
    return {};
  }

  /**
   * Transform override response to match service expectations
   * Preserves backward compatibility with existing test setups
   */
  private transformResponse(key: string, value: any): any {
    // Classification response - add taskIndex
    if (value && value.tasks) {
      return value.tasks.map((t: any, idx: number) => ({
        ...t,
        taskIndex: idx,
      }));
    }
    
    // Estimate response - transform field names
    if (value && value.timeEstimate) {
      return {
        estimate: value.timeEstimate,
        timeEstimateMinutes: value.timeEstimateMinutes,
        size: value.size,
        confidence: value.confidence,
        reasoning: value.reasoning,
      };
    }
    
    // Prioritize response - add taskIndex
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

  /**
   * Batch query multiple prompts
   */
  async batchQuery(prompts: string[], options: any = {}): Promise<any[]> {
    return Promise.all(prompts.map((prompt) => this.query(prompt, options)));
  }

  /**
   * Mock streaming query - yields mock chunks
   */
  async *queryStream(prompt: string, options: any = {}): AsyncGenerator<string> {
    const response = await this.query(prompt, options);
    const text = typeof response === 'string' 
      ? response 
      : JSON.stringify(response);
    
    // Simulate streaming by yielding chunks
    const words = text.split(' ');
    for (const word of words) {
      yield word + ' ';
    }
  }

  /**
   * Estimate token count for text
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
   * Get the mock Anthropic client (for agentic tools)
   */
  getClient(): any {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify(getAIResponse('classify')) }],
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

  // ============================================================
  // Override methods (for backward compatibility with existing tests)
  // ============================================================

  /**
   * Set a custom response for a specific prompt key
   * @deprecated Prefer using static fixtures in test/fixtures/ai-responses/
   */
  setMockResponse(promptKey: string, response: any): void {
    this.overrideResponses.set(promptKey, response);
  }

  /**
   * Clear all override responses (reverts to static fixtures)
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

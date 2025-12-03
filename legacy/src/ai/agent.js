/**
 * AI Agent - Claude Integration
 * 
 * Wrapper around Claude AI for task management operations.
 * Handles:
 * - API communication with Claude
 * - Structured output parsing (JSON mode)
 * - Context building from task history
 * - Batch processing for efficiency
 * - Error handling and retries
 * 
 * All responses are parsed as JSON for reliable data extraction.
 */

import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './prompts.js';

export class AIAgent {
  /**
   * @param {string} apiKey - Claude API key
   * @param {Object} options - Configuration options
   * @param {string} [options.model] - Claude model to use
   * @param {number} [options.maxTokens] - Max tokens for responses
   * @param {number} [options.temperature] - Temperature for responses
   */
  constructor(apiKey, options = {}) {
    if (!apiKey) {
      throw new Error('Claude API key is required');
    }

    this.client = new Anthropic({ apiKey });
    this.model = options.model || 'claude-3-5-sonnet-20241022';
    this.maxTokens = options.maxTokens || 4096;
    this.temperature = options.temperature || 0.7;
  }

  /**
   * Send a prompt to Claude and get structured JSON response
   * @param {string} prompt - User prompt
   * @param {Object} options - Request options
   * @param {number} [options.temperature] - Override default temperature
   * @param {number} [options.maxTokens] - Override default max tokens
   * @returns {Promise<Object>} Parsed JSON response
   */
  async query(prompt, options = {}) {
    try {
      console.log('[AI] Sending query to Claude...');

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature ?? this.temperature,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const textContent = response.content[0].text;
      console.log('[AI] Received response from Claude');

      // Parse JSON from response
      const jsonMatch = textContent.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('[AI] No JSON found in response:', textContent);
        throw new Error('AI response did not contain valid JSON');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;

    } catch (error) {
      if (error.status === 429) {
        console.error('[AI] Rate limit exceeded');
        throw new Error('AI rate limit exceeded. Please try again later.');
      }

      if (error.status === 401) {
        console.error('[AI] Invalid API key');
        throw new Error('Invalid Claude API key. Please check your configuration.');
      }

      console.error('[AI] Query failed:', error.message);
      throw error;
    }
  }

  /**
   * Process multiple prompts in batch with rate limiting
   * @param {Array<string>} prompts - Array of prompts
   * @param {Object} options - Batch options
   * @param {number} [options.batchSize] - Number to process at once
   * @param {number} [options.delayMs] - Delay between batches
   * @returns {Promise<Array>} Array of results
   */
  async batchQuery(prompts, options = {}) {
    console.log(`[AI] Processing ${prompts.length} prompts in batch...`);

    const batchSize = options.batchSize || 5;
    const delayMs = options.delayMs || 1000;
    const results = [];

    for (let i = 0; i < prompts.length; i += batchSize) {
      const batch = prompts.slice(i, i + batchSize);

      console.log(`[AI] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(prompts.length / batchSize)}`);

      const batchResults = await Promise.allSettled(
        batch.map(prompt => this.query(prompt))
      );

      results.push(...batchResults);

      // Rate limit courtesy delay
      if (i + batchSize < prompts.length) {
        await this._delay(delayMs);
      }
    }

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[AI] Batch complete: ${successful} success, ${failed} failed`);

    return results;
  }

  /**
   * Stream a response from Claude (for interactive use)
   * @param {string} prompt - User prompt
   * @param {Function} onToken - Callback for each token
   * @returns {Promise<string>} Complete response
   */
  async stream(prompt, onToken) {
    console.log('[AI] Starting streaming query...');

    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    let fullText = '';

    stream.on('text', (text) => {
      fullText += text;
      if (onToken) {
        onToken(text);
      }
    });

    await stream.finalMessage();

    console.log('[AI] Streaming complete');
    return fullText;
  }

  /**
   * Get token count estimate for a prompt
   * @param {string} prompt - Prompt to estimate
   * @returns {number} Approximate token count
   */
  estimateTokens(prompt) {
    // Rough estimate: ~4 characters per token
    return Math.ceil(prompt.length / 4);
  }

  /**
   * Test connection to Claude API
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    try {
      await this.query('Respond with JSON: {"status": "ok"}');
      console.log('[AI] Connection test successful');
      return true;
    } catch (error) {
      console.error('[AI] Connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get current model information
   * @returns {Object} Model details
   */
  getModelInfo() {
    return {
      model: this.model,
      maxTokens: this.maxTokens,
      temperature: this.temperature
    };
  }

  /**
   * Delay helper for rate limiting
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


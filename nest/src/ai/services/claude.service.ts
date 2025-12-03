/**
 * Claude Service
 * 
 * Wrapper around Anthropic Claude AI for task management operations.
 * Handles API communication, structured output parsing, and error handling.
 */

import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import { PromptsService } from '../prompts/prompts.service';

interface QueryOptions {
  temperature?: number;
  maxTokens?: number;
}

interface BatchOptions {
  batchSize?: number;
  delayMs?: number;
}

@Injectable()
export class ClaudeService implements OnModuleInit {
  private readonly logger = new Logger(ClaudeService.name);
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(PromptsService) private readonly promptsService: PromptsService,
  ) {
    // Use the June 2024 version which is more widely available
    // Can be overridden via CLAUDE_MODEL env var
    this.model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20240620';
    this.maxTokens = 4096;
    this.temperature = 0.7;
  }

  onModuleInit() {
    const apiKey = this.configService?.get<string>('CLAUDE_API_KEY') || process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      this.logger.warn('Claude API key not found - AI features will be unavailable');
      return;
    }

    this.client = new Anthropic({ apiKey });
    this.logger.log(`Initialized with model: ${this.model}`);
  }

  /**
   * Get the Anthropic client (for advanced use cases like agentic tools)
   */
  getClient(): Anthropic {
    return this.client;
  }

  /**
   * Get the current model name
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Send a prompt to Claude and get structured JSON response
   */
  async query(prompt: string, options: QueryOptions = {}): Promise<any> {
    try {
      this.logger.log('Sending query to Claude...');

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature ?? this.temperature,
        system: this.promptsService.SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const textContent = response.content[0].type === 'text' 
        ? response.content[0].text 
        : '';

      this.logger.log('Received response from Claude');

      // Parse JSON from response
      const jsonMatch = textContent.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.error(`No JSON found in response: ${textContent}`);
        throw new Error('AI response did not contain valid JSON');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    } catch (error: any) {
      if (error.status === 429) {
        this.logger.error('Rate limit exceeded');
        throw new Error('AI rate limit exceeded. Please try again later.');
      }

      if (error.status === 401) {
        this.logger.error('Invalid API key');
        throw new Error('Invalid Claude API key. Please check your configuration.');
      }

      this.logger.error(`Query failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process multiple prompts in batch with rate limiting
   */
  async batchQuery(prompts: string[], options: BatchOptions = {}): Promise<PromiseSettledResult<any>[]> {
    this.logger.log(`Processing ${prompts.length} prompts in batch...`);

    const batchSize = options.batchSize || 5;
    const delayMs = options.delayMs || 1000;
    const results: PromiseSettledResult<any>[] = [];

    for (let i = 0; i < prompts.length; i += batchSize) {
      const batch = prompts.slice(i, i + batchSize);

      this.logger.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(prompts.length / batchSize)}`,
      );

      const batchResults = await Promise.allSettled(batch.map((prompt) => this.query(prompt)));

      results.push(...batchResults);

      // Rate limit courtesy delay
      if (i + batchSize < prompts.length) {
        await this.delay(delayMs);
      }
    }

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    this.logger.log(`Batch complete: ${successful} success, ${failed} failed`);

    return results;
  }

  /**
   * Stream a response from Claude (for interactive use)
   */
  async stream(prompt: string, onToken: (token: string) => void): Promise<string> {
    this.logger.log('Starting streaming query...');

    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: this.promptsService.SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    let fullText = '';

    stream.on('text', (text) => {
      fullText += text;
      if (onToken) {
        onToken(text);
      }
    });

    await stream.finalMessage();

    this.logger.log('Streaming complete');
    return fullText;
  }

  /**
   * Get token count estimate for a prompt
   */
  estimateTokens(prompt: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(prompt.length / 4);
  }

  /**
   * Test connection to Claude API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.query('Respond with JSON: {"status": "ok"}');
      this.logger.log('Connection test successful');
      return true;
    } catch (error: any) {
      this.logger.error(`Connection test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get current model information
   */
  getModelInfo(): { model: string; maxTokens: number; temperature: number } {
    return {
      model: this.model,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
    };
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}


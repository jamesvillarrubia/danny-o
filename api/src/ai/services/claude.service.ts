/**
 * Claude Service
 * 
 * Wrapper around Anthropic Claude AI for task management operations.
 * Handles API communication, structured output parsing, and error handling.
 */

import { Injectable, Logger, OnModuleInit, Inject, Optional } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import { PromptsService } from '../prompts/prompts.service';
import { IStorageAdapter } from '../../common/interfaces';

interface QueryOptions {
  temperature?: number;
  maxTokens?: number;
  /**
   * Seed for deterministic output. When set with temperature=0,
   * provides reproducible results (best effort by API).
   */
  seed?: number;
  // Logging options
  interactionType?: string;
  taskId?: string;
  inputContext?: any;
}

interface BatchOptions {
  batchSize?: number;
  delayMs?: number;
}

@Injectable()
export class ClaudeService implements OnModuleInit {
  private readonly logger = new Logger(ClaudeService.name);
  private client?: Anthropic;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private defaultSeed?: number;
  private deterministicMode: boolean;

  constructor(
    @Inject(PromptsService) private readonly promptsService: PromptsService,
    @Optional() @Inject(ConfigService) private readonly configService?: ConfigService,
    @Optional() @Inject('IStorageAdapter') private readonly storage?: IStorageAdapter,
  ) {
    // Use the June 2024 version which is more widely available
    // Can be overridden via CLAUDE_MODEL env var
    this.model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20240620';
    this.maxTokens = 4096;
    
    // Deterministic mode configuration
    // When AI_DETERMINISTIC=true, use temperature=0 and optional seed for reproducible results
    this.deterministicMode = process.env.AI_DETERMINISTIC === 'true';
    
    // Temperature: 0.0 for maximum determinism, 0.7 for creativity
    // Can be overridden via AI_TEMPERATURE env var
    const envTemp = process.env.AI_TEMPERATURE;
    if (envTemp !== undefined) {
      this.temperature = parseFloat(envTemp);
    } else {
      this.temperature = this.deterministicMode ? 0.0 : 0.7;
    }
    
    // Seed for deterministic sampling (optional)
    // Set via AI_SEED env var for reproducible test results
    const envSeed = process.env.AI_SEED;
    if (envSeed !== undefined) {
      this.defaultSeed = parseInt(envSeed, 10);
    }
  }

  onModuleInit() {
    // Try to get API key from ConfigService first, then fall back to process.env
    let apiKey: string | undefined;
    if (this.configService) {
      apiKey = this.configService.get<string>('CLAUDE_API_KEY');
    }
    if (!apiKey) {
      apiKey = process.env.CLAUDE_API_KEY;
    }
    
    if (!apiKey) {
      this.logger.warn('Claude API key not found - AI features will be unavailable');
      this.logger.warn('Please set CLAUDE_API_KEY in your environment variables or .env file');
      return;
    }

    this.client = new Anthropic({ apiKey });
    
    // Log initialization with deterministic settings
    if (this.deterministicMode) {
      this.logger.log(`Initialized in DETERMINISTIC mode: model=${this.model}, temp=${this.temperature}, seed=${this.defaultSeed ?? 'none'}`);
    } else {
      this.logger.log(`Initialized with model: ${this.model}, temp=${this.temperature}`);
    }
  }

  /**
   * Get the Anthropic client (for advanced use cases like agentic tools)
   */
  getClient(): Anthropic {
    if (!this.client) {
      throw new Error('Claude client not initialized. Please check that CLAUDE_API_KEY is set in your environment variables.');
    }
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
    if (!this.client) {
      throw new Error('Claude client not initialized. Please check that CLAUDE_API_KEY is set in your environment variables.');
    }
    
    const startTime = Date.now();
    const effectiveTemp = options.temperature ?? this.temperature;
    const effectiveSeed = options.seed ?? this.defaultSeed;
    
    try {
      if (this.deterministicMode) {
        this.logger.debug(`Deterministic query: temp=${effectiveTemp}, seed=${effectiveSeed ?? 'none'}`);
      } else {
        this.logger.log('Sending query to Claude...');
      }

      // Build request parameters
      const requestParams: Anthropic.MessageCreateParams = {
        model: this.model,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: effectiveTemp,
        system: this.promptsService.SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      };
      
      // Add metadata for deterministic mode (seed support may vary by API version)
      if (effectiveSeed !== undefined) {
        // Note: seed support depends on API version. If not supported, it's ignored.
        (requestParams as any).metadata = {
          ...(requestParams as any).metadata,
          user_id: `seed_${effectiveSeed}`,  // Use user_id as a pseudo-seed identifier
        };
      }

      const response = await this.client.messages.create(requestParams);

      const textContent = response.content[0].type === 'text' 
        ? response.content[0].text 
        : '';

      this.logger.log('Received response from Claude');

      // Parse JSON from response
      const jsonMatch = textContent.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.error(`No JSON found in response: ${textContent}`);
        
        // Log failed interaction
        await this.logInteraction({
          interactionType: options.interactionType || 'query',
          taskId: options.taskId,
          inputContext: options.inputContext,
          promptUsed: prompt,
          aiResponse: textContent,
          success: false,
          errorMessage: 'AI response did not contain valid JSON',
          latencyMs: Date.now() - startTime,
        });
        
        throw new Error('AI response did not contain valid JSON');
      }

      // Sanitize JSON - fix control characters in string literals
      // Claude sometimes returns newlines/tabs inside strings which is invalid JSON
      const sanitizedJson = this.sanitizeJsonString(jsonMatch[0]);
      const parsed = JSON.parse(sanitizedJson);
      
      // Log successful interaction
      await this.logInteraction({
        interactionType: options.interactionType || 'query',
        taskId: options.taskId,
        inputContext: options.inputContext,
        promptUsed: prompt,
        aiResponse: parsed,
        success: true,
        latencyMs: Date.now() - startTime,
      });
      
      return parsed;
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      
      if (error.status === 429) {
        this.logger.error('Rate limit exceeded');
        await this.logInteraction({
          interactionType: options.interactionType || 'query',
          taskId: options.taskId,
          inputContext: options.inputContext,
          promptUsed: prompt,
          success: false,
          errorMessage: 'Rate limit exceeded',
          latencyMs,
        });
        throw new Error('AI rate limit exceeded. Please try again later.');
      }

      if (error.status === 401) {
        this.logger.error('Invalid API key');
        throw new Error('Invalid Claude API key. Please check your configuration.');
      }

      this.logger.error(`Query failed: ${error.message}`);
      
      // Log error (but not for already-handled errors)
      if (!error.message?.includes('AI response did not contain valid JSON')) {
        await this.logInteraction({
          interactionType: options.interactionType || 'query',
          taskId: options.taskId,
          inputContext: options.inputContext,
          promptUsed: prompt,
          success: false,
          errorMessage: error.message,
          latencyMs,
        });
      }
      
      throw error;
    }
  }

  /**
   * Send a prompt to Claude and get plain text response (no JSON parsing)
   */
  async queryText(prompt: string, options: QueryOptions = {}): Promise<string> {
    if (!this.client) {
      throw new Error('Claude client not initialized. Please check that CLAUDE_API_KEY is set in your environment variables.');
    }
    
    try {
      this.logger.log('Sending text query to Claude...');

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

      this.logger.log('Received text response from Claude');
      return textContent.trim();
    } catch (error: any) {
      if (error.status === 429) {
        this.logger.error('Rate limit exceeded');
        throw new Error('AI rate limit exceeded. Please try again later.');
      }

      if (error.status === 401) {
        this.logger.error('Invalid API key');
        throw new Error('Invalid Claude API key. Please check your configuration.');
      }

      this.logger.error(`Text query failed: ${error.message}`);
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
    if (!this.client) {
      throw new Error('Claude client not initialized. Please check that CLAUDE_API_KEY is set in your environment variables.');
    }
    
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
  getModelInfo(): { model: string; maxTokens: number; temperature: number; deterministicMode: boolean; seed?: number } {
    return {
      model: this.model,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
      deterministicMode: this.deterministicMode,
      seed: this.defaultSeed,
    };
  }

  /**
   * Check if deterministic mode is enabled
   */
  isDeterministic(): boolean {
    return this.deterministicMode;
  }

  /**
   * Sanitize JSON string to fix control characters in string literals.
   * Claude sometimes returns actual newlines/tabs inside JSON strings which is invalid.
   */
  private sanitizeJsonString(json: string): string {
    // Replace control characters inside string values with their escaped equivalents
    // This regex finds strings and replaces unescaped control chars within them
    let result = '';
    let inString = false;
    let escaped = false;
    
    for (let i = 0; i < json.length; i++) {
      const char = json[i];
      const code = char.charCodeAt(0);
      
      if (escaped) {
        result += char;
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        result += char;
        escaped = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        result += char;
        continue;
      }
      
      // If we're in a string and hit a control character, escape it
      if (inString && code < 32) {
        if (code === 10) {
          result += '\\n';  // newline
        } else if (code === 13) {
          result += '\\r';  // carriage return
        } else if (code === 9) {
          result += '\\t';  // tab
        } else {
          result += `\\u${code.toString(16).padStart(4, '0')}`;
        }
      } else {
        result += char;
      }
    }
    
    return result;
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log AI interaction for analysis and prompt optimization
   */
  private async logInteraction(data: {
    interactionType: string;
    taskId?: string;
    inputContext?: any;
    promptUsed?: string;
    aiResponse?: any;
    actionTaken?: string;
    success: boolean;
    errorMessage?: string;
    latencyMs?: number;
  }): Promise<void> {
    // Only log if storage is available
    if (!this.storage?.logAIInteraction) {
      return;
    }

    try {
      await this.storage.logAIInteraction({
        ...data,
        modelUsed: this.model,
      });
    } catch (error: any) {
      // Don't fail the main operation if logging fails
      this.logger.warn(`Failed to log AI interaction: ${error.message}`);
    }
  }
}


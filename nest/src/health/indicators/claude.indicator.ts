/**
 * Claude API Health Indicator
 * 
 * Checks if the Claude API is accessible and responding.
 */

import { Injectable, Inject } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ClaudeService } from '../../ai/services/claude.service';

@Injectable()
export class ClaudeHealthIndicator extends HealthIndicator {
  constructor(@Inject(ClaudeService) private readonly claudeService: ClaudeService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Test connection with a minimal query
      const isConnected = await this.claudeService.testConnection();
      
      if (!isConnected) {
        throw new Error('Connection test failed');
      }
      
      return this.getStatus(key, true, {
        message: 'Claude API is healthy',
      });
    } catch (error: any) {
      const errorMessage = error.status === 401 
        ? 'Invalid API key' 
        : error.status === 429
        ? 'Rate limit exceeded'
        : 'API connection failed';

      throw new HealthCheckError(
        'Claude API check failed',
        this.getStatus(key, false, {
          message: errorMessage,
          statusCode: error.status,
        }),
      );
    }
  }
}


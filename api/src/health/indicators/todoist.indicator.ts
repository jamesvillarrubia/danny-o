/**
 * Todoist API Health Indicator
 * 
 * Checks if the Todoist API is accessible and responding.
 */

import { Injectable, Inject } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ITaskProvider } from '../../common/interfaces';

@Injectable()
export class TodoistHealthIndicator extends HealthIndicator {
  constructor(
    @Inject('ITaskProvider') 
    private readonly taskProvider: ITaskProvider,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Attempt to fetch a small number of tasks to verify API connectivity
      // This is a lightweight operation that confirms authentication and connectivity
      await this.taskProvider.getTasks({ limit: 1 });
      
      return this.getStatus(key, true, {
        message: 'Todoist API is healthy',
      });
    } catch (error: any) {
      // Log the error but don't expose sensitive details
      const errorMessage = error.response?.status === 401 
        ? 'Invalid API key' 
        : error.response?.status === 429
        ? 'Rate limit exceeded'
        : 'API connection failed';

      throw new HealthCheckError(
        'Todoist API check failed',
        this.getStatus(key, false, {
          message: errorMessage,
          statusCode: error.response?.status,
        }),
      );
    }
  }
}


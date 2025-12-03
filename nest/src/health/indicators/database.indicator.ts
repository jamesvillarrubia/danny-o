/**
 * Database Health Indicator
 * 
 * Checks if the database connection is healthy by attempting a simple query.
 */

import { Injectable, Inject } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { IStorageAdapter } from '../../common/interfaces';

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(
    @Inject('IStorageAdapter') 
    private readonly storage: IStorageAdapter,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Attempt a simple query to verify database connectivity
      await this.storage.getLastSyncTime();
      
      return this.getStatus(key, true, {
        message: 'Database connection is healthy',
      });
    } catch (error: any) {
      throw new HealthCheckError(
        'Database check failed',
        this.getStatus(key, false, {
          message: error.message,
        }),
      );
    }
  }
}


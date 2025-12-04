/**
 * Sentry Module
 * 
 * Error tracking and performance monitoring with Sentry.
 * Uses Sentry's free tier for error capture.
 */

import { Module, Global, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import { SentryFilter } from './sentry.filter';
import { APP_FILTER } from '@nestjs/core';

@Global()
@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryFilter,
    },
  ],
})
export class SentryModule implements OnModuleInit {
  private readonly logger = new Logger(SentryModule.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const dsn = this.configService.get<string>('SENTRY_DSN');
    const environment = this.configService.get<string>('NODE_ENV', 'development');

    if (!dsn) {
      this.logger.warn('SENTRY_DSN not configured - error tracking disabled');
      return;
    }

    Sentry.init({
      dsn,
      environment,
      
      // Performance monitoring
      tracesSampleRate: 0.1, // 10% of transactions
      
      // Capture release information
      release: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
      
      // Integrations
      integrations: [
        // HTTP integration for tracing requests
        Sentry.httpIntegration(),
      ],
      
      // Filter sensitive data
      beforeSend(event) {
        // Don't send events in development
        if (environment === 'development') {
          return null;
        }
        
        // Scrub sensitive data
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['x-todoist-hmac-sha256'];
        }
        
        return event;
      },
    });

    this.logger.log(`Sentry initialized (${environment})`);
  }
}


/**
 * Sentry Exception Filter
 * 
 * Captures unhandled exceptions and sends them to Sentry.
 */

import { Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

@Catch()
export class SentryFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(SentryFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();

    // Determine status code
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Only send to Sentry for 5xx errors (server errors)
    if (status >= 500) {
      // Set Sentry context
      Sentry.setContext('request', {
        method: request.method,
        url: request.url,
        query: request.query,
        userAgent: request.headers?.['user-agent'],
      });

      // Capture the exception
      Sentry.captureException(exception);

      this.logger.error(
        `Server error [${status}] ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // Call the base filter to handle the response
    super.catch(exception, host);
  }
}


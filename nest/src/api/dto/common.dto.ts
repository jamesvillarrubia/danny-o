/**
 * Common API DTOs
 * 
 * Shared DTOs for pagination, errors, and common patterns.
 * Follows Google API Design Guide conventions.
 */

import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// Pagination
// ============================================================================

/**
 * Standard pagination query parameters
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  pageToken?: string;
}

/**
 * Standard pagination response
 */
export interface PaginationResponseDto<T> {
  items: T[];
  nextPageToken?: string;
  totalSize?: number;
}

// ============================================================================
// Error Responses
// ============================================================================

/**
 * Error detail following Google API error model
 */
export interface ErrorDetailDto {
  '@type': string;
  reason?: string;
  domain?: string;
  metadata?: Record<string, string>;
}

/**
 * Standard error response following Google API error model
 */
export interface ErrorResponseDto {
  error: {
    code: number;
    message: string;
    status: string;
    details?: ErrorDetailDto[];
  };
}

// ============================================================================
// Standard Response Wrapper
// ============================================================================

/**
 * Standard API response wrapper
 * Used for consistent response structure across all endpoints
 */
export interface ApiResponseDto<T> {
  data: T;
  metadata?: {
    requestId?: string;
    duration?: number;
    timestamp: string;
  };
}

// ============================================================================
// Status Responses
// ============================================================================

/**
 * Standard status codes following Google API conventions
 */
export type ApiStatusCode =
  | 'OK'
  | 'CANCELLED'
  | 'UNKNOWN'
  | 'INVALID_ARGUMENT'
  | 'DEADLINE_EXCEEDED'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'PERMISSION_DENIED'
  | 'RESOURCE_EXHAUSTED'
  | 'FAILED_PRECONDITION'
  | 'ABORTED'
  | 'OUT_OF_RANGE'
  | 'UNIMPLEMENTED'
  | 'INTERNAL'
  | 'UNAVAILABLE'
  | 'DATA_LOSS'
  | 'UNAUTHENTICATED';

/**
 * Map HTTP status codes to Google API status codes
 */
export const HTTP_TO_API_STATUS: Record<number, ApiStatusCode> = {
  200: 'OK',
  400: 'INVALID_ARGUMENT',
  401: 'UNAUTHENTICATED',
  403: 'PERMISSION_DENIED',
  404: 'NOT_FOUND',
  409: 'ALREADY_EXISTS',
  429: 'RESOURCE_EXHAUSTED',
  500: 'INTERNAL',
  501: 'UNIMPLEMENTED',
  503: 'UNAVAILABLE',
};

// ============================================================================
// Health & Status
// ============================================================================

/**
 * Health status response
 */
export interface HealthStatusDto {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'up' | 'down';
    todoist: 'up' | 'down';
    claude: 'up' | 'down';
  };
  version?: string;
}

// ============================================================================
// Test Support
// ============================================================================

/**
 * Reset test state response (for step-ci idempotency)
 */
export interface ResetTestStateResponseDto {
  reset: boolean;
  message: string;
}


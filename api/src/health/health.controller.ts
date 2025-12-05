/**
 * Health Check Controller
 * 
 * Exposes HTTP endpoints for health checks:
 * - GET /health - Overall health
 * - GET /health/db - Database health
 * - GET /health/todoist - Todoist API health
 * - GET /health/claude - Claude API health
 * - GET /health/ready - Readiness probe (K8s)
 * - GET /health/live - Liveness probe (K8s)
 */

import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthCheckResult } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './indicators/database.indicator';
import { TodoistHealthIndicator } from './indicators/todoist.indicator';
import { ClaudeHealthIndicator } from './indicators/claude.indicator';
import { Public } from '../common/decorators';

@Controller('health')
@Public() // Health checks should not require authentication
export class HealthController {
  constructor(
    @Inject(HealthCheckService) private health: HealthCheckService,
    @Inject(DatabaseHealthIndicator) private db: DatabaseHealthIndicator,
    @Inject(TodoistHealthIndicator) private todoist: TodoistHealthIndicator,
    @Inject(ClaudeHealthIndicator) private claude: ClaudeHealthIndicator,
  ) {}

  /**
   * Overall health check
   * Checks all systems: database, Todoist, Claude
   */
  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.isHealthy('database'),
      () => this.todoist.isHealthy('todoist'),
      () => this.claude.isHealthy('claude'),
    ]);
  }

  /**
   * Database health check
   */
  @Get('db')
  @HealthCheck()
  async checkDatabase(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.isHealthy('database'),
    ]);
  }

  /**
   * Todoist API health check
   */
  @Get('todoist')
  @HealthCheck()
  async checkTodoist(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.todoist.isHealthy('todoist'),
    ]);
  }

  /**
   * Claude API health check
   */
  @Get('claude')
  @HealthCheck()
  async checkClaude(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.claude.isHealthy('claude'),
    ]);
  }

  /**
   * Readiness probe for Kubernetes
   * Checks if the application is ready to accept traffic
   */
  @Get('ready')
  @HealthCheck()
  async checkReadiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.isHealthy('database'),
      // Todoist and Claude are not required for readiness
    ]);
  }

  /**
   * Liveness probe for Kubernetes
   * Checks if the application is alive (basic health)
   */
  @Get('live')
  @HealthCheck()
  async checkLiveness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.isHealthy('database'),
    ]);
  }
}


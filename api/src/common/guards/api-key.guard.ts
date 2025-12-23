/**
 * API Key Guard
 * 
 * Simple authentication guard that checks for a valid API key in the x-api-key header.
 * Used to protect the web API endpoints.
 */

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger, Inject, SetMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { IStorageAdapter } from '../interfaces/storage-adapter.interface';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
    private readonly storage: IStorageAdapter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if endpoint is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string;

    // Check environment variable first
    let expectedKey = this.configService.get<string>('DANNY_API_KEY');
    
    // If not in env, check storage
    if (!expectedKey) {
      expectedKey = await this.storage.getConfig('danny_api_key');
    }

    // If no API key is configured anywhere, allow all requests (development mode)
    if (!expectedKey) {
      this.logger.warn('DANNY_API_KEY not set - API is unprotected');
      return true;
    }

    if (!apiKey) {
      throw new UnauthorizedException('Missing API key');
    }

    if (apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}


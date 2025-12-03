/**
 * Environment Variables Schema
 * 
 * Validates environment variables at application startup using class-validator.
 */

import { IsString, IsEnum, IsOptional, IsInt, Min, IsNotEmpty } from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  TODOIST_API_KEY: string;

  @IsString()
  @IsNotEmpty()
  CLAUDE_API_KEY: string;

  @IsEnum(['sqlite', 'postgres'])
  DATABASE_TYPE: 'sqlite' | 'postgres';

  @IsOptional()
  @IsString()
  SQLITE_PATH?: string;

  @IsOptional()
  @IsString()
  DATABASE_URL?: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  SYNC_INTERVAL?: number;

  @IsOptional()
  @IsEnum(['development', 'production', 'test'])
  NODE_ENV?: 'development' | 'production' | 'test';

  @IsOptional()
  @IsEnum(['cli', 'mcp'])
  RUN_MODE?: 'cli' | 'mcp';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = new EnvironmentVariables();
  Object.assign(validatedConfig, config);
  
  // Add defaults
  validatedConfig.NODE_ENV = validatedConfig.NODE_ENV || 'development';
  validatedConfig.RUN_MODE = validatedConfig.RUN_MODE || 'cli';
  validatedConfig.SYNC_INTERVAL = validatedConfig.SYNC_INTERVAL || 300000;
  validatedConfig.SQLITE_PATH = validatedConfig.SQLITE_PATH || '../data/tasks.db';

  return validatedConfig;
}


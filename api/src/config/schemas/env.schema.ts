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

  @IsOptional()
  @IsString()
  PGLITE_PATH?: string; // Path for embedded PGlite database (defaults to ./data/tasks.db)

  @IsOptional()
  @IsString()
  PROD_DATABASE_URL?: string; // Production PostgreSQL connection string

  @IsOptional()
  @IsString()
  DEV_DATABASE_URL?: string; // Development PostgreSQL connection string

  @IsOptional()
  @IsEnum(['prod', 'dev'])
  DATABASE_ENV?: 'prod' | 'dev'; // Which database to use (omit for embedded PGlite)

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

  @IsOptional()
  @IsInt()
  @Min(1)
  TASK_PROCESSOR_MAX_TURNS?: number;

  @IsOptional()
  @IsString()
  DANNY_API_KEY?: string; // API key for web dashboard authentication
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = new EnvironmentVariables();
  Object.assign(validatedConfig, config);
  
  // Add defaults
  validatedConfig.NODE_ENV = validatedConfig.NODE_ENV || 'development';
  validatedConfig.RUN_MODE = validatedConfig.RUN_MODE || 'cli';
  validatedConfig.SYNC_INTERVAL = validatedConfig.SYNC_INTERVAL || 300000;
  validatedConfig.TASK_PROCESSOR_MAX_TURNS = validatedConfig.TASK_PROCESSOR_MAX_TURNS || 5;
  // PGLITE_PATH defaults to ./data/tasks.db (handled in StorageModule)

  return validatedConfig;
}


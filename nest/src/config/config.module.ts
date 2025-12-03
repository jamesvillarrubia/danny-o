/**
 * Configuration Module
 * 
 * Provides global configuration services including:
 * - Environment variable validation
 * - Taxonomy management
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TaxonomyService } from './taxonomy/taxonomy.service';
import { validate } from './schemas/env.schema';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env', // .env is in parent directory
      cache: true,
      validate,
    }),
  ],
  providers: [TaxonomyService],
  exports: [TaxonomyService],
})
export class ConfigurationModule {}


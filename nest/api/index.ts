/**
 * Vercel Serverless Entry Point
 * 
 * Creates and exports a NestJS HTTP adapter for Vercel serverless functions.
 * This file is the main entry point for the Vercel deployment.
 */

import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import express, { Request, Response } from 'express';
import { AppModule } from '../src/app.module';

let cachedApp: NestExpressApplication | null = null;

async function bootstrap(): Promise<NestExpressApplication> {
  if (cachedApp) {
    return cachedApp;
  }

  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);
  
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    adapter,
    {
      logger: ['error', 'warn', 'log'],
      // Disable buffering for serverless
      bufferLogs: false,
    }
  );

  // Enable CORS for API access
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global prefix for API routes
  app.setGlobalPrefix('api', {
    exclude: ['/'],
  });

  await app.init();
  
  cachedApp = app;
  return app;
}

// Export handler for Vercel
export default async function handler(req: Request, res: Response) {
  const app = await bootstrap();
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp(req, res);
}

// Export for local development
export { bootstrap };


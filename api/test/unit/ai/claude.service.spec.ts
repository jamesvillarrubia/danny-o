import { vi } from 'vitest';

/**
 * Claude Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClaudeService } from '../../../src/ai/services/claude.service';
import { PromptsService } from '../../../src/ai/prompts/prompts.service';
import { TaxonomyService } from '../../../src/config/taxonomy/taxonomy.service';

describe('ClaudeService', () => {
  let service: ClaudeService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaudeService,
        PromptsService,
        TaxonomyService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              if (key === 'CLAUDE_API_KEY') return 'test-api-key';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ClaudeService>(ClaudeService);
    configService = module.get<ConfigService>(ConfigService);
    
    // Manually trigger onModuleInit
    service.onModuleInit();
  });

  describe('initialization', () => {
    it('should initialize with API key from config', () => {
      expect(service).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith('CLAUDE_API_KEY');
    });

    it('should expose getModel method', () => {
      const model = service.getModel();
      expect(model).toBe('claude-3-5-sonnet-20240620');
    });

    it('should expose getClient method', () => {
      const client = service.getClient();
      expect(client).toBeDefined();
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for text', () => {
      const text = 'This is a test string';
      const tokens = service.estimateTokens(text);
      
      // Rough estimate: ~4 chars per token
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(text.length);
    });

    it('should return 0 for empty string', () => {
      const tokens = service.estimateTokens('');
      expect(tokens).toBe(0);
    });
  });

  describe('testConnection', () => {
    it('should test API connectivity', async () => {
      // Mock the actual API call - in real tests, this would use nock or similar
      const result = await service.testConnection();
      expect(typeof result).toBe('boolean');
    });
  });
});


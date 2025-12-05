/**
 * Test Module Builder
 * 
 * Helper for creating NestJS test modules with common mocks and providers.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MockStorageAdapter } from '../mocks/storage.mock';
import { MockTaskProvider } from '../mocks/task-provider.mock';
import { MockClaudeService } from '../mocks/claude.mock';
import { TaxonomyService } from '../../src/config/taxonomy/taxonomy.service';

export class TestModuleBuilder {
  private providers: any[] = [];
  private imports: any[] = [];

  /**
   * Add a storage adapter mock
   */
  withStorageMock(): this {
    this.providers.push({
      provide: 'IStorageAdapter',
      useClass: MockStorageAdapter,
    });
    return this;
  }

  /**
   * Add a task provider mock
   */
  withTaskProviderMock(): this {
    this.providers.push({
      provide: 'ITaskProvider',
      useClass: MockTaskProvider,
    });
    return this;
  }

  /**
   * Add a Claude service mock
   */
  withClaudeMock(): this {
    this.providers.push({
      provide: 'ClaudeService',
      useClass: MockClaudeService,
    });
    return this;
  }

  /**
   * Add a config service with test values
   */
  withConfig(config: Record<string, any> = {}): this {
    this.providers.push({
      provide: ConfigService,
      useValue: {
        get: vi.fn((key: string) => config[key]),
      },
    });
    return this;
  }

  /**
   * Add the real taxonomy service
   */
  withTaxonomy(): this {
    this.providers.push(TaxonomyService);
    return this;
  }

  /**
   * Add custom providers
   */
  withProviders(...providers: any[]): this {
    this.providers.push(...providers);
    return this;
  }

  /**
   * Add custom imports
   */
  withImports(...imports: any[]): this {
    this.imports.push(...imports);
    return this;
  }

  /**
   * Build the testing module
   */
  async build(): Promise<TestingModule> {
    return Test.createTestingModule({
      imports: this.imports,
      providers: this.providers,
    }).compile();
  }
}

/**
 * Create a test module builder
 */
export function createTestModule(): TestModuleBuilder {
  return new TestModuleBuilder();
}


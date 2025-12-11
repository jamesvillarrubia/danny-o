/**
 * Setup Service
 *
 * Manages first-run configuration and app setup status.
 * Stores sensitive data (API keys) encrypted in the app_config table.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { IStorageAdapter } from '../common/interfaces/storage-adapter.interface';
import { encrypt, decrypt, isEncrypted } from '../common/utils/encryption.util';

export interface SetupConfig {
  claudeApiKey: string;
  todoistApiKey: string;
  databaseType: 'embedded' | 'postgres';
  databaseUrl?: string;
}

export interface SetupStatus {
  setupCompleted: boolean;
  appVersion: string;
  databaseType: 'pglite' | 'postgres';
}

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(@Inject('IStorageAdapter') private readonly storage: IStorageAdapter) {}

  async getSetupStatus(): Promise<SetupStatus> {
    const configs = await this.storage.getConfigs(['setup_completed', 'app_version']);

    // Determine database type from environment or connection
    const databaseType = process.env.DATABASE_ENV === 'prod' || process.env.DATABASE_ENV === 'dev' 
      ? 'postgres' 
      : 'pglite';

    return {
      setupCompleted: configs.setup_completed === 'true',
      appVersion: configs.app_version || '2.0.0',
      databaseType,
    };
  }

  async completeSetup(config: SetupConfig): Promise<void> {
    // Encrypt and store API keys
    const encryptedClaudeKey = encrypt(config.claudeApiKey);
    const encryptedTodoistKey = encrypt(config.todoistApiKey);

    // Store API keys (encrypted)
    await this.storage.setConfig('claude_api_key', encryptedClaudeKey, true);
    await this.storage.setConfig('todoist_api_key', encryptedTodoistKey, true);

    // If using cloud Postgres, store the connection string
    if (config.databaseType === 'postgres' && config.databaseUrl) {
      const encryptedDbUrl = encrypt(config.databaseUrl);
      await this.storage.setConfig('database_url', encryptedDbUrl, true);
    }

    // Mark setup as completed
    await this.storage.setConfig('setup_completed', 'true', false);

    this.logger.log('Setup completed successfully');
  }

  async getDecryptedConfig(key: string): Promise<string | null> {
    const value = await this.storage.getConfig(key);
    
    if (!value) {
      return null;
    }

    // Check if it's encrypted
    if (isEncrypted(value)) {
      return decrypt(value);
    }

    return value;
  }
}

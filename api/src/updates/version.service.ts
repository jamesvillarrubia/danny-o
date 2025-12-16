/**
 * Version Management Service
 *
 * Handles version tracking and update detection for auto-update functionality.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { IStorageAdapter } from '../common/interfaces/storage-adapter.interface';
import * as semver from 'semver';

@Injectable()
export class VersionService {
  private readonly logger = new Logger(VersionService.name);

  constructor(@Inject('IStorageAdapter') private readonly storage: IStorageAdapter) {}

  async getCurrentVersion(): Promise<string> {
    const version = await this.storage.getConfig('app_version');
    return version || '0.0.0';
  }

  async getAppVersion(): Promise<string> {
    const packageJson = require('../../package.json');
    return packageJson.version;
  }

  async checkForUpdates(): Promise<boolean> {
    const dbVersion = await this.getCurrentVersion();
    const appVersion = await this.getAppVersion();

    // Check if app version is greater than database version
    const needsUpdate = semver.gt(appVersion, dbVersion);

    if (needsUpdate) {
      this.logger.log(`Update detected: ${dbVersion} -> ${appVersion}`);
    }

    return needsUpdate;
  }

  async updateVersion(): Promise<void> {
    const appVersion = await this.getAppVersion();
    await this.storage.setConfig('app_version', appVersion, false);
    this.logger.log(`Version updated to ${appVersion}`);
  }
}

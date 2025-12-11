/**
 * Backup Service
 *
 * Handles database backups for both PGlite (embedded) and remote PostgreSQL.
 * Creates backups before updates and manages backup retention.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorageAdapter } from '../common/interfaces/storage-adapter.interface';
import { copyFile, mkdir, readdir, stat, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = './data/backups';

  constructor(
    @Inject('IStorageAdapter') private readonly storage: IStorageAdapter,
    private readonly configService: ConfigService,
  ) {}

  async createBackup(): Promise<string> {
    await this.ensureBackupDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const connectionInfo = this.storage.getConnectionInfo();
    const dialect = connectionInfo.dialect;

    const backupPath = join(
      this.backupDir,
      `backup-${timestamp}.${dialect === 'pglite' ? 'db' : 'sql'}`
    );

    try {
      if (dialect === 'pglite') {
        await this.backupPGlite(backupPath, connectionInfo.path!);
      } else {
        await this.backupPostgres(backupPath, connectionInfo.connectionString!);
      }

      this.logger.log(`Backup created: ${backupPath}`);
      
      // Clean up old backups
      await this.cleanupOldBackups();

      return backupPath;
    } catch (error: any) {
      this.logger.error(`Backup failed: ${error.message}`);
      throw error;
    }
  }

  private async backupPGlite(backupPath: string, pglitePath: string): Promise<void> {
    if (!existsSync(pglitePath)) {
      throw new Error(`PGlite database not found at ${pglitePath}`);
    }

    // PGlite stores data in a directory structure - copy the entire directory
    await copyFile(pglitePath, backupPath);
    
    this.logger.log(`PGlite backup completed: ${backupPath}`);
  }

  private async backupPostgres(backupPath: string, connectionString: string): Promise<void> {
    // Use pg_dump to create backup
    const command = `pg_dump "${connectionString}" > "${backupPath}"`;

    try {
      await execAsync(command);
      this.logger.log(`PostgreSQL backup completed: ${backupPath}`);
    } catch (error: any) {
      this.logger.error(`pg_dump failed: ${error.message}`);
      throw new Error('pg_dump not available. Install PostgreSQL client tools.');
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    const retentionDays = parseInt(
      this.configService.get<string>('BACKUP_RETENTION_DAYS', '30'),
    );

    try {
      const files = await readdir(this.backupDir);
      const now = Date.now();
      const maxAge = retentionDays * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (!file.startsWith('backup-')) continue;

        const filePath = join(this.backupDir, file);
        const stats = await stat(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          await unlink(filePath);
          this.logger.log(`Deleted old backup: ${file}`);
        }
      }
    } catch (error: any) {
      this.logger.warn(`Failed to cleanup old backups: ${error.message}`);
    }
  }

  private async ensureBackupDir(): Promise<void> {
    if (!existsSync(this.backupDir)) {
      await mkdir(this.backupDir, { recursive: true });
    }
  }

  async restoreBackup(backupPath: string): Promise<void> {
    const connectionInfo = this.storage.getConnectionInfo();

    try {
      if (connectionInfo.dialect === 'pglite') {
        await this.restorePGlite(backupPath, connectionInfo.path!);
      } else {
        await this.restorePostgres(backupPath, connectionInfo.connectionString!);
      }

      this.logger.log(`Backup restored from: ${backupPath}`);
    } catch (error: any) {
      this.logger.error(`Restore failed: ${error.message}`);
      throw error;
    }
  }

  private async restorePGlite(backupPath: string, pglitePath: string): Promise<void> {
    // Close existing connection
    await this.storage.close();

    // Copy backup to database location
    await copyFile(backupPath, pglitePath);

    // Re-initialize
    await this.storage.initialize();
  }

  private async restorePostgres(backupPath: string, connectionString: string): Promise<void> {
    const command = `psql "${connectionString}" < "${backupPath}"`;

    try {
      await execAsync(command);
      this.logger.log('PostgreSQL backup restored via psql');
    } catch (error: any) {
      this.logger.error(`psql failed: ${error.message}`);
      throw new Error('psql not available. Install PostgreSQL client tools.');
    }
  }
}

/**
 * MCP Module
 * 
 * Encapsulates the Model Context Protocol server and all MCP tools.
 * Provides a clean interface for AI assistants to interact with task management.
 */

import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { ConfigurationModule } from '../config/config.module';
import { StorageModule } from '../storage/storage.module';
import { TaskProviderModule } from '../task-provider/task-provider.module';
import { TaskModule } from '../task/task.module';
import { AIModule } from '../ai/ai.module';
import { MCPServerService } from './services/mcp-server.service';
import { TaskTools, AITools, AgentTools } from './tools';

@Module({
  imports: [
    DiscoveryModule, // For decorator-based tool discovery
    ConfigurationModule,
    StorageModule,
    TaskProviderModule,
    TaskModule,
    AIModule,
  ],
  providers: [
    MCPServerService,
    TaskTools,
    AITools,
    AgentTools,
  ],
  exports: [MCPServerService],
})
export class MCPModule {}


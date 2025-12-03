/**
 * MCP Server Service
 * 
 * Main service that manages the Model Context Protocol server.
 * Discovers MCP tools via decorators and registers them with the MCP SDK.
 */

import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { ModuleRef, DiscoveryService, MetadataScanner } from '@nestjs/core';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MCP_TOOL_METADATA, MCP_TOOL_HANDLER_METADATA, MCPToolMetadata } from '../decorators';
import { IStorageAdapter } from '../../common/interfaces';
import { EnrichmentService } from '../../task/services/enrichment.service';
import { AIOperationsService } from '../../ai/services/operations.service';

interface ToolHandler {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any) => Promise<any>;
  instance: any;
  methodName: string;
}

@Injectable()
export class MCPServerService implements OnModuleInit {
  private readonly logger = new Logger(MCPServerService.name);
  private server: Server;
  private toolHandlers: ToolHandler[] = [];

  constructor(
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Inject(DiscoveryService) private readonly discoveryService: DiscoveryService,
    @Inject(MetadataScanner) private readonly metadataScanner: MetadataScanner,
  ) {
    this.server = new Server(
      {
        name: 'todoist-ai',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    );
  }

  async onModuleInit() {
    // Only initialize MCP server if in MCP mode
    if (process.env.RUN_MODE !== 'mcp') {
      this.logger.log('Skipping MCP Server initialization (not in MCP mode)');
      return;
    }
    
    this.logger.log('Initializing MCP Server...');
    await this.discoverTools();
    this.registerToolHandlers();
    this.registerResourceHandlers();
    this.logger.log(`Discovered ${this.toolHandlers.length} MCP tools`);
  }

  /**
   * Discover all MCP tool classes and their handler methods via decorators
   */
  private async discoverTools() {
    const providers = this.discoveryService.getProviders();

    for (const wrapper of providers) {
      const { instance } = wrapper;
      if (!instance || typeof instance !== 'object') {
        continue;
      }

      const prototype = Object.getPrototypeOf(instance);
      const isMCPTool = Reflect.getMetadata(MCP_TOOL_METADATA, prototype.constructor);

      if (!isMCPTool) {
        continue;
      }

      // Scan for handler methods
      const methodNames = this.metadataScanner.getAllMethodNames(prototype);

      for (const methodName of methodNames) {
        const metadata: MCPToolMetadata = Reflect.getMetadata(
          MCP_TOOL_HANDLER_METADATA,
          instance,
          methodName,
        );

        if (metadata) {
          this.logger.log(`Discovered tool: ${metadata.name} (${prototype.constructor.name}.${methodName})`);

          this.toolHandlers.push({
            name: metadata.name,
            description: metadata.description,
            inputSchema: metadata.inputSchema,
            handler: instance[methodName].bind(instance),
            instance,
            methodName,
          });
        }
      }
    }
  }

  /**
   * Register tool handlers with MCP server
   */
  private registerToolHandlers() {
    // List tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.toolHandlers.map((handler) => ({
          name: handler.name,
          description: handler.description,
          inputSchema: handler.inputSchema,
        })),
      };
    });

    // Call tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const handler = this.toolHandlers.find((h) => h.name === name);

        if (!handler) {
          throw new Error(`Unknown tool: ${name}`);
        }

        const result = await handler.handler(args || {});

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        this.logger.error(`Tool ${name} error: ${error.message}`);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Register resource handlers with MCP server
   */
  private registerResourceHandlers() {
    const storage = this.moduleRef.get<IStorageAdapter>('IStorageAdapter', { strict: false });
    const enrichment = this.moduleRef.get<EnrichmentService>(EnrichmentService, { strict: false });
    const aiOps = this.moduleRef.get<AIOperationsService>(AIOperationsService, { strict: false });

    // List resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'todoist://tasks/active',
            name: 'Active Tasks',
            description: 'All active (non-completed) tasks',
            mimeType: 'application/json',
          },
          {
            uri: 'todoist://tasks/unclassified',
            name: 'Unclassified Tasks',
            description: 'Tasks that need AI classification',
            mimeType: 'application/json',
          },
          {
            uri: 'todoist://categories/work',
            name: 'Work Tasks',
            description: 'Tasks in the work category',
            mimeType: 'application/json',
          },
          {
            uri: 'todoist://insights/patterns',
            name: 'Productivity Patterns',
            description: 'AI analysis of completion patterns',
            mimeType: 'application/json',
          },
        ],
      };
    });

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      try {
        if (uri === 'todoist://tasks/active') {
          const tasks = await storage.getTasks({ completed: false });
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(tasks, null, 2),
              },
            ],
          };
        }

        if (uri === 'todoist://tasks/unclassified') {
          const tasks = await enrichment.getUnclassifiedTasks({ force: false });
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(tasks, null, 2),
              },
            ],
          };
        }

        if (uri.startsWith('todoist://categories/')) {
          const category = uri.split('/').pop();
          const tasks = await storage.getTasks({ category, completed: false });
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(tasks, null, 2),
              },
            ],
          };
        }

        if (uri === 'todoist://insights/patterns') {
          const insights = await aiOps.generateInsights();
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(insights, null, 2),
              },
            ],
          };
        }

        throw new Error(`Unknown resource: ${uri}`);
      } catch (error: any) {
        throw new Error(`Failed to read resource ${uri}: ${error.message}`);
      }
    });
  }

  /**
   * Start the MCP server
   */
  async start() {
    this.logger.log('Starting MCP server on stdio...');

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    this.logger.log('MCP server ready');
  }

  /**
   * Get the MCP server instance (for testing)
   */
  getServer(): Server {
    return this.server;
  }
}


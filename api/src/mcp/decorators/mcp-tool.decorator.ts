/**
 * MCP Tool Decorator
 * 
 * Decorator for marking methods as MCP tools.
 * Similar to NestJS @Controller decorators, but for Model Context Protocol tools.
 */

import { SetMetadata } from '@nestjs/common';

export const MCP_TOOL_METADATA = 'mcp:tool';
export const MCP_TOOL_HANDLER_METADATA = 'mcp:tool:handler';

export interface MCPToolMetadata {
  name: string;
  description: string;
  inputSchema: any;
}

/**
 * Decorator for MCP tool classes
 */
export function MCPTool(): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(MCP_TOOL_METADATA, true, target);
  };
}

/**
 * Decorator for MCP tool handler methods
 */
export function MCPToolHandler(metadata: MCPToolMetadata): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    SetMetadata(MCP_TOOL_HANDLER_METADATA, metadata)(target, propertyKey, descriptor);
    return descriptor;
  };
}


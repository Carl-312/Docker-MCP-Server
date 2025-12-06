/**
 * 容器相关的 MCP 工具
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { SecureDockerClient } from '../utils/docker-client.js';
export declare const CONTAINER_TOOLS: Tool[];
export type ToolHandler = (client: SecureDockerClient, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
export declare function dockerListContainers(client: SecureDockerClient, args: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare function dockerInspect(client: SecureDockerClient, args: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare function dockerLogs(client: SecureDockerClient, args: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare function dockerStats(client: SecureDockerClient, args: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare const CONTAINER_TOOL_MAP: Record<string, ToolHandler>;
//# sourceMappingURL=containers.d.ts.map
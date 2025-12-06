/**
 * 镜像相关的 MCP 工具
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { SecureDockerClient } from '../utils/docker-client.js';
import type { ToolHandler } from './containers.js';
export declare const IMAGE_TOOLS: Tool[];
export declare function dockerListImages(client: SecureDockerClient, _args: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare function dockerImageInfo(client: SecureDockerClient, args: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare const IMAGE_TOOL_MAP: Record<string, ToolHandler>;
//# sourceMappingURL=images.d.ts.map
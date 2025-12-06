/**
 * 多源容器工具 - 同时搜索本地和云端 Docker
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { MultiDockerClient } from '../utils/index.js';
export declare const MULTI_CONTAINER_TOOLS: Tool[];
export type MultiToolHandler = (client: MultiDockerClient, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
export declare function multiDockerListContainers(client: MultiDockerClient, args: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare function multiDockerInspect(client: MultiDockerClient, args: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare function multiDockerLogs(client: MultiDockerClient, args: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare function multiDockerStats(client: MultiDockerClient, args: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare function multiDockerListImages(client: MultiDockerClient, _args: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare function multiDockerImageInfo(client: MultiDockerClient, args: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare function multiDockerConnectionStatus(client: MultiDockerClient, _args: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare const MULTI_TOOL_MAP: Record<string, MultiToolHandler>;
//# sourceMappingURL=multi-source-tools.d.ts.map
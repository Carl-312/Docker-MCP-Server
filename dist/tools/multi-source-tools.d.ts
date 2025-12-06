/**
 * Docker 容器和镜像工具（优化版）
 *
 * 每个工具都支持 docker_host 参数，无需预先配置
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { MultiDockerClient } from '../utils/multi-docker-client.js';
export type MultiToolHandler = (client: MultiDockerClient, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
/**
 * 工具定义
 */
export declare const MULTI_CONTAINER_TOOLS: Tool[];
/**
 * 工具处理器映射
 */
export declare const MULTI_TOOL_MAP: Record<string, MultiToolHandler>;
//# sourceMappingURL=multi-source-tools.d.ts.map
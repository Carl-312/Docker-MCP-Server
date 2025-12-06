/**
 * MCP Prompts - 配置向导提示词（简化版）
 *
 * 只提供云服务器配置向导
 */
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
/**
 * 可用的配置提示词列表
 */
export declare const PROMPTS: {
    name: string;
    description: string;
    arguments: {
        name: string;
        description: string;
        required: boolean;
    }[];
}[];
/**
 * 注册 Prompts 处理器到 MCP Server
 */
export declare function registerPromptHandlers(server: Server): void;
//# sourceMappingURL=index.d.ts.map
/**
 * 会话配置工具
 *
 * 提供在对话中动态配置 Docker 连接的能力
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
/**
 * 设置 Docker 连接工具定义
 */
export declare const SET_CONNECTION_TOOL: Tool;
/**
 * 获取会话配置工具定义
 */
export declare const GET_SESSION_CONFIG_TOOL: Tool;
/**
 * 重置配置工具定义
 */
export declare const RESET_CONFIG_TOOL: Tool;
/**
 * 处理设置连接请求
 */
export declare function handleSetConnection(_client: unknown, args: Record<string, unknown>): Promise<Record<string, unknown>>;
/**
 * 处理获取会话配置请求
 */
export declare function handleGetSessionConfig(_client: unknown, _args: Record<string, unknown>): Promise<Record<string, unknown>>;
/**
 * 处理重置配置请求
 */
export declare function handleResetConfig(_client: unknown, args: Record<string, unknown>): Promise<Record<string, unknown>>;
/**
 * 会话配置工具列表
 */
export declare const SESSION_CONFIG_TOOLS: Tool[];
/**
 * 会话配置工具处理器映射
 */
export declare const SESSION_CONFIG_HANDLERS: Record<string, (client: unknown, args: Record<string, unknown>) => Promise<Record<string, unknown>>>;
//# sourceMappingURL=session-config-tools.d.ts.map
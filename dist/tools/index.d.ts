/**
 * 工具模块聚合导出
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { type MultiToolHandler } from './multi-source-tools.js';
export declare const MULTI_TOOLS: Tool[];
export declare const MULTI_TOOL_HANDLERS: Record<string, MultiToolHandler>;
export type { MultiToolHandler };
export * from './multi-source-tools.js';
export * from './config-generator.js';
export * from './session-config-tools.js';
//# sourceMappingURL=index.d.ts.map
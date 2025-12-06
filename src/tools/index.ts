/**
 * 工具模块聚合导出
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CONTAINER_TOOLS, CONTAINER_TOOL_MAP, type ToolHandler } from './containers.js';
import { IMAGE_TOOLS, IMAGE_TOOL_MAP } from './images.js';
import { MULTI_CONTAINER_TOOLS, MULTI_TOOL_MAP, type MultiToolHandler } from './multi-source-tools.js';

// 合并所有工具定义（旧版单源）
export const TOOLS: Tool[] = [...CONTAINER_TOOLS, ...IMAGE_TOOLS];

// 多源工具定义（新版双源搜索）
export const MULTI_TOOLS: Tool[] = MULTI_CONTAINER_TOOLS;

// 合并所有工具处理器（旧版单源）
export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  ...CONTAINER_TOOL_MAP,
  ...IMAGE_TOOL_MAP,
};

// 多源工具处理器（新版双源搜索）
export const MULTI_TOOL_HANDLERS: Record<string, MultiToolHandler> = MULTI_TOOL_MAP;

// 导出子模块
export * from './containers.js';
export * from './images.js';
export * from './multi-source-tools.js';

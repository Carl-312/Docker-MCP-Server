/**
 * 工具模块聚合导出（简化版）
 */
import { MULTI_CONTAINER_TOOLS, MULTI_TOOL_MAP } from './multi-source-tools.js';
import { CONFIG_GENERATOR_TOOL, handleConfigGenerator } from './config-generator.js';
// 所有工具定义
export const MULTI_TOOLS = [
    ...MULTI_CONTAINER_TOOLS,
    CONFIG_GENERATOR_TOOL,
];
// 所有工具处理器
export const MULTI_TOOL_HANDLERS = {
    ...MULTI_TOOL_MAP,
    [CONFIG_GENERATOR_TOOL.name]: handleConfigGenerator,
};
// 导出子模块
export * from './multi-source-tools.js';
export * from './config-generator.js';
//# sourceMappingURL=index.js.map
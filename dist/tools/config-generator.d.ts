/**
 * 配置生成工具（简化版）
 *
 * 只生成云服务器 Docker 配置
 */
/**
 * 配置生成工具定义
 */
export declare const CONFIG_GENERATOR_TOOL: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            server_ip: {
                type: string;
                description: string;
            };
            port: {
                type: string;
                description: string;
            };
            security_audit: {
                type: string;
                description: string;
            };
            log_level: {
                type: string;
                enum: string[];
                description: string;
            };
        };
        required: string[];
    };
};
/**
 * 生成 MCP 配置
 */
export declare function generateMcpConfig(args: unknown): {
    success: boolean;
    config?: object;
    configJson?: string;
    instructions?: string;
    error?: string;
};
/**
 * 配置生成工具处理器
 */
export declare function handleConfigGenerator(_client: unknown, args: unknown): Promise<Record<string, unknown>>;
//# sourceMappingURL=config-generator.d.ts.map
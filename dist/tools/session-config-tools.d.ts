/**
 * 会话配置工具
 *
 * 允许用户在对话中动态设置 Docker 连接配置
 */
/**
 * 设置 Docker 连接工具定义
 */
export declare const SET_CONNECTION_TOOL: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            docker_host: {
                type: string;
                description: string;
            };
            allow_local: {
                type: string;
                description: string;
            };
            security_mode: {
                type: string;
                enum: string[];
                description: string;
            };
            audit_log: {
                type: string;
                description: string;
            };
            log_level: {
                type: string;
                enum: string[];
                description: string;
            };
        };
        required: never[];
    };
};
/**
 * 获取会话配置工具定义
 */
export declare const GET_SESSION_CONFIG_TOOL: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {};
        required: never[];
    };
};
/**
 * 重置配置工具定义
 */
export declare const RESET_CONFIG_TOOL: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            confirm: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
/**
 * 处理设置连接请求
 */
export declare function handleSetConnection(_client: unknown, args: unknown): Promise<Record<string, unknown>>;
/**
 * 处理获取会话配置请求
 */
export declare function handleGetSessionConfig(_client: unknown, _args: unknown): Promise<Record<string, unknown>>;
/**
 * 处理重置配置请求
 */
export declare function handleResetConfig(_client: unknown, args: unknown): Promise<Record<string, unknown>>;
/**
 * 会话配置工具列表
 */
export declare const SESSION_CONFIG_TOOLS: ({
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {};
        required: never[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            confirm: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
})[];
/**
 * 会话配置工具处理器映射
 */
export declare const SESSION_CONFIG_HANDLERS: Record<string, (client: unknown, args: unknown) => Promise<Record<string, unknown>>>;
//# sourceMappingURL=session-config-tools.d.ts.map
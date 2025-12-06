/**
 * 会话级配置管理器
 *
 * 允许用户在对话中动态设置 Docker 连接配置
 * 配置在会话期间有效，不需要修改 JSON 文件
 */
export interface DockerSessionConfig {
    dockerHost: string | null;
    allowLocal: boolean;
    securityMode: 'readonly' | 'readwrite';
    auditLog: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    configuredAt: Date | null;
    configuredBy: string | null;
}
/**
 * 会话配置管理器（单例）
 */
export declare class SessionConfigManager {
    private static instance;
    private config;
    private listeners;
    private constructor();
    /**
     * 获取单例实例
     */
    static getInstance(): SessionConfigManager;
    /**
     * 获取当前配置
     */
    getConfig(): Readonly<DockerSessionConfig>;
    /**
     * 设置 Docker 主机地址
     */
    setDockerHost(host: string | null): void;
    /**
     * 设置是否允许本地 Docker
     */
    setAllowLocal(allow: boolean): void;
    /**
     * 批量设置配置
     */
    setMultiple(updates: Partial<Omit<DockerSessionConfig, 'configuredAt' | 'configuredBy'>>): void;
    /**
     * 重置为环境变量配置
     */
    resetToEnv(): void;
    /**
     * 检查是否已配置 Docker 源
     */
    hasDockerSource(): boolean;
    /**
     * 添加配置变更监听器
     */
    addListener(listener: (config: DockerSessionConfig) => void): void;
    /**
     * 移除配置变更监听器
     */
    removeListener(listener: (config: DockerSessionConfig) => void): void;
    /**
     * 通知所有监听器
     */
    private notifyListeners;
    /**
     * 获取配置状态摘要
     */
    getStatusSummary(): string;
}
export declare function getSessionConfig(): SessionConfigManager;
//# sourceMappingURL=session-config.d.ts.map
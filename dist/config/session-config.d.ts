/**
 * 会话级配置管理器
 *
 * 支持在对话中动态设置 Docker 连接，无需修改配置文件
 */
export interface SessionConfig {
    dockerHost: string | null;
    securityMode: 'readonly' | 'readwrite';
    auditLog: boolean;
    logLevel: string;
    configuredAt: Date | null;
    configuredBy: 'env' | 'session' | null;
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
    getConfig(): SessionConfig;
    /**
     * 获取 Docker Host（用于 MultiDockerClient 集成）
     */
    getDockerHost(): string | null;
    /**
     * 设置 Docker 主机地址
     */
    setDockerHost(host: string | null): void;
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
    addListener(listener: (config: SessionConfig) => void): void;
    /**
     * 移除配置变更监听器
     */
    removeListener(listener: (config: SessionConfig) => void): void;
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
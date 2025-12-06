/**
 * 会话级配置管理器
 *
 * 允许用户在对话中动态设置 Docker 连接配置
 * 配置在会话期间有效，不需要修改 JSON 文件
 */
/**
 * 会话配置管理器（单例）
 */
export class SessionConfigManager {
    static instance;
    config;
    listeners = [];
    constructor() {
        // 初始化时从环境变量读取默认配置
        this.config = {
            dockerHost: process.env.DOCKER_HOST || null,
            allowLocal: process.env.ALLOW_LOCAL_DOCKER?.toLowerCase() === 'true',
            securityMode: process.env.SECURITY_MODE || 'readonly',
            auditLog: process.env.SECURITY_AUDIT_LOG?.toLowerCase() !== 'false',
            logLevel: process.env.LOG_LEVEL || 'info',
            configuredAt: process.env.DOCKER_HOST || process.env.ALLOW_LOCAL_DOCKER ? new Date() : null,
            configuredBy: process.env.DOCKER_HOST || process.env.ALLOW_LOCAL_DOCKER ? 'env' : null,
        };
    }
    /**
     * 获取单例实例
     */
    static getInstance() {
        if (!SessionConfigManager.instance) {
            SessionConfigManager.instance = new SessionConfigManager();
        }
        return SessionConfigManager.instance;
    }
    /**
     * 获取当前配置
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * 设置 Docker 主机地址
     */
    setDockerHost(host) {
        this.config.dockerHost = host;
        this.config.configuredAt = new Date();
        this.config.configuredBy = 'session';
        this.notifyListeners();
        console.error(`📡 会话配置更新: DOCKER_HOST = ${host || '(cleared)'}`);
    }
    /**
     * 设置是否允许本地 Docker
     */
    setAllowLocal(allow) {
        this.config.allowLocal = allow;
        this.config.configuredAt = new Date();
        this.config.configuredBy = 'session';
        this.notifyListeners();
        console.error(`📡 会话配置更新: ALLOW_LOCAL_DOCKER = ${allow}`);
    }
    /**
     * 批量设置配置
     */
    setMultiple(updates) {
        Object.assign(this.config, updates);
        this.config.configuredAt = new Date();
        this.config.configuredBy = 'session';
        this.notifyListeners();
        console.error(`📡 会话配置批量更新:`, updates);
    }
    /**
     * 重置为环境变量配置
     */
    resetToEnv() {
        this.config = {
            dockerHost: process.env.DOCKER_HOST || null,
            allowLocal: process.env.ALLOW_LOCAL_DOCKER?.toLowerCase() === 'true',
            securityMode: process.env.SECURITY_MODE || 'readonly',
            auditLog: process.env.SECURITY_AUDIT_LOG?.toLowerCase() !== 'false',
            logLevel: process.env.LOG_LEVEL || 'info',
            configuredAt: new Date(),
            configuredBy: 'env',
        };
        this.notifyListeners();
        console.error('📡 会话配置已重置为环境变量默认值');
    }
    /**
     * 检查是否已配置 Docker 源
     */
    hasDockerSource() {
        return !!(this.config.dockerHost || this.config.allowLocal);
    }
    /**
     * 添加配置变更监听器
     */
    addListener(listener) {
        this.listeners.push(listener);
    }
    /**
     * 移除配置变更监听器
     */
    removeListener(listener) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }
    /**
     * 通知所有监听器
     */
    notifyListeners() {
        for (const listener of this.listeners) {
            try {
                listener(this.config);
            }
            catch (error) {
                console.error('配置监听器执行错误:', error);
            }
        }
    }
    /**
     * 获取配置状态摘要
     */
    getStatusSummary() {
        const { dockerHost, allowLocal, configuredBy, configuredAt } = this.config;
        let status = '❌ 未配置';
        if (dockerHost && allowLocal) {
            status = `🔄 双源模式 (本地 + ${dockerHost})`;
        }
        else if (dockerHost) {
            status = `🌐 远程 Docker: ${dockerHost}`;
        }
        else if (allowLocal) {
            status = '💻 本地 Docker';
        }
        const source = configuredBy === 'env' ? '环境变量' :
            configuredBy === 'session' ? '会话配置' :
                configuredBy === 'prompt' ? '提示词配置' : '未知';
        const time = configuredAt ? configuredAt.toLocaleString() : '未配置';
        return `${status}\n配置来源: ${source}\n配置时间: ${time}`;
    }
}
// 导出单例获取函数
export function getSessionConfig() {
    return SessionConfigManager.getInstance();
}
//# sourceMappingURL=session-config.js.map
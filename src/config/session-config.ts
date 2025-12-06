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
export class SessionConfigManager {
  private static instance: SessionConfigManager;
  private config: SessionConfig;
  private listeners: Array<(config: SessionConfig) => void> = [];

  private constructor() {
    // 初始化时从环境变量读取默认配置
    this.config = {
      dockerHost: process.env.DOCKER_HOST || null,
      securityMode: (process.env.SECURITY_MODE as 'readonly' | 'readwrite') || 'readonly',
      auditLog: process.env.SECURITY_AUDIT_LOG?.toLowerCase() !== 'false',
      logLevel: process.env.LOG_LEVEL || 'info',
      configuredAt: process.env.DOCKER_HOST ? new Date() : null,
      configuredBy: process.env.DOCKER_HOST ? 'env' : null,
    };
  }

  /**
   * 获取单例实例
   */
  static getInstance(): SessionConfigManager {
    if (!SessionConfigManager.instance) {
      SessionConfigManager.instance = new SessionConfigManager();
    }
    return SessionConfigManager.instance;
  }

  /**
   * 获取当前配置
   */
  getConfig(): SessionConfig {
    return { ...this.config };
  }

  /**
   * 获取 Docker Host（用于 MultiDockerClient 集成）
   */
  getDockerHost(): string | null {
    return this.config.dockerHost;
  }

  /**
   * 设置 Docker 主机地址
   */
  setDockerHost(host: string | null): void {
    this.config.dockerHost = host;
    this.config.configuredAt = new Date();
    this.config.configuredBy = 'session';
    this.notifyListeners();
    console.error(`📡 会话配置更新: DOCKER_HOST = ${host || '(cleared)'}`);
  }

  /**
   * 重置为环境变量配置
   */
  resetToEnv(): void {
    this.config = {
      dockerHost: process.env.DOCKER_HOST || null,
      securityMode: (process.env.SECURITY_MODE as 'readonly' | 'readwrite') || 'readonly',
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
  hasDockerSource(): boolean {
    return !!this.config.dockerHost;
  }

  /**
   * 添加配置变更监听器
   */
  addListener(listener: (config: SessionConfig) => void): void {
    this.listeners.push(listener);
  }

  /**
   * 移除配置变更监听器
   */
  removeListener(listener: (config: SessionConfig) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.config);
      } catch (error) {
        console.error('配置监听器执行错误:', error);
      }
    }
  }

  /**
   * 获取配置状态摘要
   */
  getStatusSummary(): string {
    const { dockerHost, configuredBy, configuredAt } = this.config;
    
    const status = dockerHost
      ? `🌐 远程 Docker: ${dockerHost}`
      : '❌ 未配置 Docker 连接';
    
    const source = configuredBy === 'env' ? '环境变量' :
                   configuredBy === 'session' ? '会话配置' : '未配置';
    
    const time = configuredAt ? configuredAt.toLocaleString() : '未配置';
    
    return `${status}\n配置来源: ${source}\n配置时间: ${time}`;
  }
}

// 导出单例获取函数
export function getSessionConfig(): SessionConfigManager {
  return SessionConfigManager.getInstance();
}


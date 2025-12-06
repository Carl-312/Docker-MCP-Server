/**
 * 多源 Docker 客户端 - 同时搜索本地和云端 Docker
 * 
 * 设计理念：
 * 1. 同时尝试连接本地 Docker 和远程 Docker
 * 2. 合并所有源的结果返回给用户
 * 3. 如果都连接失败，返回详细的配置指引
 * 4. 支持会话级动态配置（无需修改配置文件）
 */

import Docker from 'dockerode';
import type { ContainerInfo, ContainerDetail, ContainerStats, ImageInfo, ImageDetail } from './docker-client.js';
import { getSessionConfig, type DockerSessionConfig } from '../config/session-config.js';

export interface DockerSource {
  name: string;
  type: 'local' | 'remote';
  host: string;
  client: Docker;
  status: 'connected' | 'disconnected' | 'error';
  error?: string;
}

export interface MultiSourceResult<T> {
  status: 'success' | 'partial' | 'no_docker_found';
  sources: {
    name: string;
    type: 'local' | 'remote';
    host: string;
    status: 'success' | 'error';
    error?: string;
    data?: T;
  }[];
  combined?: T;
  message?: string;
  setup_guide?: string;
}

interface DockerError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * 生成配置指引信息
 */
function getSetupGuide(): string {
  return `
═══════════════════════════════════════════════════════════════
🔧 Docker MCP Server 配置指南
═══════════════════════════════════════════════════════════════

❌ 未检测到任何可用的 Docker 连接！

请按以下步骤配置：

┌─────────────────────────────────────────────────────────────┐
│ 【选项1】配置云服务器 Docker（推荐）                            │
├─────────────────────────────────────────────────────────────┤
│ 1. 在服务器上开启 Docker 远程 API:                            │
│    编辑 /etc/docker/daemon.json 添加:                        │
│    {"hosts": ["unix:///var/run/docker.sock",                │
│               "tcp://0.0.0.0:2375"]}                        │
│                                                             │
│ 2. 重启 Docker: systemctl restart docker                    │
│                                                             │
│ 3. 在云服务商安全组开放 2375 端口（仅限您的IP）                  │
│                                                             │
│ 4. 使用会话配置连接（无需修改配置文件）:                        │
│    对话中说: "连接 tcp://您的服务器IP:2375"                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 【选项2】配置本地 Docker Desktop（开发环境）                    │
├─────────────────────────────────────────────────────────────┤
│ 1. 安装 Docker Desktop:                                     │
│    https://www.docker.com/products/docker-desktop/          │
│                                                             │
│ 2. 启动 Docker Desktop 并等待其完全运行                       │
│                                                             │
│ 3. 在配置文件 env 中设置:                                     │
│    ALLOW_LOCAL_DOCKER=true                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 【选项3】双源模式（同时连接云端和本地）                          │
├─────────────────────────────────────────────────────────────┤
│ 1. 先完成选项1的云服务器配置                                   │
│ 2. 在配置文件 env 中添加:                                     │
│    ALLOW_LOCAL_DOCKER=true                                  │
│                                                             │
│ 系统将自动搜索两个源并合并结果！                               │
└─────────────────────────────────────────────────────────────┘

📖 完整文档: https://github.com/Carl-312/Docker-MCP-Server
═══════════════════════════════════════════════════════════════
`.trim();
}

export class MultiDockerClient {
  private sources: DockerSource[] = [];
  private allowLocal: boolean;
  private remoteHost: string;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private lastConfigHash: string = '';

  constructor() {
    // 从会话配置获取（支持动态配置）
    const config = getSessionConfig().getConfig();
    this.allowLocal = config.allowLocal;
    this.remoteHost = config.dockerHost || '';
    this.lastConfigHash = this.getConfigHash(config);
    
    // 监听配置变更
    getSessionConfig().addListener((newConfig) => {
      this.handleConfigChange(newConfig);
    });
    
    // 同步初始化远程源（不需要测试连接）
    this.initializeRemoteSources();
    
    // 异步初始化本地源（需要预先测试连接）
    if (this.allowLocal) {
      this.initPromise = this.initializeLocalSource();
    }
  }

  /**
   * 生成配置哈希用于检测变更
   */
  private getConfigHash(config: DockerSessionConfig): string {
    return `${config.dockerHost || ''}_${config.allowLocal}`;
  }

  /**
   * 处理配置变更
   */
  private handleConfigChange(newConfig: DockerSessionConfig): void {
    const newHash = this.getConfigHash(newConfig);
    if (newHash !== this.lastConfigHash) {
      console.error('🔄 检测到配置变更，重新初始化 Docker 客户端...');
      this.lastConfigHash = newHash;
      this.allowLocal = newConfig.allowLocal;
      this.remoteHost = newConfig.dockerHost || '';
      this.reinitialize();
    }
  }

  /**
   * 重新初始化所有 Docker 源
   */
  private reinitialize(): void {
    this.sources = [];
    this.initialized = false;
    this.initPromise = null;
    
    // 重新初始化
    this.initializeRemoteSources();
    if (this.allowLocal) {
      this.initPromise = this.initializeLocalSource();
    }
    
    console.error(`📡 Docker 客户端重新初始化完成 (remote: ${this.remoteHost || 'none'}, local: ${this.allowLocal})`);
  }

  /**
   * 确保初始化完成
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
    this.initialized = true;
  }

  /**
   * 初始化远程 Docker 源（同步）
   */
  private initializeRemoteSources(): void {
    if (this.remoteHost) {
      const match = this.remoteHost.match(/tcp:\/\/([^:]+):(\d+)/);
      if (match) {
        this.sources.push({
          name: '阿里云 ECS',
          type: 'remote',
          host: `${match[1]}:${match[2]}`,
          client: new Docker({
            host: match[1],
            port: parseInt(match[2], 10),
          }),
          status: 'disconnected',
        });
        console.error(`📡 已配置远程 Docker 源: ${match[1]}:${match[2]}`);
      }
    }
  }

  /**
   * 初始化本地 Docker 源（异步，需要预先测试连接）
   * 
   * 重要：必须预先测试连接！
   * dockerode 在 Windows 上有一个隐藏行为：当 named pipe 连接失败时，
   * 会静默回退到 DOCKER_HOST 环境变量，导致"本地"连接实际上连到了远程。
   */
  private async initializeLocalSource(): Promise<void> {
    const isWindows = process.platform === 'win32';
    const socketPath = isWindows 
      ? '//./pipe/docker_engine'  // Windows named pipe
      : '/var/run/docker.sock';   // Unix socket (Linux/Mac)
    
    console.error(`💻 正在检测本地 Docker (${isWindows ? 'Windows' : 'Unix'} socket: ${socketPath})...`);
    
    // 创建本地客户端，显式只使用 socketPath，不使用任何 host/port
    const localClient = new Docker({ 
      socketPath,
      // 显式设置为 null，防止 dockerode 回退到 DOCKER_HOST
      host: undefined,
      port: undefined,
    });
    
    try {
      // 预先测试连接是否真的可用
      await localClient.ping();
      
      // 连接成功，添加到源列表
      this.sources.push({
        name: '本地 Docker Desktop',
        type: 'local',
        host: 'local',
        client: localClient,
        status: 'connected',
      });
      console.error(`✅ 本地 Docker 已连接`);
    } catch (error) {
      const errorMsg = (error as Error).message || '未知错误';
      console.error(`⚠️ 本地 Docker 不可用: ${errorMsg}`);
      console.error(`   提示: 请确保 Docker Desktop 已安装并正在运行`);
      // 不添加到源列表，因为本地 Docker 实际不可用
    }
    
    // 打印最终配置的源数量
    if (this.sources.length === 0) {
      console.error('⚠️ 警告：未配置任何可用的 Docker 源');
    } else {
      console.error(`✅ 共配置 ${this.sources.length} 个可用的 Docker 源`);
    }
  }

  /**
   * 测试单个源的连接
   */
  private async testConnection(source: DockerSource): Promise<boolean> {
    try {
      await source.client.ping();
      source.status = 'connected';
      return true;
    } catch (error) {
      source.status = 'error';
      source.error = (error as DockerError).message || '连接失败';
      return false;
    }
  }

  /**
   * 获取所有源的连接状态
   */
  async getConnectionStatus(): Promise<{
    totalSources: number;
    connectedSources: number;
    sources: { name: string; type: string; host: string; status: string; error?: string }[];
  }> {
    await this.ensureInitialized();
    
    const results = await Promise.all(
      this.sources.map(async (source) => {
        await this.testConnection(source);
        return {
          name: source.name,
          type: source.type,
          host: source.host,
          status: source.status,
          error: source.error,
        };
      })
    );

    return {
      totalSources: this.sources.length,
      connectedSources: results.filter(r => r.status === 'connected').length,
      sources: results,
    };
  }

  // ========== 容器操作 ==========

  /**
   * 从所有源列出容器
   */
  async listContainers(all: boolean = true): Promise<MultiSourceResult<ContainerInfo[]>> {
    await this.ensureInitialized();
    
    if (this.sources.length === 0) {
      return {
        status: 'no_docker_found',
        sources: [],
        message: '❌ 未配置任何 Docker 源',
        setup_guide: getSetupGuide(),
      };
    }

    const results = await Promise.all(
      this.sources.map(async (source) => {
        try {
          const containers = await source.client.listContainers({ all });
          const formatted = containers.map(c => this.formatContainer(c));
          return {
            name: source.name,
            type: source.type as 'local' | 'remote',
            host: source.host,
            status: 'success' as const,
            data: formatted,
          };
        } catch (error) {
          return {
            name: source.name,
            type: source.type as 'local' | 'remote',
            host: source.host,
            status: 'error' as const,
            error: (error as DockerError).message || '连接失败',
          };
        }
      })
    );

    const successResults = results.filter(r => r.status === 'success');
    const allContainers = successResults.flatMap(r => 
      (r.data || []).map(c => ({ ...c, source: r.name, sourceType: r.type }))
    );

    if (successResults.length === 0) {
      return {
        status: 'no_docker_found',
        sources: results,
        message: '❌ 所有 Docker 源均连接失败',
        setup_guide: getSetupGuide(),
      };
    }

    return {
      status: successResults.length === results.length ? 'success' : 'partial',
      sources: results,
      combined: allContainers as ContainerInfo[],
      message: successResults.length === results.length 
        ? `✅ 已从 ${successResults.length} 个源获取容器列表`
        : `⚠️ 部分源连接成功 (${successResults.length}/${results.length})`,
    };
  }

  /**
   * 从所有源获取容器详情（优先返回找到的第一个）
   */
  async getContainer(containerId: string): Promise<MultiSourceResult<ContainerDetail>> {
    await this.ensureInitialized();
    
    if (this.sources.length === 0) {
      return {
        status: 'no_docker_found',
        sources: [],
        message: '❌ 未配置任何 Docker 源',
        setup_guide: getSetupGuide(),
      };
    }

    const results = await Promise.all(
      this.sources.map(async (source) => {
        try {
          const container = source.client.getContainer(containerId);
          const info = await container.inspect();
          return {
            name: source.name,
            type: source.type as 'local' | 'remote',
            host: source.host,
            status: 'success' as const,
            data: this.formatContainerDetail(info),
          };
        } catch (error) {
          const dockerError = error as DockerError;
          return {
            name: source.name,
            type: source.type as 'local' | 'remote',
            host: source.host,
            status: 'error' as const,
            error: dockerError.statusCode === 404 
              ? `容器 ${containerId} 不存在` 
              : (dockerError.message || '连接失败'),
          };
        }
      })
    );

    const successResult = results.find(r => r.status === 'success');

    if (!successResult) {
      const allNotFound = results.every(r => r.error?.includes('不存在'));
      return {
        status: 'no_docker_found',
        sources: results,
        message: allNotFound 
          ? `❌ 容器 ${containerId} 在所有源中都不存在`
          : '❌ 所有 Docker 源均连接失败',
        setup_guide: allNotFound ? undefined : getSetupGuide(),
      };
    }

    return {
      status: 'success',
      sources: results,
      combined: { ...successResult.data!, source: successResult.name, sourceType: successResult.type } as ContainerDetail & { source: string; sourceType: string },
      message: `✅ 在 ${successResult.name} 中找到容器`,
    };
  }

  /**
   * 获取容器日志
   */
  async getContainerLogs(containerId: string, tail: number = 100): Promise<MultiSourceResult<string>> {
    await this.ensureInitialized();
    
    if (this.sources.length === 0) {
      return {
        status: 'no_docker_found',
        sources: [],
        message: '❌ 未配置任何 Docker 源',
        setup_guide: getSetupGuide(),
      };
    }

    const results = await Promise.all(
      this.sources.map(async (source) => {
        try {
          const container = source.client.getContainer(containerId);
          const logs = await container.logs({
            stdout: true,
            stderr: true,
            tail,
            timestamps: true,
          });
          const logStr = Buffer.isBuffer(logs) ? logs.toString('utf-8') : String(logs);
          return {
            name: source.name,
            type: source.type as 'local' | 'remote',
            host: source.host,
            status: 'success' as const,
            data: logStr,
          };
        } catch (error) {
          const dockerError = error as DockerError;
          return {
            name: source.name,
            type: source.type as 'local' | 'remote',
            host: source.host,
            status: 'error' as const,
            error: dockerError.statusCode === 404 
              ? `容器 ${containerId} 不存在` 
              : (dockerError.message || '连接失败'),
          };
        }
      })
    );

    const successResult = results.find(r => r.status === 'success');

    if (!successResult) {
      return {
        status: 'no_docker_found',
        sources: results,
        message: '❌ 无法获取容器日志',
        setup_guide: getSetupGuide(),
      };
    }

    return {
      status: 'success',
      sources: results,
      combined: successResult.data,
      message: `✅ 从 ${successResult.name} 获取日志`,
    };
  }

  /**
   * 获取容器资源统计
   */
  async getContainerStats(containerId: string): Promise<MultiSourceResult<ContainerStats>> {
    await this.ensureInitialized();
    
    if (this.sources.length === 0) {
      return {
        status: 'no_docker_found',
        sources: [],
        message: '❌ 未配置任何 Docker 源',
        setup_guide: getSetupGuide(),
      };
    }

    const results = await Promise.all(
      this.sources.map(async (source) => {
        try {
          const container = source.client.getContainer(containerId);
          const stats = await container.stats({ stream: false }) as Docker.ContainerStats;
          return {
            name: source.name,
            type: source.type as 'local' | 'remote',
            host: source.host,
            status: 'success' as const,
            data: this.formatStats(stats),
          };
        } catch (error) {
          const dockerError = error as DockerError;
          return {
            name: source.name,
            type: source.type as 'local' | 'remote',
            host: source.host,
            status: 'error' as const,
            error: dockerError.statusCode === 404 
              ? `容器 ${containerId} 不存在` 
              : (dockerError.message || '连接失败'),
          };
        }
      })
    );

    const successResult = results.find(r => r.status === 'success');

    if (!successResult) {
      return {
        status: 'no_docker_found',
        sources: results,
        message: '❌ 无法获取容器统计',
        setup_guide: getSetupGuide(),
      };
    }

    return {
      status: 'success',
      sources: results,
      combined: successResult.data,
      message: `✅ 从 ${successResult.name} 获取统计`,
    };
  }

  // ========== 镜像操作 ==========

  /**
   * 从所有源列出镜像
   */
  async listImages(): Promise<MultiSourceResult<ImageInfo[]>> {
    await this.ensureInitialized();
    
    if (this.sources.length === 0) {
      return {
        status: 'no_docker_found',
        sources: [],
        message: '❌ 未配置任何 Docker 源',
        setup_guide: getSetupGuide(),
      };
    }

    const results = await Promise.all(
      this.sources.map(async (source) => {
        try {
          const images = await source.client.listImages();
          const formatted = images.map(img => this.formatImage(img));
          return {
            name: source.name,
            type: source.type as 'local' | 'remote',
            host: source.host,
            status: 'success' as const,
            data: formatted,
          };
        } catch (error) {
          return {
            name: source.name,
            type: source.type as 'local' | 'remote',
            host: source.host,
            status: 'error' as const,
            error: (error as DockerError).message || '连接失败',
          };
        }
      })
    );

    const successResults = results.filter(r => r.status === 'success');
    const allImages = successResults.flatMap(r => 
      (r.data || []).map(img => ({ ...img, source: r.name, sourceType: r.type }))
    );

    if (successResults.length === 0) {
      return {
        status: 'no_docker_found',
        sources: results,
        message: '❌ 所有 Docker 源均连接失败',
        setup_guide: getSetupGuide(),
      };
    }

    return {
      status: successResults.length === results.length ? 'success' : 'partial',
      sources: results,
      combined: allImages as ImageInfo[],
      message: `✅ 已从 ${successResults.length} 个源获取镜像列表`,
    };
  }

  /**
   * 获取镜像详情
   */
  async getImage(imageId: string): Promise<MultiSourceResult<ImageDetail>> {
    await this.ensureInitialized();
    
    if (this.sources.length === 0) {
      return {
        status: 'no_docker_found',
        sources: [],
        message: '❌ 未配置任何 Docker 源',
        setup_guide: getSetupGuide(),
      };
    }

    const results = await Promise.all(
      this.sources.map(async (source) => {
        try {
          const image = source.client.getImage(imageId);
          const info = await image.inspect();
          return {
            name: source.name,
            type: source.type as 'local' | 'remote',
            host: source.host,
            status: 'success' as const,
            data: this.formatImageDetail(info),
          };
        } catch (error) {
          const dockerError = error as DockerError;
          return {
            name: source.name,
            type: source.type as 'local' | 'remote',
            host: source.host,
            status: 'error' as const,
            error: dockerError.statusCode === 404 
              ? `镜像 ${imageId} 不存在` 
              : (dockerError.message || '连接失败'),
          };
        }
      })
    );

    const successResult = results.find(r => r.status === 'success');

    if (!successResult) {
      return {
        status: 'no_docker_found',
        sources: results,
        message: `❌ 镜像 ${imageId} 在所有源中都不存在`,
      };
    }

    return {
      status: 'success',
      sources: results,
      combined: { ...successResult.data!, source: successResult.name, sourceType: successResult.type } as ImageDetail & { source: string; sourceType: string },
      message: `✅ 在 ${successResult.name} 中找到镜像`,
    };
  }

  // ========== 格式化辅助方法 ==========

  private formatContainer(container: Docker.ContainerInfo): ContainerInfo {
    return {
      id: container.Id.substring(0, 12),
      name: container.Names[0]?.replace(/^\//, '') || 'unknown',
      status: container.State,
      image: container.Image,
      created: new Date(container.Created * 1000).toISOString(),
    };
  }

  private formatContainerDetail(info: Docker.ContainerInspectInfo): ContainerDetail {
    return {
      id: info.Id.substring(0, 12),
      name: info.Name.replace(/^\//, ''),
      status: info.State.Status,
      image: info.Config.Image,
      created: info.Created,
      state: info.State,
      ports: info.NetworkSettings.Ports || {},
      mounts: (info.Mounts || []).map(m => m.Destination),
      envCount: (info.Config.Env || []).length,
    };
  }

  private formatStats(stats: Docker.ContainerStats): ContainerStats {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - 
                     (stats.precpu_stats?.cpu_usage?.total_usage || 0);
    const systemDelta = (stats.cpu_stats.system_cpu_usage || 0) - 
                        (stats.precpu_stats?.system_cpu_usage || 0);
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0;

    const memUsage = stats.memory_stats.usage || 0;
    const memLimit = stats.memory_stats.limit || 1;
    const memPercent = (memUsage / memLimit) * 100;

    return {
      cpuPercent: Math.round(cpuPercent * 100) / 100,
      memoryUsageMb: Math.round(memUsage / 1024 / 1024 * 100) / 100,
      memoryLimitMb: Math.round(memLimit / 1024 / 1024 * 100) / 100,
      memoryPercent: Math.round(memPercent * 100) / 100,
    };
  }

  private formatImage(image: Docker.ImageInfo): ImageInfo {
    return {
      id: image.Id.substring(7, 19),
      tags: image.RepoTags || [],
      sizeMb: Math.round(image.Size / 1024 / 1024 * 100) / 100,
      created: new Date(image.Created * 1000).toISOString(),
    };
  }

  private formatImageDetail(info: Docker.ImageInspectInfo): ImageDetail {
    return {
      id: info.Id.substring(7, 19),
      tags: info.RepoTags || [],
      sizeMb: Math.round(info.Size / 1024 / 1024 * 100) / 100,
      created: info.Created,
      architecture: info.Architecture,
      os: info.Os,
      layersCount: info.RootFS?.Layers?.length || 0,
    };
  }
}

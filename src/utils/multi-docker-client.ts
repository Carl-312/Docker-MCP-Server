/**
 * Docker 客户端（优化版）
 * 
 * 支持三种连接方式（优先级从高到低）：
 * 1. 每次调用时传入 docker_host 参数（最高优先）
 * 2. 会话配置（通过 docker_set_connection 设置）
 * 3. 环境变量配置 DOCKER_HOST（最低优先）
 */

import Docker from 'dockerode';
import { getSessionConfig } from '../config/session-config.js';

// 默认超时时间（毫秒）
const DEFAULT_TIMEOUT = 10000; // 10 秒

// 简化的类型定义
export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  created: string;
  ports: string;
}

export interface ContainerDetail {
  id: string;
  name: string;
  image: string;
  status: string;
  created: string;
  started: string;
  finished: string;
  platform: string;
  config: {
    hostname: string;
    env: string[];
    cmd: string[];
    workingDir: string;
  };
  network: {
    ipAddress: string;
    gateway: string;
    ports: unknown;
  };
}

export interface ContainerStats {
  cpu_percent: string;
  memory_usage: string;
  memory_limit: string;
  memory_percent: string;
  network_rx: string;
  network_tx: string;
  block_read: string;
  block_write: string;
}

export interface ImageInfo {
  id: string;
  tags: string[];
  size: string;
  created: string;
}

export interface ImageDetail {
  id: string;
  tags: string[];
  size: string;
  created: string;
  architecture: string;
  os: string;
  author: string;
  config: {
    env: string[];
    cmd: string[];
    entrypoint: string[];
    workingDir: string;
    exposedPorts: string[];
  };
}

export interface DockerResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  host?: string;
  hint?: string;  // 错误排查建议
}

interface DockerError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * 解析 Docker 主机地址
 */
function parseDockerHost(dockerHost: string): { host: string; port: number } | null {
  const match = dockerHost.match(/tcp:\/\/([^:]+):(\d+)/);
  if (match) {
    return { host: match[1], port: parseInt(match[2], 10) };
  }
  return null;
}

/**
 * 创建 Docker 客户端（带超时配置）
 */
function createDockerClient(dockerHost: string): Docker | null {
  const parsed = parseDockerHost(dockerHost);
  if (!parsed) return null;
  return new Docker({ 
    host: parsed.host, 
    port: parsed.port,
    timeout: DEFAULT_TIMEOUT,
  });
}

/**
 * 带超时的 Promise 包装器
 * 防止 Docker API 调用无限等待
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT,
  operation: string = 'Docker 操作'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation}超时（${timeoutMs / 1000}秒）- 请检查：1) Docker 服务是否运行 2) 端口是否正确 3) 防火墙是否放行`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * 获取有效的 Docker 地址
 * 优先级：参数 > 会话配置 > 环境变量
 */
function getEffectiveDockerHost(paramHost?: string): string | null {
  // 1. 最高优先：调用时传入的参数
  if (paramHost && paramHost.startsWith('tcp://')) {
    return paramHost;
  }
  
  // 2. 其次：会话配置（通过 docker_set_connection 设置）
  const sessionHost = getSessionConfig().getDockerHost();
  if (sessionHost) {
    return sessionHost;
  }
  
  // 3. 最低：环境变量
  return process.env.DOCKER_HOST || null;
}

/**
 * Docker 客户端类
 */
export class MultiDockerClient {
  
  /**
   * 获取连接状态
   */
  async getConnectionStatus(dockerHost?: string): Promise<DockerResult<{ connected: boolean; host: string }>> {
    const effectiveHost = getEffectiveDockerHost(dockerHost);
    
    if (!effectiveHost) {
      return {
        success: false,
        error: '未配置 Docker 连接。请在调用时传入 docker_host 参数，或设置 DOCKER_HOST 环境变量。',
        hint: '示例: {"docker_host": "tcp://192.168.1.100:2375"}',
      };
    }

    const client = createDockerClient(effectiveHost);
    if (!client) {
      return {
        success: false,
        error: `无效的 Docker 地址格式: ${effectiveHost}。正确格式: tcp://IP:端口`,
        hint: '示例: tcp://192.168.1.100:2375',
      };
    }

    try {
      await withTimeout(client.ping(), DEFAULT_TIMEOUT, '连接测试');
      return {
        success: true,
        data: { connected: true, host: effectiveHost },
        host: effectiveHost,
      };
    } catch (error) {
      const err = error as DockerError;
      return {
        success: false,
        error: `连接失败: ${err.message}`,
        host: effectiveHost,
        hint: this.getConnectionErrorHint(err),
      };
    }
  }

  /**
   * 根据错误类型提供排查建议
   */
  private getConnectionErrorHint(err: DockerError): string {
    if (err.message.includes('超时')) {
      return '排查建议: 1) 检查 IP 和端口是否正确 2) 检查云服务器安全组是否放行该端口 3) 检查 Docker 是否配置了 TCP 监听';
    }
    if (err.code === 'ECONNREFUSED') {
      return '连接被拒绝: Docker 服务可能未启动，或未监听该端口。请检查 Docker 配置。';
    }
    if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
      return '域名/IP 解析失败: 请检查地址是否正确。';
    }
    return '请检查 Docker 服务状态和网络连接。';
  }

  /**
   * 列出容器
   */
  async listContainers(onlyRunning: boolean = false, dockerHost?: string): Promise<DockerResult<ContainerInfo[]>> {
    const effectiveHost = getEffectiveDockerHost(dockerHost);
    
    if (!effectiveHost) {
      return {
        success: false,
        error: '未配置 Docker 连接。请传入 docker_host 参数（如 tcp://192.168.1.100:2375）',
        hint: '示例: {"docker_host": "tcp://192.168.1.100:2375", "only_running": true}',
      };
    }

    const client = createDockerClient(effectiveHost);
    if (!client) {
      return { success: false, error: `无效的 Docker 地址: ${effectiveHost}` };
    }

    try {
      const containers = await withTimeout(
        client.listContainers({ all: !onlyRunning }),
        DEFAULT_TIMEOUT,
        '列出容器'
      );
      const result: ContainerInfo[] = containers.map(c => ({
        id: c.Id.substring(0, 12),
        name: c.Names[0]?.replace(/^\//, '') || 'unknown',
        image: c.Image,
        status: c.Status,
        state: c.State,
        created: new Date(c.Created * 1000).toISOString(),
        ports: c.Ports?.map(p => `${p.PrivatePort}${p.PublicPort ? `:${p.PublicPort}` : ''}`).join(', ') || '',
      }));

      return {
        success: true,
        data: result,
        host: effectiveHost,
      };
    } catch (error) {
      const err = error as DockerError;
      return {
        success: false,
        error: `查询失败: ${err.message}`,
        host: effectiveHost,
        hint: this.getConnectionErrorHint(err),
      };
    }
  }

  /**
   * 获取容器详情
   */
  async inspectContainer(containerId: string, dockerHost?: string): Promise<DockerResult<ContainerDetail>> {
    const effectiveHost = getEffectiveDockerHost(dockerHost);
    
    if (!effectiveHost) {
      return { success: false, error: '未配置 Docker 连接。请传入 docker_host 参数' };
    }

    const client = createDockerClient(effectiveHost);
    if (!client) {
      return { success: false, error: `无效的 Docker 地址: ${effectiveHost}` };
    }

    try {
      const container = client.getContainer(containerId);
      const info = await withTimeout(
        container.inspect(),
        DEFAULT_TIMEOUT,
        '获取容器详情'
      );
      
      const result: ContainerDetail = {
        id: info.Id.substring(0, 12),
        name: info.Name.replace(/^\//, ''),
        image: info.Config.Image,
        status: info.State.Status,
        created: info.Created,
        started: info.State.StartedAt,
        finished: info.State.FinishedAt,
        platform: info.Platform,
        config: {
          hostname: info.Config.Hostname,
          env: info.Config.Env || [],
          cmd: info.Config.Cmd || [],
          workingDir: info.Config.WorkingDir,
        },
        network: {
          ipAddress: info.NetworkSettings.IPAddress,
          gateway: info.NetworkSettings.Gateway,
          ports: info.NetworkSettings.Ports,
        },
      };

      return { success: true, data: result, host: effectiveHost };
    } catch (error) {
      const err = error as DockerError;
      return {
        success: false,
        error: err.statusCode === 404 ? `容器 ${containerId} 不存在` : err.message,
        host: effectiveHost,
        hint: err.statusCode === 404 ? undefined : this.getConnectionErrorHint(err),
      };
    }
  }

  /**
   * 获取容器日志
   */
  async getContainerLogs(containerId: string, tail: number = 100, dockerHost?: string): Promise<DockerResult<string>> {
    const effectiveHost = getEffectiveDockerHost(dockerHost);
    
    if (!effectiveHost) {
      return { success: false, error: '未配置 Docker 连接。请传入 docker_host 参数' };
    }

    const client = createDockerClient(effectiveHost);
    if (!client) {
      return { success: false, error: `无效的 Docker 地址: ${effectiveHost}` };
    }

    try {
      const container = client.getContainer(containerId);
      const logsBuffer = await withTimeout(
        container.logs({
          stdout: true,
          stderr: true,
          tail,
          timestamps: true,
        }),
        DEFAULT_TIMEOUT,
        '获取容器日志'
      );
      
      const logs = logsBuffer.toString('utf-8')
        .replace(/[\x00-\x08]/g, '')
        .trim();

      return { success: true, data: logs || '(无日志)', host: effectiveHost };
    } catch (error) {
      const err = error as DockerError;
      return {
        success: false,
        error: err.statusCode === 404 ? `容器 ${containerId} 不存在` : err.message,
        host: effectiveHost,
        hint: err.statusCode === 404 ? undefined : this.getConnectionErrorHint(err),
      };
    }
  }

  /**
   * 获取容器资源使用情况
   */
  async getContainerStats(containerId: string, dockerHost?: string): Promise<DockerResult<ContainerStats>> {
    const effectiveHost = getEffectiveDockerHost(dockerHost);
    
    if (!effectiveHost) {
      return { success: false, error: '未配置 Docker 连接。请传入 docker_host 参数' };
    }

    const client = createDockerClient(effectiveHost);
    if (!client) {
      return { success: false, error: `无效的 Docker 地址: ${effectiveHost}` };
    }

    try {
      const container = client.getContainer(containerId);
      const stats = await withTimeout(
        container.stats({ stream: false }),
        DEFAULT_TIMEOUT,
        '获取容器状态'
      );
      
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0;
      
      const memUsage = stats.memory_stats.usage || 0;
      const memLimit = stats.memory_stats.limit || 1;
      const memPercent = (memUsage / memLimit) * 100;

      const result: ContainerStats = {
        cpu_percent: cpuPercent.toFixed(2) + '%',
        memory_usage: this.formatBytes(memUsage),
        memory_limit: this.formatBytes(memLimit),
        memory_percent: memPercent.toFixed(2) + '%',
        network_rx: this.formatBytes(this.sumNetworkStats(stats.networks, 'rx_bytes')),
        network_tx: this.formatBytes(this.sumNetworkStats(stats.networks, 'tx_bytes')),
        block_read: this.formatBytes(this.sumBlockStats(stats.blkio_stats?.io_service_bytes_recursive, 'Read')),
        block_write: this.formatBytes(this.sumBlockStats(stats.blkio_stats?.io_service_bytes_recursive, 'Write')),
      };

      return { success: true, data: result, host: effectiveHost };
    } catch (error) {
      const err = error as DockerError;
      return {
        success: false,
        error: err.statusCode === 404 ? `容器 ${containerId} 不存在` : err.message,
        host: effectiveHost,
        hint: err.statusCode === 404 ? undefined : this.getConnectionErrorHint(err),
      };
    }
  }

  /**
   * 列出镜像
   */
  async listImages(dockerHost?: string): Promise<DockerResult<ImageInfo[]>> {
    const effectiveHost = getEffectiveDockerHost(dockerHost);
    
    if (!effectiveHost) {
      return { success: false, error: '未配置 Docker 连接。请传入 docker_host 参数' };
    }

    const client = createDockerClient(effectiveHost);
    if (!client) {
      return { success: false, error: `无效的 Docker 地址: ${effectiveHost}` };
    }

    try {
      const images = await withTimeout(
        client.listImages(),
        DEFAULT_TIMEOUT,
        '列出镜像'
      );
      const result: ImageInfo[] = images.map(img => ({
        id: img.Id.replace('sha256:', '').substring(0, 12),
        tags: img.RepoTags || ['<none>'],
        size: this.formatBytes(img.Size),
        created: new Date(img.Created * 1000).toISOString(),
      }));

      return { success: true, data: result, host: effectiveHost };
    } catch (error) {
      const err = error as DockerError;
      return {
        success: false,
        error: `查询失败: ${err.message}`,
        host: effectiveHost,
        hint: this.getConnectionErrorHint(err),
      };
    }
  }

  /**
   * 获取镜像详情
   */
  async inspectImage(imageId: string, dockerHost?: string): Promise<DockerResult<ImageDetail>> {
    const effectiveHost = getEffectiveDockerHost(dockerHost);
    
    if (!effectiveHost) {
      return { success: false, error: '未配置 Docker 连接。请传入 docker_host 参数' };
    }

    const client = createDockerClient(effectiveHost);
    if (!client) {
      return { success: false, error: `无效的 Docker 地址: ${effectiveHost}` };
    }

    try {
      const image = client.getImage(imageId);
      const info = await withTimeout(
        image.inspect(),
        DEFAULT_TIMEOUT,
        '获取镜像详情'
      );
      
      const result: ImageDetail = {
        id: info.Id.replace('sha256:', '').substring(0, 12),
        tags: info.RepoTags || [],
        size: this.formatBytes(info.Size),
        created: info.Created,
        architecture: info.Architecture,
        os: info.Os,
        author: info.Author || 'unknown',
        config: {
          env: info.Config.Env || [],
          cmd: info.Config.Cmd || [],
          entrypoint: Array.isArray(info.Config.Entrypoint) ? info.Config.Entrypoint : [],
          workingDir: info.Config.WorkingDir,
          exposedPorts: Object.keys(info.Config.ExposedPorts || {}),
        },
      };

      return { success: true, data: result, host: effectiveHost };
    } catch (error) {
      const err = error as DockerError;
      return {
        success: false,
        error: err.statusCode === 404 ? `镜像 ${imageId} 不存在` : err.message,
        host: effectiveHost,
        hint: err.statusCode === 404 ? undefined : this.getConnectionErrorHint(err),
      };
    }
  }

  // 工具方法
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private sumNetworkStats(networks: Record<string, { rx_bytes: number; tx_bytes: number }> | undefined, key: 'rx_bytes' | 'tx_bytes'): number {
    if (!networks) return 0;
    return Object.values(networks).reduce((sum, net) => sum + (net[key] || 0), 0);
  }

  private sumBlockStats(stats: Array<{ op: string; value: number }> | undefined, op: string): number {
    if (!stats) return 0;
    const stat = stats.find(s => s.op === op);
    return stat?.value || 0;
  }
}

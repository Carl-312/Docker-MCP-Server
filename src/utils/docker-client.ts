/**
 * Docker 客户端封装 - 安全版
 * 
 * 只允许只读操作，禁止直连 Docker Socket（生产环境）
 */

import Docker from 'dockerode';

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  image: string;
  created: string;
}

export interface ContainerDetail extends ContainerInfo {
  state: Docker.ContainerInspectInfo['State'];
  ports: Record<string, unknown>;
  mounts: string[];
  envCount: number;
}

export interface ContainerStats {
  cpuPercent: number;
  memoryUsageMb: number;
  memoryLimitMb: number;
  memoryPercent: number;
}

export interface ImageInfo {
  id: string;
  tags: string[];
  sizeMb: number;
  created: string;
}

export interface ImageDetail extends ImageInfo {
  architecture: string;
  os: string;
  layersCount: number;
}

interface DockerError extends Error {
  statusCode?: number;
}

export class SecureDockerClient {
  private client: Docker;
  private dockerHost: string;

  constructor() {
    const allowLocal = process.env.ALLOW_LOCAL_DOCKER?.toLowerCase() === 'true';
    const dockerHost = process.env.DOCKER_HOST || '';
    
    this.dockerHost = dockerHost;

    // 场景1：配置了远程 DOCKER_HOST
    if (dockerHost) {
      const match = dockerHost.match(/tcp:\/\/([^:]+):(\d+)/);
      if (match) {
        this.client = new Docker({
          host: match[1],
          port: parseInt(match[2], 10),
        });
        console.error(`🔗 已连接到远程 Docker: ${match[1]}:${match[2]}`);
        return;
      } else if (dockerHost.startsWith('unix://') || dockerHost.includes('docker.sock')) {
        if (!allowLocal) {
          throw new SecurityError(
            '🚫 安全警告：禁止直连 Docker Socket！\n' +
            '生产环境请配置远程 DOCKER_HOST=tcp://your-ecs-ip:2375\n' +
            '本地开发可设置 ALLOW_LOCAL_DOCKER=true'
          );
        }
        this.client = new Docker({ socketPath: dockerHost.replace('unix://', '') });
        console.error(`🔗 已连接到 Docker Socket: ${dockerHost}`);
        return;
      }
    }

    // 场景2：允许本地连接
    if (allowLocal) {
      this.client = new Docker();
      console.error('🔗 已连接到本地 Docker');
      return;
    }

    // 场景3：未配置任何连接方式，给出清晰的配置指引
    throw new SecurityError(
      '❌ Docker MCP 未配置连接目标！\n\n' +
      '🔧 请告诉用户按以下步骤配置：\n\n' +
      '═══════════════════════════════════════\n' +
      '【选项1】连接阿里云 ECS Docker（推荐）\n' +
      '═══════════════════════════════════════\n' +
      '在 MCP 配置文件中添加环境变量：\n' +
      '  "env": {\n' +
      '    "DOCKER_HOST": "tcp://您的ECS公网IP:2375"\n' +
      '  }\n\n' +
      '配置文件位置：\n' +
      '  • Claude Desktop (Windows): %APPDATA%\\Claude\\claude_desktop_config.json\n' +
      '  • Claude Desktop (Mac): ~/Library/Application Support/Claude/claude_desktop_config.json\n' +
      '  • VS Code: .vscode/mcp.json\n\n' +
      '═══════════════════════════════════════\n' +
      '【选项2】连接本地 Docker（开发者）\n' +
      '═══════════════════════════════════════\n' +
      '  "env": {\n' +
      '    "ALLOW_LOCAL_DOCKER": "true"\n' +
      '  }\n\n' +
      '📖 完整文档: https://github.com/Carl-312/Docker-MCP-Server'
    );
  }

  /**
   * 获取当前连接的 Docker 地址
   */
  getDockerHost(): string {
    return this.dockerHost || 'local';
  }

  // ========== 容器只读操作 ==========

  /**
   * 列出所有容器
   */
  async listContainers(all: boolean = true): Promise<ContainerInfo[]> {
    const containers = await this.client.listContainers({ all });
    return containers.map(c => this.formatContainer(c));
  }

  /**
   * 获取单个容器详情
   */
  async getContainer(containerId: string): Promise<ContainerDetail | null> {
    try {
      const container = this.client.getContainer(containerId);
      const info = await container.inspect();
      return this.formatContainerDetail(info);
    } catch (error) {
      if ((error as DockerError).statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * 获取容器日志
   */
  async getContainerLogs(containerId: string, tail: number = 100): Promise<string> {
    try {
      const container = this.client.getContainer(containerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
      });
      
      // logs 可能是 Buffer 或 Stream
      if (Buffer.isBuffer(logs)) {
        return logs.toString('utf-8');
      }
      return String(logs);
    } catch (error) {
      if ((error as DockerError).statusCode === 404) {
        return `容器 ${containerId} 不存在`;
      }
      throw error;
    }
  }

  /**
   * 获取容器资源使用情况
   */
  async getContainerStats(containerId: string): Promise<ContainerStats | null> {
    try {
      const container = this.client.getContainer(containerId);
      const stats = await container.stats({ stream: false });
      return this.formatStats(stats as Docker.ContainerStats);
    } catch (error) {
      if ((error as DockerError).statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  // ========== 镜像只读操作 ==========

  /**
   * 列出所有镜像
   */
  async listImages(): Promise<ImageInfo[]> {
    const images = await this.client.listImages();
    return images.map(img => this.formatImage(img));
  }

  /**
   * 获取镜像详情
   */
  async getImage(imageId: string): Promise<ImageDetail | null> {
    try {
      const image = this.client.getImage(imageId);
      const info = await image.inspect();
      return this.formatImageDetail(info);
    } catch (error) {
      if ((error as DockerError).statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  // ========== 系统信息 ==========

  /**
   * 获取 Docker 版本信息
   */
  async getVersion(): Promise<Docker.DockerVersion> {
    return await this.client.version();
  }

  /**
   * 获取 Docker 系统信息（脱敏）
   */
  async getInfo(): Promise<Record<string, unknown>> {
    const info = await this.client.info();
    // 脱敏处理，只返回安全信息
    return {
      Containers: info.Containers,
      ContainersRunning: info.ContainersRunning,
      ContainersPaused: info.ContainersPaused,
      ContainersStopped: info.ContainersStopped,
      Images: info.Images,
      ServerVersion: info.ServerVersion,
      OperatingSystem: info.OperatingSystem,
      Architecture: info.Architecture,
      MemTotal: info.MemTotal,
      NCPU: info.NCPU,
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
    // CPU 使用率计算
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - 
                     (stats.precpu_stats?.cpu_usage?.total_usage || 0);
    const systemDelta = (stats.cpu_stats.system_cpu_usage || 0) - 
                        (stats.precpu_stats?.system_cpu_usage || 0);
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0;

    // 内存使用
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
      id: image.Id.substring(7, 19), // 去掉 sha256: 前缀
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

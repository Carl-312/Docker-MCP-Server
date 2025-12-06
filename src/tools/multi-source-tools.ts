/**
 * 多源容器工具 - 同时搜索本地和云端 Docker
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { MultiDockerClient, type MultiSourceResult } from '../utils/index.js';

// ========== 工具定义 ==========

export const MULTI_CONTAINER_TOOLS: Tool[] = [
  {
    name: 'docker_list_containers',
    description: '列出所有 Docker 容器（同时搜索本地和云端）',
    inputSchema: {
      type: 'object',
      properties: {
        only_running: {
          type: 'boolean',
          description: '是否只显示运行中的容器，默认显示全部',
        },
      },
      required: [],
    },
  },
  {
    name: 'docker_inspect',
    description: '查看指定容器的详细信息（在所有源中搜索）',
    inputSchema: {
      type: 'object',
      properties: {
        container_id: {
          type: 'string',
          description: '容器ID或名称',
        },
      },
      required: ['container_id'],
    },
  },
  {
    name: 'docker_logs',
    description: '获取容器的最近日志（在所有源中搜索）',
    inputSchema: {
      type: 'object',
      properties: {
        container_id: {
          type: 'string',
          description: '容器ID或名称',
        },
        tail: {
          type: 'integer',
          description: '获取最近多少行日志，默认100行',
        },
      },
      required: ['container_id'],
    },
  },
  {
    name: 'docker_stats',
    description: '获取容器的资源使用情况（在所有源中搜索）',
    inputSchema: {
      type: 'object',
      properties: {
        container_id: {
          type: 'string',
          description: '容器ID或名称',
        },
      },
      required: ['container_id'],
    },
  },
  {
    name: 'docker_list_images',
    description: '列出所有 Docker 镜像（同时搜索本地和云端）',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'docker_image_info',
    description: '查看指定镜像的详细信息（在所有源中搜索）',
    inputSchema: {
      type: 'object',
      properties: {
        image_id: {
          type: 'string',
          description: '镜像ID或名称（如 nginx:latest）',
        },
      },
      required: ['image_id'],
    },
  },
  {
    name: 'docker_connection_status',
    description: '查看所有 Docker 源的连接状态',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// ========== 工具处理器类型 ==========

export type MultiToolHandler = (
  client: MultiDockerClient,
  args: Record<string, unknown>
) => Promise<Record<string, unknown>>;

// ========== 格式化输出 ==========

function formatMultiSourceResponse<T>(result: MultiSourceResult<T>): Record<string, unknown> {
  if (result.status === 'no_docker_found') {
    return {
      status: 'error',
      message: result.message,
      sources: result.sources,
      setup_guide: result.setup_guide,
    };
  }

  return {
    status: result.status,
    message: result.message,
    sources_summary: result.sources.map(s => ({
      name: s.name,
      type: s.type === 'local' ? '💻 本地' : '☁️ 云端',
      host: s.host,
      status: s.status === 'success' ? '✅ 成功' : '❌ 失败',
      error: s.error,
    })),
    data: result.combined,
  };
}

// ========== 工具实现 ==========

export async function multiDockerListContainers(
  client: MultiDockerClient,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const onlyRunning = args.only_running === true;
  const result = await client.listContainers(!onlyRunning);
  
  const response = formatMultiSourceResponse(result);
  
  if (result.status !== 'no_docker_found' && Array.isArray(result.combined)) {
    response.total = result.combined.length;
    response.containers = result.combined;
    delete response.data;
  }
  
  return response;
}

export async function multiDockerInspect(
  client: MultiDockerClient,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const containerId = args.container_id as string;
  
  if (!containerId) {
    return { status: 'error', message: '请提供容器ID' };
  }
  
  const result = await client.getContainer(containerId);
  const response = formatMultiSourceResponse(result);
  
  if (result.status === 'success') {
    response.container = result.combined;
    delete response.data;
  }
  
  return response;
}

export async function multiDockerLogs(
  client: MultiDockerClient,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const containerId = args.container_id as string;
  const tail = (args.tail as number) || 100;
  
  if (!containerId) {
    return { status: 'error', message: '请提供容器ID' };
  }
  
  const result = await client.getContainerLogs(containerId, tail);
  const response = formatMultiSourceResponse(result);
  
  if (result.status === 'success') {
    response.container_id = containerId;
    response.lines = tail;
    response.logs = result.combined;
    delete response.data;
  }
  
  return response;
}

export async function multiDockerStats(
  client: MultiDockerClient,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const containerId = args.container_id as string;
  
  if (!containerId) {
    return { status: 'error', message: '请提供容器ID' };
  }
  
  const result = await client.getContainerStats(containerId);
  const response = formatMultiSourceResponse(result);
  
  if (result.status === 'success') {
    response.container_id = containerId;
    response.stats = result.combined;
    delete response.data;
  }
  
  return response;
}

export async function multiDockerListImages(
  client: MultiDockerClient,
  _args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const result = await client.listImages();
  const response = formatMultiSourceResponse(result);
  
  if (result.status !== 'no_docker_found' && Array.isArray(result.combined)) {
    response.total = result.combined.length;
    response.images = result.combined;
    delete response.data;
  }
  
  return response;
}

export async function multiDockerImageInfo(
  client: MultiDockerClient,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const imageId = args.image_id as string;
  
  if (!imageId) {
    return { status: 'error', message: '请提供镜像ID' };
  }
  
  const result = await client.getImage(imageId);
  const response = formatMultiSourceResponse(result);
  
  if (result.status === 'success') {
    response.image = result.combined;
    delete response.data;
  }
  
  return response;
}

export async function multiDockerConnectionStatus(
  client: MultiDockerClient,
  _args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const status = await client.getConnectionStatus();
  
  if (status.totalSources === 0) {
    return {
      status: 'error',
      message: '❌ 未配置任何 Docker 源',
      setup_guide: `
═══════════════════════════════════════════════════════════════
🔧 请在 .env 文件中配置 Docker 源：

【本地 Docker】
  ALLOW_LOCAL_DOCKER=true

【远程 Docker（阿里云等）】
  DOCKER_HOST=tcp://您的服务器IP:2375

【双源模式（同时使用）】
  ALLOW_LOCAL_DOCKER=true
  DOCKER_HOST=tcp://您的服务器IP:2375
═══════════════════════════════════════════════════════════════
      `.trim(),
    };
  }
  
  return {
    status: status.connectedSources > 0 ? 'success' : 'error',
    message: status.connectedSources > 0 
      ? `✅ ${status.connectedSources}/${status.totalSources} 个源连接成功`
      : '❌ 所有源连接失败',
    total_sources: status.totalSources,
    connected_sources: status.connectedSources,
    sources: status.sources.map(s => ({
      name: s.name,
      type: s.type === 'local' ? '💻 本地' : '☁️ 云端',
      host: s.host,
      status: s.status === 'connected' ? '✅ 已连接' : '❌ 未连接',
      error: s.error,
    })),
  };
}

// ========== 工具路由映射 ==========

export const MULTI_TOOL_MAP: Record<string, MultiToolHandler> = {
  docker_list_containers: multiDockerListContainers,
  docker_inspect: multiDockerInspect,
  docker_logs: multiDockerLogs,
  docker_stats: multiDockerStats,
  docker_list_images: multiDockerListImages,
  docker_image_info: multiDockerImageInfo,
  docker_connection_status: multiDockerConnectionStatus,
};

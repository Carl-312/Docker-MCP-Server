/**
 * Docker 容器和镜像工具（优化版）
 * 
 * 每个工具都支持 docker_host 参数，无需预先配置
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { MultiDockerClient } from '../utils/multi-docker-client.js';

export type MultiToolHandler = (client: MultiDockerClient, args: Record<string, unknown>) => Promise<Record<string, unknown>>;

// 通用的 docker_host 参数定义
const dockerHostParam = {
  type: 'string',
  description: 'Docker 服务器地址，格式: tcp://IP:端口（如 tcp://192.168.1.100:2375）。如果已设置 DOCKER_HOST 环境变量，此参数可选。',
};

/**
 * 工具定义
 */
export const MULTI_CONTAINER_TOOLS: Tool[] = [
  {
    name: 'docker_list_containers',
    description: '列出云服务器上的所有 Docker 容器',
    inputSchema: {
      type: 'object',
      properties: {
        docker_host: dockerHostParam,
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
    description: '查看指定容器的详细信息',
    inputSchema: {
      type: 'object',
      properties: {
        docker_host: dockerHostParam,
        container_id: {
          type: 'string',
          description: '容器ID或名称（必填）',
        },
      },
      required: ['container_id'],
    },
  },
  {
    name: 'docker_logs',
    description: '获取容器的最近日志',
    inputSchema: {
      type: 'object',
      properties: {
        docker_host: dockerHostParam,
        container_id: {
          type: 'string',
          description: '容器ID或名称（必填）',
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
    description: '获取容器的资源使用情况（CPU、内存、网络等）',
    inputSchema: {
      type: 'object',
      properties: {
        docker_host: dockerHostParam,
        container_id: {
          type: 'string',
          description: '容器ID或名称（必填）',
        },
      },
      required: ['container_id'],
    },
  },
  {
    name: 'docker_list_images',
    description: '列出云服务器上的所有 Docker 镜像',
    inputSchema: {
      type: 'object',
      properties: {
        docker_host: dockerHostParam,
      },
      required: [],
    },
  },
  {
    name: 'docker_image_info',
    description: '查看指定镜像的详细信息',
    inputSchema: {
      type: 'object',
      properties: {
        docker_host: dockerHostParam,
        image_id: {
          type: 'string',
          description: '镜像ID或名称（如 nginx:latest）（必填）',
        },
      },
      required: ['image_id'],
    },
  },
  {
    name: 'docker_connection_status',
    description: '测试 Docker 连接是否正常',
    inputSchema: {
      type: 'object',
      properties: {
        docker_host: dockerHostParam,
      },
      required: [],
    },
  },
];

/**
 * 工具处理器
 */

// 列出容器
async function handleListContainers(
  client: MultiDockerClient,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const dockerHost = args.docker_host as string | undefined;
  const onlyRunning = args.only_running as boolean || false;
  
  const result = await client.listContainers(onlyRunning, dockerHost);
  
  if (!result.success) {
    return {
      status: 'error',
      message: result.error,
      hint: '请传入 docker_host 参数，例如: {"docker_host": "tcp://192.168.1.100:2375"}',
    };
  }
  
  return {
    status: 'success',
    host: result.host,
    count: result.data?.length || 0,
    containers: result.data,
  };
}

// 容器详情
async function handleInspect(
  client: MultiDockerClient,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const dockerHost = args.docker_host as string | undefined;
  const containerId = args.container_id as string;
  
  if (!containerId) {
    return { status: 'error', message: '请提供 container_id 参数' };
  }
  
  const result = await client.inspectContainer(containerId, dockerHost);
  
  if (!result.success) {
    return { status: 'error', message: result.error, host: result.host };
  }
  
  return {
    status: 'success',
    host: result.host,
    container: result.data,
  };
}

// 容器日志
async function handleLogs(
  client: MultiDockerClient,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const dockerHost = args.docker_host as string | undefined;
  const containerId = args.container_id as string;
  const tail = (args.tail as number) || 100;
  
  if (!containerId) {
    return { status: 'error', message: '请提供 container_id 参数' };
  }
  
  const result = await client.getContainerLogs(containerId, tail, dockerHost);
  
  if (!result.success) {
    return { status: 'error', message: result.error, host: result.host };
  }
  
  return {
    status: 'success',
    host: result.host,
    container_id: containerId,
    tail: tail,
    logs: result.data,
  };
}

// 容器资源统计
async function handleStats(
  client: MultiDockerClient,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const dockerHost = args.docker_host as string | undefined;
  const containerId = args.container_id as string;
  
  if (!containerId) {
    return { status: 'error', message: '请提供 container_id 参数' };
  }
  
  const result = await client.getContainerStats(containerId, dockerHost);
  
  if (!result.success) {
    return { status: 'error', message: result.error, host: result.host };
  }
  
  return {
    status: 'success',
    host: result.host,
    container_id: containerId,
    stats: result.data,
  };
}

// 列出镜像
async function handleListImages(
  client: MultiDockerClient,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const dockerHost = args.docker_host as string | undefined;
  
  const result = await client.listImages(dockerHost);
  
  if (!result.success) {
    return {
      status: 'error',
      message: result.error,
      hint: '请传入 docker_host 参数，例如: {"docker_host": "tcp://192.168.1.100:2375"}',
    };
  }
  
  return {
    status: 'success',
    host: result.host,
    count: result.data?.length || 0,
    images: result.data,
  };
}

// 镜像详情
async function handleImageInfo(
  client: MultiDockerClient,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const dockerHost = args.docker_host as string | undefined;
  const imageId = args.image_id as string;
  
  if (!imageId) {
    return { status: 'error', message: '请提供 image_id 参数' };
  }
  
  const result = await client.inspectImage(imageId, dockerHost);
  
  if (!result.success) {
    return { status: 'error', message: result.error, host: result.host };
  }
  
  return {
    status: 'success',
    host: result.host,
    image: result.data,
  };
}

// 连接状态
async function handleConnectionStatus(
  client: MultiDockerClient,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const dockerHost = args.docker_host as string | undefined;
  
  const result = await client.getConnectionStatus(dockerHost);
  
  if (!result.success) {
    return {
      status: 'error',
      message: result.error,
      hint: '请传入 docker_host 参数测试连接，例如: {"docker_host": "tcp://192.168.1.100:2375"}',
    };
  }
  
  return {
    status: 'success',
    message: '✅ Docker 连接正常',
    host: result.host,
    connected: result.data?.connected,
  };
}

/**
 * 工具处理器映射
 */
export const MULTI_TOOL_MAP: Record<string, MultiToolHandler> = {
  docker_list_containers: handleListContainers,
  docker_inspect: handleInspect,
  docker_logs: handleLogs,
  docker_stats: handleStats,
  docker_list_images: handleListImages,
  docker_image_info: handleImageInfo,
  docker_connection_status: handleConnectionStatus,
};

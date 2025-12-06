/**
 * 镜像相关的 MCP 工具
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { SecureDockerClient } from '../utils/docker-client.js';
import type { ToolHandler } from './containers.js';

// ========== 工具定义 ==========

export const IMAGE_TOOLS: Tool[] = [
  {
    name: 'docker_list_images',
    description: '列出本地所有 Docker 镜像',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'docker_image_info',
    description: '查看指定镜像的详细信息',
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
];

// ========== 工具实现 ==========

export async function dockerListImages(
  client: SecureDockerClient,
  _args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  try {
    const images = await client.listImages();
    const dockerHost = client.getDockerHost();

    return {
      status: 'success',
      docker_host: dockerHost,
      docker_type: dockerHost === 'local' ? '💻 本地 Docker' : `☁️ 远程 Docker (${dockerHost})`,
      total: images.length,
      images,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function dockerImageInfo(
  client: SecureDockerClient,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  try {
    const imageId = args.image_id as string;
    const dockerHost = client.getDockerHost();

    if (!imageId) {
      return { status: 'error', message: '请提供镜像ID' };
    }

    const image = await client.getImage(imageId);

    if (image === null) {
      return { status: 'error', message: `镜像 ${imageId} 不存在` };
    }

    return {
      status: 'success',
      docker_host: dockerHost,
      docker_type: dockerHost === 'local' ? '💻 本地 Docker' : `☁️ 远程 Docker (${dockerHost})`,
      image,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

// ========== 工具路由映射 ==========

export const IMAGE_TOOL_MAP: Record<string, ToolHandler> = {
  docker_list_images: dockerListImages,
  docker_image_info: dockerImageInfo,
};

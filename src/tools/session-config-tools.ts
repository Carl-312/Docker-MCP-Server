/**
 * 会话配置工具
 * 
 * 提供在对话中动态配置 Docker 连接的能力
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getSessionConfig } from '../config/session-config.js';

/**
 * 设置 Docker 连接工具定义
 */
export const SET_CONNECTION_TOOL: Tool = {
  name: 'docker_set_connection',
  description: '设置 Docker 连接。在对话中配置要连接的云服务器 Docker，无需修改配置文件。配置在当前会话期间有效。',
  inputSchema: {
    type: 'object',
    properties: {
      docker_host: {
        type: 'string',
        description: '完整的 Docker 地址，必须是 tcp://IP:端口 格式（如 tcp://192.168.1.100:2375）。如果用户只提供了 IP，请要求用户确认端口号后再设置。设为空字符串可清除配置。',
      },
      security_mode: {
        type: 'string',
        enum: ['readonly', 'readwrite'],
        description: '安全模式（默认 readonly，建议保持只读）',
      },
      audit_log: {
        type: 'boolean',
        description: '是否启用审计日志（默认 true）',
      },
      log_level: {
        type: 'string',
        enum: ['debug', 'info', 'warn', 'error'],
        description: '日志级别（默认 info）',
      },
    },
    required: ['docker_host'],
  },
};

/**
 * 获取会话配置工具定义
 */
export const GET_SESSION_CONFIG_TOOL: Tool = {
  name: 'docker_get_session_config',
  description: '获取当前会话的 Docker 配置状态。查看已配置的连接信息和配置来源。',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

/**
 * 重置配置工具定义
 */
export const RESET_CONFIG_TOOL: Tool = {
  name: 'docker_reset_config',
  description: '重置 Docker 配置为环境变量默认值。清除会话中设置的临时配置。',
  inputSchema: {
    type: 'object',
    properties: {
      confirm: {
        type: 'boolean',
        description: '确认重置（必须设为 true）',
      },
    },
    required: ['confirm'],
  },
};

// Schema 定义
const SetConnectionSchema = z.object({
  docker_host: z.string(),
  security_mode: z.enum(['readonly', 'readwrite']).optional(),
  audit_log: z.boolean().optional(),
  log_level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
});

const ResetConfigSchema = z.object({
  confirm: z.boolean(),
});

/**
 * 处理设置连接请求
 */
export async function handleSetConnection(
  _client: unknown,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  try {
    const params = SetConnectionSchema.parse(args);
    const configManager = getSessionConfig();

    // 处理清除配置
    if (params.docker_host === '' || params.docker_host === 'null') {
      configManager.setDockerHost(null);
      return {
        success: true,
        message: '✅ Docker 连接已清除',
        current_config: {
          docker_host: null,
        },
      };
    }

    // 严格验证格式：必须是 tcp://IP:端口
    const tcpPattern = /^tcp:\/\/[\w.-]+:\d+$/;
    if (!tcpPattern.test(params.docker_host)) {
      // 检测用户是否只提供了 IP
      const ipOnlyPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
      const ipWithPortPattern = /^(\d{1,3}\.){3}\d{1,3}:\d+$/;

      if (ipOnlyPattern.test(params.docker_host)) {
        return {
          success: false,
          error: `检测到您只提供了 IP 地址 "${params.docker_host}"。请确认 Docker TCP 端口（通常是 2375），然后使用完整格式。`,
          suggestion: `tcp://${params.docker_host}:2375`,
          hint: '请用户确认端口号后再设置，不要自动补全。',
        };
      }

      if (ipWithPortPattern.test(params.docker_host)) {
        return {
          success: false,
          error: `格式不完整，缺少 tcp:// 前缀。请使用完整格式。`,
          suggestion: `tcp://${params.docker_host}`,
        };
      }

      return {
        success: false,
        error: 'docker_host 格式错误，必须是 tcp://IP:端口 格式',
        example: 'tcp://192.168.1.100:2375',
      };
    }

    configManager.setDockerHost(params.docker_host);
    const config = configManager.getConfig();

    return {
      success: true,
      message: '✅ Docker 连接已配置',
      current_config: {
        docker_host: config.dockerHost,
        security_mode: config.securityMode,
        audit_log: config.auditLog,
        log_level: config.logLevel,
      },
      status: configManager.getStatusSummary(),
      note: '配置在当前会话期间有效。现在可以使用 docker_list_containers 等工具查询 Docker。',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '参数验证失败',
    };
  }
}

/**
 * 处理获取会话配置请求
 */
export async function handleGetSessionConfig(
  _client: unknown,
  _args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const configManager = getSessionConfig();
  const config = configManager.getConfig();

  return {
    success: true,
    config: {
      docker_host: config.dockerHost,
      security_mode: config.securityMode,
      audit_log: config.auditLog,
      log_level: config.logLevel,
    },
    metadata: {
      configured_at: config.configuredAt?.toISOString() || null,
      configured_by: config.configuredBy,
    },
    status: configManager.getStatusSummary(),
    has_docker_source: configManager.hasDockerSource(),
    usage_guide: `
## 📖 配置使用指南

### 设置 Docker 连接
调用 docker_set_connection，设置 docker_host 为 "tcp://您的服务器IP:2375"

### 示例
docker_set_connection: {"docker_host": "tcp://your-server-ip:2375"}

### 配置完成后
可以使用 docker_list_containers、docker_logs 等工具查询 Docker
    `.trim(),
  };
}

/**
 * 处理重置配置请求
 */
export async function handleResetConfig(
  _client: unknown,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  try {
    const params = ResetConfigSchema.parse(args);

    if (!params.confirm) {
      return {
        success: false,
        error: '请设置 confirm: true 确认重置操作',
      };
    }

    const configManager = getSessionConfig();
    configManager.resetToEnv();
    const config = configManager.getConfig();

    return {
      success: true,
      message: '✅ 配置已重置为环境变量默认值',
      current_config: {
        docker_host: config.dockerHost,
        security_mode: config.securityMode,
        audit_log: config.auditLog,
        log_level: config.logLevel,
      },
      status: configManager.getStatusSummary(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '参数验证失败',
    };
  }
}

/**
 * 会话配置工具列表
 */
export const SESSION_CONFIG_TOOLS: Tool[] = [
  SET_CONNECTION_TOOL,
  GET_SESSION_CONFIG_TOOL,
  RESET_CONFIG_TOOL,
];

/**
 * 会话配置工具处理器映射
 */
export const SESSION_CONFIG_HANDLERS: Record<
  string,
  (client: unknown, args: Record<string, unknown>) => Promise<Record<string, unknown>>
> = {
  [SET_CONNECTION_TOOL.name]: handleSetConnection,
  [GET_SESSION_CONFIG_TOOL.name]: handleGetSessionConfig,
  [RESET_CONFIG_TOOL.name]: handleResetConfig,
};


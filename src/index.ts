#!/usr/bin/env node
/**
 * Docker MCP Server - 企业级安全版
 * 
 * 提供 Docker 容器和镜像的只读管理功能
 * 支持 MCP (Model Context Protocol) 标准
 * 
 * 传输模式：
 * - stdio: 标准输入输出（默认，用于 Claude Desktop 等）
 * - http:  HTTP + SSE（用于独立部署和 API 调用）
 * 
 * 配置方式：
 * - 通过 MCP 配置文件的 env 字段注入环境变量（推荐）
 * - 或通过命令行参数
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

import { SecureDockerClient, SecurityError, MultiDockerClient } from './utils/index.js';
import { SecurityGuard } from './security/guard.js';
import { AuditLogger } from './security/audit.js';
import { MULTI_TOOLS, MULTI_TOOL_HANDLERS } from './tools/index.js';

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    transport: 'stdio' as 'stdio' | 'http',
    port: 3000,
    host: '0.0.0.0',
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--transport' && args[i + 1]) {
      options.transport = args[i + 1] as 'stdio' | 'http';
      i++;
    } else if (args[i] === '--port' && args[i + 1]) {
      options.port = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--host' && args[i + 1]) {
      options.host = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Docker MCP Server - 企业级安全版

用法: docker-mcp-secure [选项]

选项:
  --transport <type>  传输模式: stdio (默认) 或 http
  --port <number>     HTTP 模式端口号 (默认: 3000)
  --host <address>    HTTP 模式绑定地址 (默认: 0.0.0.0)
  --help, -h          显示帮助信息

示例:
  # Stdio 模式 (用于 Claude Desktop)
  docker-mcp-secure

  # HTTP 模式 (用于独立部署)
  docker-mcp-secure --transport http --port 3000

环境变量:
  DOCKER_HOST          Docker 远程地址 (tcp://ip:port)
  ALLOW_LOCAL_DOCKER   允许本地 Docker 连接 (true/false)
  SECURITY_MODE        安全模式 (readonly/readwrite)
  MCP_TRANSPORT        传输模式 (stdio/http)
  MCP_PORT             HTTP 端口号
`);
      process.exit(0);
    }
  }

  // 环境变量覆盖
  if (process.env.MCP_TRANSPORT) {
    options.transport = process.env.MCP_TRANSPORT as 'stdio' | 'http';
  }
  if (process.env.MCP_PORT) {
    options.port = parseInt(process.env.MCP_PORT, 10);
  }
  if (process.env.MCP_HOST) {
    options.host = process.env.MCP_HOST;
  }

  return options;
}

// 打印当前配置信息（从 MCP json 的 env 字段注入）
console.error('📋 Docker MCP Server 配置:');
console.error(`   DOCKER_HOST: ${process.env.DOCKER_HOST || '(未设置，将使用本地 Docker)'}`);
console.error(`   ALLOW_LOCAL_DOCKER: ${process.env.ALLOW_LOCAL_DOCKER || 'false'}`);
console.error(`   SECURITY_MODE: ${process.env.SECURITY_MODE || 'readonly'}`);
console.error(`   SECURITY_AUDIT_LOG: ${process.env.SECURITY_AUDIT_LOG || 'true'}`);
console.error(`   LOG_LEVEL: ${process.env.LOG_LEVEL || 'info'}`);

// 创建 MCP 服务器
const server = new Server(
  {
    name: 'docker-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 初始化组件
let multiDockerClient: MultiDockerClient | null = null;
const securityGuard = new SecurityGuard();
const auditLogger = new AuditLogger();

/**
 * 初始化多源 Docker 客户端
 */
async function initMultiDockerClient(): Promise<MultiDockerClient> {
  if (!multiDockerClient) {
    try {
      multiDockerClient = new MultiDockerClient();
      console.error('✅ 多源 Docker 客户端初始化成功');
    } catch (error) {
      if (error instanceof SecurityError) {
        console.error(`🚫 安全错误: ${error.message}`);
      }
      throw error;
    }
  }
  return multiDockerClient;
}

/**
 * 处理工具列表请求
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error(`📦 返回 ${MULTI_TOOLS.length} 个工具`);
  return { tools: MULTI_TOOLS };
});

/**
 * 处理工具调用请求
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const startTime = Date.now();
  
  console.error(`🔧 调用工具: ${name}`);
  
  try {
    // 安全检查
    const [allowed, reason] = securityGuard.checkToolCall(name, args || {});
    if (!allowed) {
      auditLogger.logSecurityEvent('BLOCKED', name, reason);
      throw new McpError(ErrorCode.InvalidRequest, `安全拦截: ${reason}`);
    }
    
    // 获取工具处理器
    const handler = MULTI_TOOL_HANDLERS[name];
    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `未知工具: ${name}`);
    }
    
    // 初始化多源 Docker 客户端
    const client = await initMultiDockerClient();
    
    // 执行工具
    const result = await handler(client, args || {});
    const duration = Date.now() - startTime;
    
    // 记录审计日志
    auditLogger.logToolCall(name, args || {}, result, true, duration);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    auditLogger.logToolCall(name, args || {}, { error: errorMessage }, false, duration);
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(ErrorCode.InternalError, errorMessage);
  }
});

/**
 * 启动服务器
 */
async function main() {
  const options = parseArgs();
  const securityMode = process.env.SECURITY_MODE || 'readonly';
  const dockerHost = process.env.DOCKER_HOST;
  const allowLocal = process.env.ALLOW_LOCAL_DOCKER?.toLowerCase() === 'true';
  
  console.error('🚀 Docker MCP Server 启动中...');
  console.error(`🔒 安全模式: ${securityMode}`);
  console.error(`📡 传输模式: ${options.transport}`);
  
  // 显示 Docker 连接状态
  if (dockerHost && allowLocal) {
    console.error(`🌐 Docker 目标: 双源模式（本地 + ${dockerHost}）`);
  } else if (dockerHost) {
    console.error(`🌐 Docker 目标: ${dockerHost}`);
  } else if (allowLocal) {
    console.error(`🌐 Docker 目标: 本地 Docker`);
  } else {
    console.error(`⚠️  Docker 目标: 未配置！调用工具时会提示配置方法`);
  }
  
  console.error(`📦 已加载 ${MULTI_TOOLS.length} 个工具:`);
  MULTI_TOOLS.forEach(tool => {
    console.error(`   - ${tool.name}: ${tool.description}`);
  });

  if (options.transport === 'http') {
    // HTTP 模式：使用 Express + StreamableHTTP
    await startHttpServer(options.port, options.host);
  } else {
    // Stdio 模式：标准输入输出
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('✅ MCP Server 已启动 (Stdio 模式)，等待连接...');
  }
}

/**
 * 启动 HTTP 服务器
 */
async function startHttpServer(port: number, host: string) {
  const app = createMcpExpressApp({ host });
  
  // 存储活跃的传输会话
  const transports = new Map<string, StreamableHTTPServerTransport>();

  // MCP 端点
  app.all('/mcp', async (req: Request, res: Response) => {
    // 为每个请求创建新的传输实例
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        transports.set(sessionId, transport);
        console.error(`📡 新会话: ${sessionId}`);
      },
      onsessionclosed: (sessionId) => {
        transports.delete(sessionId);
        console.error(`📡 会话关闭: ${sessionId}`);
      },
    });

    // 连接到服务器
    await server.connect(transport);
    
    // 处理请求
    await transport.handleRequest(req, res);
  });

  // 健康检查端点
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      name: 'docker-mcp-server',
      version: '1.0.0',
      transport: 'http',
      tools: MULTI_TOOLS.length,
      docker: {
        host: process.env.DOCKER_HOST || 'not configured',
        localAllowed: process.env.ALLOW_LOCAL_DOCKER === 'true',
      },
    });
  });

  // 工具列表端点（方便调试）
  app.get('/tools', (_req: Request, res: Response) => {
    res.json({
      tools: MULTI_TOOLS.map(t => ({
        name: t.name,
        description: t.description,
      })),
    });
  });

  // 启动服务器并保持进程运行
  return new Promise<void>((resolve, reject) => {
    const httpServer = app.listen(port, host, () => {
      console.error(`✅ MCP Server 已启动 (HTTP 模式)`);
      console.error(`   🌐 地址: http://${host}:${port}`);
      console.error(`   📡 MCP 端点: http://${host}:${port}/mcp`);
      console.error(`   💚 健康检查: http://${host}:${port}/health`);
      console.error(`   🔧 工具列表: http://${host}:${port}/tools`);
      console.error(`\n按 Ctrl+C 停止服务器...`);
      // 不调用 resolve()，让 Promise 保持 pending 状态，进程不会退出
    });

    httpServer.on('error', (err: Error) => {
      console.error('❌ HTTP 服务器错误:', err);
      reject(err);
    });
  });
}

main().catch((error) => {
  console.error('❌ 服务器启动失败:', error);
  process.exit(1);
});

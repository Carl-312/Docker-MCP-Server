#!/usr/bin/env node
/**
 * Docker MCP Server - 企业级安全版（简化版）
 * 
 * 提供 Docker 容器和镜像的只读管理功能
 * 支持 MCP (Model Context Protocol) 标准
 * 
 * 特点：
 * - 每个工具都支持 docker_host 参数，无需预先配置
 * - 也可通过 DOCKER_HOST 环境变量设置默认连接
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

import { MultiDockerClient } from './utils/multi-docker-client.js';
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

环境变量:
  DOCKER_HOST          Docker 远程地址 (tcp://ip:port)，可选
  SECURITY_MODE        安全模式 (readonly/readwrite)
  MCP_TRANSPORT        传输模式 (stdio/http)
  MCP_PORT             HTTP 端口号

使用方式:
  1. 环境变量配置（推荐持久化）:
     DOCKER_HOST=tcp://your-server:2375

  2. 每次调用时传入（无需配置）:
     docker_list_containers: {"docker_host": "tcp://your-server:2375"}
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

// 打印当前配置信息
console.error('📋 Docker MCP Server 配置:');
console.error(`   DOCKER_HOST: ${process.env.DOCKER_HOST || '(未设置，调用时需传入 docker_host 参数)'}`);
console.error(`   SECURITY_MODE: ${process.env.SECURITY_MODE || 'readonly'}`);

// 创建 MCP 服务器
const server = new Server(
  {
    name: 'docker-mcp-server',
    version: '1.0.6',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 初始化组件
const dockerClient = new MultiDockerClient();
const securityGuard = new SecurityGuard();
const auditLogger = new AuditLogger();

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
    
    // 执行工具
    const result = await handler(dockerClient, args || {});
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
  
  console.error('🚀 Docker MCP Server 启动中...');
  console.error(`🔒 安全模式: ${process.env.SECURITY_MODE || 'readonly'}`);
  console.error(`📡 传输模式: ${options.transport}`);
  console.error(`📦 已加载 ${MULTI_TOOLS.length} 个工具`);

  if (options.transport === 'http') {
    await startHttpServer(options.port, options.host);
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('✅ MCP Server 已启动 (Stdio 模式)');
  }
}

/**
 * 启动 HTTP 服务器
 */
async function startHttpServer(port: number, host: string) {
  const app = createMcpExpressApp({ host });
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.all('/mcp', async (req: Request, res: Response) => {
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

    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      name: 'docker-mcp-server',
      version: '1.0.6',
      tools: MULTI_TOOLS.length,
      docker_host: process.env.DOCKER_HOST || 'not configured (pass docker_host in each call)',
    });
  });

  app.get('/tools', (_req: Request, res: Response) => {
    res.json({
      tools: MULTI_TOOLS.map(t => ({
        name: t.name,
        description: t.description,
      })),
    });
  });

  return new Promise<void>((resolve, reject) => {
    const httpServer = app.listen(port, host, () => {
      console.error(`✅ MCP Server 已启动 (HTTP 模式)`);
      console.error(`   🌐 地址: http://${host}:${port}`);
      console.error(`   📡 MCP 端点: http://${host}:${port}/mcp`);
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

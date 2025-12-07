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
 * - 同时支持 SSE 和 Streamable HTTP 传输模式
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError, } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import { MultiDockerClient } from './utils/multi-docker-client.js';
import { SecurityGuard } from './security/guard.js';
import { AuditLogger } from './security/audit.js';
import { MULTI_TOOLS, MULTI_TOOL_HANDLERS } from './tools/index.js';
// 解析命令行参数
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        transport: 'stdio',
        port: 3000,
        host: '0.0.0.0',
    };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--transport' && args[i + 1]) {
            options.transport = args[i + 1];
            i++;
        }
        else if (args[i] === '--port' && args[i + 1]) {
            options.port = parseInt(args[i + 1], 10);
            i++;
        }
        else if (args[i] === '--host' && args[i + 1]) {
            options.host = args[i + 1];
            i++;
        }
        else if (args[i] === '--help' || args[i] === '-h') {
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
        options.transport = process.env.MCP_TRANSPORT;
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
const server = new Server({
    name: 'docker-mcp-server',
    version: '1.0.6',
}, {
    capabilities: {
        tools: {},
    },
});
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
    }
    catch (error) {
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
    }
    else {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error('✅ MCP Server 已启动 (Stdio 模式)');
    }
}
/**
 * 启动 HTTP 服务器
 * 同时支持 SSE 和 Streamable HTTP 两种传输模式
 */
async function startHttpServer(port, host) {
    const app = createMcpExpressApp({ host });
    // Streamable HTTP 传输存储
    const streamableTransports = new Map();
    // SSE 传输存储
    const sseTransports = new Map();
    // ===== Streamable HTTP 端点 (新标准) =====
    app.all('/mcp', async (req, res) => {
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sessionId) => {
                streamableTransports.set(sessionId, transport);
                console.error(`📡 [Streamable] 新会话: ${sessionId}`);
            },
            onsessionclosed: (sessionId) => {
                streamableTransports.delete(sessionId);
                console.error(`📡 [Streamable] 会话关闭: ${sessionId}`);
            },
        });
        await server.connect(transport);
        await transport.handleRequest(req, res);
    });
    // ===== SSE 端点 (兼容旧客户端/百宝箱) =====
    app.get('/sse', async (req, res) => {
        console.error('📡 [SSE] 收到 SSE 连接请求');
        // 验证 API Key（如果设置了）
        const apiKey = req.query.key || req.headers['x-api-key'];
        const requiredKey = process.env.API_KEY;
        if (requiredKey && apiKey !== requiredKey) {
            res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
            return;
        }
        const transport = new SSEServerTransport('/messages', res);
        const sessionId = transport.sessionId;
        sseTransports.set(sessionId, transport);
        console.error(`📡 [SSE] 新会话: ${sessionId}`);
        res.on('close', () => {
            sseTransports.delete(sessionId);
            console.error(`📡 [SSE] 会话关闭: ${sessionId}`);
        });
        await server.connect(transport);
    });
    // SSE 消息处理端点
    app.post('/messages', async (req, res) => {
        const sessionId = req.query.sessionId;
        const transport = sseTransports.get(sessionId);
        if (transport) {
            await transport.handlePostMessage(req, res);
        }
        else {
            res.status(400).json({ error: 'No transport found for sessionId' });
        }
    });
    // ===== 兼容百宝箱的端点别名 =====
    app.get('/mcp-servers', async (req, res) => {
        console.error('📡 [SSE] 收到百宝箱 SSE 连接请求');
        // 验证 API Key
        const apiKey = req.query.key || req.headers['x-api-key'];
        const requiredKey = process.env.API_KEY;
        if (requiredKey && apiKey !== requiredKey) {
            res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
            return;
        }
        const transport = new SSEServerTransport('/mcp-messages', res);
        const sessionId = transport.sessionId;
        sseTransports.set(sessionId, transport);
        console.error(`📡 [百宝箱] 新会话: ${sessionId}`);
        res.on('close', () => {
            sseTransports.delete(sessionId);
            console.error(`📡 [百宝箱] 会话关闭: ${sessionId}`);
        });
        await server.connect(transport);
    });
    app.post('/mcp-messages', async (req, res) => {
        const sessionId = req.query.sessionId;
        const transport = sseTransports.get(sessionId);
        if (transport) {
            await transport.handlePostMessage(req, res);
        }
        else {
            res.status(400).json({ error: 'No transport found for sessionId' });
        }
    });
    // ===== 辅助端点 =====
    app.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            name: 'docker-mcp-server',
            version: '1.0.7',
            tools: MULTI_TOOLS.length,
            docker_host: process.env.DOCKER_HOST || 'not configured (pass docker_host in each call)',
            endpoints: {
                streamableHttp: '/mcp',
                sse: '/sse',
                sseMessages: '/messages',
                baibaobox: '/mcp-servers',
                baibaoboxMessages: '/mcp-messages',
            },
        });
    });
    app.get('/tools', (_req, res) => {
        res.json({
            tools: MULTI_TOOLS.map(t => ({
                name: t.name,
                description: t.description,
            })),
        });
    });
    return new Promise((resolve, reject) => {
        const httpServer = app.listen(port, host, () => {
            console.error(`✅ MCP Server 已启动 (HTTP 模式)`);
            console.error(`   🌐 地址: http://${host}:${port}`);
            console.error(`   📡 Streamable HTTP: http://${host}:${port}/mcp`);
            console.error(`   📡 SSE 端点: http://${host}:${port}/sse`);
            console.error(`   📡 百宝箱端点: http://${host}:${port}/mcp-servers`);
        });
        httpServer.on('error', (err) => {
            console.error('❌ HTTP 服务器错误:', err);
            reject(err);
        });
    });
}
main().catch((error) => {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map
/**
 * MCP Prompts - 配置向导提示词
 *
 * 提供交互式配置指南，帮助用户生成正确的 MCP 配置
 */
import { GetPromptRequestSchema, ListPromptsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
/**
 * 可用的配置提示词列表
 */
export const PROMPTS = [
    {
        name: 'setup-cloud-docker',
        description: '配置连接云服务器 Docker（阿里云 ECS、腾讯云 CVM、AWS EC2 等）',
        arguments: [
            {
                name: 'server_ip',
                description: '云服务器的公网 IP 地址',
                required: true,
            },
            {
                name: 'port',
                description: 'Docker TCP 端口（默认 2375）',
                required: false,
            },
        ],
    },
    {
        name: 'setup-local-docker',
        description: '配置连接本地 Docker（开发环境）',
        arguments: [],
    },
    {
        name: 'setup-dual-source',
        description: '配置双源模式（同时连接本地和远程 Docker）',
        arguments: [
            {
                name: 'server_ip',
                description: '云服务器的公网 IP 地址',
                required: true,
            },
            {
                name: 'port',
                description: 'Docker TCP 端口（默认 2375）',
                required: false,
            },
        ],
    },
    {
        name: 'show-current-config',
        description: '查看当前 Docker MCP 配置状态',
        arguments: [],
    },
];
/**
 * 生成云服务器配置的提示词内容
 */
function generateCloudConfigPrompt(serverIp, port = '2375') {
    const config = {
        mcpServers: {
            'docker-mcp-secure': {
                command: 'npx',
                args: ['docker-mcp-secure'],
                env: {
                    DOCKER_HOST: `tcp://${serverIp}:${port}`,
                    SECURITY_MODE: 'readonly',
                    SECURITY_AUDIT_LOG: 'true',
                    LOG_LEVEL: 'info',
                },
            },
        },
    };
    return `# 🌐 云服务器 Docker 配置

## 您的配置信息
- 服务器 IP: ${serverIp}
- 端口: ${port}

## 生成的 MCP 配置

请将以下配置复制到您的 MCP 配置文件中：

\`\`\`json
${JSON.stringify(config, null, 2)}
\`\`\`

## 配置文件位置

- **Claude Desktop (Windows)**: \`%APPDATA%\\Claude\\claude_desktop_config.json\`
- **Claude Desktop (macOS)**: \`~/Library/Application Support/Claude/claude_desktop_config.json\`
- **VS Code (Copilot)**: \`.vscode/mcp.json\`
- **Cursor**: \`~/.cursor/mcp.json\`

## ⚠️ 重要提醒

1. **开启 Docker TCP 端口**：确保服务器上的 Docker 已开启 TCP 端口
   \`\`\`bash
   # 编辑 Docker 配置
   sudo vim /etc/docker/daemon.json
   # 添加: {"hosts": ["unix:///var/run/docker.sock", "tcp://0.0.0.0:2375"]}
   # 重启 Docker
   sudo systemctl restart docker
   \`\`\`

2. **配置安全组**：在云服务商控制台，限制 ${port} 端口只对您的 IP 开放

3. **保存配置后重启** MCP 客户端（Claude Desktop/Cursor 等）`;
}
/**
 * 生成本地 Docker 配置的提示词内容
 */
function generateLocalConfigPrompt() {
    const config = {
        mcpServers: {
            'docker-mcp-secure': {
                command: 'npx',
                args: ['docker-mcp-secure'],
                env: {
                    ALLOW_LOCAL_DOCKER: 'true',
                    SECURITY_MODE: 'readonly',
                    SECURITY_AUDIT_LOG: 'true',
                    LOG_LEVEL: 'info',
                },
            },
        },
    };
    return `# 💻 本地 Docker 配置（开发环境）

## 生成的 MCP 配置

请将以下配置复制到您的 MCP 配置文件中：

\`\`\`json
${JSON.stringify(config, null, 2)}
\`\`\`

## 配置文件位置

- **Claude Desktop (Windows)**: \`%APPDATA%\\Claude\\claude_desktop_config.json\`
- **Claude Desktop (macOS)**: \`~/Library/Application Support/Claude/claude_desktop_config.json\`
- **VS Code (Copilot)**: \`.vscode/mcp.json\`
- **Cursor**: \`~/.cursor/mcp.json\`

## 前提条件

确保本地 Docker 已安装并运行：
\`\`\`bash
docker --version
docker ps
\`\`\`

保存配置后重启 MCP 客户端即可使用。`;
}
/**
 * 生成双源模式配置的提示词内容
 */
function generateDualSourceConfigPrompt(serverIp, port = '2375') {
    const config = {
        mcpServers: {
            'docker-mcp-secure': {
                command: 'npx',
                args: ['docker-mcp-secure'],
                env: {
                    DOCKER_HOST: `tcp://${serverIp}:${port}`,
                    ALLOW_LOCAL_DOCKER: 'true',
                    SECURITY_MODE: 'readonly',
                    SECURITY_AUDIT_LOG: 'true',
                    LOG_LEVEL: 'info',
                },
            },
        },
    };
    return `# 🔄 双源模式配置（本地 + 远程）

## 您的配置信息
- 远程服务器 IP: ${serverIp}
- 端口: ${port}
- 本地 Docker: 已启用

## 生成的 MCP 配置

请将以下配置复制到您的 MCP 配置文件中：

\`\`\`json
${JSON.stringify(config, null, 2)}
\`\`\`

## 双源模式说明

在双源模式下，您可以：
- 使用 \`source: "local"\` 查询本地 Docker
- 使用 \`source: "remote"\` 查询远程 Docker
- 不指定 source 时默认查询远程

## 配置文件位置

- **Claude Desktop (Windows)**: \`%APPDATA%\\Claude\\claude_desktop_config.json\`
- **Claude Desktop (macOS)**: \`~/Library/Application Support/Claude/claude_desktop_config.json\`
- **VS Code (Copilot)**: \`.vscode/mcp.json\`
- **Cursor**: \`~/.cursor/mcp.json\`

保存配置后重启 MCP 客户端即可使用。`;
}
/**
 * 生成当前配置状态的提示词内容
 */
function generateCurrentConfigPrompt() {
    const dockerHost = process.env.DOCKER_HOST || '未配置';
    const allowLocal = process.env.ALLOW_LOCAL_DOCKER || 'false';
    const securityMode = process.env.SECURITY_MODE || 'readonly';
    const auditLog = process.env.SECURITY_AUDIT_LOG || 'true';
    const logLevel = process.env.LOG_LEVEL || 'info';
    let status = '❌ 未配置';
    if (dockerHost !== '未配置' && allowLocal === 'true') {
        status = '🔄 双源模式（本地 + 远程）';
    }
    else if (dockerHost !== '未配置') {
        status = '🌐 远程 Docker';
    }
    else if (allowLocal === 'true') {
        status = '💻 本地 Docker';
    }
    return `# 📋 当前 Docker MCP 配置状态

## 连接状态: ${status}

| 配置项 | 当前值 | 说明 |
|--------|--------|------|
| DOCKER_HOST | \`${dockerHost}\` | 远程 Docker 地址 |
| ALLOW_LOCAL_DOCKER | \`${allowLocal}\` | 是否允许本地连接 |
| SECURITY_MODE | \`${securityMode}\` | 安全模式 |
| SECURITY_AUDIT_LOG | \`${auditLog}\` | 审计日志 |
| LOG_LEVEL | \`${logLevel}\` | 日志级别 |

## 修改配置

如需修改配置，请使用以下提示词：
- \`setup-cloud-docker\` - 配置云服务器 Docker
- \`setup-local-docker\` - 配置本地 Docker
- \`setup-dual-source\` - 配置双源模式

或直接调用 \`docker_generate_config\` 工具生成新配置。`;
}
/**
 * 注册 Prompts 处理器到 MCP Server
 */
export function registerPromptHandlers(server) {
    // 处理 prompts/list 请求
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
        return { prompts: PROMPTS };
    });
    // 处理 prompts/get 请求
    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        switch (name) {
            case 'setup-cloud-docker': {
                const serverIp = args?.server_ip;
                const port = args?.port || '2375';
                if (!serverIp) {
                    return {
                        messages: [
                            {
                                role: 'user',
                                content: {
                                    type: 'text',
                                    text: '请提供云服务器的公网 IP 地址（server_ip 参数）',
                                },
                            },
                        ],
                    };
                }
                return {
                    messages: [
                        {
                            role: 'user',
                            content: {
                                type: 'text',
                                text: generateCloudConfigPrompt(serverIp, port),
                            },
                        },
                    ],
                };
            }
            case 'setup-local-docker':
                return {
                    messages: [
                        {
                            role: 'user',
                            content: {
                                type: 'text',
                                text: generateLocalConfigPrompt(),
                            },
                        },
                    ],
                };
            case 'setup-dual-source': {
                const serverIp = args?.server_ip;
                const port = args?.port || '2375';
                if (!serverIp) {
                    return {
                        messages: [
                            {
                                role: 'user',
                                content: {
                                    type: 'text',
                                    text: '请提供云服务器的公网 IP 地址（server_ip 参数）',
                                },
                            },
                        ],
                    };
                }
                return {
                    messages: [
                        {
                            role: 'user',
                            content: {
                                type: 'text',
                                text: generateDualSourceConfigPrompt(serverIp, port),
                            },
                        },
                    ],
                };
            }
            case 'show-current-config':
                return {
                    messages: [
                        {
                            role: 'user',
                            content: {
                                type: 'text',
                                text: generateCurrentConfigPrompt(),
                            },
                        },
                    ],
                };
            default:
                return {
                    messages: [
                        {
                            role: 'user',
                            content: {
                                type: 'text',
                                text: `未知的配置向导: ${name}`,
                            },
                        },
                    ],
                };
        }
    });
}
//# sourceMappingURL=index.js.map
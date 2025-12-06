/**
 * 配置生成工具（简化版）
 *
 * 只生成云服务器 Docker 配置
 */
import { z } from 'zod';
/**
 * 配置生成工具定义
 */
export const CONFIG_GENERATOR_TOOL = {
    name: 'docker_generate_config',
    description: '生成 Docker MCP 配置 JSON。根据您的云服务器信息生成可直接使用的 MCP 配置',
    inputSchema: {
        type: 'object',
        properties: {
            server_ip: {
                type: 'string',
                description: '云服务器公网 IP（必填）',
            },
            port: {
                type: 'string',
                description: 'Docker TCP 端口（默认 2375）',
            },
            security_audit: {
                type: 'boolean',
                description: '是否启用安全审计日志（默认 true）',
            },
            log_level: {
                type: 'string',
                enum: ['debug', 'info', 'warn', 'error'],
                description: '日志级别（默认 info）',
            },
        },
        required: ['server_ip'],
    },
};
/**
 * 配置生成参数 Schema
 */
const ConfigGeneratorSchema = z.object({
    server_ip: z.string(),
    port: z.string().default('2375'),
    security_audit: z.boolean().default(true),
    log_level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});
/**
 * 生成 MCP 配置
 */
export function generateMcpConfig(args) {
    try {
        const params = ConfigGeneratorSchema.parse(args);
        const { server_ip, port, security_audit, log_level } = params;
        if (!server_ip) {
            return {
                success: false,
                error: '请提供 server_ip 参数（云服务器公网 IP）',
            };
        }
        // 构建环境变量
        const env = {
            DOCKER_HOST: `tcp://${server_ip}:${port}`,
            SECURITY_MODE: 'readonly',
            SECURITY_AUDIT_LOG: security_audit ? 'true' : 'false',
            LOG_LEVEL: log_level,
        };
        // 构建完整配置
        const config = {
            mcpServers: {
                'docker-mcp-secure': {
                    command: 'npx',
                    args: ['docker-mcp-secure'],
                    env,
                },
            },
        };
        // 生成说明文档
        const instructions = `
# 🌐 云服务器 Docker 配置

## 配置信息
- 服务器 IP: ${server_ip}
- 端口: ${port}
- 安全模式: readonly

## 使用说明

1. 复制上面的 JSON 配置
2. 粘贴到对应客户端的配置文件中
3. 重启 MCP 客户端

## 📂 配置文件位置

| 客户端 | 路径 |
|--------|------|
| Claude Desktop (Windows) | \`%APPDATA%\\Claude\\claude_desktop_config.json\` |
| Claude Desktop (macOS) | \`~/Library/Application Support/Claude/claude_desktop_config.json\` |
| VS Code (Copilot) | \`.vscode/mcp.json\` |
| Cursor | \`~/.cursor/mcp.json\` |

## ⚠️ 服务器配置

### 1. 开启 Docker TCP 端口

\`\`\`bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<EOF
{
  "hosts": ["unix:///var/run/docker.sock", "tcp://0.0.0.0:${port}"]
}
EOF
sudo systemctl restart docker
\`\`\`

### 2. 配置安全组

在云服务商控制台开放 TCP 端口 ${port}，**仅允许您的 IP 访问**

### 3. 验证连接

\`\`\`bash
curl http://${server_ip}:${port}/version
\`\`\`
`;
        return {
            success: true,
            config,
            configJson: JSON.stringify(config, null, 2),
            instructions: instructions.trim(),
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : '参数验证失败',
        };
    }
}
/**
 * 配置生成工具处理器
 */
export async function handleConfigGenerator(_client, args) {
    return generateMcpConfig(args);
}
//# sourceMappingURL=config-generator.js.map
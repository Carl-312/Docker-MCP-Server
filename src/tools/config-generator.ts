/**
 * 配置生成工具
 * 
 * 根据用户需求生成 MCP 配置 JSON
 */

import { z } from 'zod';

/**
 * 配置生成工具定义
 */
export const CONFIG_GENERATOR_TOOL = {
  name: 'docker_generate_config',
  description: '生成 Docker MCP 配置。根据您的场景（云服务器/本地/双源）生成可直接使用的 MCP 配置 JSON',
  inputSchema: {
    type: 'object' as const,
    properties: {
      mode: {
        type: 'string',
        enum: ['cloud', 'local', 'dual'],
        description: '配置模式: cloud=云服务器, local=本地Docker, dual=双源模式',
      },
      server_ip: {
        type: 'string',
        description: '云服务器公网 IP（cloud 和 dual 模式必填）',
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
    required: ['mode'],
  },
};

/**
 * 配置生成参数 Schema
 */
const ConfigGeneratorSchema = z.object({
  mode: z.enum(['cloud', 'local', 'dual']),
  server_ip: z.string().optional(),
  port: z.string().default('2375'),
  security_audit: z.boolean().default(true),
  log_level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

/**
 * 生成 MCP 配置
 */
export function generateMcpConfig(args: unknown): {
  success: boolean;
  config?: object;
  configJson?: string;
  instructions?: string;
  error?: string;
} {
  try {
    const params = ConfigGeneratorSchema.parse(args);
    const { mode, server_ip, port, security_audit, log_level } = params;

    // 验证云服务器模式必须有 IP
    if ((mode === 'cloud' || mode === 'dual') && !server_ip) {
      return {
        success: false,
        error: `${mode === 'cloud' ? '云服务器' : '双源'}模式需要提供 server_ip 参数`,
      };
    }

    // 构建环境变量
    const env: Record<string, string> = {
      SECURITY_MODE: 'readonly',
      SECURITY_AUDIT_LOG: security_audit ? 'true' : 'false',
      LOG_LEVEL: log_level,
    };

    // 根据模式设置连接参数
    let modeDescription = '';
    switch (mode) {
      case 'cloud':
        env.DOCKER_HOST = `tcp://${server_ip}:${port}`;
        modeDescription = `🌐 云服务器模式 (${server_ip}:${port})`;
        break;
      case 'local':
        env.ALLOW_LOCAL_DOCKER = 'true';
        modeDescription = '💻 本地 Docker 模式';
        break;
      case 'dual':
        env.DOCKER_HOST = `tcp://${server_ip}:${port}`;
        env.ALLOW_LOCAL_DOCKER = 'true';
        modeDescription = `🔄 双源模式 (本地 + ${server_ip}:${port})`;
        break;
    }

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
    const instructions = generateInstructions(mode, server_ip, port);

    return {
      success: true,
      config,
      configJson: JSON.stringify(config, null, 2),
      instructions: `# ${modeDescription}\n\n${instructions}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '参数验证失败',
    };
  }
}

/**
 * 生成配置说明
 */
function generateInstructions(mode: string, serverIp?: string, port?: string): string {
  const configLocations = `
## 📂 配置文件位置

| 客户端 | 路径 |
|--------|------|
| Claude Desktop (Windows) | \`%APPDATA%\\Claude\\claude_desktop_config.json\` |
| Claude Desktop (macOS) | \`~/Library/Application Support/Claude/claude_desktop_config.json\` |
| VS Code (Copilot) | \`.vscode/mcp.json\` |
| Cursor | \`~/.cursor/mcp.json\` |
`;

  let modeSpecificInstructions = '';

  if (mode === 'cloud' || mode === 'dual') {
    modeSpecificInstructions = `
## ⚠️ 云服务器配置步骤

### 1. 开启 Docker TCP 端口

在服务器上编辑 Docker 配置：
\`\`\`bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<EOF
{
  "hosts": ["unix:///var/run/docker.sock", "tcp://0.0.0.0:${port}"]
}
EOF
\`\`\`

修改 systemd 服务（如果需要）：
\`\`\`bash
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo tee /etc/systemd/system/docker.service.d/override.conf <<EOF
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd
EOF
\`\`\`

重启 Docker：
\`\`\`bash
sudo systemctl daemon-reload
sudo systemctl restart docker
\`\`\`

### 2. 配置安全组

在云服务商控制台（阿里云/腾讯云/AWS）：
- 开放 TCP 端口 ${port}
- **仅允许您的 IP 访问**（非常重要！）

### 3. 验证连接

\`\`\`bash
# 从本地测试
curl http://${serverIp}:${port}/version
\`\`\`
`;
  }

  if (mode === 'local' || mode === 'dual') {
    modeSpecificInstructions += `
## 💻 本地 Docker 要求

确保 Docker Desktop 已安装并运行：
\`\`\`bash
docker --version
docker ps
\`\`\`
`;
  }

  return `
## 使用说明

1. 复制上面的 JSON 配置
2. 粘贴到对应客户端的配置文件中
3. 重启 MCP 客户端

${configLocations}
${modeSpecificInstructions}

## ✅ 配置完成后

重启 Claude Desktop / Cursor / VS Code 后，即可使用以下工具：
- \`docker_list_containers\` - 列出容器
- \`docker_inspect\` - 查看容器详情
- \`docker_logs\` - 获取容器日志
- \`docker_stats\` - 查看资源使用情况
- \`docker_list_images\` - 列出镜像
- \`docker_image_info\` - 查看镜像详情
`;
}

/**
 * 配置生成工具处理器
 */
export async function handleConfigGenerator(_client: unknown, args: unknown): Promise<Record<string, unknown>> {
  return generateMcpConfig(args) as Record<string, unknown>;
}


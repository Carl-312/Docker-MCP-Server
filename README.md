# Docker MCP Server

> 云巡 - 企业级安全的 Docker 容器管理 MCP 服务器

[![npm version](https://img.shields.io/npm/v/docker-mcp-secure.svg)](https://www.npmjs.com/package/docker-mcp-secure)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

## 📚 文档

- 📖 [**用户配置指南**](docs/USER-SETUP-GUIDE.md) - 详细的 Docker 接口配置说明
- ⚡ [**快速开始**](docs/QUICK-START.md) - 5 分钟快速配置参考

## 📖 简介

这是一个基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 的 Docker 管理服务器，允许 AI 助手安全地查询 Docker 容器和镜像信息。

### ✨ 核心特性

- 🌐 **连接云端 Docker** - 支持连接阿里云 ECS、腾讯云 CVM、AWS EC2 等远程 Docker
- ✅ **7 个只读工具** - 安全查询容器和镜像
- 🔒 **企业级安全** - API 白名单、参数校验、审计日志
- 🚫 **无危险操作** - 禁止创建、删除、执行等操作
- 📦 **即插即用** - 支持 Claude Desktop、VS Code Copilot、Cursor 等

## 🚀 快速开始

### 安装

```bash
npm install -g docker-mcp-secure
```

### ⚙️ 配置

#### 方式一：连接您的云服务器 Docker（推荐）

```json
{
  "mcpServers": {
    "docker-mcp-secure": {
      "command": "npx",
      "args": ["docker-mcp-secure"],
      "env": {
        "DOCKER_HOST": "tcp://您的服务器IP:2375"
      }
    }
  }
}
```

> 📝 需要先在服务器上开启 Docker TCP 端口，详见 [用户配置指南](docs/USER-SETUP-GUIDE.md)

#### 方式二：连接本地 Docker（开发者）

```json
{
  "mcpServers": {
    "docker-mcp-secure": {
      "command": "npx",
      "args": ["docker-mcp-secure"],
      "env": {
        "ALLOW_LOCAL_DOCKER": "true"
      }
    }
  }
}
```

#### 方式三：完整配置（可选）

如需自定义所有选项，可使用完整配置：

```json
{
  "mcpServers": {
    "docker-mcp-secure": {
      "command": "npx",
      "args": ["docker-mcp-secure"],
      "env": {
        "DOCKER_HOST": "tcp://您的服务器IP:2375",
        "ALLOW_LOCAL_DOCKER": "false",
        "SECURITY_MODE": "readonly",
        "SECURITY_AUDIT_LOG": "true",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

> 💡 **提示**：上述配置展示了所有可用选项及其默认值。大多数情况下，使用方式一或方式二的简洁配置即可。

#### 方式四：会话内动态配置（云端部署推荐）

无需修改配置文件，直接在对话中设置 Docker 连接：

```
用户: 连接我的服务器 47.100.xxx.xxx
AI: [调用 docker_set_connection] 已连接到 tcp://47.100.xxx.xxx:2375

用户: 列出容器
AI: [调用 docker_list_containers] 找到 3 个容器...
```

> 🔄 会话配置在当前对话期间有效，适合云端部署的 MCP 服务器。

### 配置文件位置

**Claude Desktop:**
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

**VS Code (GitHub Copilot):** `.vscode/mcp.json`

**Cursor:** `~/.cursor/mcp.json`

## 🔧 可用工具

### Docker 查询工具

| 工具名称 | 描述 |
|---------|------|
| `docker_list_containers` | 列出所有 Docker 容器 |
| `docker_inspect` | 查看容器详细信息 |
| `docker_logs` | 获取容器日志 |
| `docker_stats` | 获取容器资源使用情况 |
| `docker_list_images` | 列出本地所有镜像 |
| `docker_image_info` | 查看镜像详细信息 |
| `docker_connection_status` | 查看 Docker 连接状态 |

### 配置管理工具

| 工具名称 | 描述 |
|---------|------|
| `docker_set_connection` | 🆕 在对话中设置 Docker 连接（会话级） |
| `docker_get_session_config` | 🆕 查看当前会话配置状态 |
| `docker_reset_config` | 🆕 重置为环境变量默认配置 |
| `docker_generate_config` | 生成 MCP 配置 JSON（用于配置文件）|

## 🌐 环境变量

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `DOCKER_HOST` | - | Docker 主机地址（如 `tcp://your-ip:2375`）|
| `ALLOW_LOCAL_DOCKER` | `false` | 是否允许本地 Docker 连接 |
| `SECURITY_MODE` | `readonly` | 安全模式 |
| `SECURITY_AUDIT_LOG` | `true` | 是否启用审计日志 |
| `LOG_LEVEL` | `info` | 日志级别 |

## 🔒 安全设计

### 只读操作

本服务器只提供只读操作，禁止以下危险行为：

- ❌ 创建/删除容器
- ❌ 启动/停止容器
- ❌ 执行命令 (exec)
- ❌ 构建/推送镜像
- ❌ 访问文件系统

### API 白名单

只允许以下 Docker API 端点：

- `GET /containers/json` - 列出容器
- `GET /containers/{id}/json` - 容器详情
- `GET /containers/{id}/logs` - 容器日志
- `GET /containers/{id}/stats` - 容器统计
- `GET /images/json` - 列出镜像
- `GET /images/{id}/json` - 镜像详情

### 参数校验

自动拦截危险参数模式：

- 命令注入 (`;`, `|`, `&&`)
- 路径遍历 (`..`)
- 代码执行 (反引号, `$()`)

## 🏗️ 本地开发

```bash
# 克隆项目
git clone https://github.com/Carl-312/Docker-MCP-Server.git
cd Docker-MCP-Server

# 安装依赖
npm install

# 开发模式（Stdio）
npm run dev

# 开发模式（HTTP）
npm run dev:http

# 构建
npm run build

# 测试
npm test
```

## 📋 依赖项

| 包名 | 用途 |
|------|------|
| `@modelcontextprotocol/sdk` | MCP 官方 SDK |
| `dockerode` | Docker API 客户端 |
| `zod` | 运行时类型校验 |

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**⚠️ 安全提醒**：请务必在云服务商安全组中限制 2375 端口只对您的 IP 开放，避免暴露给公网！


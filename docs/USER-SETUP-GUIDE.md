# 🐳 Docker MCP Server 用户配置指南

> 📅 版本：1.0.0

---

## 📖 概述

**docker-mcp-secure** 是一个企业级安全的 Docker 容器管理 MCP 服务器，允许 AI 助手（如 Claude、GitHub Copilot）安全地查询您的 Docker 容器和镜像信息。

### 工作原理

```
┌─────────────────┐      MCP 协议      ┌─────────────────┐      Docker API     ┌─────────────────┐
│   AI 助手        │ ◄───────────────► │  docker-mcp     │ ◄─────────────────► │  您的 Docker     │
│  Claude/Copilot │     stdio/http     │   -secure       │     tcp://IP:2375   │  服务器          │
└─────────────────┘                    └─────────────────┘                     └─────────────────┘
```

要使用本工具，您需要：
1. **配置您的 Docker 服务器**：开启远程 API 访问
2. **配置安全规则**：限制访问 IP
3. **配置 MCP 客户端**：告诉 MCP 如何连接您的 Docker

---

## 🚀 快速开始

### 连接方式选择

| 连接方式 | 适用场景 | 难度 |
|---------|---------|------|
| **远程 Docker（云服务器）** | 阿里云 ECS、腾讯云 CVM、AWS EC2 等 | ⭐⭐ |
| **本地 Docker** | 本机安装的 Docker Desktop | ⭐ |

---

## 🌐 方式一：连接远程 Docker（推荐）

适用于：阿里云 ECS、腾讯云 CVM、华为云 ECS、AWS EC2、Azure VM 等

### 📋 前置条件

- ✅ 一台运行 Docker 的云服务器
- ✅ 服务器公网 IP 地址
- ✅ 服务器 root 或 sudo 权限
- ✅ 安全组/防火墙管理权限

### 步骤 1：配置 Docker 远程 API

SSH 登录到您的服务器，执行以下操作：

#### 1.1 编辑 Docker daemon 配置

```bash
# 创建或编辑 daemon.json
sudo vim /etc/docker/daemon.json
```

添加以下内容（如果文件已有内容，合并配置）：

```json
{
  "hosts": ["tcp://0.0.0.0:2375", "unix:///var/run/docker.sock"]
}
```

> 💡 **配置说明**：
> - `tcp://0.0.0.0:2375` — 监听所有网络接口的 2375 端口
> - `unix:///var/run/docker.sock` — 保留本地 socket 连接

#### 1.2 处理 systemd 与 daemon.json 冲突

如果您的系统使用 systemd 管理 Docker（大多数 Linux 发行版），需要创建覆盖配置：

```bash
# 创建覆盖目录
sudo mkdir -p /etc/systemd/system/docker.service.d

# 创建覆盖配置文件
sudo vim /etc/systemd/system/docker.service.d/override.conf
```

写入以下内容：

```ini
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd
```

> ⚠️ **重要**：必须先清空 `ExecStart=`，否则会与 daemon.json 的 hosts 配置冲突！

#### 1.3 重启 Docker 服务

```bash
# 重载 systemd 配置
sudo systemctl daemon-reload

# 重启 Docker
sudo systemctl restart docker

# 检查状态
sudo systemctl status docker
```

#### 1.4 验证配置

```bash
# 检查端口监听
netstat -tlnp | grep 2375
# 或
ss -tlnp | grep 2375

# 测试本地连接
curl http://localhost:2375/version
```

如果看到 Docker 版本信息的 JSON 输出，说明配置成功！

---

### 步骤 2：配置安全组/防火墙

> ⚠️ **安全警告**：Docker 2375 端口提供 **root 级别权限**，必须严格限制访问 IP！

#### 2.1 获取您的公网 IP

在您的本地电脑上执行：

**Windows PowerShell:**
```powershell
(Invoke-WebRequest -Uri "https://api.ipify.org").Content
```

**macOS/Linux:**
```bash
curl https://api.ipify.org
```

记录显示的 IP 地址，例如：`123.45.67.89`

#### 2.2 配置云服务商安全组

##### 阿里云 ECS

1. 登录 [ECS 控制台](https://ecs.console.aliyun.com)
2. 左侧菜单 → **网络与安全** → **安全组**
3. 找到您的实例所在安全组 → **配置规则**
4. **入方向** → **手动添加**：

| 配置项 | 值 |
|-------|-----|
| 协议类型 | TCP |
| 端口范围 | 2375/2375 |
| 授权对象 | **您的IP/32**（例如：123.45.67.89/32）|
| 描述 | Docker远程访问 |

##### 腾讯云 CVM

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/cvm)
2. 左侧菜单 → **安全组**
3. 找到对应安全组 → **修改规则**
4. **入站规则** → **添加规则**：

| 配置项 | 值 |
|-------|-----|
| 协议端口 | TCP:2375 |
| 来源 | **您的IP/32** |
| 策略 | 允许 |

##### AWS EC2

1. 登录 [AWS 控制台](https://console.aws.amazon.com/ec2)
2. **Security Groups** → 选择实例的安全组
3. **Edit inbound rules** → **Add rule**：

| Type | Port | Source |
|------|------|--------|
| Custom TCP | 2375 | **您的IP/32** |

##### 本地服务器（物理机/VM）

如果使用 iptables：

```bash
# 仅允许您的 IP 访问 2375
sudo iptables -A INPUT -p tcp --dport 2375 -s 您的IP -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 2375 -j DROP
```

如果使用 ufw：

```bash
sudo ufw allow from 您的IP to any port 2375 proto tcp
```

---

### 步骤 3：测试远程连接

在您的本地电脑上测试：

**Windows PowerShell:**
```powershell
# 测试端口连通性
Test-NetConnection -ComputerName 您的服务器IP -Port 2375

# 测试 Docker API
Invoke-WebRequest -Uri "http://您的服务器IP:2375/version"
```

**macOS/Linux:**
```bash
# 测试端口连通性
nc -zv 您的服务器IP 2375

# 测试 Docker API
curl http://您的服务器IP:2375/version
```

如果返回 Docker 版本信息，恭喜！您的 Docker 远程访问已配置成功！

---

### 步骤 4：配置 MCP

#### 4.1 找到配置文件位置

**Claude Desktop:**
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

**VS Code (GitHub Copilot):**
- 项目级: `.vscode/mcp.json`
- 用户级: `~/.cursor/mcp.json` (Cursor) 或 VS Code 设置

#### 4.2 添加 MCP 配置

编辑配置文件，添加以下内容：

```json
{
  "mcpServers": {
    "docker-mcp-secure": {
      "command": "npx",
      "args": ["docker-mcp-secure"],
      "env": {
        "DOCKER_HOST": "tcp://您的服务器IP:2375",
        "SECURITY_MODE": "readonly",
        "SECURITY_AUDIT_LOG": "true",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

> 📝 **配置说明**：
> 
> | 环境变量 | 必填 | 说明 |
> |---------|------|------|
> | `DOCKER_HOST` | ✅ 是 | Docker API 地址，格式：`tcp://IP:端口` |
> | `SECURITY_MODE` | 否 | 安全模式，默认 `readonly`（只读） |
> | `SECURITY_AUDIT_LOG` | 否 | 是否记录审计日志，默认 `true` |
> | `LOG_LEVEL` | 否 | 日志级别：`debug`/`info`/`warn`/`error` |

#### 4.3 重启 AI 助手

- Claude Desktop：完全退出后重新打开
- VS Code/Cursor：重新加载窗口（Ctrl+Shift+P → Reload Window）

---

## 🏠 方式二：连接本地 Docker

适用于：本机安装了 Docker Desktop 的开发者

### 配置 MCP

```json
{
  "mcpServers": {
    "docker-mcp-secure": {
      "command": "npx",
      "args": ["docker-mcp-secure"],
      "env": {
        "ALLOW_LOCAL_DOCKER": "true",
        "SECURITY_MODE": "readonly"
      }
    }
  }
}
```

> 💡 无需配置 Docker 本身，直接使用本地 socket 连接。

---

## 🔧 可用工具

配置完成后，AI 助手将可以使用以下工具：

| 工具名称 | 功能描述 |
|---------|---------|
| `docker_list_containers` | 列出所有 Docker 容器 |
| `docker_inspect` | 查看容器详细信息 |
| `docker_logs` | 获取容器日志 |
| `docker_stats` | 获取容器资源使用情况 |
| `docker_list_images` | 列出本地所有镜像 |
| `docker_image_info` | 查看镜像详细信息 |
| `docker_connection_status` | 查看 Docker 连接状态 |

所有工具都是**只读**的，不会对您的容器进行任何修改、删除、启停操作。

---

## 🛡️ 安全最佳实践

### ✅ 必须做

1. **IP 白名单**：安全组/防火墙只允许您的 IP 访问 2375 端口
2. **定期检查**：确认安全组规则没有被误修改
3. **IP 变更时更新**：家庭/办公网络 IP 变化时及时更新安全组

### ❌ 绝对禁止

1. **不要**将 2375 端口开放给 `0.0.0.0/0`（所有人）
2. **不要**在生产环境的关键服务器上开启 2375
3. **不要**忽略安全组配置

### 💡 生产环境建议

如果需要在生产环境使用，建议：

1. **使用 TLS 加密**：配置 Docker TLS 证书（端口 2376）
2. **使用 VPN**：通过 VPN 连接后再访问 Docker API
3. **使用跳板机**：通过堡垒机中转访问

---

## 🐛 故障排查

### 问题 1：连接超时

**症状**：`Connection timeout` 或 `ETIMEDOUT`

**排查步骤**：

```bash
# 1. 检查端口监听（在服务器上执行）
netstat -tlnp | grep 2375

# 2. 检查安全组是否放行您的 IP
# 登录云控制台查看安全组规则

# 3. 检查您的 IP 是否变化
curl https://api.ipify.org
```

### 问题 2：Connection refused

**症状**：`connect ECONNREFUSED`

**排查步骤**：

```bash
# 1. 检查 Docker 服务状态
sudo systemctl status docker

# 2. 检查 daemon.json 配置是否正确
cat /etc/docker/daemon.json

# 3. 检查是否有 systemd 冲突
cat /etc/systemd/system/docker.service.d/override.conf
```

### 问题 3：MCP 工具不显示

**症状**：AI 助手看不到 Docker 工具

**排查步骤**：

1. 检查 MCP 配置文件 JSON 语法是否正确
2. 确认 `npx docker-mcp-secure` 命令可以正常执行
3. 重启 AI 助手应用

### 问题 4：IP 地址变化

家庭/办公网络 IP 可能会变化，导致连接失败。

**解决方案**：

1. 重新获取当前 IP：`curl https://api.ipify.org`
2. 更新安全组规则中的授权 IP
3. 测试连接是否恢复

---

## 📚 完整配置示例

### Claude Desktop (Windows)

配置文件：`%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "docker-mcp-secure": {
      "command": "npx",
      "args": ["docker-mcp-secure"],
      "env": {
        "DOCKER_HOST": "tcp://您的服务器IP:2375",
        "SECURITY_MODE": "readonly",
        "SECURITY_AUDIT_LOG": "true"
      }
    }
  }
}
```

### Cursor / VS Code

配置文件：`~/.cursor/mcp.json` 或 `.vscode/mcp.json`

```json
{
  "mcpServers": {
    "docker-mcp-secure": {
      "command": "npx",
      "args": ["docker-mcp-secure"],
      "env": {
        "DOCKER_HOST": "tcp://您的服务器IP:2375",
        "ALLOW_LOCAL_DOCKER": "true",
        "SECURITY_MODE": "readonly",
        "SECURITY_AUDIT_LOG": "true",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

> 💡 同时配置 `DOCKER_HOST` 和 `ALLOW_LOCAL_DOCKER=true` 可以启用**双源模式**，同时查询远程和本地 Docker。

---

## 🔗 相关资源

- [Docker 远程 API 官方文档](https://docs.docker.com/engine/api/)
- [Docker TLS 配置指南](https://docs.docker.com/engine/security/protect-access/)
- [MCP 协议规范](https://modelcontextprotocol.io/)

---

## ❓ 常见问题 FAQ

**Q: 我的 IP 是动态的怎么办？**

A: 每次 IP 变化后需要更新安全组。建议使用固定 IP 或考虑 VPN 方案。

**Q: 可以同时连接多个 Docker 服务器吗？**

A: 当前版本支持本地 + 一个远程 Docker（双源模式）。

**Q: 为什么使用 2375 端口而不是 2376？**

A: 2375 是非加密 HTTP 端口，配置简单。2376 是 TLS 加密端口，更安全但需要证书配置。

**Q: 这个工具安全吗？**

A: 是的，本工具只提供**只读**操作，无法创建、删除、启停容器，无法执行命令。安全风险主要来自 Docker API 端口的暴露，请务必限制访问 IP。

---

*配置遇到问题？欢迎提交 Issue 或查阅项目文档！*


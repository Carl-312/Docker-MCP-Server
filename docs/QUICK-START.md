# ⚡ Docker MCP 快速配置参考

> 5 分钟完成配置

---

## 🎯 您要做的事

```
                    您的 AI 助手                     您的 Docker 服务器
                        │                                    │
                        ▼                                    ▼
┌──────────────┐    ┌──────────────┐    TCP:2375    ┌──────────────┐
│ Claude/      │───►│ docker-mcp  │──────────────►│   Docker     │
│ Copilot      │    │   -secure   │               │   Engine     │
└──────────────┘    └──────────────┘               └──────────────┘
                          ▲
                          │
                 通过 DOCKER_HOST 环境变量
                 告诉 MCP 连接哪里
```

---

## 📋 配置清单

### 在服务器上做（2 步）

#### ① 开启 Docker 远程访问

```bash
# 编辑 daemon.json
sudo vim /etc/docker/daemon.json
```

```json
{
  "hosts": ["tcp://0.0.0.0:2375", "unix:///var/run/docker.sock"]
}
```

```bash
# 处理 systemd 冲突
sudo mkdir -p /etc/systemd/system/docker.service.d
echo -e "[Service]\nExecStart=\nExecStart=/usr/bin/dockerd" | sudo tee /etc/systemd/system/docker.service.d/override.conf

# 重启
sudo systemctl daemon-reload && sudo systemctl restart docker
```

#### ② 安全组放行您的 IP

| 协议 | 端口 | 来源 |
|-----|------|------|
| TCP | 2375 | 您的公网IP/32 |

查询您的 IP：
```bash
curl https://api.ipify.org
```

---

### 在本地做（1 步）

#### ③ 配置 MCP

**文件位置：**
- Claude Desktop: `%APPDATA%\Claude\claude_desktop_config.json`
- Cursor: `~/.cursor/mcp.json`

**配置内容：**

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

---

## ✅ 验证配置

```bash
# 测试连接（在本地执行）
curl http://您的服务器IP:2375/version
```

看到 JSON 输出 = 配置成功 ✅

---

## 🔧 环境变量速查

| 变量 | 值 | 说明 |
|-----|-----|------|
| `DOCKER_HOST` | `tcp://IP:2375` | **必填**，远程 Docker 地址 |
| `ALLOW_LOCAL_DOCKER` | `true` | 可选，允许本地 Docker |
| `SECURITY_MODE` | `readonly` | 可选，默认只读 |

---

## 🆘 常见错误

| 错误 | 原因 | 解决 |
|-----|------|------|
| `ETIMEDOUT` | 安全组未放行 | 检查安全组规则 |
| `ECONNREFUSED` | Docker 未监听 2375 | 检查 daemon.json |
| 工具不显示 | MCP 配置错误 | 检查 JSON 语法，重启 AI 助手 |

---

📚 详细文档：[USER-SETUP-GUIDE.md](./USER-SETUP-GUIDE.md)


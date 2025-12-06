/**
 * Docker 客户端（优化版）
 *
 * 支持两种连接方式：
 * 1. 环境变量配置 DOCKER_HOST（持久化）
 * 2. 每次调用时传入 docker_host 参数（无需配置）
 */
import Docker from 'dockerode';
/**
 * 解析 Docker 主机地址
 */
function parseDockerHost(dockerHost) {
    const match = dockerHost.match(/tcp:\/\/([^:]+):(\d+)/);
    if (match) {
        return { host: match[1], port: parseInt(match[2], 10) };
    }
    return null;
}
/**
 * 创建 Docker 客户端
 */
function createDockerClient(dockerHost) {
    const parsed = parseDockerHost(dockerHost);
    if (!parsed)
        return null;
    return new Docker({ host: parsed.host, port: parsed.port });
}
/**
 * 获取有效的 Docker 地址（优先使用参数，其次使用环境变量）
 */
function getEffectiveDockerHost(paramHost) {
    if (paramHost && paramHost.startsWith('tcp://')) {
        return paramHost;
    }
    return process.env.DOCKER_HOST || null;
}
/**
 * Docker 客户端类
 */
export class MultiDockerClient {
    /**
     * 获取连接状态
     */
    async getConnectionStatus(dockerHost) {
        const effectiveHost = getEffectiveDockerHost(dockerHost);
        if (!effectiveHost) {
            return {
                success: false,
                error: '未配置 Docker 连接。请在调用时传入 docker_host 参数，或设置 DOCKER_HOST 环境变量。',
            };
        }
        const client = createDockerClient(effectiveHost);
        if (!client) {
            return {
                success: false,
                error: `无效的 Docker 地址格式: ${effectiveHost}。正确格式: tcp://IP:端口`,
            };
        }
        try {
            await client.ping();
            return {
                success: true,
                data: { connected: true, host: effectiveHost },
                host: effectiveHost,
            };
        }
        catch (error) {
            const err = error;
            return {
                success: false,
                error: `连接失败: ${err.message}`,
                host: effectiveHost,
            };
        }
    }
    /**
     * 列出容器
     */
    async listContainers(onlyRunning = false, dockerHost) {
        const effectiveHost = getEffectiveDockerHost(dockerHost);
        if (!effectiveHost) {
            return {
                success: false,
                error: '未配置 Docker 连接。请传入 docker_host 参数（如 tcp://192.168.1.100:2375）',
            };
        }
        const client = createDockerClient(effectiveHost);
        if (!client) {
            return { success: false, error: `无效的 Docker 地址: ${effectiveHost}` };
        }
        try {
            const containers = await client.listContainers({ all: !onlyRunning });
            const result = containers.map(c => ({
                id: c.Id.substring(0, 12),
                name: c.Names[0]?.replace(/^\//, '') || 'unknown',
                image: c.Image,
                status: c.Status,
                state: c.State,
                created: new Date(c.Created * 1000).toISOString(),
                ports: c.Ports?.map(p => `${p.PrivatePort}${p.PublicPort ? `:${p.PublicPort}` : ''}`).join(', ') || '',
            }));
            return {
                success: true,
                data: result,
                host: effectiveHost,
            };
        }
        catch (error) {
            const err = error;
            return {
                success: false,
                error: `查询失败: ${err.message}`,
                host: effectiveHost,
            };
        }
    }
    /**
     * 获取容器详情
     */
    async inspectContainer(containerId, dockerHost) {
        const effectiveHost = getEffectiveDockerHost(dockerHost);
        if (!effectiveHost) {
            return { success: false, error: '未配置 Docker 连接。请传入 docker_host 参数' };
        }
        const client = createDockerClient(effectiveHost);
        if (!client) {
            return { success: false, error: `无效的 Docker 地址: ${effectiveHost}` };
        }
        try {
            const container = client.getContainer(containerId);
            const info = await container.inspect();
            const result = {
                id: info.Id.substring(0, 12),
                name: info.Name.replace(/^\//, ''),
                image: info.Config.Image,
                status: info.State.Status,
                created: info.Created,
                started: info.State.StartedAt,
                finished: info.State.FinishedAt,
                platform: info.Platform,
                config: {
                    hostname: info.Config.Hostname,
                    env: info.Config.Env || [],
                    cmd: info.Config.Cmd || [],
                    workingDir: info.Config.WorkingDir,
                },
                network: {
                    ipAddress: info.NetworkSettings.IPAddress,
                    gateway: info.NetworkSettings.Gateway,
                    ports: info.NetworkSettings.Ports,
                },
            };
            return { success: true, data: result, host: effectiveHost };
        }
        catch (error) {
            const err = error;
            return {
                success: false,
                error: err.statusCode === 404 ? `容器 ${containerId} 不存在` : err.message,
                host: effectiveHost,
            };
        }
    }
    /**
     * 获取容器日志
     */
    async getContainerLogs(containerId, tail = 100, dockerHost) {
        const effectiveHost = getEffectiveDockerHost(dockerHost);
        if (!effectiveHost) {
            return { success: false, error: '未配置 Docker 连接。请传入 docker_host 参数' };
        }
        const client = createDockerClient(effectiveHost);
        if (!client) {
            return { success: false, error: `无效的 Docker 地址: ${effectiveHost}` };
        }
        try {
            const container = client.getContainer(containerId);
            const logsBuffer = await container.logs({
                stdout: true,
                stderr: true,
                tail,
                timestamps: true,
            });
            const logs = logsBuffer.toString('utf-8')
                .replace(/[\x00-\x08]/g, '')
                .trim();
            return { success: true, data: logs || '(无日志)', host: effectiveHost };
        }
        catch (error) {
            const err = error;
            return {
                success: false,
                error: err.statusCode === 404 ? `容器 ${containerId} 不存在` : err.message,
                host: effectiveHost,
            };
        }
    }
    /**
     * 获取容器资源使用情况
     */
    async getContainerStats(containerId, dockerHost) {
        const effectiveHost = getEffectiveDockerHost(dockerHost);
        if (!effectiveHost) {
            return { success: false, error: '未配置 Docker 连接。请传入 docker_host 参数' };
        }
        const client = createDockerClient(effectiveHost);
        if (!client) {
            return { success: false, error: `无效的 Docker 地址: ${effectiveHost}` };
        }
        try {
            const container = client.getContainer(containerId);
            const stats = await container.stats({ stream: false });
            const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
            const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
            const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0;
            const memUsage = stats.memory_stats.usage || 0;
            const memLimit = stats.memory_stats.limit || 1;
            const memPercent = (memUsage / memLimit) * 100;
            const result = {
                cpu_percent: cpuPercent.toFixed(2) + '%',
                memory_usage: this.formatBytes(memUsage),
                memory_limit: this.formatBytes(memLimit),
                memory_percent: memPercent.toFixed(2) + '%',
                network_rx: this.formatBytes(this.sumNetworkStats(stats.networks, 'rx_bytes')),
                network_tx: this.formatBytes(this.sumNetworkStats(stats.networks, 'tx_bytes')),
                block_read: this.formatBytes(this.sumBlockStats(stats.blkio_stats?.io_service_bytes_recursive, 'Read')),
                block_write: this.formatBytes(this.sumBlockStats(stats.blkio_stats?.io_service_bytes_recursive, 'Write')),
            };
            return { success: true, data: result, host: effectiveHost };
        }
        catch (error) {
            const err = error;
            return {
                success: false,
                error: err.statusCode === 404 ? `容器 ${containerId} 不存在` : err.message,
                host: effectiveHost,
            };
        }
    }
    /**
     * 列出镜像
     */
    async listImages(dockerHost) {
        const effectiveHost = getEffectiveDockerHost(dockerHost);
        if (!effectiveHost) {
            return { success: false, error: '未配置 Docker 连接。请传入 docker_host 参数' };
        }
        const client = createDockerClient(effectiveHost);
        if (!client) {
            return { success: false, error: `无效的 Docker 地址: ${effectiveHost}` };
        }
        try {
            const images = await client.listImages();
            const result = images.map(img => ({
                id: img.Id.replace('sha256:', '').substring(0, 12),
                tags: img.RepoTags || ['<none>'],
                size: this.formatBytes(img.Size),
                created: new Date(img.Created * 1000).toISOString(),
            }));
            return { success: true, data: result, host: effectiveHost };
        }
        catch (error) {
            const err = error;
            return {
                success: false,
                error: `查询失败: ${err.message}`,
                host: effectiveHost,
            };
        }
    }
    /**
     * 获取镜像详情
     */
    async inspectImage(imageId, dockerHost) {
        const effectiveHost = getEffectiveDockerHost(dockerHost);
        if (!effectiveHost) {
            return { success: false, error: '未配置 Docker 连接。请传入 docker_host 参数' };
        }
        const client = createDockerClient(effectiveHost);
        if (!client) {
            return { success: false, error: `无效的 Docker 地址: ${effectiveHost}` };
        }
        try {
            const image = client.getImage(imageId);
            const info = await image.inspect();
            const result = {
                id: info.Id.replace('sha256:', '').substring(0, 12),
                tags: info.RepoTags || [],
                size: this.formatBytes(info.Size),
                created: info.Created,
                architecture: info.Architecture,
                os: info.Os,
                author: info.Author || 'unknown',
                config: {
                    env: info.Config.Env || [],
                    cmd: info.Config.Cmd || [],
                    entrypoint: Array.isArray(info.Config.Entrypoint) ? info.Config.Entrypoint : [],
                    workingDir: info.Config.WorkingDir,
                    exposedPorts: Object.keys(info.Config.ExposedPorts || {}),
                },
            };
            return { success: true, data: result, host: effectiveHost };
        }
        catch (error) {
            const err = error;
            return {
                success: false,
                error: err.statusCode === 404 ? `镜像 ${imageId} 不存在` : err.message,
                host: effectiveHost,
            };
        }
    }
    // 工具方法
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    sumNetworkStats(networks, key) {
        if (!networks)
            return 0;
        return Object.values(networks).reduce((sum, net) => sum + (net[key] || 0), 0);
    }
    sumBlockStats(stats, op) {
        if (!stats)
            return 0;
        const stat = stats.find(s => s.op === op);
        return stat?.value || 0;
    }
}
//# sourceMappingURL=multi-docker-client.js.map
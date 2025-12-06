/**
 * 容器相关的 MCP 工具
 */
// ========== 工具定义 ==========
export const CONTAINER_TOOLS = [
    {
        name: 'docker_list_containers',
        description: '列出所有 Docker 容器，包括运行中和已停止的容器',
        inputSchema: {
            type: 'object',
            properties: {
                only_running: {
                    type: 'boolean',
                    description: '是否只显示运行中的容器，默认显示全部',
                },
            },
            required: [],
        },
    },
    {
        name: 'docker_inspect',
        description: '查看指定容器的详细信息，包括状态、端口、挂载等',
        inputSchema: {
            type: 'object',
            properties: {
                container_id: {
                    type: 'string',
                    description: '容器ID或名称',
                },
            },
            required: ['container_id'],
        },
    },
    {
        name: 'docker_logs',
        description: '获取容器的最近日志，用于排查问题',
        inputSchema: {
            type: 'object',
            properties: {
                container_id: {
                    type: 'string',
                    description: '容器ID或名称',
                },
                tail: {
                    type: 'integer',
                    description: '获取最近多少行日志，默认100行',
                },
            },
            required: ['container_id'],
        },
    },
    {
        name: 'docker_stats',
        description: '获取容器的资源使用情况（CPU、内存）',
        inputSchema: {
            type: 'object',
            properties: {
                container_id: {
                    type: 'string',
                    description: '容器ID或名称',
                },
            },
            required: ['container_id'],
        },
    },
];
// ========== 工具实现 ==========
export async function dockerListContainers(client, args) {
    try {
        const onlyRunning = args.only_running === true;
        const containers = await client.listContainers(!onlyRunning);
        const dockerHost = client.getDockerHost();
        return {
            status: 'success',
            docker_host: dockerHost,
            docker_type: dockerHost === 'local' ? '💻 本地 Docker' : `☁️ 远程 Docker (${dockerHost})`,
            total: containers.length,
            containers,
        };
    }
    catch (error) {
        return {
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
        };
    }
}
export async function dockerInspect(client, args) {
    try {
        const containerId = args.container_id;
        const dockerHost = client.getDockerHost();
        if (!containerId) {
            return { status: 'error', message: '请提供容器ID' };
        }
        const container = await client.getContainer(containerId);
        if (container === null) {
            return { status: 'error', message: `容器 ${containerId} 不存在` };
        }
        return {
            status: 'success',
            docker_host: dockerHost,
            docker_type: dockerHost === 'local' ? '💻 本地 Docker' : `☁️ 远程 Docker (${dockerHost})`,
            container,
        };
    }
    catch (error) {
        return {
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
        };
    }
}
export async function dockerLogs(client, args) {
    try {
        const containerId = args.container_id;
        const tail = args.tail || 100;
        const dockerHost = client.getDockerHost();
        if (!containerId) {
            return { status: 'error', message: '请提供容器ID' };
        }
        const logs = await client.getContainerLogs(containerId, tail);
        return {
            status: 'success',
            docker_host: dockerHost,
            docker_type: dockerHost === 'local' ? '💻 本地 Docker' : `☁️ 远程 Docker (${dockerHost})`,
            container_id: containerId,
            lines: tail,
            logs,
        };
    }
    catch (error) {
        return {
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
        };
    }
}
export async function dockerStats(client, args) {
    try {
        const containerId = args.container_id;
        const dockerHost = client.getDockerHost();
        if (!containerId) {
            return { status: 'error', message: '请提供容器ID' };
        }
        const stats = await client.getContainerStats(containerId);
        if (stats === null) {
            return { status: 'error', message: `容器 ${containerId} 不存在` };
        }
        return {
            status: 'success',
            docker_host: dockerHost,
            docker_type: dockerHost === 'local' ? '💻 本地 Docker' : `☁️ 远程 Docker (${dockerHost})`,
            container_id: containerId,
            stats,
        };
    }
    catch (error) {
        return {
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
        };
    }
}
// ========== 工具路由映射 ==========
export const CONTAINER_TOOL_MAP = {
    docker_list_containers: dockerListContainers,
    docker_inspect: dockerInspect,
    docker_logs: dockerLogs,
    docker_stats: dockerStats,
};
//# sourceMappingURL=containers.js.map
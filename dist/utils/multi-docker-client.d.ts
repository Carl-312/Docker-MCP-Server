/**
 * Docker 客户端（优化版）
 *
 * 支持三种连接方式（优先级从高到低）：
 * 1. 每次调用时传入 docker_host 参数（最高优先）
 * 2. 会话配置（通过 docker_set_connection 设置）
 * 3. 环境变量配置 DOCKER_HOST（最低优先）
 */
export interface ContainerInfo {
    id: string;
    name: string;
    image: string;
    status: string;
    state: string;
    created: string;
    ports: string;
}
export interface ContainerDetail {
    id: string;
    name: string;
    image: string;
    status: string;
    created: string;
    started: string;
    finished: string;
    platform: string;
    config: {
        hostname: string;
        env: string[];
        cmd: string[];
        workingDir: string;
    };
    network: {
        ipAddress: string;
        gateway: string;
        ports: unknown;
    };
}
export interface ContainerStats {
    cpu_percent: string;
    memory_usage: string;
    memory_limit: string;
    memory_percent: string;
    network_rx: string;
    network_tx: string;
    block_read: string;
    block_write: string;
}
export interface ImageInfo {
    id: string;
    tags: string[];
    size: string;
    created: string;
}
export interface ImageDetail {
    id: string;
    tags: string[];
    size: string;
    created: string;
    architecture: string;
    os: string;
    author: string;
    config: {
        env: string[];
        cmd: string[];
        entrypoint: string[];
        workingDir: string;
        exposedPorts: string[];
    };
}
export interface DockerResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    host?: string;
    hint?: string;
}
/**
 * Docker 客户端类
 */
export declare class MultiDockerClient {
    /**
     * 获取连接状态
     */
    getConnectionStatus(dockerHost?: string): Promise<DockerResult<{
        connected: boolean;
        host: string;
    }>>;
    /**
     * 根据错误类型提供排查建议
     */
    private getConnectionErrorHint;
    /**
     * 列出容器
     */
    listContainers(onlyRunning?: boolean, dockerHost?: string): Promise<DockerResult<ContainerInfo[]>>;
    /**
     * 获取容器详情
     */
    inspectContainer(containerId: string, dockerHost?: string): Promise<DockerResult<ContainerDetail>>;
    /**
     * 获取容器日志
     */
    getContainerLogs(containerId: string, tail?: number, dockerHost?: string): Promise<DockerResult<string>>;
    /**
     * 获取容器资源使用情况
     */
    getContainerStats(containerId: string, dockerHost?: string): Promise<DockerResult<ContainerStats>>;
    /**
     * 列出镜像
     */
    listImages(dockerHost?: string): Promise<DockerResult<ImageInfo[]>>;
    /**
     * 获取镜像详情
     */
    inspectImage(imageId: string, dockerHost?: string): Promise<DockerResult<ImageDetail>>;
    private formatBytes;
    private sumNetworkStats;
    private sumBlockStats;
}
//# sourceMappingURL=multi-docker-client.d.ts.map
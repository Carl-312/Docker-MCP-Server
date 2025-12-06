/**
 * 多源 Docker 客户端 - 同时搜索本地和云端 Docker
 *
 * 设计理念：
 * 1. 同时尝试连接本地 Docker 和远程 Docker
 * 2. 合并所有源的结果返回给用户
 * 3. 如果都连接失败，返回详细的配置指引
 */
import Docker from 'dockerode';
import type { ContainerInfo, ContainerDetail, ContainerStats, ImageInfo, ImageDetail } from './docker-client.js';
export interface DockerSource {
    name: string;
    type: 'local' | 'remote';
    host: string;
    client: Docker;
    status: 'connected' | 'disconnected' | 'error';
    error?: string;
}
export interface MultiSourceResult<T> {
    status: 'success' | 'partial' | 'no_docker_found';
    sources: {
        name: string;
        type: 'local' | 'remote';
        host: string;
        status: 'success' | 'error';
        error?: string;
        data?: T;
    }[];
    combined?: T;
    message?: string;
    setup_guide?: string;
}
export declare class MultiDockerClient {
    private sources;
    private allowLocal;
    private remoteHost;
    private initialized;
    private initPromise;
    constructor();
    /**
     * 确保初始化完成
     */
    private ensureInitialized;
    /**
     * 初始化远程 Docker 源（同步）
     */
    private initializeRemoteSources;
    /**
     * 初始化本地 Docker 源（异步，需要预先测试连接）
     *
     * 重要：必须预先测试连接！
     * dockerode 在 Windows 上有一个隐藏行为：当 named pipe 连接失败时，
     * 会静默回退到 DOCKER_HOST 环境变量，导致"本地"连接实际上连到了远程。
     */
    private initializeLocalSource;
    /**
     * 测试单个源的连接
     */
    private testConnection;
    /**
     * 获取所有源的连接状态
     */
    getConnectionStatus(): Promise<{
        totalSources: number;
        connectedSources: number;
        sources: {
            name: string;
            type: string;
            host: string;
            status: string;
            error?: string;
        }[];
    }>;
    /**
     * 从所有源列出容器
     */
    listContainers(all?: boolean): Promise<MultiSourceResult<ContainerInfo[]>>;
    /**
     * 从所有源获取容器详情（优先返回找到的第一个）
     */
    getContainer(containerId: string): Promise<MultiSourceResult<ContainerDetail>>;
    /**
     * 获取容器日志
     */
    getContainerLogs(containerId: string, tail?: number): Promise<MultiSourceResult<string>>;
    /**
     * 获取容器资源统计
     */
    getContainerStats(containerId: string): Promise<MultiSourceResult<ContainerStats>>;
    /**
     * 从所有源列出镜像
     */
    listImages(): Promise<MultiSourceResult<ImageInfo[]>>;
    /**
     * 获取镜像详情
     */
    getImage(imageId: string): Promise<MultiSourceResult<ImageDetail>>;
    private formatContainer;
    private formatContainerDetail;
    private formatStats;
    private formatImage;
    private formatImageDetail;
}
//# sourceMappingURL=multi-docker-client.d.ts.map
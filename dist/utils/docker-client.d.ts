/**
 * Docker 客户端封装 - 安全版
 *
 * 只允许只读操作，禁止直连 Docker Socket（生产环境）
 */
import Docker from 'dockerode';
export declare class SecurityError extends Error {
    constructor(message: string);
}
export interface ContainerInfo {
    id: string;
    name: string;
    status: string;
    image: string;
    created: string;
}
export interface ContainerDetail extends ContainerInfo {
    state: Docker.ContainerInspectInfo['State'];
    ports: Record<string, unknown>;
    mounts: string[];
    envCount: number;
}
export interface ContainerStats {
    cpuPercent: number;
    memoryUsageMb: number;
    memoryLimitMb: number;
    memoryPercent: number;
}
export interface ImageInfo {
    id: string;
    tags: string[];
    sizeMb: number;
    created: string;
}
export interface ImageDetail extends ImageInfo {
    architecture: string;
    os: string;
    layersCount: number;
}
export declare class SecureDockerClient {
    private client;
    private dockerHost;
    constructor();
    /**
     * 获取当前连接的 Docker 地址
     */
    getDockerHost(): string;
    /**
     * 列出所有容器
     */
    listContainers(all?: boolean): Promise<ContainerInfo[]>;
    /**
     * 获取单个容器详情
     */
    getContainer(containerId: string): Promise<ContainerDetail | null>;
    /**
     * 获取容器日志
     */
    getContainerLogs(containerId: string, tail?: number): Promise<string>;
    /**
     * 获取容器资源使用情况
     */
    getContainerStats(containerId: string): Promise<ContainerStats | null>;
    /**
     * 列出所有镜像
     */
    listImages(): Promise<ImageInfo[]>;
    /**
     * 获取镜像详情
     */
    getImage(imageId: string): Promise<ImageDetail | null>;
    /**
     * 获取 Docker 版本信息
     */
    getVersion(): Promise<Docker.DockerVersion>;
    /**
     * 获取 Docker 系统信息（脱敏）
     */
    getInfo(): Promise<Record<string, unknown>>;
    private formatContainer;
    private formatContainerDetail;
    private formatStats;
    private formatImage;
    private formatImageDetail;
}
//# sourceMappingURL=docker-client.d.ts.map
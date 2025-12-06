/**
 * 安全守卫 - API 白名单与权限控制
 */
export declare class SecurityGuard {
    private readonly securityMode;
    private readonly allowedTools;
    private readonly blockedPatterns;
    constructor();
    /**
     * 检查工具调用是否允许
     * @returns [allowed, reason]
     */
    checkToolCall(toolName: string, args: Record<string, unknown>): [boolean, string];
    /**
     * 检查参数安全性
     */
    private checkArguments;
    /**
     * 检查是否为只读模式
     */
    isReadonlyMode(): boolean;
}
//# sourceMappingURL=guard.d.ts.map
/**
 * 审计日志 - 记录所有操作
 */
export interface AuditLogEntry {
    timestamp: string;
    eventType: 'TOOL_CALL' | 'SECURITY_EVENT' | 'ERROR';
    toolName: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    success: boolean;
    durationMs?: number;
    message?: string;
}
export declare class AuditLogger {
    private readonly enabled;
    constructor();
    /**
     * 记录工具调用
     */
    logToolCall(toolName: string, args: Record<string, unknown>, result: unknown, success: boolean, durationMs: number): void;
    /**
     * 记录安全事件
     */
    logSecurityEvent(eventType: string, toolName: string, message: string): void;
    /**
     * 记录错误
     */
    logError(toolName: string, error: Error): void;
    /**
     * 写入日志
     */
    private writeLog;
    /**
     * 脱敏参数
     */
    private sanitizeArguments;
    /**
     * 截断结果（避免日志过大）
     */
    private truncateResult;
}
//# sourceMappingURL=audit.d.ts.map
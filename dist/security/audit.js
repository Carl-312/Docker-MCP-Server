/**
 * 审计日志 - 记录所有操作
 */
export class AuditLogger {
    enabled;
    constructor() {
        this.enabled = process.env.SECURITY_AUDIT_LOG?.toLowerCase() !== 'false';
    }
    /**
     * 记录工具调用
     */
    logToolCall(toolName, args, result, success, durationMs) {
        if (!this.enabled)
            return;
        const sanitizedArgs = this.sanitizeArguments(args);
        const entry = {
            timestamp: new Date().toISOString(),
            eventType: 'TOOL_CALL',
            toolName,
            arguments: sanitizedArgs,
            result: success ? this.truncateResult(result) : undefined,
            success,
            durationMs,
        };
        this.writeLog(entry);
    }
    /**
     * 记录安全事件
     */
    logSecurityEvent(eventType, toolName, message) {
        if (!this.enabled)
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            eventType: 'SECURITY_EVENT',
            toolName,
            arguments: {},
            success: false,
            message: `[${eventType}] ${message}`,
        };
        this.writeLog(entry);
    }
    /**
     * 记录错误
     */
    logError(toolName, error) {
        if (!this.enabled)
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            eventType: 'ERROR',
            toolName,
            arguments: {},
            success: false,
            message: error.message,
        };
        this.writeLog(entry);
    }
    /**
     * 写入日志
     */
    writeLog(entry) {
        // 输出到 stderr 以避免干扰 MCP 协议
        console.error(JSON.stringify(entry));
    }
    /**
     * 脱敏参数
     */
    sanitizeArguments(args) {
        const sanitized = {};
        const sensitiveKeys = ['password', 'secret', 'token', 'key', 'auth'];
        for (const [key, value] of Object.entries(args)) {
            const lowerKey = key.toLowerCase();
            if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
                sanitized[key] = '***HIDDEN***';
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    /**
     * 截断结果（避免日志过大）
     */
    truncateResult(result) {
        const str = JSON.stringify(result);
        if (str.length > 1000) {
            return { _truncated: true, length: str.length };
        }
        return result;
    }
}
//# sourceMappingURL=audit.js.map
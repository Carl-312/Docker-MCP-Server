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

export class AuditLogger {
  private readonly enabled: boolean;

  constructor() {
    this.enabled = process.env.SECURITY_AUDIT_LOG?.toLowerCase() !== 'false';
  }

  /**
   * 记录工具调用
   */
  logToolCall(
    toolName: string,
    args: Record<string, unknown>,
    result: unknown,
    success: boolean,
    durationMs: number
  ): void {
    if (!this.enabled) return;

    const sanitizedArgs = this.sanitizeArguments(args);
    
    const entry: AuditLogEntry = {
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
  logSecurityEvent(
    eventType: string,
    toolName: string,
    message: string
  ): void {
    if (!this.enabled) return;

    const entry: AuditLogEntry = {
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
  logError(toolName: string, error: Error): void {
    if (!this.enabled) return;

    const entry: AuditLogEntry = {
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
  private writeLog(entry: AuditLogEntry): void {
    // 输出到 stderr 以避免干扰 MCP 协议
    console.error(JSON.stringify(entry));
  }

  /**
   * 脱敏参数
   */
  private sanitizeArguments(args: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    
    const sensitiveKeys = ['password', 'secret', 'token', 'key', 'auth'];
    
    for (const [key, value] of Object.entries(args)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '***HIDDEN***';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * 截断结果（避免日志过大）
   */
  private truncateResult(result: unknown): unknown {
    const str = JSON.stringify(result);
    if (str.length > 1000) {
      return { _truncated: true, length: str.length };
    }
    return result;
  }
}

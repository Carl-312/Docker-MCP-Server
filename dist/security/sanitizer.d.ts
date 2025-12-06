/**
 * 日志脱敏 - 敏感信息过滤
 */
export declare class LogSanitizer {
    private readonly sensitiveEnvKeys;
    private readonly sensitivePatterns;
    /**
     * 脱敏字符串
     */
    sanitizeString(text: string): string;
    /**
     * 脱敏环境变量列表
     */
    sanitizeEnvVars(envVars: string[]): string[];
    /**
     * 脱敏对象
     */
    sanitizeObject<T extends Record<string, unknown>>(obj: T): T;
}
export declare const sanitizer: LogSanitizer;
//# sourceMappingURL=sanitizer.d.ts.map
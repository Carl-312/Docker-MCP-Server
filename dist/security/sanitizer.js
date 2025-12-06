/**
 * 日志脱敏 - 敏感信息过滤
 */
export class LogSanitizer {
    // 需要脱敏的环境变量关键词
    sensitiveEnvKeys = [
        'PASSWORD', 'PASSWD', 'PWD',
        'SECRET', 'TOKEN', 'KEY', 'API_KEY',
        'CREDENTIAL', 'AUTH',
        'MYSQL_ROOT', 'POSTGRES_PASSWORD',
        'REDIS_PASSWORD', 'MONGO_PASSWORD',
        'AWS_ACCESS', 'AWS_SECRET',
        'PRIVATE_KEY', 'SSH_KEY',
    ];
    // 需要脱敏的正则模式
    sensitivePatterns = [
        // API Keys (各种格式)
        [/([A-Za-z_]+(?:KEY|TOKEN|SECRET|PASSWORD)[A-Za-z_]*)[=:]\s*["']?([^"'\s]{8,})["']?/gi, '$1=***HIDDEN***'],
        // Bearer Tokens
        [/(Bearer\s+)[A-Za-z0-9\-_.]+/gi, '$1***HIDDEN***'],
        // Basic Auth
        [/(Basic\s+)[A-Za-z0-9+/=]+/gi, '$1***HIDDEN***'],
    ];
    /**
     * 脱敏字符串
     */
    sanitizeString(text) {
        if (!text)
            return text;
        let result = text;
        for (const [pattern, replacement] of this.sensitivePatterns) {
            result = result.replace(pattern, replacement);
        }
        return result;
    }
    /**
     * 脱敏环境变量列表
     */
    sanitizeEnvVars(envVars) {
        return envVars.map(env => {
            const [key] = env.split('=');
            const upperKey = key?.toUpperCase() || '';
            if (this.sensitiveEnvKeys.some(sk => upperKey.includes(sk))) {
                return `${key}=***HIDDEN***`;
            }
            return env;
        });
    }
    /**
     * 脱敏对象
     */
    sanitizeObject(obj) {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                result[key] = this.sanitizeString(value);
            }
            else if (Array.isArray(value)) {
                result[key] = value.map(v => typeof v === 'string' ? this.sanitizeString(v) : v);
            }
            else if (typeof value === 'object' && value !== null) {
                result[key] = this.sanitizeObject(value);
            }
            else {
                result[key] = value;
            }
        }
        return result;
    }
}
// 导出单例
export const sanitizer = new LogSanitizer();
//# sourceMappingURL=sanitizer.js.map
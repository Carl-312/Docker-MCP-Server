/**
 * 日志脱敏 - 敏感信息过滤
 */

export class LogSanitizer {
  // 需要脱敏的环境变量关键词
  private readonly sensitiveEnvKeys: string[] = [
    'PASSWORD', 'PASSWD', 'PWD',
    'SECRET', 'TOKEN', 'KEY', 'API_KEY',
    'CREDENTIAL', 'AUTH',
    'MYSQL_ROOT', 'POSTGRES_PASSWORD',
    'REDIS_PASSWORD', 'MONGO_PASSWORD',
    'AWS_ACCESS', 'AWS_SECRET',
    'PRIVATE_KEY', 'SSH_KEY',
  ];

  // 需要脱敏的正则模式
  private readonly sensitivePatterns: Array<[RegExp, string]> = [
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
  sanitizeString(text: string): string {
    if (!text) return text;

    let result = text;
    for (const [pattern, replacement] of this.sensitivePatterns) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  /**
   * 脱敏环境变量列表
   */
  sanitizeEnvVars(envVars: string[]): string[] {
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
  sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.sanitizeString(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map(v => 
          typeof v === 'string' ? this.sanitizeString(v) : v
        );
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitizeObject(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    
    return result as T;
  }
}

// 导出单例
export const sanitizer = new LogSanitizer();

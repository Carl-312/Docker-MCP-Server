/**
 * 安全守卫 - API 白名单与权限控制
 */
export class SecurityGuard {
    securityMode;
    // 允许调用的工具名称
    allowedTools = new Set([
        'docker_list_containers',
        'docker_inspect',
        'docker_logs',
        'docker_stats',
        'docker_list_images',
        'docker_image_info',
    ]);
    // 禁止的参数模式（正则表达式）
    blockedPatterns = [
        /;.*$/, // 命令注入
        /\|.*$/, // 管道命令
        /`.*`/, // 反引号执行
        /\$\(.*\)/, // 命令替换
        /&&/, // 命令连接
        /\|\|/, // 或命令
    ];
    constructor() {
        this.securityMode = process.env.SECURITY_MODE || 'readonly';
    }
    /**
     * 检查工具调用是否允许
     * @returns [allowed, reason]
     */
    checkToolCall(toolName, args) {
        // 检查工具是否在白名单中
        if (!this.allowedTools.has(toolName)) {
            return [false, `工具 ${toolName} 不在白名单中`];
        }
        // 检查参数安全性
        const [safe, reason] = this.checkArguments(args);
        if (!safe) {
            return [false, reason];
        }
        return [true, ''];
    }
    /**
     * 检查参数安全性
     */
    checkArguments(args) {
        for (const [key, value] of Object.entries(args)) {
            if (typeof value === 'string') {
                for (const pattern of this.blockedPatterns) {
                    if (pattern.test(value)) {
                        return [false, `参数 ${key} 包含危险模式`];
                    }
                }
                // 检查路径遍历
                if (value.includes('..')) {
                    return [false, `参数 ${key} 包含路径遍历`];
                }
            }
        }
        return [true, ''];
    }
    /**
     * 检查是否为只读模式
     */
    isReadonlyMode() {
        return this.securityMode === 'readonly';
    }
}
//# sourceMappingURL=guard.js.map
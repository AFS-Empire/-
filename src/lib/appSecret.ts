/**
 * App 端私有盐值
 *
 * ⚠️ 此文件仅 App 构建包含，网页构建时被 alias 替换为 appSecret.web.ts
 * 盐值永远不存在于网页前端 JS 产物中
 *
 * 用途：导出 JSON 时生成签名
 *   sign = SHA256( JSON.stringify(data) + APP_PRIVATE_SALT )
 *
 * 网页端导入时：用户输入此盐值 → 验签 → 通过才导入
 */
export const APP_PRIVATE_SALT = 'AFSEmpire@2026#08zCLMJfL0o8X2eE';

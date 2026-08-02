/**
 * App 端私有盐值（环境变量隔离版）
 *
 * ⚠️ 盐值严禁明文写死在源码内，严禁上传 GitHub。
 *    本文件仅从构建时环境变量 ARCHIVE_PRIVATE_SALT 读取真实值。
 *    Vite 在构建时把 import.meta.env.VITE_* / process.env 注入产物。
 *
 * 注入路径：
 *  - 本地构建：从 .env.local 读取（.env.local 已被 .gitignore 忽略）
 *  - CI 构建：从 GitHub Actions Secrets 注入环境变量
 *  - Web 构建：vite alias 替换为 appSecret.web.ts（空字符串），产物无盐值
 *
 * 用途：导出 JSON 时作为 PBKDF2 派生密钥 + HMAC 签名密钥
 */
export const APP_PRIVATE_SALT: string = import.meta.env.VITE_ARCHIVE_SALT ?? '';

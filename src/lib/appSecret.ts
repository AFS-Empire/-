/**
 * App 端密钥常量（环境变量隔离版）
 *
 * ⚠️ 密钥严禁明文写死在源码内，严禁上传 GitHub。
 *    本文件仅从构建时环境变量 VITE_ARCHIVE_SALT 读取真实值。
 *    Vite 在构建时把 import.meta.env.VITE_* 注入产物。
 *
 * 注入路径：
 *  - 本地构建：从 .env.local 读取（.env.local 已被 .gitignore 忽略）
 *  - CI 构建：从 GitHub Actions Secrets 注入环境变量
 *  - Web 构建：vite alias 替换为 appSecret.web.ts（空字符串），产物无密钥
 *
 * 三段式密钥命名（本次仅区分变量名，底层共用同一盐值；后续可拆分为不同值）：
 *  - APP_INSTALL_KEY_A   设备绑定 / 管理员首登（每机一次性）
 *  - APP_OPERATION_KEY_B 写操作验证（30天周期）
 *  - APP_DATA_SALT       数据加密 / 签名（PBKDF2 派生 + HMAC 签名密钥）
 *
 * 当前阶段：三者同值（均读 VITE_ARCHIVE_SALT），安全强度不变，仅作命名铺垫。
 */
export const APP_INSTALL_KEY_A: string = import.meta.env.VITE_ARCHIVE_SALT ?? '';
export const APP_OPERATION_KEY_B: string = import.meta.env.VITE_ARCHIVE_SALT ?? '';
export const APP_DATA_SALT: string = import.meta.env.VITE_ARCHIVE_SALT ?? '';

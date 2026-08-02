/**
 * 三类独立存储模块
 *
 * 按用途严格分离，禁止混写：
 * 1. cacheStorage  — 网页临时缓存（UI 状态、非敏感偏好）
 * 2. secureStorage — App 私密密钥/机器码绑定（敏感数据）
 * 3. backupStorage — 档案备份文件（IndexedDB 快照）
 *
 * 所有 localStorage 调用必须通过本模块，禁止业务代码直接写 localStorage
 */

const PREFIX = 'wa';
const CACHE_PREFIX = `${PREFIX}:cache:`;
const SECURE_PREFIX = `${PREFIX}:secure:`;
const BACKUP_PREFIX = `${PREFIX}:backup:`;

/** 网页临时缓存（非敏感） */
export const cacheStorage = {
  get(key: string): string | null {
    return localStorage.getItem(CACHE_PREFIX + key);
  },
  set(key: string, value: string): void {
    localStorage.setItem(CACHE_PREFIX + key, value);
  },
  remove(key: string): void {
    localStorage.removeItem(CACHE_PREFIX + key);
  },
};

/** App 私密存储（机器码、绑定信息等敏感数据） */
export const secureStorage = {
  get(key: string): string | null {
    return localStorage.getItem(SECURE_PREFIX + key);
  },
  set(key: string, value: string): void {
    localStorage.setItem(SECURE_PREFIX + key, value);
  },
  remove(key: string): void {
    localStorage.removeItem(SECURE_PREFIX + key);
  },
};

/** 档案备份文件存储（IndexedDB 快照、自动备份） */
export const backupStorage = {
  get(key: string): string | null {
    return localStorage.getItem(BACKUP_PREFIX + key);
  },
  set(key: string, value: string): void {
    localStorage.setItem(BACKUP_PREFIX + key, value);
  },
  remove(key: string): void {
    localStorage.removeItem(BACKUP_PREFIX + key);
  },
};

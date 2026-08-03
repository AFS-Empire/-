/**
 * 密钥B：操作验证（30天周期）
 *
 * 用途：所有写操作（导入/导出/编辑/删除/新增）前必须验证密钥B
 * 密钥B复用盐值（APP_PRIVATE_SALT）
 * 验证通过后存入 localStorage.operation_verified_at 时间戳
 * 30天内不需要重复验证，超过30天需要重新输入
 */

const OPERATION_VERIFIED_KEY = 'operation_verified_at';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30天的毫秒数

/** 检查是否已完成操作验证（30天周期） */
export function isOperationVerified(): boolean {
  try {
    const timestamp = localStorage.getItem(OPERATION_VERIFIED_KEY);
    if (!timestamp) return false;
    const verifiedAt = parseInt(timestamp, 10);
    if (isNaN(verifiedAt)) return false;
    return Date.now() - verifiedAt < THIRTY_DAYS_MS;
  } catch {
    return false;
  }
}

/** 验证密钥B（复用盐值） */
export async function verifyOperationKey(input: string): Promise<boolean> {
  const { APP_PRIVATE_SALT } = await import('./appSecret');
  if (!APP_PRIVATE_SALT) return false;
  return input === APP_PRIVATE_SALT;
}

/** 标记已完成操作验证（记录时间戳） */
export function markOperationVerified(): void {
  try {
    localStorage.setItem(OPERATION_VERIFIED_KEY, String(Date.now()));
  } catch {
    // localStorage 不可用时静默失败
  }
}

/** 获取距离下次验证还剩多少天（用于提示） */
export function getDaysUntilNextVerification(): number {
  try {
    const timestamp = localStorage.getItem(OPERATION_VERIFIED_KEY);
    if (!timestamp) return 0;
    const verifiedAt = parseInt(timestamp, 10);
    if (isNaN(verifiedAt)) return 0;
    const remaining = THIRTY_DAYS_MS - (Date.now() - verifiedAt);
    return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
  } catch {
    return 0;
  }
}

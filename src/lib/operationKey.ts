/**
 * 密钥B：操作验证（30天周期）
 *
 * 用途：所有写操作（导入/导出/编辑/删除/新增）前必须验证密钥B
 * 密钥B 复用盐值（APP_OPERATION_KEY_B）
 * 验证通过后存入 localStorage.operation_verified_at：{ ts, sig }
 *   - ts  : 验证时间戳
 *   - sig : HMAC-SHA256(密钥B, ts)，防篡改
 * 30天内不需要重复验证，超过30天需要重新输入。
 *
 * 防篡改：用户无法仅靠修改 localStorage 的 ts 续期 —— 缺少密钥B 无法伪造 sig，
 *        isOperationVerified 会因 sig 不匹配而判定未验证。
 *
 * 兼容性：旧版本仅存裸时间戳字符串，新版读取时 JSON.parse 得到 number，
 *        rec.ts 为 undefined → 判定未验证 → 需重新输入一次密钥B（一次性代价）。
 */

import { APP_OPERATION_KEY_B } from './appSecret';
import { hmacSha256Hex } from './hiddenUnlock';

const OPERATION_VERIFIED_KEY = 'operation_verified_at';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30天的毫秒数

interface VerifiedRecord {
  ts: number;
  sig: string;
}

/** 读取并校验验证记录（HMAC 防篡改）；无效或被篡改返回 null */
function readVerifiedRecord(): VerifiedRecord | null {
  try {
    const raw = localStorage.getItem(OPERATION_VERIFIED_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as Partial<VerifiedRecord>;
    if (typeof rec.ts !== 'number' || typeof rec.sig !== 'string') return null;
    // HMAC 校验：篡改 ts 则 sig 不匹配
    const expected = hmacSha256Hex(APP_OPERATION_KEY_B, String(rec.ts));
    if (expected !== rec.sig) return null;
    return { ts: rec.ts, sig: rec.sig };
  } catch {
    return null; // 解析失败：静默判定未验证
  }
}

/** 检查是否已完成操作验证（30天周期，HMAC 防篡改） */
export function isOperationVerified(): boolean {
  const rec = readVerifiedRecord();
  if (!rec) return false;
  return Date.now() - rec.ts < THIRTY_DAYS_MS;
}

/** 验证密钥B（复用盐值） */
export async function verifyOperationKey(input: string): Promise<boolean> {
  if (!APP_OPERATION_KEY_B) return false;
  return input === APP_OPERATION_KEY_B;
}

/** 标记已完成操作验证（时间戳 + HMAC 签名） */
export function markOperationVerified(): void {
  try {
    const ts = Date.now();
    const sig = hmacSha256Hex(APP_OPERATION_KEY_B, String(ts));
    localStorage.setItem(OPERATION_VERIFIED_KEY, JSON.stringify({ ts, sig }));
  } catch {
    // localStorage 不可用时静默失败
  }
}

/** 获取距离下次验证还剩多少天（用于提示） */
export function getDaysUntilNextVerification(): number {
  const rec = readVerifiedRecord();
  if (!rec) return 0;
  const remaining = THIRTY_DAYS_MS - (Date.now() - rec.ts);
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

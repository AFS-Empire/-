/**
 * App 端私钥会话缓存（PIN 会话）
 *
 * 安全模型：
 * - PIN = App 私有盐值（用户在 App 内手动输入）
 * - 输入正确 → 解锁本会话，sessionKey 仅暂存内存
 * - 不使用 persist 中间件 → 杀后台 / 冷启动即清空，必须重新输入
 * - 解锁后才允许：导入档案验签、保存档案编辑等敏感操作
 *
 * 与 hiddenUnlock（网页端隐藏解锁）的区别：
 * - hiddenUnlock 是网页端"点标题5次"的隐藏入口，盐值不内置
 * - pinSessionStore 是 App 端显式 PIN 校验，盐值内置（appSecret）
 * 两者都是内存态、不落盘。
 */
import { create } from 'zustand';
import { verifySign } from '../lib/hiddenUnlock';

interface PinSessionState {
  /** 当前会话是否已解锁 */
  isUnlocked: boolean;
  /** 会话私钥（= 盐值），仅内存，不落盘 */
  sessionKey: string | null;
  /** 解锁时间戳，用于会话超时判断（可选） */
  unlockedAt: number | null;
  /** 用 PIN 解锁会话；PIN 必须等于 App 私有盐值 */
  unlock: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  /** 锁定会话（清空内存中的私钥） */
  lock: () => void;
  /** 校验导入文件的签名（需先解锁） */
  verifyImport: (fileData: Record<string, unknown>) => Promise<boolean>;
}

async function getDataSalt(): Promise<string> {
  const { APP_DATA_SALT } = await import('../lib/appSecret');
  return APP_DATA_SALT;
}

export const usePinSessionStore = create<PinSessionState>((set, get) => ({
  isUnlocked: false,
  sessionKey: null,
  unlockedAt: null,

  unlock: async (pin) => {
    const salt = await getDataSalt();
    // Web 构建 salt 为空 → 永远无法解锁（Web 走 hiddenUnlock，不使用本 store）
    if (!salt) {
      return { ok: false, error: '当前环境不支持 PIN 解锁' };
    }
    if (!pin || pin !== salt) {
      return { ok: false, error: '密钥错误' };
    }
    set({ isUnlocked: true, sessionKey: pin, unlockedAt: Date.now() });
    return { ok: true };
  },

  lock: () => set({ isUnlocked: false, sessionKey: null, unlockedAt: null }),

  verifyImport: async (fileData) => {
    const key = get().sessionKey;
    if (!key) return false;
    return verifySign(fileData, key);
  },
}));

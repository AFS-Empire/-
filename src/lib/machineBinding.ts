/**
 * 机器码绑定（仅 App 端有效，网页端空操作）
 *
 * 原理：
 *   1. 首次启动：获取设备 Android ID → 绑定码 = SHA256(deviceId + appId + 私有盐)
 *      绑定码存 localStorage，作为「本机授权凭证」
 *   2. 后续启动：重新计算绑定码 → 与存储的对比
 *      不匹配 = 设备更换/数据被拷贝到其他设备 → 拒绝启动（或要求重新激活）
 *   3. 网页端：无 deviceId，无盐值，跳过绑定逻辑（纯浏览，不需要绑定）
 *
 * 安全性：
 *   - 私有盐仅 App 构建包含（appSecret.ts），逆向网页 JS 拿不到
 *   - 绑定码 = SHA256 三元素拼接，无法伪造
 *   - deviceId 是 Android 系统级标识，普通用户无法修改
 */
import { APP_PRIVATE_SALT } from './appSecret';
import { sha256Hex } from './hiddenUnlock';

const STORAGE_KEY = '__machine_binding__';
const APP_ID = 'com.orpheus.archive';

export interface BindingResult {
  bound: boolean;          // 是否已绑定本机
  deviceId: string | null; // 设备ID（调试用，不暴露给网页端）
  match: boolean;          // 绑定码是否匹配
  reason?: string;         // 不匹配的原因
}

/**
 * 获取设备唯一标识
 * - Android App：调 @capacitor/device 获取 Android ID
 * - 桌面端：用机器名 + CPU 架构拼一个伪机器码
 * - 网页端：返回 null（不绑定）
 */
async function getDeviceId(): Promise<string | null> {
  // 网页端：不绑定
  if (typeof window !== 'undefined' && !window.archiveApp && !window.capacitor?.isNative) {
    return null;
  }

  // Capacitor App（Android/iOS）
  if (typeof window !== 'undefined' && window.capacitor?.isNative) {
    try {
      const { Device } = await import('@capacitor/device');
      const info = await Device.getId();
      return info.uuid;
    } catch {
      return null;
    }
  }

  // Electron 桌面端
  if (typeof window !== 'undefined' && window.archiveApp) {
    // 用 navigator 信息拼一个伪机器码
    const parts = [
      navigator.userAgent,
      navigator.hardwareConcurrency?.toString() || '',
      screen.width + 'x' + screen.height,
    ];
    return await sha256Hex(parts.join('|'));
  }

  return null;
}

/**
 * 首次绑定：生成本机绑定码并存入 localStorage
 * 后续启动调用 verifyBinding() 校验
 */
export async function bindMachine(): Promise<BindingResult> {
  const deviceId = await getDeviceId();
  if (!deviceId) {
    return { bound: false, deviceId: null, match: false, reason: '非 App 环境，跳过绑定' };
  }

  // 盐值为空 = Web 构建，不绑定
  if (!APP_PRIVATE_SALT) {
    return { bound: false, deviceId: null, match: false, reason: '无盐值，跳过绑定' };
  }

  const bindingCode = await sha256Hex(deviceId + APP_ID + APP_PRIVATE_SALT);
  localStorage.setItem(STORAGE_KEY, bindingCode);

  return { bound: true, deviceId, match: true };
}

/**
 * 校验本机绑定：重新计算绑定码，与存储的对比
 * - match=true：本机已授权
 * - match=false：设备不匹配或数据被拷贝 → 安全风险
 */
export async function verifyBinding(): Promise<BindingResult> {
  const stored = localStorage.getItem(STORAGE_KEY);

  // 首次启动，未绑定过 → 自动绑定
  if (!stored) {
    return bindMachine();
  }

  const deviceId = await getDeviceId();
  if (!deviceId) {
    return { bound: false, deviceId: null, match: false, reason: '非 App 环境' };
  }

  if (!APP_PRIVATE_SALT) {
    return { bound: false, deviceId: null, match: false, reason: '无盐值' };
  }

  const currentCode = await sha256Hex(deviceId + APP_ID + APP_PRIVATE_SALT);
  const match = currentCode === stored;

  return {
    bound: true,
    deviceId,
    match,
    reason: match ? undefined : '设备不匹配 — 数据可能被拷贝到其他设备',
  };
}

/**
 * 解除绑定（换机/重置时用）
 * 清除 localStorage 里的绑定码，下次启动会重新绑定
 */
export function unbindMachine(): void {
  localStorage.removeItem(STORAGE_KEY);
}

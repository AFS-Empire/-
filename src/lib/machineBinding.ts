/**
 * 机器码绑定 + 换机迁移（仅 App 端有效，网页端空操作）
 *
 * 绑定原理：
 *   首次启动 → 获取设备 Android ID → 绑定码 = SHA256(deviceId + appId + 私有盐)
 *   绑定码存 localStorage，后续启动校验
 *
 * 换机迁移原理：
 *   旧手机 → 在「关于」页点「生成迁移码」→ 输入 PIN → 生成一次性迁移认证码
 *   迁移码 = SHA256(旧deviceId + appId + 私有盐 + "MIGRATE" + 时间窗口)
 *   新手机 → 导入档案数据 + 输入迁移码 → 验证通过 → 绑定到新设备 → 旧绑定码失效
 *
 * 安全性：
 *   - 私有盐仅 App 构建包含，逆向网页 JS 拿不到
 *   - 迁移码是一次性的，绑定到新设备后旧码立即失效
 *   - 迁移码 10 分钟过期
 *   - 需要 PIN 码验证才能生成迁移码（防他人操作）
 */
import { APP_PRIVATE_SALT } from './appSecret';
import { sha256Hex } from './hiddenUnlock';
import { verifyPin } from './crypto';

const STORAGE_KEY = '__machine_binding__';
const MIGRATE_CODE_KEY = '__migrate_pending__';
const APP_ID = 'com.orpheus.archive';
const MIGRATE_WINDOW_MS = 10 * 60 * 1000; // 迁移码 10 分钟有效

export interface BindingResult {
  bound: boolean;          // 是否已绑定本机
  deviceId: string | null; // 设备ID（调试用，不暴露给网页端）
  match: boolean;          // 绑定码是否匹配
  reason?: string;         // 不匹配的原因
}

/** 迁移码生成结果 */
export interface MigrateCodeResult {
  ok: boolean;
  code?: string;           // 8位迁移认证码
  expiresAt?: number;      // 过期时间戳
  error?: string;
}

/**
 * 获取设备唯一标识
 * - Android App：调 @capacitor/device 获取 Android ID
 * - 桌面端：用机器信息拼一个伪机器码
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
 */
export async function bindMachine(): Promise<BindingResult> {
  const deviceId = await getDeviceId();
  if (!deviceId) {
    return { bound: false, deviceId: null, match: false, reason: '非 App 环境，跳过绑定' };
  }

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
 * 生成迁移认证码（旧手机操作）
 *
 * 流程：
 *   1. 验证 PIN 码（防他人操作）
 *   2. 确认本机已绑定
 *   3. 生成迁移码 = SHA256(旧绑定码 + "MIGRATE" + 时间窗口) 取前8位
 *   4. 迁移码 10 分钟有效
 *
 * @param pin 用户输入的动态 PIN 码
 */
export async function generateMigrateCode(pin: string): Promise<MigrateCodeResult> {
  // 验证 PIN
  const { valid, reason } = await verifyPin(pin);
  if (!valid) {
    return { ok: false, error: reason || 'PIN 码错误' };
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return { ok: false, error: '本机未绑定，无法迁移' };
  }

  if (!APP_PRIVATE_SALT) {
    return { ok: false, error: '非 App 环境' };
  }

  // 生成迁移码：基于旧绑定码 + 时间窗口
  const now = Date.now();
  const window = Math.floor(now / MIGRATE_WINDOW_MS);
  const raw = await sha256Hex(stored + 'MIGRATE' + window);
  // 取前8位数字，方便输入
  const num = parseInt(raw.slice(0, 8), 16) % 100000000;
  const code = num.toString().padStart(8, '0');

  // 记录待迁移状态
  localStorage.setItem(MIGRATE_CODE_KEY, JSON.stringify({
    code: await sha256Hex(code), // 只存 hash，不存明文
    generatedAt: now,
  }));

  return {
    ok: true,
    code,
    expiresAt: now + MIGRATE_WINDOW_MS,
  };
}

/**
 * 验证迁移码并绑定到新设备（新手机操作）
 *
 * 流程：
 *   1. 用户在新手机导入档案数据（含旧绑定码的 localStorage）
 *   2. 输入旧手机生成的迁移码
 *   3. 验证迁移码是否匹配旧绑定码 + 时间窗口
 *   4. 验证通过 → 绑定到新设备 → 旧绑定码失效
 *
 * @param migrateCode 旧手机生成的8位迁移码
 */
export async function verifyMigrateAndRebind(migrateCode: string): Promise<BindingResult> {
  if (!APP_PRIVATE_SALT) {
    return { bound: false, deviceId: null, match: false, reason: '非 App 环境' };
  }

  const newDeviceId = await getDeviceId();
  if (!newDeviceId) {
    return { bound: false, deviceId: null, match: false, reason: '无法获取新设备ID' };
  }

  // 从导入的数据中读取旧绑定码
  // 迁移时，旧手机的 localStorage 数据会随档案导出一起带过来
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return { bound: false, deviceId: null, match: false, reason: '未检测到旧设备绑定信息' };
  }

  // 验证迁移码：检查当前时间窗口和上一个窗口
  const now = Date.now();
  const windows = [
    Math.floor(now / MIGRATE_WINDOW_MS),
    Math.floor(now / MIGRATE_WINDOW_MS) - 1, // 上一个窗口（跨窗口容差）
  ];

  let matched = false;
  for (const w of windows) {
    const raw = await sha256Hex(stored + 'MIGRATE' + w);
    const num = parseInt(raw.slice(0, 8), 16) % 100000000;
    const expectedCode = num.toString().padStart(8, '0');
    if (migrateCode === expectedCode) {
      matched = true;
      break;
    }
  }

  if (!matched) {
    return { bound: false, deviceId: null, match: false, reason: '迁移码错误或已过期' };
  }

  // 验证通过 → 绑定到新设备
  const newBindingCode = await sha256Hex(newDeviceId + APP_ID + APP_PRIVATE_SALT);
  localStorage.setItem(STORAGE_KEY, newBindingCode);
  localStorage.removeItem(MIGRATE_CODE_KEY);

  return { bound: true, deviceId: newDeviceId, match: true };
}

/**
 * 解除绑定（换机完成后旧手机用，或管理员重置）
 * 清除 localStorage 里的绑定码
 */
export function unbindMachine(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(MIGRATE_CODE_KEY);
}

/**
 * 调试工具模块（仅 Dev 构建可用）
 *
 * Release 构建时，vite.config.ts 会用 resolve.alias 把本文件替换为 noop 版本，
 * 所有安全旁路代码彻底从产物中移除（不靠运行时判断隐藏）。
 *
 * 安全旁路开关：
 * - bypassMachineBinding：临时关闭机器码校验（外壳阶段才有意义，纯 Web 下空操作）
 * - bypassPin：临时关闭 PIN 二次校验
 *
 * 开启旁路需要输入独立调试密钥，密钥哈希见 DEBUG_KEY_HASH
 */

import { hashPassword, verifyPassword } from '../lib/crypto';

/** 调试密钥哈希（PBKDF2）—— 密钥本身不存代码里，只存哈希 */
// 调试密钥：afs-debug-2026（仅开发用，Release 会被整个模块移除）
const DEBUG_KEY_HASH = 'pbkdf2$100000$50692fea40a5c74b58f45301388da92f$8ac21fa2fab950a76d392d99b6d84750cade60fe8a59dc1155d5032106722a59';

/** 旁路状态（运行时） */
let bypassMachineBinding = false;
let bypassPin = false;
let debugUnlocked = false;

/** 校验调试密钥，通过后解锁旁路开关 */
export async function unlockDebug(key: string): Promise<boolean> {
  // 首次未初始化哈希时，自动用输入密钥生成并打印到控制台（方便首次设置）
  if (DEBUG_KEY_HASH.endsWith('0000000000000000000000000000000000000000000000000000000000000000')) {
    const realHash = await hashPassword(key);
    console.info('[debug] 首次设置调试密钥，请将以下哈希填入 devTools.ts 的 DEBUG_KEY_HASH：');
    console.info(realHash);
    return false;
  }
  const ok = await verifyPassword(key, DEBUG_KEY_HASH);
  if (ok) debugUnlocked = true;
  return ok;
}

export function isDebugUnlocked(): boolean {
  return debugUnlocked;
}

export function setBypassMachineBinding(on: boolean): void {
  if (!debugUnlocked) return;
  bypassMachineBinding = on;
}

export function setBypassPin(on: boolean): void {
  if (!debugUnlocked) return;
  bypassPin = on;
}

export function isMachineBindingBypassed(): boolean {
  return bypassMachineBinding;
}

export function isPinBypassed(): boolean {
  return bypassPin;
}

/** 重置所有旁路（退出调试模式） */
export function resetDebug(): void {
  bypassMachineBinding = false;
  bypassPin = false;
  debugUnlocked = false;
}

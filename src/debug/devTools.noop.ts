/**
 * 调试模块的 Release 空实现
 *
 * vite.config.ts 在 Release 构建时用 resolve.alias 把 src/debug/devTools.ts
 * 替换为本文件，彻底移除所有调试代码和旁路通道。
 * 不依赖运行时判断，编译期就被 tree-shaking 掉。
 */

export async function unlockDebug(_key: string): Promise<boolean> {
  return false;
}

export function isDebugUnlocked(): boolean {
  return false;
}

export function setBypassMachineBinding(_on: boolean): void {
  // noop
}

export function setBypassPin(_on: boolean): void {
  // noop
}

export function isMachineBindingBypassed(): boolean {
  return false;
}

export function isPinBypassed(): boolean {
  return false;
}

export function resetDebug(): void {
  // noop
}

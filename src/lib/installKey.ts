/**
 * 密钥A：首次安装验证
 *
 * 用途：App首次安装后必须输入密钥A才能进入系统
 * 验证通过后写入 localStorage.install_verified = true
 * 卸载重装会清除 localStorage，重新触发验证
 */

const INSTALL_VERIFIED_KEY = 'install_verified';
const INSTALL_KEY_A = import.meta.env.VITE_INSTALL_KEY_A ?? '';

/** 检查是否已完成首次安装验证 */
export function isInstallVerified(): boolean {
  try {
    return localStorage.getItem(INSTALL_VERIFIED_KEY) === 'true';
  } catch {
    return false;
  }
}

/** 验证密钥A */
export function verifyInstallKey(input: string): boolean {
  if (!INSTALL_KEY_A) return false;
  return input === INSTALL_KEY_A;
}

/** 标记已完成首次安装验证 */
export function markInstallVerified(): void {
  try {
    localStorage.setItem(INSTALL_VERIFIED_KEY, 'true');
  } catch {
    // localStorage 不可用时静默失败
  }
}

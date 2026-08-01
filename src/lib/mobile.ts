/**
 * Capacitor 移动端适配层
 *
 * 这一层只在 Capacitor 环境里有效（安卓/iOS App 内），
 * 浏览器/Electron 里所有 API 都走兜底，不影响桌面端。
 *
 * 职责：
 * 1. 状态栏/导航栏暗色化 + 安全区适配
 * 2. 安卓返回键 → 模拟浏览器后退（A3→A2→A1 而不是直接退出）
 * 3. 文件分享：把备份 JSON 通过系统分享面板发出去（微信/QQ/网盘）
 * 4. 文件选择：从系统文件选择器读 JSON 恢复
 *
 * 关键：所有 Capacitor 插件调用都通过 Capacitor.Plugins 动态取，
 *   不写 import("@capacitor/xxx")，避免浏览器环境 Vite 解析失败白屏。
 */

/** 判断当前是否在 Capacitor 移动 App 内 */
export function isMobileApp(): boolean {
  return typeof window !== 'undefined'
    && typeof (window as any).capacitor !== 'undefined'
    && (window as any).capacitor.isNative === true;
}

/**
 * 判断当前是否为手机浏览器（非 Capacitor App，但 UA 是手机）
 * 用于在手机浏览器里启用 navigator.share 等移动端优化
 */
export function isMobileBrowser(): boolean {
  if (isMobileApp()) return false; // Capacitor App 有自己的分享逻辑
  if (typeof window === 'undefined' || !navigator) return false;
  return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent);
}

/**
 * 用 Web Share API 分享文件（手机浏览器）
 * 安卓 Chrome / iOS Safari 12.2+ 支持 navigator.share({ files })
 * 返回 true 表示分享成功（或用户取消），false 表示不支持
 */
export async function webShareFile(blob: Blob, filename: string): Promise<{ ok: true; shared: boolean } | { ok: false; error: string }> {
  if (!navigator.share) return { ok: false, error: '浏览器不支持分享' };
  if (!navigator.canShare || !navigator.canShare({ files: [new File([blob], filename, { type: blob.type })] })) {
    return { ok: false, error: '浏览器不支持文件分享' };
  }
  try {
    const file = new File([blob], filename, { type: 'application/json' });
    await navigator.share({
      files: [file],
      title: '奥菲斯档案备份',
      text: `${filename} · 完整档案数据`,
    });
    return { ok: true, shared: true };
  } catch (e) {
    // 用户取消分享不算错误
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { ok: true, shared: false };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/** 移动端平台信息 */
export interface MobileInfo {
  platform: 'android' | 'ios' | 'web';
  isMobile: true;
}

/** 取 Capacitor 插件（仅在移动端可用，桌面/浏览器返回 undefined） */
function getPlugin(name: string): any | undefined {
  const cap = (window as any).Capacitor;
  if (!cap || !cap.Plugins) return undefined;
  return cap.Plugins[name];
}

/** 初始化移动端：状态栏、导航栏、返回键、安全区 */
export async function initMobile(): Promise<MobileInfo | null> {
  if (!isMobileApp()) return null;
  try {
    const StatusBar = getPlugin('StatusBar');
    const NavigationBar = getPlugin('NavigationBar');
    const App = getPlugin('App');

    // 状态栏暗色（白字）
    if (StatusBar) {
      try {
        await StatusBar.setStyle({ style: 'DARK' });
        await StatusBar.setBackgroundColor({ color: '#0d0d0f' });
      } catch { /* iOS 忽略背景色 */ }
    }

    // 导航栏暗色
    if (NavigationBar) {
      try {
        await NavigationBar.setBackgroundColor({ color: '#0d0d0f' });
        await NavigationBar.setStyle({ style: 'DARK' });
      } catch { /* web 兜底 */ }
    }

    // 安卓返回键 → 模拟浏览器后退，而不是直接退出 App
    // 这样 A1→A2→A3 按返回是 A3→A2→A1，符合用户预期
    if (App) {
      App.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          App.exitApp();
        }
      });
    }

    const cap = (window as any).capacitor;
    return { platform: (cap?.platform as 'android' | 'ios') || 'android', isMobile: true };
  } catch (e) {
    console.error('[initMobile] failed', e);
    return null;
  }
}

/**
 * 移动端备份：把 JSON 写入 app 私有目录，然后用系统分享面板发出去
 * （微信文件传输助手 / QQ / 网盘 / 蓝牙 都能选）
 *
 * 桌面端/浏览器不会调这个，走 window.archiveApp.saveBackup 或 a 标签下载
 */
export async function mobileShareBackup(json: string, filename: string): Promise<{ ok: true; shared: boolean } | { ok: false; error: string }> {
  if (!isMobileApp()) return { ok: false, error: '非移动端环境' };
  try {
    const Filesystem = getPlugin('Filesystem');
    const Share = getPlugin('Share');
    if (!Filesystem || !Share) return { ok: false, error: '文件系统或分享插件不可用' };

    // 写到 app 的 Cache 目录（分享后系统会读这个文件）
    const writeRes = await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: 'CACHE',
      encoding: 'utf8',
      recursive: true,
    });
    // 用系统分享面板发出去
    await Share.share({
      title: '奥菲斯档案备份',
      text: `${filename} · 完整档案数据`,
      url: writeRes.uri,
      dialogTitle: '分享档案备份到...',
    });
    return { ok: true, shared: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/**
 * 移动端恢复：用隐藏 input[type=file] 触发系统文件选择器
 * WebView 在安卓上支持 input file，会弹出系统文件选择器
 */
export async function mobilePickBackupFile(): Promise<{ ok: true; json: string; name: string } | { ok: false; canceled?: true; error?: string }> {
  if (!isMobileApp()) return { ok: false, error: '非移动端环境' };
  return pickFileViaInput();
}

/** 用隐藏 input[type=file] 触发系统文件选择器（跨平台兜底） */
function pickFileViaInput(): Promise<{ ok: true; json: string; name: string } | { ok: false; canceled?: true; error?: string }> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) {
        resolve({ ok: false, canceled: true });
        return;
      }
      try {
        const json = await f.text();
        resolve({ ok: true, json, name: f.name });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        resolve({ ok: false, error: msg });
      }
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  });
}

/** 平台信息（UI 用） */
export const platformInfo = {
  isMobile: isMobileApp(),
  isDesktop: Boolean((window as any).archiveApp),
};

import { sha256Hex } from '../lib/hiddenUnlock';
import { secureStorage } from '../lib/storage';

export interface BindingResult {
  bound: boolean;
  deviceId: string | null;
  match: boolean;
  reason?: string;
}

export interface MigrateCodeResult {
  ok: boolean;
  code?: string;
  error?: string;
}

export interface PlatformAPI {
  isApp(): boolean;
  isWeb(): boolean;
  isDesktop(): boolean;
  pickImage(): Promise<{ dataUrl: string; name: string } | null>;
  pickImages(): Promise<{ dataUrl: string; name: string }[]>;
  pickTextFile(): Promise<{ content: string; name: string } | null>;
  saveFile(filename: string, content: string, mime?: string): Promise<void>;
  shareFile(blob: Blob, filename: string): Promise<{ ok: true; shared: boolean } | { ok: false; error: string }>;
  bindMachine(): Promise<BindingResult>;
  verifyBinding(): Promise<BindingResult>;
  generateMigrateCode(password: string): Promise<MigrateCodeResult>;
  verifyMigrateAndRebind(code: string): Promise<BindingResult>;
  unbindMachine(): void;
  initPlatform(): Promise<{ platform: 'android' | 'ios'; isMobile: true } | null>;
}

const STORAGE_KEY = 'machine_binding';
const APP_ID = 'com.orpheus.archive';

function getPlugin(name: string): any | undefined {
  const cap = (window as any).Capacitor;
  if (!cap || !cap.Plugins) return undefined;
  return cap.Plugins[name];
}

async function getDeviceId(): Promise<string | null> {
  // 1. 优先走 @capacitor/device 官方插件（Capacitor 6 自动注册）
  try {
    const { Device } = await import('@capacitor/device');
    const info = await Device.getId();
    if (info?.uuid) return info.uuid;
  } catch (e) {
    console.warn('[app:getDeviceId] Capacitor Device 插件不可用，降级', e);
  }

  // 2. 兜底：直接访问 window.Capacitor.Plugins.Device（插件已加载但 import 解析失败时）
  try {
    const cap = (window as any).Capacitor;
    const DevicePlugin = cap?.Plugins?.Device;
    if (DevicePlugin && typeof DevicePlugin.getId === 'function') {
      const info = await DevicePlugin.getId();
      if (info?.uuid) return info.uuid;
    }
  } catch (e) {
    console.warn('[app:getDeviceId] 直接访问 Device 插件失败', e);
  }

  // 3. App 环境最终兜底：基于 WebView 指纹（navigator.userAgent + hardwareConcurrency + devicePixelRatio 等）
  //    仅在 Capacitor 环境使用，保证非 App 环境不返回假 ID
  try {
    const cap = (window as any).Capacitor;
    const isNativeApp = cap?.Platform === 'android' || cap?.Platform === 'ios' ||
      (typeof cap?.isNativePlatform === 'function' ? cap.isNativePlatform() : cap?.isNative);
    if (isNativeApp) {
      const ua = navigator.userAgent || '';
      const hw = navigator.hardwareConcurrency || 0;
      const dpr = window.devicePixelRatio || 0;
      const screen = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
      const fp = `orpheus-fp:${ua}:${hw}:${dpr}:${screen}`;
      // 用轻量 hash 转 32 位十六进制（不依赖 sha256，避免循环依赖）
      let hash = 0x811c9dc5;
      for (let i = 0; i < fp.length; i++) {
        hash ^= fp.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
      }
      const hex = (hash >>> 0).toString(16).padStart(8, '0');
      const uuid = `${hex}-0000-4000-8000-${hex}${hex}`;
      console.info('[app:getDeviceId] 使用设备指纹兜底 ID');
      return uuid;
    }
  } catch (e) {
    console.warn('[app:getDeviceId] 指纹兜底失败', e);
  }

  return null;
}

async function getAppPrivateSalt(): Promise<string> {
  const { APP_PRIVATE_SALT } = await import('../lib/appSecret');
  return APP_PRIVATE_SALT;
}

async function bindMachineInner(): Promise<BindingResult> {
  const APP_PRIVATE_SALT = await getAppPrivateSalt();
  const deviceId = await getDeviceId();
  if (!deviceId) {
    return { bound: false, deviceId: null, match: false, reason: '非 App 环境，跳过绑定' };
  }

  if (!APP_PRIVATE_SALT) {
    return { bound: false, deviceId: null, match: false, reason: '无盐值，跳过绑定' };
  }

  const bindingCode = await sha256Hex(deviceId + APP_ID + APP_PRIVATE_SALT);
  secureStorage.set(STORAGE_KEY, bindingCode);

  return { bound: true, deviceId, match: true };
}

async function verifyBindingInner(): Promise<BindingResult> {
  const APP_PRIVATE_SALT = await getAppPrivateSalt();
  const stored = secureStorage.get(STORAGE_KEY);

  if (!stored) {
    return bindMachineInner();
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

async function generateMigrateCodeInner(password: string): Promise<MigrateCodeResult> {
  const APP_PRIVATE_SALT = await getAppPrivateSalt();
  if (!APP_PRIVATE_SALT) {
    return { ok: false, error: '非 App 环境' };
  }
  if (password !== APP_PRIVATE_SALT) {
    return { ok: false, error: '管理员密码错误' };
  }

  const stored = secureStorage.get(STORAGE_KEY);
  if (!stored) {
    return { ok: false, error: '本机未绑定，无法迁移' };
  }

  const raw = await sha256Hex(stored + 'MIGRATE');
  const num = parseInt(raw.slice(0, 8), 16) % 100000000;
  const code = num.toString().padStart(8, '0');

  return { ok: true, code };
}

async function verifyMigrateAndRebindInner(migrateCode: string): Promise<BindingResult> {
  const APP_PRIVATE_SALT = await getAppPrivateSalt();
  if (!APP_PRIVATE_SALT) {
    return { bound: false, deviceId: null, match: false, reason: '非 App 环境' };
  }

  const newDeviceId = await getDeviceId();
  if (!newDeviceId) {
    return { bound: false, deviceId: null, match: false, reason: '无法获取新设备ID' };
  }

  const stored = secureStorage.get(STORAGE_KEY);
  if (!stored) {
    return { bound: false, deviceId: null, match: false, reason: '未检测到旧设备绑定信息' };
  }

  const raw = await sha256Hex(stored + 'MIGRATE');
  const num = parseInt(raw.slice(0, 8), 16) % 100000000;
  const expectedCode = num.toString().padStart(8, '0');

  if (migrateCode !== expectedCode) {
    return { bound: false, deviceId: null, match: false, reason: '迁移码错误' };
  }

  const newBindingCode = await sha256Hex(newDeviceId + APP_ID + APP_PRIVATE_SALT);
  secureStorage.set(STORAGE_KEY, newBindingCode);

  return { bound: true, deviceId: newDeviceId, match: true };
}

export const app: PlatformAPI = {
  isApp() {
    return true;
  },
  isWeb() {
    return false;
  },
  isDesktop() {
    return false;
  },

  async pickImage() {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
      });
      if (!photo.base64String) return null;
      const mime = photo.format === 'png' ? 'image/png' : 'image/jpeg';
      return {
        dataUrl: `data:${mime};base64,${photo.base64String}`,
        name: `photo_${Date.now()}.${photo.format}`,
      };
    } catch {
      return null;
    }
  },

  async pickImages() {
    const results: { dataUrl: string; name: string }[] = [];
    const result = await this.pickImage();
    if (result) {
      results.push(result);
    }
    return results;
  },

  pickTextFile() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      input.onchange = async () => {
        const f = input.files?.[0];
        if (!f) { resolve(null); return; }
        try {
          const content = await f.text();
          resolve({ content, name: f.name });
        } catch {
          resolve(null);
        }
        input.remove();
      };
      document.body.appendChild(input);
      input.click();
    });
  },

  async saveFile(filename: string, content: string, mime: string = 'application/json'): Promise<void> {
    void mime;
    try {
      const { Share } = await import('@capacitor/share');
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      const tempName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const writeRes = await Filesystem.writeFile({
        path: tempName,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      await Share.share({
        title: filename,
        url: writeRes.uri,
      });
    } catch (e) {
      console.error('saveFile failed', e);
      throw e;
    }
  },

  async shareFile(blob: Blob, filename: string): Promise<{ ok: true; shared: boolean } | { ok: false; error: string }> {
    try {
      const Filesystem = getPlugin('Filesystem');
      const Share = getPlugin('Share');
      if (!Filesystem || !Share) return { ok: false, error: '文件系统或分享插件不可用' };

      let content: string;
      if (blob.type === 'application/json' || blob.type === 'text/plain' || blob.type === '') {
        content = await blob.text();
      } else {
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        content = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      }

      const writeRes = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: 'CACHE',
        encoding: 'utf8',
        recursive: true,
      });
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
  },

  bindMachine: bindMachineInner,
  verifyBinding: verifyBindingInner,
  generateMigrateCode: generateMigrateCodeInner,
  verifyMigrateAndRebind: verifyMigrateAndRebindInner,

  unbindMachine() {
    secureStorage.remove(STORAGE_KEY);
  },

  async initPlatform() {
    try {
      const StatusBar = getPlugin('StatusBar');
      const NavigationBar = getPlugin('NavigationBar');
      const AppPlugin = getPlugin('App');

      if (StatusBar) {
        try {
          await StatusBar.setStyle({ style: 'DARK' });
          await StatusBar.setBackgroundColor({ color: '#0d0d0f' });
        } catch { /* iOS 忽略背景色 */ }
      }

      if (NavigationBar) {
        try {
          await NavigationBar.setBackgroundColor({ color: '#0d0d0f' });
          await NavigationBar.setStyle({ style: 'DARK' });
        } catch { /* web 兜底 */ }
      }

      if (AppPlugin) {
        AppPlugin.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            AppPlugin.exitApp();
          }
        });
      }

      const cap = (window as any).Capacitor;
      return { platform: (cap?.platform as 'android' | 'ios') || 'android', isMobile: true };
    } catch (e) {
      console.error('[initPlatform] failed', e);
      return null;
    }
  },
};

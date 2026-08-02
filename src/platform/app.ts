import { sha256Hex } from '../lib/hiddenUnlock';

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

const STORAGE_KEY = '__machine_binding__';
const APP_ID = 'com.orpheus.archive';

function getPlugin(name: string): any | undefined {
  const cap = (window as any).Capacitor;
  if (!cap || !cap.Plugins) return undefined;
  return cap.Plugins[name];
}

async function getDeviceId(): Promise<string | null> {
  try {
    const { Device } = await import('@capacitor/device');
    const info = await Device.getId();
    return info.uuid;
  } catch {
    return null;
  }
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
  localStorage.setItem(STORAGE_KEY, bindingCode);

  return { bound: true, deviceId, match: true };
}

async function verifyBindingInner(): Promise<BindingResult> {
  const APP_PRIVATE_SALT = await getAppPrivateSalt();
  const stored = localStorage.getItem(STORAGE_KEY);

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

  const stored = localStorage.getItem(STORAGE_KEY);
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

  const stored = localStorage.getItem(STORAGE_KEY);
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
  localStorage.setItem(STORAGE_KEY, newBindingCode);

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
    localStorage.removeItem(STORAGE_KEY);
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

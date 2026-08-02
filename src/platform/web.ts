export interface PlatformAPI {
  isApp(): boolean;
  isWeb(): boolean;
  isDesktop(): boolean;

  pickImage(): Promise<{ dataUrl: string; name: string } | null>;
  pickImages(): Promise<{ dataUrl: string; name: string }[]>;
  pickTextFile(): Promise<{ content: string; name: string } | null>;
  saveFile(filename: string, content: string, mime?: string): Promise<void>;

  shareFile(blob: Blob, filename: string): Promise<{ ok: true; shared: boolean } | { ok: false; error: string }>;

  bindMachine(): Promise<{ bound: boolean; deviceId: string | null; match: boolean; reason?: string }>;
  verifyBinding(): Promise<{ bound: boolean; deviceId: string | null; match: boolean; reason?: string }>;
  generateMigrateCode(password: string): Promise<{ ok: boolean; code?: string; error?: string }>;
  verifyMigrateAndRebind(code: string): Promise<{ bound: boolean; deviceId: string | null; match: boolean; reason?: string }>;
  unbindMachine(): void;

  initPlatform(): Promise<{ platform: 'web'; isMobile: false } | null>;
}

const MACHINE_BINDING_KEY = '__machine_binding__';

function pickImageViaInput(): Promise<{ dataUrl: string; name: string } | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUrl: reader.result as string, name: f.name });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(f);
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  });
}

function pickImagesViaInput(): Promise<{ dataUrl: string; name: string }[]> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (files.length === 0) { resolve([]); return; }
      const results = await Promise.all(files.map(async f => {
        const reader = new FileReader();
        return new Promise<{ dataUrl: string; name: string }>(res => {
          reader.onload = () => res({ dataUrl: reader.result as string, name: f.name });
          reader.onerror = () => res({ dataUrl: '', name: f.name });
          reader.readAsDataURL(f);
        });
      }));
      resolve(results.filter(r => r.dataUrl));
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  });
}

function pickTextFileViaInput(): Promise<{ content: string; name: string } | null> {
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
}

export const web: PlatformAPI = {
  isApp(): boolean {
    return false;
  },

  isWeb(): boolean {
    return true;
  },

  isDesktop(): boolean {
    return false;
  },

  pickImage(): Promise<{ dataUrl: string; name: string } | null> {
    return pickImageViaInput();
  },

  pickImages(): Promise<{ dataUrl: string; name: string }[]> {
    return pickImagesViaInput();
  },

  pickTextFile(): Promise<{ content: string; name: string } | null> {
    return pickTextFileViaInput();
  },

  async saveFile(filename: string, content: string, mime: string = 'application/json'): Promise<void> {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.position = 'fixed';
    a.style.left = '-9999px';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async shareFile(blob: Blob, filename: string): Promise<{ ok: true; shared: boolean } | { ok: false; error: string }> {
    if (!navigator.share) return { ok: false, error: '浏览器不支持分享' };
    if (!navigator.canShare || !navigator.canShare({ files: [new File([blob], filename, { type: blob.type })] })) {
      return { ok: false, error: '浏览器不支持文件分享' };
    }
    try {
      const file = new File([blob], filename, { type: blob.type });
      await navigator.share({
        files: [file],
        title: filename,
        text: `${filename}`,
      });
      return { ok: true, shared: true };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return { ok: true, shared: false };
      }
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  },

  async bindMachine(): Promise<{ bound: boolean; deviceId: string | null; match: boolean; reason?: string }> {
    return { bound: false, deviceId: null, match: false, reason: '网页端不启用机器绑定' };
  },

  async verifyBinding(): Promise<{ bound: boolean; deviceId: string | null; match: boolean; reason?: string }> {
    return { bound: false, deviceId: null, match: false, reason: '网页端不启用机器绑定' };
  },

  async generateMigrateCode(_password: string): Promise<{ ok: boolean; code?: string; error?: string }> {
    return { ok: false, error: '网页端不支持换机迁移' };
  },

  async verifyMigrateAndRebind(_code: string): Promise<{ bound: boolean; deviceId: string | null; match: boolean; reason?: string }> {
    return { bound: false, deviceId: null, match: false, reason: '网页端不支持换机迁移' };
  },

  unbindMachine(): void {
    localStorage.removeItem(MACHINE_BINDING_KEY);
  },

  async initPlatform(): Promise<{ platform: 'web'; isMobile: false } | null> {
    return { platform: 'web', isMobile: false };
  },
};

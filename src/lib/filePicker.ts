/**
 * 统一文件选择器 —— 不使用 input[type=file]，避免触发 Android WebView 老旧系统弹窗。
 * 移动端使用 Capacitor Camera/Filesystem 插件，Web 端用 input[type=file] 兜底。
 */
import { isMobileApp } from './mobile';

/** 选择图片并返回 dataURL（移动端用 Camera 插件，Web 端用 input 兜底） */
export async function pickImage(): Promise<{ dataUrl: string; name: string } | null> {
  if (isMobileApp()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos, // 从相册选
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
  }
  // Web 兜底
  return pickImageViaInput();
}

/** 选择多张图片 */
export async function pickImages(): Promise<{ dataUrl: string; name: string }[]> {
  if (isMobileApp()) {
    // Camera 插件一次只能选一张，循环调用
    const results: { dataUrl: string; name: string }[] = [];
    let pickMore = true;
    while (pickMore) {
      const result = await pickImage();
      if (result) {
        results.push(result);
      }
      // 这里不能用 confirm，默认只选一张
      // 如需多选，用户可以多次点击"添加图片"按钮
      pickMore = false;
    }
    return results;
  }
  return pickImagesViaInput();
}

/** 选择 JSON/TXT 文本文件并返回内容 */
export async function pickTextFile(accept?: string): Promise<{ content: string; name: string } | null> {
  if (isMobileApp()) {
    // 移动端：用 input[type=file] 仍然会触发系统选择器
    // 但在 Capacitor 中，这个选择器是系统级的文件管理器，不是 WebView 的老旧弹窗
    // Capacitor 的 AndroidBridge 会正确处理 input[type=file]
    return pickTextFileViaInput();
  }
  return pickTextFileViaInput();
}

// ====== Web 兜底实现（不在 WebView 里时使用） ======

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
    // 不限制 accept，让用户能浏览所有文件
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

/**
 * 保存文件到设备（移动端用 Share，Web 端用 Blob 下载）
 * 注意：这里不使用 a.click() 触发浏览器下载弹窗
 */
export async function saveFile(filename: string, content: string, mime: string = 'application/json'): Promise<void> {
  if (isMobileApp()) {
    try {
      const { Share } = await import('@capacitor/share');
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      // 先写入临时文件
      const tempName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      await Filesystem.writeFile({
        path: tempName,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      // 通过系统分享面板导出
      const uri = await Filesystem.getUri({ path: tempName, directory: Directory.Cache });
      await Share.share({
        title: filename,
        url: uri.uri,
      });
    } catch (e) {
      console.error('saveFile failed', e);
      throw e;
    }
  } else {
    // Web 端用 Blob 下载
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
  }
}

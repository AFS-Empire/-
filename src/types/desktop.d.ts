/**
 * 桌面 App / 移动 App 类型声明
 *
 * - window.archiveApp：Electron 桌面端通过 contextBridge 注入（preload.ts 暴露）
 * - window.capacitor：Capacitor 移动端运行时注入
 * - 浏览器访问时两者都为 undefined（UI 自动降级成 a 标签下载 / FileReader）
 */
import type { ArchiveAppAPI } from '../../electron/preload';

/** 平台类型 */
export type EPlatform = 'desktop' | 'mobile' | 'web';

/** 重新导出，方便别处 import */
export type { ArchiveAppAPI };

/** Capacitor 运行时全局对象（移动端才有） */
interface CapacitorGlobal {
  isNative: boolean;
  platform: 'android' | 'ios' | 'web';
}

declare global {
  interface Window {
    /** Electron 桌面端注入的 API */
    archiveApp?: ArchiveAppAPI;
    /** Capacitor 移动端注入的运行时 */
    capacitor?: CapacitorGlobal;
  }
}

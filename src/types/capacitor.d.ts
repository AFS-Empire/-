/**
 * Capacitor 模块类型声明（占位）
 *
 * 当 @capacitor/* 包未安装时（如桌面端开发、CI 环境），
 * 这些声明让 TypeScript 编译能通过。
 * 真正的 Capacitor 类型在 npm install 后会覆盖这些占位。
 *
 * 运行时：mobile.ts 里的所有 Capacitor 调用都在 isMobileApp() 判断后执行，
 * 浏览器/桌面端永远不会走到，所以占位类型不影响实际运行。
 */

declare module '@capacitor/status-bar' {
  export enum Style { Dark = 'DARK', Light = 'LIGHT' }
  export const StatusBar: {
    setStyle(opts: { style: string }): Promise<void>;
    setBackgroundColor(opts: { color: string }): Promise<void>;
  };
}

declare module '@capacitor/android' {
  export const NavigationBar: {
    setBackgroundColor(opts: { color: string }): Promise<void>;
    setStyle(opts: { style: string }): Promise<void>;
  };
}

declare module '@capacitor/app' {
  export const App: {
    addListener(event: 'backButton', cb: (opts: { canGoBack: boolean }) => void): Promise<void>;
    exitApp(): Promise<void>;
    getInfo(): Promise<{ name: string; version: string; build: string; id: string }>;
  };
}

declare module '@capacitor/filesystem' {
  export enum Directory { Cache = 'CACHE', Documents = 'DOCUMENTS', Data = 'DATA' }
  export enum Encoding { UTF8 = 'utf8', ASCII = 'ascii' }
  export const Filesystem: {
    writeFile(opts: {
      path: string;
      data: string;
      directory: Directory;
      encoding: Encoding;
      recursive?: boolean;
    }): Promise<{ uri: string }>;
    readFile(opts: {
      path: string;
      directory: Directory;
      encoding: Encoding;
    }): Promise<{ data: string }>;
  };
}

declare module '@capacitor/share' {
  export const Share: {
    share(opts: {
      title?: string;
      text?: string;
      url?: string;
      dialogTitle?: string;
    }): Promise<void>;
  };
}

declare module '@capacitor/core' {
  export interface CapacitorGlobal {
    isNative: boolean;
    platform: 'android' | 'ios' | 'web';
  }
  export const Capacitor: CapacitorGlobal;
}

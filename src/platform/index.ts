/**
 * 平台隔离层统一入口
 *
 * 双重隔离策略：
 * 1. 编译时：通过 IS_WEB_BUILD 常量 + Vite Tree Shaking，干掉另一个平台的全部代码
 *    - 网页构建：不会把 @capacitor 相关代码打进 bundle
 *    - App 构建：不会把 input[type=file] 下载逻辑打包进不必要分支
 * 2. 运行时：启动时用 Capacitor 检测二次兜底，防止编译配置弄错
 *
 * 业务代码禁止：
 *   ❌ 直接 import @capacitor/*
 *   ❌ 直接写 isMobileApp() / window.capacitor / window.Capacitor
 *   ❌ 写 if (isWeb) {...} else {...} 双份平台代码在业务文件里
 *
 * 必须通过本文件暴露的 platform 变量调用：
 *   ✅ import { platform } from '../platform';
 *   ✅ platform.saveFile(...);      // 两端同一 API
 *   ✅ platform.bindMachine(...);   // 网页端自动走 NO-OP
 */
import { IS_WEB_BUILD } from '../lib/buildTarget';
import { web } from './web';
import { app } from './app';
import type { PlatformAPI } from './web';

// 选择运行时实现：
// 1) IS_WEB_BUILD 是编译时 define 常量，Vite 会删除不可达分支 + 未用 import
// 2) 非 web 构建时，用 Capacitor 原生检测兜底
let runtime: PlatformAPI;

if (IS_WEB_BUILD) {
  runtime = web;
} else {
  const cap: any =
    (typeof window !== 'undefined' && ((window as any).Capacitor || (window as any).capacitor)) || null;
  const isNative = !!(
    cap &&
    (typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : cap.isNative)
  );
  runtime = isNative ? ((app as unknown) as PlatformAPI) : web;
}

export const platform: PlatformAPI = runtime;
export type { PlatformAPI };

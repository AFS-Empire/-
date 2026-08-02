/**
 * 机器码绑定状态 store（App 端）
 *
 * 用途：决定本设备是否允许执行写操作（编辑/导出/导入）。
 * - App 端：启动时调用 platform.verifyBinding()，isBound = bound && match
 *   未绑定 / 设备不匹配 → 锁死写操作，仅允许查看
 * - Web 端：不启用机器绑定，isBound 恒为 true（Web 的写权限由 hiddenUnlock 把关）
 * - Dev 构建可经 devTools 旁路（Release 构建旁路代码被整体移除）
 */
import { create } from 'zustand';
import { IS_WEB_BUILD } from '../lib/buildTarget';
import { isMachineBindingBypassed } from '../debug/devTools';
import { platform } from '../platform';

export type BindingResult = Awaited<ReturnType<typeof platform.verifyBinding>>;

interface BindingState {
  /** 本设备是否已通过机器码绑定校验（写操作的总闸门） */
  isBound: boolean;
  /** 原始校验结果（用于 UI 展示原因） */
  result: BindingResult | null;
  /** 是否正在校验中 */
  loading: boolean;
  /** 启动时调用一次：执行 verifyBinding 并更新状态 */
  refresh: () => Promise<BindingResult>;
}

// 初始值：Web / 桌面端直接放行；Capacitor App 待 refresh 后更新
const INITIAL_IS_BOUND = IS_WEB_BUILD || !platform.isApp();

export const useBindingStore = create<BindingState>((set) => ({
  isBound: INITIAL_IS_BOUND,
  result: null,
  loading: !INITIAL_IS_BOUND,

  refresh: async () => {
    // Web 端 / 桌面端（Electron）：不启用机器绑定，直接放行
    // 仅 Capacitor App（platform.isApp()）才执行机器码绑定校验
    if (IS_WEB_BUILD || !platform.isApp()) {
      const passResult: BindingResult = { bound: false, deviceId: null, match: false, reason: '当前环境不启用机器绑定' };
      set({ isBound: true, result: passResult, loading: false });
      return passResult;
    }
    // Dev 旁路：调试构建跳过校验
    if (isMachineBindingBypassed()) {
      const bypassResult: BindingResult = { bound: true, deviceId: null, match: true };
      set({ isBound: true, result: bypassResult, loading: false });
      return bypassResult;
    }
    try {
      const result = await platform.verifyBinding();
      set({ result, loading: false });
      // bound && match 才允许写；只 bound 但不 match（设备不匹配）→ 锁死
      set({ isBound: !!(result.bound && result.match) });
      return result;
    } catch (e) {
      const errResult: BindingResult = { bound: false, deviceId: null, match: false, reason: '绑定校验异常' };
      set({ result: errResult, isBound: false, loading: false });
      return errResult;
    }
  },
}));

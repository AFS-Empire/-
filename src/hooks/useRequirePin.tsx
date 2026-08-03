/**
 * useRequirePin — App 端敏感操作的密钥会话守卫
 *
 * 用法：
 *   const { requirePin, PinGuard } = useRequirePin();
 *   requirePin('保存档案', () => { doSave(); });
 *   // 在组件 JSX 末尾渲染 {PinGuard}
 *
 * 行为：
 * - 已解锁（pinSessionStore.isUnlocked）→ 直接执行 action
 * - 未解锁 → 弹出 PinDialog，校验通过后执行 action
 * - 仅 App 构建有效（Web 构建盐值为空，unlock 永远失败 → 调用方应仅在 App 路径使用）
 */
import { useState, useCallback } from 'react';
import { usePinSessionStore } from '../store/pinSessionStore';
import { PinDialog } from '../components/PinDialog';

export function useRequirePin() {
  const [pending, setPending] = useState<{
    open: boolean;
    label: string;
    action: (() => unknown) | null;
  }>({ open: false, label: '', action: null });

  const requirePin = useCallback((label: string, action: () => unknown) => {
    // 已解锁直接执行
    if (usePinSessionStore.getState().isUnlocked) {
      action();
      return;
    }
    setPending({ open: true, label, action });
  }, []);

  const handleClose = useCallback(() => {
    setPending({ open: false, label: '', action: null });
  }, []);

  const handleUnlocked = useCallback(() => {
    const action = pending.action;
    setPending({ open: false, label: '', action: null });
    if (action) {
      // 异步执行，不阻塞弹窗关闭动画
      Promise.resolve(action()).catch(e => console.error('[requirePin] action failed', e));
    }
  }, [pending.action]);

  const PinGuard = pending.open ? (
    <PinDialog
      open={pending.open}
      onClose={handleClose}
      title="密钥校验"
      message={`请输入档案密钥以继续：${pending.label}`}
      onUnlocked={handleUnlocked}
    />
  ) : null;

  return { requirePin, PinGuard };
}

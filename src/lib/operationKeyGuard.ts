/**
 * 操作验证守卫（密钥B）
 *
 * 用途：拦截所有写操作，检查密钥B是否已验证
 * 设计：使用全局事件系统，不依赖 React 组件
 */

import { isOperationVerified } from './operationKey';

/** 待执行的操作队列 */
const pendingActions: Array<() => void> = [];

/** 监听者集合（用于通知 UI 层显示对话框） */
type Listener = (show: boolean) => void;
const listeners = new Set<Listener>();

/** 触发 UI 显示/隐藏验证对话框 */
function notifyListeners(show: boolean) {
  listeners.forEach(fn => fn(show));
}

/** 订阅 UI 事件 */
export function subscribeOperationKeyListener(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 检查并执行写操作
 * @param action 要执行的操作
 * @returns true 表示操作已执行，false 表示操作被拦截（等待验证）
 */
export function needVerify(action: () => void): boolean {
  if (isOperationVerified()) {
    // 已验证，直接执行
    action();
    return true;
  }
  // 需要验证，保存操作并通知 UI
  pendingActions.push(action);
  notifyListeners(true);
  return false;
}

/** 验证通过后执行所有待执行的操作 */
export function executePendingActions(): void {
  const actions = [...pendingActions];
  pendingActions.length = 0;
  notifyListeners(false);
  actions.forEach(fn => fn());
}

/** 取消验证，清空待执行的操作 */
export function cancelPendingActions(): void {
  pendingActions.length = 0;
  notifyListeners(false);
}

/** 获取当前待执行操作数量（用于调试） */
export function getPendingCount(): number {
  return pendingActions.length;
}

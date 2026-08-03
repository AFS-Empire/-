/**
 * 操作验证 Hook（密钥B）
 *
 * 用途：在执行写操作前检查密钥B是否已验证
 * 返回：
 *   - needVerify: 是否需要弹出验证对话框
 *   - showDialog: 是否显示对话框
 *   - openVerify: 触发验证对话框
 *   - onVerified: 验证通过后关闭对话框并执行操作
 *   - onCancel: 取消验证
 *   - verifiedRef: 最近一次验证是否通过（用于后续判断）
 */

import { useState, useCallback, useRef } from 'react';
import { isOperationVerified } from '../lib/operationKey';

export function useOperationKeyVerification() {
  const [showDialog, setShowDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const verifiedRef = useRef(false);

  /** 检查是否需要验证，如果需要则显示对话框 */
  const requireVerify = useCallback((action: () => void) => {
    // 已验证（30天内）→ 直接执行
    if (isOperationVerified()) {
      action();
      return true;
    }
    // 需要验证 → 显示对话框，保存待执行的操作
    setPendingAction(() => action);
    setShowDialog(true);
    verifiedRef.current = false;
    return false;
  }, []);

  /** 验证通过后的回调 */
  const onVerified = useCallback(() => {
    verifiedRef.current = true;
    setShowDialog(false);
    // 执行待执行的操作
    if (pendingAction) {
      const action = pendingAction;
      setPendingAction(null);
      action();
    }
  }, [pendingAction]);

  /** 取消验证 */
  const onCancel = useCallback(() => {
    verifiedRef.current = false;
    setShowDialog(false);
    setPendingAction(null);
  }, []);

  return {
    showDialog,
    requireVerify,
    onVerified,
    onCancel,
    verifiedRef,
  };
}

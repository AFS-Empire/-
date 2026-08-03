/**
 * 公共 UI 组件 — 减少页面级重复代码
 */

import type { ReactNode } from 'react';

/** 空状态占位 */
export function EmptyState({ text = '暂无内容', icon }: { text?: string; icon?: ReactNode }) {
  return (
    <div className="panel p-12 text-center text-ink-500">
      {icon && <div className="mb-2">{icon}</div>}
      {text}
    </div>
  );
}

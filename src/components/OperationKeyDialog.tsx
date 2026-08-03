/**
 * 操作验证对话框（密钥B）
 *
 * 功能：
 * - 在执行写操作（导入/导出/编辑/删除/新增）前弹出
 * - 输入密钥B验证通过后放行操作
 * - 验证通过后30天内不需要重复输入
 */

import { useState } from 'react';
import { verifyOperationKey, markOperationVerified } from '../lib/operationKey';

interface Props {
  show: boolean;
  onVerified: () => void;
  onCancel: () => void;
}

export default function OperationKeyDialog({ show, onVerified, onCancel }: Props) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!show) return null;

  const handleSubmit = async () => {
    if (!input.trim()) {
      setError('请输入操作密钥');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setSubmitting(true);
    const ok = await verifyOperationKey(input.trim());
    setSubmitting(false);

    if (ok) {
      markOperationVerified();
      setInput('');
      setError('');
      onVerified();
    } else {
      setError('密钥错误，请重试');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setInput('');
    }
  };

  const handleCancel = () => {
    setInput('');
    setError('');
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className={`panel-gold w-full max-w-sm p-5 relative ${shake ? 'animate-shake' : ''}`}
      >
        {/* 标题 */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🔑</span>
          <h3 className="text-base font-semibold text-gold-200 tracking-wide">操作验证</h3>
        </div>

        {/* 提示文字 */}
        <p className="text-sm text-ink-400 mb-4">
          请输入操作密钥以继续执行此操作
          <br />
          <span className="text-xs text-ink-600">验证后30天内无需重复输入</span>
        </p>

        {/* 密钥输入框 */}
        <div className="relative mb-3">
          <input
            type="password"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSubmit();
            }}
            placeholder="请输入操作密钥"
            className="input-field"
            autoFocus
            disabled={submitting}
          />
        </div>

        {/* 错误提示 */}
        {error && (
          <p className="text-sm text-red-400 mb-3 animate-fade-in">{error}</p>
        )}

        {/* 按钮组 */}
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className="btn-ghost flex-1"
            disabled={submitting}
          >
            取消
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting || !input.trim()}
            className="btn-gold flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '验证中...' : '验证'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 首次安装验证遮罩
 *
 * 功能：
 * - App首次安装启动时弹出
 * - 输入密钥A验证通过后进入系统
 * - 无法跳过（无关闭按钮、无ESC退出、点击遮罩不关闭）
 * - 卸载重装会重新触发
 */

import { useState, useEffect } from 'react';
import { verifyInstallKey, markInstallVerified } from '../lib/installKey';

interface Props {
  onVerified: () => void;
}

export default function InstallGate({ onVerified }: Props) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 禁止ESC、禁止点击外部关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const handleSubmit = async () => {
    if (!input.trim()) {
      setError('请输入密钥');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setSubmitting(true);
    const ok = verifyInstallKey(input.trim());
    setSubmitting(false);

    if (ok) {
      markInstallVerified();
      onVerified();
    } else {
      setError('密钥错误，请重试');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div
        className={`panel-gold w-full max-w-md mx-4 p-6 relative ${shake ? 'animate-shake' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Logo + 标题 */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full overflow-hidden border-2 border-gold-600/50 shadow-lg shadow-gold-900/30">
            <img src="/logo.jpg" alt="奥菲斯帝国档案馆徽记" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-lg font-bold text-gold-200 tracking-wider">奥菲斯帝国档案馆</h1>
          <p className="text-xs text-ink-500 mt-1">首次安装验证</p>
        </div>

        {/* 提示文字 */}
        <p className="text-sm text-ink-400 text-center mb-4">
          请输入授权密钥以启动应用
          <br />
          <span className="text-xs text-ink-600">此密钥由管理员提供，每个设备仅需验证一次</span>
        </p>

        {/* 密钥输入框 */}
        <div className="relative mb-4">
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
            placeholder="请输入密钥"
            className="input-field"
            autoFocus
            disabled={submitting}
          />
        </div>

        {/* 错误提示 */}
        {error && (
          <p className="text-sm text-red-400 text-center mb-3 animate-fade-in">{error}</p>
        )}

        {/* 验证按钮 */}
        <button
          onClick={() => void handleSubmit()}
          disabled={submitting || !input.trim()}
          className="btn-gold w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? '验证中...' : '验证密钥'}
        </button>

        {/* 底部安全提示 */}
        <p className="text-[10px] text-ink-600 text-center mt-4">
          本密钥用于防止未授权访问，请妥善保管
        </p>
      </div>
    </div>
  );
}

/**
 * PIN 解锁弹窗
 *
 * 用于 App 端敏感操作（导入/导出/保存编辑）前的私钥校验。
 * - 输入密钥 → 校验通过 → 回调 onUnlocked → 关闭
 * - 校验失败 → 内联显示错误，清空输入，保持弹窗开启供重试
 * - 取消 → 直接关闭
 *
 * 不使用原生 prompt；匹配黑底鎏金风格。
 */
import { useState, useEffect, useRef } from 'react';
import { ShieldCheck, KeyRound, AlertCircle } from 'lucide-react';
import { usePinSessionStore } from '../store/pinSessionStore';
import { BaseDialog } from './Dialog';

interface PinDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  /** 解锁成功后回调（弹窗会自动关闭） */
  onUnlocked: () => void;
}

export function PinDialog({
  open, onClose, title = '密钥校验', message = '请输入档案密钥以继续此操作', onUnlocked,
}: PinDialogProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const unlock = usePinSessionStore(s => s.unlock);

  useEffect(() => {
    if (open) {
      setPin('');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await unlock(pin);
      if (res.ok) {
        onUnlocked();
        onClose();
      } else {
        setError(res.error || '密钥错误');
        setPin('');
        setTimeout(() => inputRef.current?.focus(), 30);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <BaseDialog open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-gold-900/30 border border-gold-700/50 flex items-center justify-center shrink-0">
            <KeyRound size={18} className="text-gold-400" />
          </div>
          <div className="space-y-1">
            <p className="text-sm text-ink-300 leading-relaxed">{message}</p>
            <p className="text-[10px] text-ink-500">密钥仅在本会话内存中保留，退出 App 即清空</p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="password"
          value={pin}
          onChange={e => { setPin(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          placeholder="输入档案密钥"
          className="input-field font-mono tracking-wider"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-red-400">
            <AlertCircle size={12} />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost text-sm">取消</button>
          <button
            onClick={submit}
            disabled={busy || !pin}
            className="btn-gold text-sm flex items-center gap-1.5 disabled:opacity-40"
          >
            <ShieldCheck size={14} />
            {busy ? '校验中…' : '解锁'}
          </button>
        </div>
      </div>
    </BaseDialog>
  );
}

/**
 * 动态 PIN 验证弹窗
 *
 * 导入/导出档案时的二次校验。
 * 界面会自动展示当前有效 PIN（来源：网络时间 + 私有盐），
 * 用户直接复制输入即可，30 秒换一次。
 */
import { useState, useEffect, useCallback } from 'react';
import { Shield, Clock, X, RefreshCw } from 'lucide-react';
import { getCurrentPin, verifyPin, detectClockTampering, PIN_TTL_SECONDS } from '../lib/crypto';

interface PinDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PinDialog({ open, title, onClose, onSuccess }: PinDialogProps) {
  const [input, setInput] = useState('');
  const [currentPin, setCurrentPin] = useState<string>('');
  const [pinSource, setPinSource] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clockWarn, setClockWarn] = useState<string>('');

  /** 刷新当前 PIN 显示 */
  const refreshPin = useCallback(async () => {
    setLoading(true);
    try {
      const { pin, source, expiresAt: exp } = await getCurrentPin();
      setCurrentPin(pin);
      setPinSource(source);
      setExpiresAt(exp);
      setError('');
    } catch (e) {
      setError('获取 PIN 失败：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  /** 首次打开时拉取 PIN + 检测时钟篡改 */
  useEffect(() => {
    if (!open) return;
    setInput('');
    setError('');
    void refreshPin();
    void detectClockTampering().then(r => {
      if (r.tampered) setClockWarn(r.detail);
      else setClockWarn('');
    });
  }, [open, refreshPin]);

  /** 倒计时 */
  useEffect(() => {
    if (!open || !expiresAt) return;
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((expiresAt - now) / 1000));
      setRemainingSec(diff);
      if (diff === 0) {
        // PIN 过期，自动刷新
        void refreshPin();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [open, expiresAt, refreshPin]);

  /** 提交校验 */
  const handleSubmit = async () => {
    if (checking || !input) return;
    setChecking(true);
    setError('');
    try {
      const { valid, reason } = await verifyPin(input);
      if (valid) {
        onSuccess();
        setInput('');
      } else {
        setError(reason || 'PIN 错误');
      }
    } catch (e) {
      setError('校验失败：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setChecking(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="panel-gold w-full max-w-sm p-5 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded text-ink-500 hover:text-gold-300 hover:bg-ink-800/50 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-gold-400" />
          <h3 className="text-base font-semibold text-gold-200 tracking-wide">{title}</h3>
        </div>

        {/* 当前有效 PIN 展示区 */}
        <div className="bg-ink-950/60 border border-gold-900/40 rounded-lg p-3 mb-4">
          <div className="text-[11px] text-gold-500/70 mb-1.5 tracking-wide flex items-center gap-1">
            <Clock size={11} />
            当前有效 PIN（{pinSource}）
          </div>
          <div className="flex items-center justify-between gap-2">
            <code className="text-2xl font-mono font-bold text-gold-200 tracking-[0.3em]">
              {loading ? '······' : currentPin}
            </code>
            <button
              onClick={refreshPin}
              disabled={loading}
              className="p-1.5 rounded text-ink-400 hover:text-gold-300 hover:bg-ink-800/50 transition-colors disabled:opacity-40"
              title="刷新 PIN"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="text-[10px] text-ink-500 mt-1.5">
            {remainingSec > 0 ? `${remainingSec}s 后更换` : '正在刷新...'} · 每 {PIN_TTL_SECONDS}s 轮换一次
          </div>
        </div>

        {/* 时钟篡改警告 */}
        {clockWarn && (
          <div className="text-[11px] text-red-400 bg-red-950/30 border border-red-900/50 rounded px-2 py-1.5 mb-3">
            ⚠ {clockWarn}
          </div>
        )}

        {/* 输入区 */}
        <div className="mb-3">
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={input}
            onChange={e => setInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => { if (e.key === 'Enter') void handleSubmit(); }}
            placeholder="输入 6 位 PIN"
            autoFocus
            className="input-field text-center text-lg tracking-[0.4em] font-mono"
          />
        </div>

        {error && (
          <div className="text-[11px] text-red-400 mb-3">{error}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={checking || input.length !== 6}
          className="btn-gold w-full"
        >
          {checking ? '校验中...' : '确认'}
        </button>

        <p className="text-[10px] text-ink-600 mt-3 text-center leading-relaxed">
          PIN 基于网络标准时间生成，用于防止未授权导出档案
        </p>
      </div>
    </div>
  );
}

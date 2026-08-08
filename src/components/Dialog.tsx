import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Info } from 'lucide-react';

interface BaseDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function BaseDialog({ open, onClose, title, children }: BaseDialogProps) {
  if (!open) return null;
  // 使用 Portal 渲染到 document.body，彻底脱离祖先 DOM 树
  // 解决 position:fixed 被祖先 transform/backdrop-filter 限制导致弹窗内嵌的问题
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden relative rounded-xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          boxShadow: '0 20px 50px -10px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 标题栏：固定高度，不被压缩 */}
        <div
          className="flex items-center justify-between p-5 pb-3 shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <h3 className="text-base font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>
        {/* 内容区：独立滚动，适配安卓 WebView */}
        <div
          className="overflow-y-auto flex-1 min-h-0 px-5 pb-5"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  variant?: 'default' | 'danger';
}

export function ConfirmDialog({
  open, onClose, title = '确认操作', message,
  confirmText = '确定', cancelText = '取消',
  onConfirm, variant = 'default'
}: ConfirmDialogProps) {
  return (
    <BaseDialog open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          {variant === 'danger' ? (
            <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
          ) : (
            <Info size={20} className="text-gold-400 shrink-0 mt-0.5" />
          )}
          <p className="text-sm text-ink-300 leading-relaxed whitespace-pre-line">{message}</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost text-sm">{cancelText}</button>
          <button
            onClick={() => { onClose(); onConfirm(); }}
            className={variant === 'danger' ? 'btn-gold-danger text-sm' : 'btn-gold text-sm'}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </BaseDialog>
  );
}

export interface PromptDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value: string) => void;
  inputType?: 'text' | 'password';
  multiline?: boolean;
}

export function PromptDialog({
  open, onClose, title = '输入', message,
  placeholder = '', defaultValue = '',
  confirmText = '确定', cancelText = '取消',
  onConfirm, inputType = 'text', multiline = false
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, defaultValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      onConfirm(value);
      onClose();
    }
  };

  return (
    <BaseDialog open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-ink-400">{message}</p>
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            className="input-field w-full font-serif leading-relaxed"
            rows={4}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={inputType}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="input-field"
          />
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost text-sm">{cancelText}</button>
          <button
            onClick={() => { onClose(); onConfirm(value); }}
            className="btn-gold text-sm"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </BaseDialog>
  );
}

export interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  confirmText?: string;
}

export function AlertDialog({
  open, onClose, title = '提示', message, confirmText = '知道了'
}: AlertDialogProps) {
  return (
    <BaseDialog open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-ink-300 leading-relaxed">{message}</p>
        <div className="flex justify-end">
          <button onClick={onClose} className="btn-gold text-sm">{confirmText}</button>
        </div>
      </div>
    </BaseDialog>
  );
}

export interface ModeSelectDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  onSelect: (mode: 'open' | 'unlock') => void;
}

export function ModeSelectDialog({
  open, onClose, title = '选择小说模式', onSelect
}: ModeSelectDialogProps) {
  if (!open) return null;
  return (
    <BaseDialog open={open} onClose={onClose} title={title}>
      <div className="space-y-3">
        <p className="text-xs text-ink-400">请选择小说的角色关联显示模式</p>
        <button
          onClick={() => { onClose(); onSelect('open'); }}
          className="w-full p-4 rounded-lg border border-gold-700/50 hover:border-gold-500 hover:bg-gold-900/20 transition-all text-left"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-gold-400 font-medium">开放模式</span>
          </div>
          <p className="text-xs text-ink-400">角色名直接高亮显示，点击查看档案</p>
        </button>
        <button
          onClick={() => { onClose(); onSelect('unlock'); }}
          className="w-full p-4 rounded-lg border border-ink-700 hover:border-gold-500 hover:bg-gold-900/20 transition-all text-left"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-gold-400 font-medium">解锁模式</span>
          </div>
          <p className="text-xs text-ink-400">读完后才显示角色关联，防止剧透</p>
        </button>
      </div>
    </BaseDialog>
  );
}

export interface SelectDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  options: { value: string; label: string }[];
  value?: string;
  onSelect: (value: string) => void;
}

export function SelectDialog({
  open, onClose, title = '请选择', options, value, onSelect
}: SelectDialogProps) {
  if (!open) return null;
  return (
    <BaseDialog open={open} onClose={onClose} title={title}>
      <div
        className="space-y-1 max-h-[60vh] overflow-y-auto overflow-x-hidden"
        style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' } as React.CSSProperties}
      >
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => { onClose(); onSelect(opt.value); }}
            className={`w-full flex items-center justify-between p-3 rounded-lg transition-all text-left ${
              value === opt.value
                ? 'bg-gold-900/30 border border-gold-700 text-gold-200'
                : 'border border-transparent text-ink-300 hover:bg-ink-800/50'
            }`}
          >
            <span className={value === opt.value ? 'text-gold-200' : 'text-ink-300'}>
              {opt.label}
            </span>
            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              value === opt.value ? 'border-gold-500 bg-gold-900/50' : 'border-ink-600'
            }`}>
              {value === opt.value && <span className="w-2 h-2 rounded-full bg-gold-500" />}
            </span>
          </button>
        ))}
      </div>
    </BaseDialog>
  );
}

export interface PickerProps {
  value?: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

export function Picker({ value, onChange, options, placeholder = '请选择', className = '' }: PickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full px-4 py-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-gold-700 focus:ring-1 focus:ring-gold-700/50 transition-all flex items-center justify-between text-left ${className}`}
      >
        <span className={selected ? 'text-ink-100' : 'text-ink-500'}>
          {selected?.label || placeholder}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gold-600 shrink-0">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <SelectDialog
        open={open}
        onClose={() => setOpen(false)}
        title={placeholder}
        options={options}
        value={value}
        onSelect={onChange}
      />
    </>
  );
}

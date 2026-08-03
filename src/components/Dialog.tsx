import { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, Info } from 'lucide-react';

interface BaseDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function BaseDialog({ open, onClose, title, children }: BaseDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="panel-gold w-full max-w-md p-5 relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded text-ink-500 hover:text-gold-300 hover:bg-ink-800/50" aria-label="关闭">
          <X size={16} />
        </button>
        <h3 className="text-base font-semibold text-gold-200 tracking-wide mb-4">{title}</h3>
        {children}
      </div>
    </div>
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
            onClick={() => { onConfirm(); onClose(); }}
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
            onClick={() => { onConfirm(value); onClose(); }}
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
          onClick={() => { onSelect('open'); onClose(); }}
          className="w-full p-4 rounded-lg border border-gold-700/50 hover:border-gold-500 hover:bg-gold-900/20 transition-all text-left"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-gold-400 font-medium">开放模式</span>
          </div>
          <p className="text-xs text-ink-400">角色名直接高亮显示，点击查看档案</p>
        </button>
        <button
          onClick={() => { onSelect('unlock'); onClose(); }}
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

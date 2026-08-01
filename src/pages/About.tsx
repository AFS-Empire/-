/**
 * 关于页面
 *
 * 1. 展示版权信息、原创声明、联系方式
 * 2. App 版：连续点击标题 6 次触发调试面板（仅 Dev 构建）
 * 3. Web 版：连续点击标题 5 次触发隐藏密码框，解锁后可导入/导出
 */
import { useState, useRef } from 'react';
import { BookOpen, Shield, Code, AlertTriangle, X, KeyRound, FlaskConical, Lock, CheckCircle2 } from 'lucide-react';
import { CREATOR, CONTACT, COPYRIGHT } from '../lib/watermark';
import { IS_WEB_BUILD } from '../lib/buildTarget';
import { useHiddenUnlock } from '../lib/hiddenUnlock';
// devTools 在 Release/Web 构建时被 alias 替换为 noop，不会包含真实逻辑
import {
  unlockDebug, isDebugUnlocked, setBypassPin, setBypassMachineBinding,
  isPinBypassed, isMachineBindingBypassed, resetDebug,
} from '../debug/devTools';

// App 版调试面板：6 次点击
const DEBUG_TRIGGER_COUNT = 6;
const DEBUG_TRIGGER_WINDOW_MS = 2000;

// Web 版隐藏解锁：5 次点击
const HIDDEN_TRIGGER_COUNT = 5;
const HIDDEN_TRIGGER_WINDOW_MS = 3000;

export default function About() {
  const [clickCount, setClickCount] = useState(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // App 版调试面板
  const [showDebug, setShowDebug] = useState(false);

  // Web 版隐藏解锁
  const [showHiddenPrompt, setShowHiddenPrompt] = useState(false);
  const [hiddenPassword, setHiddenPassword] = useState('');
  const [hiddenMsg, setHiddenMsg] = useState('');
  const isUnlocked = useHiddenUnlock(s => s.isUnlocked);
  const unlock = useHiddenUnlock(s => s.unlock);
  const lock = useHiddenUnlock(s => s.lock);

  /** 标题连续点击触发 */
  const handleTitleClick = () => {
    const targetCount = IS_WEB_BUILD ? HIDDEN_TRIGGER_COUNT : DEBUG_TRIGGER_COUNT;
    const windowMs = IS_WEB_BUILD ? HIDDEN_TRIGGER_WINDOW_MS : DEBUG_TRIGGER_WINDOW_MS;

    const newCount = clickCount + 1;
    setClickCount(newCount);

    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => setClickCount(0), windowMs);

    if (newCount >= targetCount) {
      setClickCount(0);
      if (IS_WEB_BUILD) {
        setShowHiddenPrompt(true);
      } else {
        setShowDebug(true);
      }
    }
  };

  /** Web 版：验证隐藏密码 */
  const handleHiddenUnlock = async () => {
    if (!hiddenPassword) return;
    const ok = await unlock(hiddenPassword);
    if (ok) {
      setHiddenMsg('已解锁 · 导入导出功能已开启');
      setTimeout(() => {
        setShowHiddenPrompt(false);
        setHiddenPassword('');
        setHiddenMsg('');
      }, 1500);
    } else {
      setHiddenMsg('密码错误');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 标题区 */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold-900/30 border border-gold-700 mb-4">
          <BookOpen size={28} className="text-gold-400" />
        </div>
        <h1
          onClick={handleTitleClick}
          className="gold-title text-2xl font-bold cursor-pointer select-none"
          title=""
        >
          奥菲斯帝国档案馆
        </h1>
        {clickCount > 0 && (
          <p className="text-gold-500/40 text-[10px] mt-1">{clickCount}</p>
        )}
      </div>

      {/* 版权信息 */}
      <div className="panel-gold p-5 space-y-3">
        <div className="flex items-center gap-2 text-gold-300">
          <Shield size={16} />
          <h2 className="font-semibold tracking-wide">版权声明</h2>
        </div>
        <p className="text-sm text-ink-300 leading-relaxed">{COPYRIGHT}</p>
        <div className="gold-divider" />
        <div className="text-sm space-y-1.5">
          <div className="flex items-center gap-2 text-ink-400">
            <span className="text-gold-500/70 w-16">作者</span>
            <span className="text-gold-200">{CREATOR}</span>
          </div>
          <div className="flex items-center gap-2 text-ink-400">
            <span className="text-gold-500/70 w-16">联系</span>
            <span className="text-ink-200">{CONTACT}</span>
          </div>
        </div>
      </div>

      {/* 原创警示 */}
      <div className="panel p-5 space-y-2 border-red-900/30">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle size={16} />
          <h2 className="font-semibold tracking-wide">原创警示</h2>
        </div>
        <p className="text-xs text-ink-400 leading-relaxed">
          本软件由 {CREATOR} 独立开发，所有代码、设计、数据模型均受著作权法保护。
          未经授权禁止复制、二次分发、去除原创标记或冒用作者名义发布。
          软件底层已多处分散植入隐形原创标记，导出的档案备份内嵌数字水印，
          作为创作归属的举证依据。任何盗用行为一经发现将依法追究。
        </p>
      </div>

      {/* 技术信息 */}
      <div className="panel p-5 space-y-2">
        <div className="flex items-center gap-2 text-gold-300">
          <Code size={16} />
          <h2 className="font-semibold tracking-wide">技术栈</h2>
        </div>
        <p className="text-xs text-ink-400 leading-relaxed">
          React 18 + TypeScript + Vite + Tailwind CSS v4 + Zustand + IndexedDB
        </p>
        <p className="text-xs text-ink-500">
          数据本地存储 · 无需联网 · 支持 Windows / 安卓 / 浏览器三端
        </p>
      </div>

      {/* ─── App 版调试面板 ─── */}
      {!IS_WEB_BUILD && showDebug && (
        <DebugPanel show={showDebug} onClose={() => setShowDebug(false)} />
      )}

      {/* ─── Web 版隐藏解锁面板 ─── */}
      {IS_WEB_BUILD && showHiddenPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setShowHiddenPrompt(false)}>
          <div className="panel-gold w-full max-w-md p-5 relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowHiddenPrompt(false)}
              className="absolute top-3 right-3 p-1 rounded text-ink-500 hover:text-gold-300 hover:bg-ink-800/50"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Lock size={18} className="text-gold-400" />
              <h3 className="text-base font-semibold text-gold-200 tracking-wide">数据同步</h3>
            </div>

            {!isUnlocked ? (
              <div className="space-y-3">
                <p className="text-xs text-ink-400">输入同步密钥以启用导入/导出功能</p>
                <div className="relative">
                  <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                  <input
                    type="password"
                    value={hiddenPassword}
                    onChange={e => setHiddenPassword(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void handleHiddenUnlock(); }}
                    placeholder="同步密钥"
                    className="input-field pl-9"
                    autoFocus
                  />
                </div>
                <button onClick={handleHiddenUnlock} className="btn-gold w-full">解锁</button>
                {hiddenMsg && <p className="text-[11px] text-red-400">{hiddenMsg}</p>}
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <CheckCircle2 size={36} className="text-green-400 mx-auto" />
                <p className="text-sm text-green-400">{hiddenMsg || '已解锁'}</p>
                <p className="text-xs text-ink-500">导入导出功能已在侧边栏开启</p>
                <button onClick={() => { lock(); setShowHiddenPrompt(false); }} className="btn-ghost w-full text-sm">
                  重新锁定
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Web 版已解锁状态提示 */}
      {IS_WEB_BUILD && isUnlocked && !showHiddenPrompt && (
        <div className="panel p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle2 size={14} />
            <span>数据同步已开启</span>
          </div>
          <button onClick={() => { lock(); }} className="text-xs text-ink-500 hover:text-red-400 transition-colors">
            锁定
          </button>
        </div>
      )}
    </div>
  );
}

/** App 版调试面板（独立组件，Web 版编译时不会渲染） */
function DebugPanel({ show: _show, onClose }: { show: boolean; onClose: () => void }) {
  const [debugKey, setDebugKey] = useState('');
  const [debugMsg, setDebugMsg] = useState('');
  const [bypassPin, setBypassPinState] = useState(isPinBypassed());
  const [bypassMachine, setBypassMachineState] = useState(isMachineBindingBypassed());

  const handleUnlock = async () => {
    if (!debugKey) return;
    const ok = await unlockDebug(debugKey);
    if (ok) {
      setDebugMsg('调试模式已解锁');
      setBypassPinState(isPinBypassed());
      setBypassMachineState(isMachineBindingBypassed());
    } else {
      setDebugMsg('调试密钥错误');
    }
  };

  const handleReset = () => {
    resetDebug();
    setBypassPinState(false);
    setBypassMachineState(false);
    setDebugMsg('已退出调试模式');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="panel-gold w-full max-w-md p-5 relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded text-ink-500 hover:text-gold-300 hover:bg-ink-800/50">
          <X size={16} />
        </button>
        <div className="flex items-center gap-2 mb-4">
          <FlaskConical size={18} className="text-gold-400" />
          <h3 className="text-base font-semibold text-gold-200 tracking-wide">调试面板</h3>
          <span className="text-[10px] text-ink-500 ml-auto">仅开发版可用</span>
        </div>
        {!isDebugUnlocked() ? (
          <div className="space-y-3">
            <p className="text-xs text-ink-400">输入调试密钥以解锁安全旁路</p>
            <div className="relative">
              <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
              <input type="password" value={debugKey} onChange={e => setDebugKey(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleUnlock(); }}
                placeholder="调试密钥" className="input-field pl-9" autoFocus />
            </div>
            <button onClick={handleUnlock} className="btn-gold w-full">解锁</button>
            {debugMsg && <p className="text-[11px] text-ink-500">{debugMsg}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-green-400">✓ 调试模式已激活</p>
            <div className="space-y-2">
              <label className="flex items-center justify-between p-2.5 rounded-lg bg-ink-900/60 border border-ink-700">
                <span className="text-sm text-ink-200">旁路 PIN 校验</span>
                <input type="checkbox" checked={bypassPin}
                  onChange={e => { setBypassPin(e.target.checked); setBypassPinState(e.target.checked); }}
                  className="w-4 h-4 accent-gold-500" />
              </label>
              <label className="flex items-center justify-between p-2.5 rounded-lg bg-ink-900/60 border border-ink-700">
                <span className="text-sm text-ink-200">旁路机器码校验</span>
                <input type="checkbox" checked={bypassMachine}
                  onChange={e => { setBypassMachineBinding(e.target.checked); setBypassMachineState(e.target.checked); }}
                  className="w-4 h-4 accent-gold-500" />
              </label>
            </div>
            <button onClick={handleReset} className="btn-ghost w-full text-sm">退出调试模式</button>
          </div>
        )}
      </div>
    </div>
  );
}

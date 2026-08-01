/**
 * 备份/恢复 工具栏 + 自动备份历史
 *
 * 三端兼容：
 * - 桌面 App（Electron）：IPC 保存到磁盘任意路径 + 自动备份历史
 * - 移动 App（Capacitor）：系统分享面板发到微信/QQ/网盘 + 文件选择器读
 * - 浏览器：a 标签下载 + FileReader 读
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Upload, HardDrive, CheckCircle2, XCircle, History, RotateCcw, Trash2, RefreshCw, Database, Share2 } from 'lucide-react';
import { exportAll, importAll } from '../data/db';
import { useDataStore } from '../store/dataStore';
import { useCommentStore } from '../store/commentStore';
import { useAuthStore } from '../store/authStore';
import { isMobileApp, isMobileBrowser, mobileShareBackup, mobilePickBackupFile, webShareFile } from '../lib/mobile';
import { IS_WEB_BUILD } from '../lib/buildTarget';
import { useHiddenUnlock } from '../lib/hiddenUnlock';
import PinDialog from './PinDialog';

interface AutoBackupItem {
  name: string;
  size: number;
  mtime: number;
  isLatest: boolean;
}

interface AppInfo {
  version: string;
  isPackaged: boolean;
  userDataPath: string;
  appName: string;
  platform: NodeJS.Platform;
  backupDir: string;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function BackupBar() {
  const refresh = useDataStore(s => s.refresh);
  const refreshComments = useCommentStore(s => s.refresh);
  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = currentUser?.role === 'admin';
  // Web 版：隐藏解锁即视为授权（无 PIN/管理员）
  const isUnlocked = useHiddenUnlock(s => s.isUnlocked);
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [autoBackups, setAutoBackups] = useState<AutoBackupItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // PIN 二次校验：备份/恢复前必须通过（App 版专用）
  // 待执行的操作（PIN 通过后执行）
  const [pinOpen, setPinOpen] = useState(false);
  const [pinTitle, setPinTitle] = useState('');
  const pendingAction = useRef<(() => void) | null>(null);

  // 浏览器下载兜底：显示可手动点击的下载链接
  const [downloadLink, setDownloadLink] = useState<{ url: string; name: string } | null>(null);

  /**
   * 操作授权 + 执行
   * - Web 版：检查隐藏解锁状态，已解锁直接执行 action（不要求 PIN）
   * - App 版：检查管理员身份，再走 PIN 二次校验
   */
  const requirePin = (title: string, action: () => void) => {
    if (IS_WEB_BUILD) {
      if (!isUnlocked) {
        showToast('err', '请先在「关于」页面解锁数据同步');
        return;
      }
      action();
      return;
    }
    if (!isAdmin) {
      showToast('err', '仅管理员可执行此操作');
      return;
    }
    setPinTitle(title);
    pendingAction.current = action;
    setPinOpen(true);
  };

  const isDesktop = Boolean(window.archiveApp);
  const isMobile = isMobileApp();

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  /** 刷新自动备份列表 */
  const refreshAutoBackups = useCallback(async () => {
    if (!window.archiveApp) return;
    try {
      const res = await window.archiveApp.listAutoBackups();
      if (res.ok) setAutoBackups(res.items);
    } catch (e) {
      console.error('[listAutoBackups]', e);
    }
  }, []);

  /** 取应用信息 */
  useEffect(() => {
    if (!window.archiveApp) return;
    window.archiveApp.getAppInfo().then((info: AppInfo) => {
      setAppInfo(info);
    }).catch(() => {});
    refreshAutoBackups();
  }, [refreshAutoBackups]);

  /** 备份：导出整个 IndexedDB 全部内容到文件（需 PIN 校验） */
  const handleBackup = () => {
    if (busy) return;
    requirePin('导出档案', doBackup);
  };

  /** 桌面浏览器下载：Blob + a 标签 + 手动链接兜底 */
  const triggerBrowserDownload = (json: string, filename: string) => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 30000);
    setDownloadLink({ url, name: filename });
  };

  const doBackup = async () => {
    setBusy(true);
    try {
      const json = await exportAll();
      const stamp = new Date();
      const y = stamp.getFullYear();
      const m = String(stamp.getMonth() + 1).padStart(2, '0');
      const d = String(stamp.getDate()).padStart(2, '0');
      const hh = String(stamp.getHours()).padStart(2, '0');
      const mm = String(stamp.getMinutes()).padStart(2, '0');
      const defaultName = `奥菲斯档案备份-${y}${m}${d}-${hh}${mm}`;

      if (window.archiveApp) {
        // 桌面 App：走系统保存对话框 → 真正写入磁盘
        const r = await window.archiveApp.saveBackup({ json, defaultName });
        if (!r.ok) {
          if ((r as any).canceled) { setBusy(false); return; }
          showToast('err', (r as any).error || '备份失败');
        } else {
          showToast('ok', `已备份到：${r.path}`);
          refreshAutoBackups();
        }
      } else if (isMobile) {
        // 移动 App：写入 Cache + 系统分享面板（发微信文件传输助手/QQ/网盘）
        const r = await mobileShareBackup(json, `${defaultName}.json`);
        if (!r.ok) showToast('err', r.error || '分享失败');
        else showToast('ok', '已通过系统分享发出');
      } else if (isMobileBrowser() && typeof navigator.share === 'function') {
        // 手机浏览器：优先用 Web Share API（系统分享面板，比 a.click() 下载可靠）
        const blob = new Blob([json], { type: 'application/json' });
        const r = await webShareFile(blob, `${defaultName}.json`);
        if (!r.ok) {
          // 不支持文件分享，回退到 a.click() 下载
          triggerBrowserDownload(json, `${defaultName}.json`);
        } else if (r.shared) {
          showToast('ok', '已通过系统分享发出');
        } else {
          showToast('ok', '已取消分享');
        }
      } else {
        // 桌面浏览器：用 Blob + a 标签下载 + 手动链接兜底
        triggerBrowserDownload(json, `${defaultName}.json`);
        showToast('ok', '已生成下载文件（若未自动下载，请点击下方链接）');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast('err', `备份失败：${msg}`);
    } finally {
      setBusy(false);
    }
  };

  /** 浏览器环境：从文件读（PIN 校验后才真正导入） */
  const handleRestoreBrowser = (file: File | null) => {
    if (!file || busy) return;
    // 文件选择器关闭后，浏览器的 change 事件可能和后续弹窗的点击冲突
    // 延迟一帧再弹 PIN，避免点击穿透导致弹窗秒关
    requestAnimationFrame(() => {
      requirePin('导入档案', async () => {
        setBusy(true);
        try {
          const json = await file.text();
          await importAll(json);
          await Promise.all([refresh(), refreshComments()]);
          showToast('ok', '档案已导入，请刷新页面以查看');
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          showToast('err', `导入失败：${msg}`);
        } finally {
          setBusy(false);
        }
      });
    });
  };

  /** 桌面 App：点击恢复 直接走 IPC 打开文件对话框（需 PIN） */
  const handleRestoreDesktop = () => {
    const app = window.archiveApp;
    if (!app || busy) return;
    requirePin('导入档案', async () => {
      setBusy(true);
      try {
        const r = await app.loadBackup();
        if (!r.ok) {
          if ((r as any).canceled) { setBusy(false); return; }
          showToast('err', (r as any).error || '读取失败');
        } else {
          await importAll(r.json);
          await Promise.all([refresh(), refreshComments()]);
          showToast('ok', `已从 ${r.path} 导入完成`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        showToast('err', `导入失败：${msg}`);
      } finally {
        setBusy(false);
      }
    });
  };

  /** 移动 App：点击恢复 走系统文件选择器（需 PIN） */
  const handleRestoreMobile = () => {
    if (!isMobile || busy) return;
    requirePin('导入档案', async () => {
      setBusy(true);
      try {
        const r = await mobilePickBackupFile();
        if (!r.ok) {
          if ((r as any).canceled) { setBusy(false); return; }
          showToast('err', (r as any).error || '选择失败');
        } else {
          await importAll(r.json);
          await Promise.all([refresh(), refreshComments()]);
          showToast('ok', `已从 ${r.name} 导入`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        showToast('err', `导入失败：${msg}`);
      } finally {
        setBusy(false);
      }
    });
  };

  /** 从自动备份恢复 */
  const handleRestoreAuto = async (name: string) => {
    if (!window.archiveApp || busy) return;
    if (!confirm(`确认从「${name}」恢复？当前所有数据会被该备份覆盖。`)) return;
    setBusy(true);
    try {
      const r = await window.archiveApp.restoreAutoBackup({ name });
      if (!r.ok) {
        showToast('err', (r as any).error || '恢复失败');
      } else {
        await importAll(r.json);
        await Promise.all([refresh(), refreshComments()]);
        showToast('ok', `已从 ${name} 恢复`);
        await refreshAutoBackups();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast('err', `恢复失败：${msg}`);
    } finally {
      setBusy(false);
    }
  };

  /** 删除某份自动备份 */
  const handleDeleteAuto = async (name: string) => {
    if (!window.archiveApp || busy) return;
    if (!confirm(`确认删除备份「${name}」？此操作不可撤销。`)) return;
    setBusy(true);
    try {
      const r = await window.archiveApp.deleteAutoBackup({ name });
      if (!r.ok) {
        showToast('err', (r as any).error || '删除失败');
      } else {
        await refreshAutoBackups();
        showToast('ok', `已删除 ${name}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast('err', `删除失败：${msg}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-[0.15em] text-gold-500/80 flex items-center gap-1.5 px-1">
        <HardDrive size={12} /> 档案导出 / 导入
      </div>

      {/* 数据存储位置（仅桌面版） */}
      {appInfo && (
        <div className="px-2 py-1.5 rounded-md bg-ink-900/40 border border-ink-700/50 text-[10px] text-ink-400 leading-relaxed">
          <div className="flex items-center gap-1 mb-0.5 text-gold-500/70">
            <Database size={10} />
            <span>数据位置</span>
          </div>
          <div className="break-all font-mono">{appInfo.userDataPath}</div>
          <div className="mt-1 text-ink-500">卸载/升级 App 不会自动清空此目录</div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleBackup}
          disabled={busy}
          className="flex-1 min-w-[88px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-gold-900/20 hover:bg-gold-900/40 border border-gold-800/50 text-gold-300 hover:text-gold-200 transition-all text-xs disabled:opacity-50"
          title={isDesktop ? '将完整档案导出到本地文件' : isMobile ? '分享档案 JSON 到其他应用' : '下载档案 JSON 文件'}
        >
          {isMobile ? <Share2 size={14} /> : <Download size={14} />}
          导出
        </button>
        {isDesktop ? (
          <button
            onClick={handleRestoreDesktop}
            disabled={busy}
            className="flex-1 min-w-[88px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-ink-700 hover:border-gold-700/50 text-ink-200 hover:text-gold-300 hover:bg-ink-800/50 transition-all text-xs disabled:opacity-50"
            title="从本地 JSON 文件导入档案"
          >
            <Upload size={14} />
            导入
          </button>
        ) : isMobile ? (
          <button
            onClick={handleRestoreMobile}
            disabled={busy}
            className="flex-1 min-w-[88px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-ink-700 hover:border-gold-700/50 text-ink-200 hover:text-gold-300 hover:bg-ink-800/50 transition-all text-xs disabled:opacity-50"
            title="从文件选择器选 JSON 导入"
          >
            <Upload size={14} />
            导入
          </button>
        ) : (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0] || null;
                handleRestoreBrowser(f);
                if (fileRef.current) fileRef.current.value = '';
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex-1 min-w-[88px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-ink-700 hover:border-gold-700/50 text-ink-200 hover:text-gold-300 hover:bg-ink-800/50 transition-all text-xs disabled:opacity-50"
              title="选择本地 JSON 文件导入"
            >
              <Upload size={14} />
              导入
            </button>
          </>
        )}
      </div>

      {/* 自动备份历史（仅桌面版） */}
      {isDesktop && (
        <div className="space-y-1.5">
          <button
            onClick={() => { setShowHistory(s => !s); refreshAutoBackups(); }}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-ink-800/40 text-[11px] text-ink-300 hover:text-gold-300 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <History size={11} />
              自动备份历史
              {autoBackups.length > 0 && <span className="text-gold-500/70">({autoBackups.length})</span>}
            </span>
            <RefreshCw size={10} className={busy ? 'animate-spin' : ''} />
          </button>

          {showHistory && (
            <div className="space-y-1 max-h-[260px] overflow-y-auto pr-0.5">
              {autoBackups.length === 0 ? (
                <div className="text-[10px] text-ink-500 px-2 py-2 text-center">
                  暂无自动备份。退出 App 或每次保存修改后会自动生成。
                </div>
              ) : (
                autoBackups.map(item => (
                  <div
                    key={item.name}
                    className="group flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-ink-900/40 border border-ink-700/40 hover:border-gold-700/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono text-gold-300/90 truncate">
                          {item.isLatest ? '最新快照' : item.name.replace('auto-', '').replace('.json', '')}
                        </span>
                        {item.isLatest && (
                          <span className="text-[9px] px-1 py-0 rounded bg-gold-900/40 text-gold-400/90 border border-gold-700/40">LIVE</span>
                        )}
                      </div>
                      <div className="text-[9px] text-ink-500 flex gap-2">
                        <span>{formatTime(item.mtime)}</span>
                        <span>{formatSize(item.size)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleRestoreAuto(item.name)}
                        disabled={busy}
                        title="从该备份恢复"
                        className="p-1 rounded hover:bg-gold-900/30 text-ink-400 hover:text-gold-300"
                      >
                        <RotateCcw size={11} />
                      </button>
                      {!item.isLatest && (
                        <button
                          onClick={() => handleDeleteAuto(item.name)}
                          disabled={busy}
                          title="删除该备份"
                          className="p-1 rounded hover:bg-red-900/30 text-ink-400 hover:text-red-400"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          <div className="text-[9px] text-ink-600 px-1 leading-snug">
            · 退出 App 时自动生成带时间戳备份<br />
            · 每小时最多写 1 份新备份，平时只更新"最新快照"<br />
            · 自动保留最近 30 份，超出自动清理最旧
          </div>
        </div>
      )}

      {toast && (
        <div className="animate-fade-in text-[11px] rounded-md px-2 py-1.5 border flex items-center gap-1.5"
             style={{ background: toast.type === 'ok' ? 'rgba(80,200,120,0.1)' : 'rgba(220,70,70,0.1)', borderColor: toast.type === 'ok' ? 'rgba(80,200,120,0.4)' : 'rgba(220,70,70,0.4)' }}>
          {toast.type === 'ok'
            ? <CheckCircle2 size={12} style={{ color: '#77dd77' }} />
            : <XCircle size={12} style={{ color: '#dd5555' }} />}
          <span className="truncate" style={{ color: toast.type === 'ok' ? '#aaddaa' : '#ddaaaa' }}>{toast.msg}</span>
        </div>
      )}

      {/* 浏览器下载兜底链接（自动下载被拦截时手动点） */}
      {downloadLink && (
        <div className="animate-fade-in rounded-md px-2 py-2 border border-gold-700/50 bg-gold-900/20">
          <div className="text-[10px] text-gold-500/80 mb-1 flex items-center gap-1">
            <Download size={10} />
            手动下载（若未自动触发）
          </div>
          <a
            href={downloadLink.url}
            download={downloadLink.name}
            target="_blank"
            rel="noopener"
            className="block text-[11px] text-gold-300 hover:text-gold-100 underline break-all"
          >
            {downloadLink.name}
          </a>
          <button
            onClick={() => setDownloadLink(null)}
            className="mt-1 text-[10px] text-ink-500 hover:text-ink-300"
          >
            关闭
          </button>
        </div>
      )}

      {/* PIN 二次校验弹窗 */}
      <PinDialog
        open={pinOpen}
        title={pinTitle}
        onClose={() => { setPinOpen(false); pendingAction.current = null; }}
        onSuccess={() => {
          setPinOpen(false);
          const action = pendingAction.current;
          pendingAction.current = null;
          if (action) action();
        }}
      />
    </div>
  );
}

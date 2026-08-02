/**
 * 预加载脚本 —— 安全桥接层
 *
 * 渲染层（React）运行在沙箱里，没有 Node 权限；
 * 只通过 contextBridge 暴露一组极小、明确的 IPC 通道给 UI 调用。
 * 未来如果要加能力（托盘、通知、协议）都在这里注册。
 */
import { contextBridge, ipcRenderer } from 'electron';

type BackupSaveResult =
  | { ok: true; path: string }
  | { ok: false; canceled: true }
  | { ok: false; error: string };

type BackupLoadResult =
  | { ok: true; json: string; path: string }
  | { ok: false; canceled: true }
  | { ok: false; error: string };

interface AppInfo {
  version: string;
  isPackaged: boolean;
  userDataPath: string;
  appName: string;
  platform: NodeJS.Platform;
  backupDir: string;
}

interface SyncStatus {
  enabled: boolean;
  message: string;
}

interface AutoBackupItem {
  name: string;
  size: number;
  mtime: number;
  isLatest: boolean;
}

interface AutoBackupListResult {
  ok: true;
  dir: string;
  items: AutoBackupItem[];
}

interface AutoBackupRestoreResult {
  ok: true;
  json: string;
  path: string;
}

interface CleanupItemInfo {
  key: string;
  label: string;
  size: number;
  count?: number;
  safe: boolean;
}
interface CleanupProtectedInfo {
  key: string;
  label: string;
  reason: string;
}
interface CleanupInfoResult {
  ok: true;
  userDataPath: string;
  backupDir: string;
  items: CleanupItemInfo[];
  protected: CleanupProtectedInfo[];
}
interface CleanupExecCleared {
  key: string;
  count?: number;
  size?: number;
  note?: string;
}

/** 暴露给 UI 的 API（window.archiveApp） */
const api = {
  /** 是否已处于 Electron 环境（否则就是纯浏览器访问） */
  isDesktop: true,

  /** 把渲染层生成的完整 JSON 备份保存到用户选择的磁盘路径 */
  saveBackup(args: { json: string; defaultName?: string }): Promise<BackupSaveResult> {
    return ipcRenderer.invoke('backup:save', args);
  },

  /** 从用户选择的磁盘路径读取备份 JSON（返回到渲染层再解析） */
  loadBackup(): Promise<BackupLoadResult> {
    return ipcRenderer.invoke('backup:load');
  },

  /** 推送一份自动快照（节流，主进程按需写时间戳） */
  pushAutoSnapshot(args: { json: string }): Promise<{ ok: true }> {
    return ipcRenderer.invoke('backup:auto-snapshot', args);
  },

  /** 退出前推送最终快照（强制带时间戳） */
  pushFinalSnapshot(args: { json: string }): Promise<{ ok: true }> {
    return ipcRenderer.invoke('backup:final-snapshot', args);
  },

  /** 列出所有自动备份 */
  listAutoBackups(): Promise<AutoBackupListResult> {
    return ipcRenderer.invoke('backup:list-auto');
  },

  /** 从指定自动备份恢复 */
  restoreAutoBackup(args: { name: string }): Promise<AutoBackupRestoreResult | { ok: false; error: string }> {
    return ipcRenderer.invoke('backup:restore-auto', args);
  },

  /** 删除某个自动备份（latest 不可删） */
  deleteAutoBackup(args: { name: string }): Promise<{ ok: true } | { ok: false; error: string }> {
    return ipcRenderer.invoke('backup:delete-auto', args);
  },

  /** 取应用基本信息（版本 / 数据目录路径，用于设置页展示） */
  getAppInfo(): Promise<AppInfo> {
    return ipcRenderer.invoke('app:info');
  },

  /** 多人实时同步状态（端口预留，暂未启用） */
  getSyncStatus(): Promise<SyncStatus> {
    return ipcRenderer.invoke('sync:status');
  },

  /** 监听主进程"准备退出"事件，渲染层应立即推送最终快照 */
  onPrepareQuit(cb: () => void): void {
    ipcRenderer.on('app:prepare-quit', () => cb());
  },

  // —— 系统管理：垃圾清理 + 打开文件夹 ——
  /** 获取可清理项目清单、各项目大小、以及红线禁止清理的项目说明 */
  getCleanupInfo(): Promise<CleanupInfoResult> {
    return ipcRenderer.invoke('system:cleanup-info');
  },
  /** 执行清理（传入白名单 key 数组）；永远不传受保护的 key（主进程也不处理） */
  executeCleanup(args: { keys: string[] }): Promise<{ ok: boolean; error?: string | null; cleared: CleanupExecCleared[] }> {
    return ipcRenderer.invoke('system:cleanup-execute', args);
  },
  /** 用系统文件管理器打开指定路径（打开"你的数据存在哪"） */
  openPath(args: { path: string }): Promise<{ ok: boolean; error?: string | null }> {
    return ipcRenderer.invoke('system:open-path', args);
  },
};

// 只在有 contextBridge 时暴露（正常 Electron 环境必然存在）
if (typeof contextBridge !== 'undefined') {
  contextBridge.exposeInMainWorld('archiveApp', api);
}

export type ArchiveAppAPI = typeof api;

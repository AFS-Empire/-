/**
 * Electron 主进程 —— 奥菲斯帝国档案馆
 *
 * 职责：
 * 1. 创建应用窗口
 * 2. 决定数据存放目录（app.getPath('userData') —— 系统用户目录，重装系统/卸载都不会被自动清空，数据永久存本地）
 * 3. IPC：把渲染层传来的备份 JSON 写入硬盘任意位置 / 从硬盘任意位置读 JSON 返回给渲染层
 *    （真正的安全导出，不依赖浏览器下载）
 * 4. 自动备份：渲染层每次数据变化推送快照 → 主进程落盘 latest.json + 退出时写时间戳备份
 *    保留最近 30 份时间戳备份，自动清理更老的
 * 5. 预留 websocket 启动入口（未来多人实时同步时接）
 */
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Menu,
  type SaveDialogOptions,
  type OpenDialogOptions,
} from 'electron';

const isDev = process.env.NODE_ENV === 'development';

/** 自动备份保留份数（超出自动清理最旧的） */
const AUTO_BACKUP_KEEP = 30;
/** 两次时间戳备份之间最小间隔（毫秒）—— 避免短时间内频繁写新文件 */
const AUTO_BACKUP_MIN_INTERVAL = 60 * 60 * 1000; // 1 小时

/** 自动备份目录 */
function autoBackupDir(): string {
  return path.join(app.getPath('userData'), 'backups');
}
/** latest 快照路径（每次覆盖，保证"最近一次完整数据"始终可读） */
function latestSnapshotPath(): string {
  return path.join(autoBackupDir(), 'latest.json');
}

/** 渲染层 Vite 开发服务器地址（dev） 或 本地 dist 打包路径（prod） */
function getRendererUrl(): string {
  if (isDev) return 'http://localhost:5173';
  return `file://${path.join(__dirname, '..', 'dist', 'index.html')}`;
}

/** 资源文件目录（生产环境位于 asar 外的 resources 或 asar 内，统一用 app.isPackaged 判断） */
function resolvePublicAsset(relPath: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath || path.join(__dirname, '..'), 'public', relPath);
  }
  return path.join(app.getAppPath(), 'public', relPath);
}

/** 确保目录存在（同步创建） */
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: '#0d0d0f',
    title: '奥菲斯帝国档案馆',
    autoHideMenuBar: true,
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,           // 强开：渲染层无法直接 require Node
      sandbox: true,                    // 强安全
      nodeIntegration: false,           // 强关：渲染层没有 Node 能力
      webSecurity: true,
      spellcheck: false,
    },
    icon: resolvePublicAsset('favicon.svg'),
  });

  // 外链用系统默认浏览器打开，不在 app 里开新窗
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 菜单栏：极简（macOS 保留必要项，其余平台隐藏）
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
        { label: '编辑', submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
        { label: '视图', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] },
      ])
    );
  } else {
    Menu.setApplicationMenu(null);
  }

  // 初始加载
  const url = getRendererUrl();
  if (isDev) {
    mainWindow.loadURL(url).catch(err => console.error('[loadURL dev]', err));
  } else {
    mainWindow.loadURL(url).catch(err => console.error('[loadURL prod]', err));
  }

  // 开发态自动打开 DevTools 方便调试
  if (isDev) {
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============ IPC：备份 / 恢复 ============
// 原则：文件 IO 全部在主进程做，渲染层只拿结果。
// 这里不硬编码只支持 JSON 格式，未来接入二进制图片/富文本导出时可扩展。

/**
 * 主进程里集中写入备份文件
 * @param payload.json 完整内容字符串（由渲染层生成）
 * @param payload.defaultName 默认文件名（不含后缀）
 */
ipcMain.handle('backup:save', async (_event, payload: { json: string; defaultName?: string }) => {
  if (!mainWindow) return { ok: false, error: '窗口不存在' };
  const stamp = new Date();
  const y = stamp.getFullYear();
  const m = String(stamp.getMonth() + 1).padStart(2, '0');
  const d = String(stamp.getDate()).padStart(2, '0');
  const def = payload.defaultName ? payload.defaultName : `worldarchive-backup-${y}${m}${d}`;
  const opts: SaveDialogOptions = {
    title: '导出档案备份',
    defaultPath: `${def}.json`,
    filters: [{ name: '档案备份 JSON', extensions: ['json'] }, { name: '所有文件', extensions: ['*'] }],
  };
  const res = await dialog.showSaveDialog(mainWindow, opts);
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  try {
    // 路径规范化 + 允许目录白名单（用户选择的任意路径本身就是用户意图，这里不额外限制）
    const normalized = path.normalize(res.filePath);
    ensureDir(path.dirname(normalized));
    fs.writeFileSync(normalized, payload.json, 'utf-8');
    return { ok: true, path: normalized };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
});

/** 主进程里集中读取备份文件 */
ipcMain.handle('backup:load', async (_event) => {
  if (!mainWindow) return { ok: false, error: '窗口不存在' };
  const opts: OpenDialogOptions = {
    title: '导入档案备份',
    properties: ['openFile'],
    filters: [{ name: '档案备份 JSON', extensions: ['json'] }, { name: '所有文件', extensions: ['*'] }],
  };
  const res = await dialog.showOpenDialog(mainWindow, opts);
  if (res.canceled || res.filePaths.length === 0) return { ok: false, canceled: true };
  try {
    const normalized = path.normalize(res.filePaths[0]);
    const json = fs.readFileSync(normalized, 'utf-8');
    return { ok: true, json, path: normalized };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
});

/** 返回应用信息（版本 / 数据目录路径 / 是否打包） —— UI 里展示给用户看数据存在哪 */
ipcMain.handle('app:info', () => {
  return {
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    userDataPath: app.getPath('userData'),
    appName: app.getName(),
    platform: process.platform,
    backupDir: autoBackupDir(),
  };
});

// ============ 自动备份 ============

/** 内存里记最近一次写时间戳备份的时刻，用于节流 */
let lastAutoStampAt = 0;

/** 写一份带时间戳的快照；按节流规则可能只更新 latest */
function writeAutoSnapshot(json: string, opts: { forceStamp?: boolean } = {}): void {
  try {
    const dir = autoBackupDir();
    ensureDir(dir);
    // 永远更新 latest（保证"最近一次完整数据"始终在磁盘）
    fs.writeFileSync(latestSnapshotPath(), json, 'utf-8');
    // 是否额外写一份带时间戳的
    const now = Date.now();
    const needStamp = opts.forceStamp || (now - lastAutoStampAt > AUTO_BACKUP_MIN_INTERVAL);
    if (needStamp) {
      const d = new Date(now);
      const p = (n: number) => String(n).padStart(2, '0');
      const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
      fs.writeFileSync(path.join(dir, `auto-${ts}.json`), json, 'utf-8');
      lastAutoStampAt = now;
      // 清理超出保留数的旧备份
      cleanOldAutoBackups();
    }
  } catch (e) {
    console.error('[auto-backup] write failed', e);
  }
}

/** 列出自动备份目录，按时间倒序返回 */
function listAutoBackups(): Array<{ name: string; size: number; mtime: number; isLatest: boolean }> {
  const dir = autoBackupDir();
  if (!fs.existsSync(dir)) return [];
  const out: Array<{ name: string; size: number; mtime: number; isLatest: boolean }> = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const full = path.join(dir, name);
    try {
      const stat = fs.statSync(full);
      out.push({ name, size: stat.size, mtime: stat.mtimeMs, isLatest: name === 'latest.json' });
    } catch {
      // 跳过无法访问的文件
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

/** 保留最近 AUTO_BACKUP_KEEP 份时间戳备份（latest.json 不计入） */
function cleanOldAutoBackups(): void {
  const all = listAutoBackups().filter(b => !b.isLatest);
  if (all.length <= AUTO_BACKUP_KEEP) return;
  const toDelete = all.slice(AUTO_BACKUP_KEEP);
  for (const f of toDelete) {
    try { fs.unlinkSync(path.join(autoBackupDir(), f.name)); } catch { /* 忽略 */ }
  }
}

/** 渲染层每次数据变化推送快照 → 主进程落盘 */
ipcMain.handle('backup:auto-snapshot', (_event, payload: { json: string }) => {
  writeAutoSnapshot(payload.json, { forceStamp: false });
  return { ok: true };
});

/** 列出所有自动备份（含 latest + 历史时间戳） */
ipcMain.handle('backup:list-auto', () => {
  return { ok: true, dir: autoBackupDir(), items: listAutoBackups() };
});

/** 从指定自动备份文件读取 JSON 返回给渲染层 */
ipcMain.handle('backup:restore-auto', (_event, payload: { name: string }) => {
  try {
    // 路径规范化 + 只允许读 autoBackupDir 下的文件（防穿越）
    const dir = autoBackupDir();
    const full = path.normalize(path.join(dir, payload.name));
    if (!full.startsWith(dir)) return { ok: false, error: '非法路径' };
    if (!fs.existsSync(full)) return { ok: false, error: '备份文件不存在' };
    const json = fs.readFileSync(full, 'utf-8');
    return { ok: true, json, path: full };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
});

/** 删除某个自动备份（用户在 UI 上手动清理） */
ipcMain.handle('backup:delete-auto', (_event, payload: { name: string }) => {
  try {
    const dir = autoBackupDir();
    const full = path.normalize(path.join(dir, payload.name));
    if (!full.startsWith(dir)) return { ok: false, error: '非法路径' };
    if (payload.name === 'latest.json') return { ok: false, error: 'latest 不可删除' };
    if (fs.existsSync(full)) fs.unlinkSync(full);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
});

// ============ 未来多人同步预留入口 ============
// 此处保留一个 IPC 钩子，将来接入 WebSocket 服务端/客户端时，
// 把同步层的启停/状态查询挂到这里即可，无需动 UI 代码。
ipcMain.handle('sync:status', () => {
  return { enabled: false, message: '多人实时同步端口已预留，暂未启用' };
});

// ============ App 生命周期 ============
app.whenReady().then(() => {
  // 确保数据备份目录（app.getPath('userData') 下的 backups 子目录）存在
  ensureDir(path.join(app.getPath('userData'), 'backups'));

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  // macOS 常规做法：app 留在 dock 里
  if (process.platform !== 'darwin') app.quit();
});

// 退出前：通知渲染层做最后一次快照推送（带时间戳），等它返回后再 quit
let pendingSnapshot = false;
app.on('before-quit', (e) => {
  if (pendingSnapshot) return; // 已经等过一轮，直接放行
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (!win) return;
  // 让渲染层立即 exportAll 并通过 IPC 推过来（forceStamp=true）
  // 设置一个最多 1.5s 的超时兜底，避免渲染层卡死导致无法退出
  pendingSnapshot = true;
  e.preventDefault();
  win.webContents.send('app:prepare-quit');
  const timer = setTimeout(() => {
    app.quit();
  }, 1500);
  // 渲染层推送完快照后，主进程会主动 quit（见 backup:auto-snapshot 内的 forceStamp 分支不需要再 quit）
  // 这里再补一个保险：2 秒后无论渲染层有没有响应都退出
  setTimeout(() => {
    clearTimeout(timer);
    app.quit();
  }, 2000);
});

// 渲染层在退出前会以 forceStamp 推送最终快照
ipcMain.handle('backup:final-snapshot', (_event, payload: { json: string }) => {
  writeAutoSnapshot(payload.json, { forceStamp: true });
  pendingSnapshot = false;
  // 给一点时间让 fs.writeFileSync 完成，然后退出
  setTimeout(() => app.quit(), 100);
  return { ok: true };
});

// 渲染层崩溃白屏兜底：记录错误
app.on('web-contents-created', (_e, wc) => {
  wc.on('render-process-gone', (_ev, details) => {
    console.error('[render-process-gone]', details);
  });
});

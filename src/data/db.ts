import { openDB, type IDBPDatabase } from 'idb';
import type { AnyEntry, Era, CustomSection, User, Comment } from '../types';
import { SECTION_PREFIX } from '../types';

const DB_NAME = 'worldarchive';
const DB_VERSION = 3;

// localStorage 兜底备份键 —— IndexedDB 被意外清空时从此恢复
const BACKUP_KEY = 'worldarchive_backup_v1';
// 备份最大体积（localStorage 单 key 通常 5MB，留 1MB 余量给其它数据）
const BACKUP_MAX_BYTES = 4_000_000;
// 备份写入节流：避免每次 save 都写满 localStorage
let backupTimer: ReturnType<typeof setTimeout> | null = null;

let dbInstance: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 条目主表 — 所有板块共用
      if (!db.objectStoreNames.contains('entries')) {
        const store = db.createObjectStore('entries', { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('title', 'title', { unique: false });
      }
      // 纪元表
      if (!db.objectStoreNames.contains('eras')) {
        const store = db.createObjectStore('eras', { keyPath: 'id' });
        store.createIndex('order', 'order', { unique: false });
      }
      // 自定义分类表
      if (!db.objectStoreNames.contains('customSections')) {
        db.createObjectStore('customSections', { keyPath: 'id' });
      }
      // 用户表
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'username' });
      }
      // 设置表（键值对）
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
      // 评论表（v2 新增）
      if (!db.objectStoreNames.contains('comments')) {
        const store = db.createObjectStore('comments', { keyPath: 'id' });
        store.createIndex('targetCode', 'targetCode', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      // 小说：书籍（v3 新增）
      if (!db.objectStoreNames.contains('novelBooks')) {
        db.createObjectStore('novelBooks', { keyPath: 'id' });
      }
      // 小说：分卷（v3 新增）
      if (!db.objectStoreNames.contains('novelVolumes')) {
        const store = db.createObjectStore('novelVolumes', { keyPath: 'id' });
        store.createIndex('bookId', 'bookId', { unique: false });
      }
      // 小说：章节（v3 新增）
      if (!db.objectStoreNames.contains('novelChapters')) {
        const store = db.createObjectStore('novelChapters', { keyPath: 'id' });
        store.createIndex('bookId', 'bookId', { unique: false });
        store.createIndex('volumeId', 'volumeId', { unique: false });
      }
      // 小说：阅读进度（v3 新增）
      if (!db.objectStoreNames.contains('novelProgress')) {
        db.createObjectStore('novelProgress', { keyPath: 'bookId' });
      }
    },
  });
  return dbInstance;
}

// ============ 条目 CRUD ============
export async function getAllEntries(): Promise<AnyEntry[]> {
  const db = await getDB();
  return db.getAll('entries');
}

export async function getEntriesByType(type: string): Promise<AnyEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('entries', 'type', type);
}

export async function getEntry(id: string): Promise<AnyEntry | undefined> {
  const db = await getDB();
  return db.get('entries', id);
}

export async function saveEntry(entry: AnyEntry): Promise<void> {
  const db = await getDB();
  entry.updatedAt = Date.now();
  await db.put('entries', entry);
  // 自动创建反向关联
  await syncReverseLinks(entry);
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('entries', id);
  // 清理其他条目中指向此条目的关联
  const all = await getAllEntries();
  for (const e of all) {
    if (e.links.some(l => l.id === id)) {
      e.links = e.links.filter(l => l.id !== id);
      await db.put('entries', e);
    }
  }
}

/** 反向关联同步：A 关联了 B，则 B 也自动关联 A */
async function syncReverseLinks(entry: AnyEntry): Promise<void> {
  const db = await getDB();
  for (const link of entry.links) {
    const target = await db.get('entries', link.id) as AnyEntry | undefined;
    if (!target) continue;
    const reverseExists = target.links.some(l => l.id === entry.id);
    if (!reverseExists) {
      target.links.push({
        id: entry.id,
        type: entry.type,
        title: entry.title,
        relation: '被关联',
      });
      await db.put('entries', target);
    }
  }
}

// ============ 纪元 CRUD ============
export async function getAllEras(): Promise<Era[]> {
  const db = await getDB();
  const eras = await db.getAll('eras');
  return eras.sort((a, b) => a.order - b.order);
}

export async function saveEra(era: Era): Promise<void> {
  const db = await getDB();
  await db.put('eras', era);
}

export async function deleteEra(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('eras', id);
}

// ============ 自定义分类 CRUD ============
export async function getCustomSections(): Promise<CustomSection[]> {
  const db = await getDB();
  return db.getAll('customSections');
}

export async function saveCustomSection(section: CustomSection): Promise<void> {
  const db = await getDB();
  await db.put('customSections', section);
}

export async function deleteCustomSection(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('customSections', id);
}

// ============ 用户 ============
export async function getUser(username: string): Promise<User | undefined> {
  const db = await getDB();
  return db.get('users', username);
}

export async function saveUser(user: User): Promise<void> {
  const db = await getDB();
  await db.put('users', user);
}

export async function getAllUsers(): Promise<User[]> {
  const db = await getDB();
  return db.getAll('users');
}

// ============ 设置 ============
export async function getSetting(key: string): Promise<any> {
  const db = await getDB();
  return db.get('settings', key);
}

export async function setSetting(key: string, value: any): Promise<void> {
  const db = await getDB();
  await db.put('settings', value, key);
}

// ============ 导入导出 ============

/**
 * 导出全部数据（含小说）为带签名的 JSON
 * @param privateSalt 私有盐值（仅 App 端传入，网页端不调用此函数）
 */
export async function exportAll(privateSalt?: string): Promise<string> {
  const db = await getDB();
  const entries = await db.getAll('entries');
  const eras = await db.getAll('eras');
  const customSections = await db.getAll('customSections');
  const users = await db.getAll('users');
  const settings: Record<string, any> = {};
  const keys = await db.getAllKeys('settings');
  for (const k of keys) {
    settings[String(k)] = await db.get('settings', k);
  }
  // 小说数据
  const novelBooks = await db.getAll('novelBooks');
  const novelVolumes = await db.getAll('novelVolumes');
  const novelChapters = await db.getAll('novelChapters');
  const novelProgress = await db.getAll('novelProgress');

  // 构建签名 payload（key 顺序必须与 hiddenUnlock.buildSignPayload 一致）
  const { buildSignPayload, sha256Hex } = await import('../lib/hiddenUnlock');
  const payload = buildSignPayload({ entries, eras, customSections, users, settings, novelBooks, novelVolumes, novelChapters, novelProgress });
  const sign = privateSalt ? await sha256Hex(payload + privateSalt) : '';

  // 嵌入隐形数字水印（创作者署名），永久写入备份文件
  const { buildExportWatermark } = await import('../lib/watermark');
  const watermark = buildExportWatermark();
  return JSON.stringify({
    entries, eras, customSections, users, settings,
    novelBooks, novelVolumes, novelChapters, novelProgress,
    sign,
    exportDate: new Date().toISOString(),
    ...watermark,
  }, null, 2);
}

/**
 * 导入全部数据（含小说）
 * 注意：签名校验由调用方（BackupBar）在调用前完成
 */
export async function importAll(json: string): Promise<void> {
  const data = JSON.parse(json);
  // 校验水印（仅记录日志，不阻断导入）
  const { verifyImportWatermark } = await import('../lib/watermark');
  const wm = verifyImportWatermark(data);
  if (!wm.hasWatermark) {
    console.warn('[import] 导入的备份未包含本项目水印，可能来自第三方或旧版本');
  } else if (wm.author) {
    console.info(`[import] 水印校验通过：作者 ${wm.author}`);
  }
  const db = await getDB();
  const storeNames = ['entries', 'eras', 'customSections', 'users', 'settings', 'novelBooks', 'novelVolumes', 'novelChapters', 'novelProgress'];
  const tx = db.transaction(storeNames, 'readwrite');
  // 清空旧数据
  await Promise.all([
    tx.objectStore('entries').clear(),
    tx.objectStore('eras').clear(),
    tx.objectStore('customSections').clear(),
    tx.objectStore('novelBooks').clear(),
    tx.objectStore('novelVolumes').clear(),
    tx.objectStore('novelChapters').clear(),
    tx.objectStore('novelProgress').clear(),
  ]);
  // 写入新数据
  if (data.entries) for (const e of data.entries) await tx.objectStore('entries').put(e);
  if (data.eras) for (const e of data.eras) await tx.objectStore('eras').put(e);
  if (data.customSections) for (const s of data.customSections) await tx.objectStore('customSections').put(s);
  if (data.users) for (const u of data.users) await tx.objectStore('users').put(u);
  if (data.settings) for (const [k, v] of Object.entries(data.settings)) await tx.objectStore('settings').put(v, k);
  if (data.novelBooks) for (const b of data.novelBooks) await tx.objectStore('novelBooks').put(b);
  if (data.novelVolumes) for (const v of data.novelVolumes) await tx.objectStore('novelVolumes').put(v);
  if (data.novelChapters) for (const c of data.novelChapters) await tx.objectStore('novelChapters').put(c);
  if (data.novelProgress) for (const p of data.novelProgress) await tx.objectStore('novelProgress').put(p);
  await tx.done;
}

/** 生成唯一 ID */
export function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// 注：密码哈希已迁移至 src/lib/crypto.ts（PBKDF2-SHA256 + 随机盐）
// 此处旧的简单哈希函数已删除，避免被误用

// ============ 评论 CRUD ============
export async function getAllComments(): Promise<Comment[]> {
  const db = await getDB();
  const comments = await db.getAll('comments');
  return comments.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getCommentsByTarget(targetCode: string): Promise<Comment[]> {
  const db = await getDB();
  const comments = await db.getAllFromIndex('comments', 'targetCode', targetCode);
  return comments.sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveComment(comment: Comment): Promise<void> {
  const db = await getDB();
  await db.put('comments', comment);
}

export async function deleteComment(id: string): Promise<void> {
  const db = await getDB();
  // 同时删除子回复
  const all = await getAllComments();
  const toDelete = [id, ...all.filter(c => c.parentId === id).map(c => c.id)];
  for (const did of toDelete) await db.delete('comments', did);
}

export async function togglePinComment(id: string): Promise<void> {
  const db = await getDB();
  const c = await db.get('comments', id) as Comment | undefined;
  if (c) {
    c.isPinned = !c.isPinned;
    await db.put('comments', c);
  }
}

// ============ 编号辅助 ============
/** 获取条目的编号（基于其在同类型中的排序位置） */
export function getEntryCode(entries: AnyEntry[], entryId: string): string {
  const entry = entries.find(e => e.id === entryId);
  if (!entry) return 'UNKNOWN';
  const sameType = entries
    .filter(e => e.type === entry.type)
    .sort((a, b) => a.createdAt - b.createdAt);
  const index = sameType.findIndex(e => e.id === entryId);
  if (index === -1) return 'UNKNOWN';
  const prefix = SECTION_PREFIX[entry.type] || 'ITEM';
  return `${prefix}-${String(index + 1).padStart(3, '0')}`;
}

// ============ localStorage 兜底备份 ============
// 策略：每次写入操作完成后节流 500ms 把全库快照写入 localStorage；
//       应用启动时若 IndexedDB 是空的但 localStorage 有备份，自动恢复。
//       localStorage 比 IndexedDB 更难被浏览器/容器意外清空，作为最后防线。
//       评论量大时不参与备份（评论是衍生数据，恢复 entries/eras 即可）。

/** 把当前 IndexedDB 全库快照写入 localStorage（节流 500ms） */
export function scheduleBackup(): void {
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(async () => {
    backupTimer = null;
    try {
      const db = await getDB();
      const [entries, eras, customSections, users] = await Promise.all([
        db.getAll('entries'),
        db.getAll('eras'),
        db.getAll('customSections'),
        db.getAll('users'),
      ]);
      const snapshot = JSON.stringify({
        entries, eras, customSections, users,
        backupAt: Date.now(),
      });
      // 体积超限就跳过本次（保留旧备份比写半截强）
      if (snapshot.length > BACKUP_MAX_BYTES) {
        console.warn('[backup] 快照体积超限，跳过写入 localStorage，请尽快导出 JSON 备份');
        return;
      }
      localStorage.setItem(BACKUP_KEY, snapshot);
    } catch (e) {
      console.error('[backup] 写入 localStorage 失败', e);
    }
  }, 500);
}

/** 应用启动时调用：若 IndexedDB 全空但 localStorage 有备份，自动恢复 */
export async function restoreFromBackupIfNeeded(): Promise<boolean> {
  try {
    const db = await getDB();
    const [entryCount, eraCount] = await Promise.all([
      db.count('entries'),
      db.count('eras'),
    ]);
    // IndexedDB 有数据，不需要恢复
    if (entryCount > 0 || eraCount > 0) return false;

    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return false;

    const data = JSON.parse(raw) as {
      entries?: AnyEntry[];
      eras?: Era[];
      customSections?: CustomSection[];
      users?: User[];
      backupAt?: number;
    };
    if (!data.entries?.length && !data.eras?.length) return false;

    // 恢复到 IndexedDB
    const tx = db.transaction(['entries', 'eras', 'customSections', 'users'], 'readwrite');
    if (data.entries) for (const e of data.entries) await tx.objectStore('entries').put(e);
    if (data.eras) for (const e of data.eras) await tx.objectStore('eras').put(e);
    if (data.customSections) for (const s of data.customSections) await tx.objectStore('customSections').put(s);
    if (data.users) for (const u of data.users) await tx.objectStore('users').put(u);
    await tx.done;

    console.info('[backup] 已从 localStorage 自动恢复', {
      entries: data.entries?.length || 0,
      eras: data.eras?.length || 0,
      backupAt: data.backupAt ? new Date(data.backupAt).toLocaleString() : 'unknown',
    });
    return true;
  } catch (e) {
    console.error('[backup] 从 localStorage 恢复失败', e);
    return false;
  }
}


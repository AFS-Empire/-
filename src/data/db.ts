import { openDB, type IDBPDatabase } from 'idb';
import type { AnyEntry, Era, CustomSection, User, Comment } from '../types';
import { SECTION_PREFIX } from '../types';
import { backupStorage } from '../lib/storage';

const DB_NAME = 'worldarchive';
const DB_VERSION = 3;

// 档案备份存储键（走 backupStorage 独立分区）
const BACKUP_KEY = 'snapshot_v1';
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
 * 导出全部数据（含小说）为 v2 加密 JSON
 *
 * 格式（v2）：
 * {
 *   v: 2, encrypted: true,
 *   iv, ciphertext, sign,           // 加密主体 + 签名（角色/时间线/小说正文全部在内）
 *   exportDate, ...watermark        // 外层明文：导出时间 + 创作者署名
 * }
 *
 * 盐值从环境变量经 appSecret.ts 注入（App/桌面构建有真实值，Web 构建为空）。
 * 网页端不调用此函数（导出按钮已被移除）。
 */
export async function exportAll(): Promise<string> {
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

  // 明文 payload（主体数据，全部进入加密）
  const payload = {
    entries, eras, customSections, users, settings,
    novelBooks, novelVolumes, novelChapters, novelProgress,
  };

  // 私有盐值：App/桌面构建注入真实值；Web 构建为空（但网页端不调用导出）
  const { APP_DATA_SALT } = await import('../lib/appSecret');
  // 诊断日志：打印导出密钥指纹（与导入端 [Import] 日志的密钥指纹对比）
  console.error('[Export] 密钥指纹=' + (APP_DATA_SALT
    ? 'len=' + APP_DATA_SALT.length + ' "' + APP_DATA_SALT.slice(0, 2) + '…' + APP_DATA_SALT.slice(-2) + '"'
    : '空'));
  // 加密主体 + 签名（AES-GCM 认证加密 + HMAC 双保险）
  const { encryptPayload } = await import('../lib/cryptoVault');
  const vault = await encryptPayload(payload, APP_DATA_SALT);
  console.error('[Export] ✅ v2 加密完成，v=' + vault.v + ' encrypted=' + vault.encrypted);

  // 外层明文：导出时间 + 创作者署名水印
  const { buildExportWatermark } = await import('../lib/watermark');
  const watermark = buildExportWatermark();
  return JSON.stringify({
    ...vault,
    exportDate: new Date().toISOString(),
    ...watermark,
  }, null, 2);
}

/**
 * 解密 + 验签导入文件，返回可直接写入的明文 payload
 *
 * 自动识别格式：
 * - v2（encrypted:true）：AES-GCM 解密 + 验签（双重校验）
 * - v1（旧明文，无 encrypted 字段）：仅验签（向后兼容旧备份）
 *
 * 任何失败（解密失败 / 验签不一致 / 格式错误 / 盐值错误）
 * 一律抛出 VaultError，外层展示「文件无效」并丢弃详细错误，防试探攻击。
 *
 * @param rawJson 文件原始文本
 * @param privateKey 会话密钥（= 私有盐值）
 */
export async function verifyAndDecrypt(
  rawJson: string,
  privateKey: string,
): Promise<Record<string, unknown>> {
  const { VaultError, decryptPayload } = await import('../lib/cryptoVault');

  // 先算密钥指纹（sha256 摘要首尾 6+4 = 10位，不泄露本体）
  // 两端肉眼对比：App端关于页"导出密钥指纹" == 网页端导入时输入密钥的指纹
  const { sha256Hex } = await import('../lib/hiddenUnlock');
  let keyFp = '空';
  try {
    if (privateKey) {
      const sha = await sha256Hex(privateKey);
      keyFp = sha.slice(0, 8) + '…' + sha.slice(-6);
    }
  } catch { /* ignore */ }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawJson);
  } catch {
    throw new VaultError(`JSON 解析失败；导入密钥指纹=${keyFp}`);
  }
  const fmt = `v=${data.v} encrypted=${data.encrypted} 顶层=[${Object.keys(data).join(',')}]`;

  // v2 加密格式
  if (data.v === 2 && data.encrypted === true) {
    try {
      return await decryptPayload(data, privateKey);
    } catch (e) {
      const reason = e instanceof VaultError && e.diag
        ? e.diag
        : 'AES-GCM 解密失败（最常见=密钥不匹配；也可能数据被篡改）';
      throw new VaultError(`走 v2 路径 ❌ ${reason}；格式：${fmt}；导入密钥指纹=${keyFp}`);
    }
  }

  // v1 旧明文格式（向后兼容）
  const { verifySign } = await import('../lib/hiddenUnlock');
  let ok: boolean;
  try {
    ok = await verifySign(data, privateKey);
  } catch {
    throw new VaultError(`走 v1 路径 ❌ verifySign 异常；格式：${fmt}；导入密钥指纹=${keyFp}`);
  }
  if (!ok) {
    // 额外判断：data 中有没有 entries 等主体字段？没有的话就是 v2 文件误走 v1
    const hasPayload = Array.isArray(data.entries) && data.entries.length > 0
      || Array.isArray(data.novelBooks) && data.novelBooks.length > 0;
    const diag = hasPayload
      ? '文件有明文数据但签名不匹配（密钥不对 或 JSON 序列化顺序不一致）'
      : '文件中没有明文 entries/novelBooks 等主体数据，极可能是 v2 加密文件被误判为 v1（网页端跑旧代码？）';
    throw new VaultError(`走 v1 路径 ❌ 验签失败（${diag}）；格式：${fmt}；导入密钥指纹=${keyFp}`);
  }
  return data;
}

/**
 * 导入全部数据（含小说）
 * 接收已解密验签的 payload 对象（由 verifyAndDecrypt 产出）
 */
export async function importAll(payload: Record<string, unknown>): Promise<void> {
  const data = payload;
  // 校验水印（仅记录日志，不阻断导入）
  const { verifyImportWatermark } = await import('../lib/watermark');
  const wm = verifyImportWatermark(data);
  if (!wm.hasWatermark) {
    console.warn('[import] 导入的备份未包含本项目水印，可能来自第三方或旧版本');
  } else if (wm.author) {
    if (__DEBUG_BUILD__) console.info(`[import] 水印校验通过：作者 ${wm.author}`);
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
  if (data.entries) for (const e of data.entries as unknown[]) await tx.objectStore('entries').put(e);
  if (data.eras) for (const e of data.eras as unknown[]) await tx.objectStore('eras').put(e);
  if (data.customSections) for (const s of data.customSections as unknown[]) await tx.objectStore('customSections').put(s);
  if (data.users) for (const u of data.users as unknown[]) await tx.objectStore('users').put(u);
  if (data.settings) for (const [k, v] of Object.entries(data.settings as Record<string, unknown>)) await tx.objectStore('settings').put(v, k);
  if (data.novelBooks) for (const b of data.novelBooks as unknown[]) await tx.objectStore('novelBooks').put(b);
  if (data.novelVolumes) for (const v of data.novelVolumes as unknown[]) await tx.objectStore('novelVolumes').put(v);
  if (data.novelChapters) for (const c of data.novelChapters as unknown[]) await tx.objectStore('novelChapters').put(c);
  if (data.novelProgress) for (const p of data.novelProgress as unknown[]) await tx.objectStore('novelProgress').put(p);
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
      backupStorage.set(BACKUP_KEY, snapshot);
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

    const raw = backupStorage.get(BACKUP_KEY);
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


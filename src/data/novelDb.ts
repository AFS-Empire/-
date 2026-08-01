import type { NovelBook, NovelVolume, NovelChapter, NovelProgress } from '../types';
import { getDB, genId } from './db';

// ============ 书籍 CRUD ============
export async function getAllNovelBooks(): Promise<NovelBook[]> {
  const db = await getDB();
  return db.getAll('novelBooks') as Promise<NovelBook[]>;
}

export async function getNovelBook(id: string): Promise<NovelBook | undefined> {
  const db = await getDB();
  return db.get('novelBooks', id) as Promise<NovelBook | undefined>;
}

export async function saveNovelBook(book: NovelBook): Promise<void> {
  const db = await getDB();
  book.updatedAt = Date.now();
  await db.put('novelBooks', book);
}

export async function deleteNovelBook(id: string): Promise<void> {
  const db = await getDB();
  const volumes = await db.getAllFromIndex('novelVolumes', 'bookId', id) as NovelVolume[];
  const chapters = await db.getAllFromIndex('novelChapters', 'bookId', id) as NovelChapter[];
  const tx = db.transaction(['novelChapters', 'novelVolumes', 'novelBooks', 'novelProgress'], 'readwrite');
  for (const c of chapters) await tx.objectStore('novelChapters').delete(c.id);
  for (const v of volumes) await tx.objectStore('novelVolumes').delete(v.id);
  await tx.objectStore('novelProgress').delete(id).catch(() => {});
  await tx.objectStore('novelBooks').delete(id);
  await tx.done;
}

// ============ 分卷 CRUD ============
export async function getNovelVolumes(bookId: string): Promise<NovelVolume[]> {
  const db = await getDB();
  const volumes = await db.getAllFromIndex('novelVolumes', 'bookId', bookId) as NovelVolume[];
  return volumes.sort((a, b) => a.order - b.order);
}

export async function saveNovelVolume(volume: NovelVolume): Promise<void> {
  const db = await getDB();
  await db.put('novelVolumes', volume);
}

export async function deleteNovelVolume(id: string): Promise<void> {
  const db = await getDB();
  const chapters = await db.getAllFromIndex('novelChapters', 'volumeId', id) as NovelChapter[];
  const tx = db.transaction(['novelChapters', 'novelVolumes'], 'readwrite');
  for (const c of chapters) await tx.objectStore('novelChapters').delete(c.id);
  await tx.objectStore('novelVolumes').delete(id);
  await tx.done;
}

// ============ 章节 CRUD ============
export async function getNovelChapters(bookId: string): Promise<NovelChapter[]> {
  const db = await getDB();
  const chapters = await db.getAllFromIndex('novelChapters', 'bookId', bookId) as NovelChapter[];
  return chapters.sort((a, b) => a.order - b.order);
}

export async function getNovelChapter(id: string): Promise<NovelChapter | undefined> {
  const db = await getDB();
  return db.get('novelChapters', id) as Promise<NovelChapter | undefined>;
}

export async function saveNovelChapter(chapter: NovelChapter): Promise<void> {
  const db = await getDB();
  chapter.updatedAt = Date.now();
  await db.put('novelChapters', chapter);
}

export async function deleteNovelChapter(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('novelChapters', id);
}

// ============ 阅读进度 ============
export async function getNovelProgress(bookId: string): Promise<NovelProgress | undefined> {
  const db = await getDB();
  return db.get('novelProgress', bookId) as Promise<NovelProgress | undefined>;
}

export async function saveNovelProgress(progress: NovelProgress): Promise<void> {
  const db = await getDB();
  progress.updatedAt = Date.now();
  await db.put('novelProgress', progress);
}

// ============ 批量操作 ============
export async function bulkSaveChapters(chapters: NovelChapter[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('novelChapters', 'readwrite');
  for (const c of chapters) {
    c.updatedAt = Date.now();
    await tx.store.put(c);
  }
  await tx.done;
}

export function makeNovelId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

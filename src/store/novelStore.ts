import { create } from 'zustand';
import type { NovelBook, NovelVolume, NovelChapter, NovelProgress } from '../types';
import * as novelDb from '../data/novelDb';
import { scanMentions, parseNovelTxt, type ParsedChapter } from '../lib/txtParser';
import type { Character } from '../types';

interface NovelState {
  books: NovelBook[];
  volumes: Record<string, NovelVolume[]>;  // bookId -> volumes
  chapters: Record<string, NovelChapter[]>; // bookId -> chapters
  progress: Record<string, NovelProgress>; // bookId -> progress
  loaded: boolean;

  refresh: () => Promise<void>;
  createBook: (title: string, spoilerMode?: 'open' | 'unlock') => Promise<NovelBook>;
  deleteBook: (id: string) => Promise<void>;
  updateBook: (id: string, patch: Partial<NovelBook>) => Promise<void>;

  createVolume: (bookId: string, title: string) => Promise<void>;
  deleteVolume: (id: string) => Promise<void>;
  updateVolume: (id: string, title: string) => Promise<void>;

  importChapters: (bookId: string, volumeId: string, txt: string, characters: Character[]) => Promise<number>;
  updateChapter: (id: string, patch: Partial<NovelChapter>) => Promise<void>;
  deleteChapter: (id: string) => Promise<void>;
  markChapterRead: (bookId: string, chapterId: string) => Promise<void>;

  saveProgress: (progress: NovelProgress) => Promise<void>;
}

export const useNovelStore = create<NovelState>((set, get) => ({
  books: [],
  volumes: {},
  chapters: {},
  progress: {},
  loaded: false,

  refresh: async () => {
    const books = await novelDb.getAllNovelBooks();
    const volumes: Record<string, NovelVolume[]> = {};
    const chapters: Record<string, NovelChapter[]> = {};
    const progress: Record<string, NovelProgress> = {};

    for (const book of books) {
      volumes[book.id] = await novelDb.getNovelVolumes(book.id);
      chapters[book.id] = await novelDb.getNovelChapters(book.id);
      const p = await novelDb.getNovelProgress(book.id);
      if (p) progress[book.id] = p;
    }

    set({ books, volumes, chapters, progress, loaded: true });
  },

  createBook: async (title, spoilerMode = 'open') => {
    const book: NovelBook = {
      id: novelDb.makeNovelId('book'),
      title,
      spoilerMode,
      totalChapters: 0,
      completedChapters: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await novelDb.saveNovelBook(book);
    await get().refresh();
    return book;
  },

  deleteBook: async (id) => {
    await novelDb.deleteNovelBook(id);
    await get().refresh();
  },

  updateBook: async (id, patch) => {
    const book = await novelDb.getNovelBook(id);
    if (!book) return;
    await novelDb.saveNovelBook({ ...book, ...patch });
    await get().refresh();
  },

  createVolume: async (bookId, title) => {
    const vols = get().volumes[bookId] || [];
    const volume: NovelVolume = {
      id: novelDb.makeNovelId('vol'),
      bookId,
      title,
      order: vols.length,
    };
    await novelDb.saveNovelVolume(volume);
    await get().refresh();
  },

  deleteVolume: async (id) => {
    await novelDb.deleteNovelVolume(id);
    await get().refresh();
  },

  updateVolume: async (id, title) => {
    const db = await import('../data/db').then(m => m.getDB());
    const vol = await db.get('novelVolumes', id) as NovelVolume | undefined;
    if (!vol) return;
    await novelDb.saveNovelVolume({ ...vol, title });
    await get().refresh();
  },

  importChapters: async (bookId, volumeId, txt, characters) => {
    const parsed: ParsedChapter[] = parseNovelTxt(txt);
    if (parsed.length === 0) return 0;

    const existing = get().chapters[bookId] || [];
    const existingOrders = new Set(existing.map(c => c.order));
    let startOrder = 1;
    while (existingOrders.has(startOrder)) startOrder++;

    const chapters: NovelChapter[] = parsed.map((p, i) => ({
      id: novelDb.makeNovelId('chap'),
      bookId,
      volumeId,
      order: startOrder + i,
      title: p.title,
      content: p.content,
      mentions: scanMentions(p.content, characters.map(c => ({ id: c.id, name: c.title }))),
      read: false,
      updatedAt: Date.now(),
    }));

    await novelDb.bulkSaveChapters(chapters);

    // 更新书籍章节数
    const book = await novelDb.getNovelBook(bookId);
    if (book) {
      const allChapters = await novelDb.getNovelChapters(bookId);
      await novelDb.saveNovelBook({
        ...book,
        totalChapters: allChapters.length,
        updatedAt: Date.now(),
      });
    }

    await get().refresh();
    return chapters.length;
  },

  updateChapter: async (id, patch) => {
    const db = await import('../data/db').then(m => m.getDB());
    const chap = await db.get('novelChapters', id) as NovelChapter | undefined;
    if (!chap) return;
    if (patch.content) {
      // 重新扫描 mentions
      const characters = get().books.length > 0
        ? [] // 需要外部传入，简化处理：保持原 mentions 不变
        : [];
      // 简化：只更新 content，不重扫 mentions（用户编辑后可手动重扫）
    }
    await novelDb.saveNovelChapter({ ...chap, ...patch });
    await get().refresh();
  },

  deleteChapter: async (id) => {
    const chap = await import('../data/db').then(m => m.getDB()).then(db => db.get('novelChapters', id)) as NovelChapter | undefined;
    if (chap) {
      await novelDb.deleteNovelChapter(id);
      const book = await novelDb.getNovelBook(chap.bookId);
      if (book) {
        const allChapters = await novelDb.getNovelChapters(chap.bookId);
        await novelDb.saveNovelBook({ ...book, totalChapters: allChapters.length });
      }
    }
    await get().refresh();
  },

  markChapterRead: async (bookId, chapterId) => {
    const db = await import('../data/db').then(m => m.getDB());
    const chap = await db.get('novelChapters', chapterId) as NovelChapter | undefined;
    if (!chap) return;
    const updated = { ...chap, read: true };
    await novelDb.saveNovelChapter(updated);

    const book = await novelDb.getNovelBook(bookId);
    if (book) {
      const allChapters = await novelDb.getNovelChapters(bookId);
      const completed = allChapters.filter(c => c.read).length;
      await novelDb.saveNovelBook({ ...book, completedChapters: completed });
    }
    await get().refresh();
  },

  saveProgress: async (progress) => {
    await novelDb.saveNovelProgress(progress);
    set(s => ({
      progress: { ...s.progress, [progress.bookId]: progress },
    }));
  },
}));

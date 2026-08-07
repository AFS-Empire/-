import { create } from 'zustand';
import type { NovelBook, NovelVolume, NovelChapter, NovelProgress } from '../types';
import * as novelDb from '../data/novelDb';
import { scanMentions, parseNovelTxt, type ParsedChapter } from '../lib/txtParser';
import type { Character } from '../types';
import { isOperationVerified } from '../lib/operationKey';
import { needVerify } from '../lib/operationKeyGuard';
import { useBindingStore } from './bindingStore';

async function guardWrite<T>(execute: () => Promise<T>): Promise<T | false> {
  if (!useBindingStore.getState().isBound) return false;
  if (isOperationVerified()) {
    return await execute();
  }
  needVerify(() => {
    void execute();
  });
  return false;
}

interface NovelState {
  books: NovelBook[];
  volumes: Record<string, NovelVolume[]>;
  chapters: Record<string, NovelChapter[]>;
  progress: Record<string, NovelProgress>;
  loaded: boolean;

  refresh: () => Promise<void>;
  createBook: (title: string, spoilerMode?: 'open' | 'unlock') => Promise<NovelBook | false>;
  deleteBook: (id: string) => Promise<boolean>;
  updateBook: (id: string, patch: Partial<NovelBook>) => Promise<boolean>;

  createVolume: (bookId: string, title: string) => Promise<boolean>;
  deleteVolume: (id: string) => Promise<boolean>;
  updateVolume: (id: string, title: string) => Promise<boolean>;

  importChapters: (bookId: string, volumeId: string, txt: string, characters: Character[]) => Promise<number | false>;
  createChapter: (bookId: string, volumeId: string, title: string, content: string, characters: Character[]) => Promise<boolean>;
  updateChapter: (id: string, patch: Partial<NovelChapter>, characters?: Character[]) => Promise<boolean>;
  deleteChapter: (id: string) => Promise<boolean>;
  markChapterRead: (bookId: string, chapterId: string) => Promise<boolean>;

  saveProgress: (progress: NovelProgress) => Promise<void>;
}

let _lastRefreshFingerprint = '';

function computeFingerprint(
  books: NovelBook[],
  chaptersMap: Record<string, NovelChapter[]>,
  progressMap: Record<string, NovelProgress>,
): string {
  let fp = `${books.length}|`;
  for (const b of books) {
    fp += `${b.id}:${b.updatedAt}:${b.completedChapters}|`;
  }
  const chapterIds = Object.keys(chaptersMap).sort();
  for (const id of chapterIds) {
    fp += `${id}:${chaptersMap[id].length}|`;
    for (const c of chaptersMap[id]) {
      fp += `${c.id}:${c.read ? 1 : 0}:${c.updatedAt}|`;
    }
  }
  const progressIds = Object.keys(progressMap).sort();
  for (const id of progressIds) {
    const p = progressMap[id];
    fp += `${id}:${p.lastChapterId || ''}:${p.scrollRatio}|`;
  }
  return fp;
}

export const useNovelStore = create<NovelState>((set, get) => ({
  books: [],
  volumes: {},
  chapters: {},
  progress: {},
  loaded: false,

  refresh: async () => {
    const books = await novelDb.getAllNovelBooks();
    const results = await Promise.all(
      books.map(async (book) => {
        const [volumes, chapters, progress] = await Promise.all([
          novelDb.getNovelVolumes(book.id),
          novelDb.getNovelChapters(book.id),
          novelDb.getNovelProgress(book.id),
        ]);
        return { book, volumes, chapters, progress };
      })
    );

    const volumesMap: Record<string, NovelVolume[]> = {};
    const chaptersMap: Record<string, NovelChapter[]> = {};
    const progressMap: Record<string, NovelProgress> = {};

    for (const { book, volumes, chapters, progress } of results) {
      volumesMap[book.id] = volumes;
      chaptersMap[book.id] = chapters;
      if (progress) progressMap[book.id] = progress;
    }

    const fp = computeFingerprint(books, chaptersMap, progressMap);

    if (get().loaded && fp === _lastRefreshFingerprint) {
      return;
    }
    _lastRefreshFingerprint = fp;

    set({ books, volumes: volumesMap, chapters: chaptersMap, progress: progressMap, loaded: true });
  },

  createBook: async (title, spoilerMode = 'open') => {
    return guardWrite(async () => {
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
      _lastRefreshFingerprint = '';
      await get().refresh();
      return book;
    });
  },

  deleteBook: async (id) => {
    return guardWrite(async () => {
      await novelDb.deleteNovelBook(id);
      _lastRefreshFingerprint = '';
      await get().refresh();
      return true;
    });
  },

  updateBook: async (id, patch) => {
    return guardWrite(async () => {
      const book = await novelDb.getNovelBook(id);
      if (!book) return false;
      await novelDb.saveNovelBook({ ...book, ...patch });
      _lastRefreshFingerprint = '';
      await get().refresh();
      return true;
    });
  },

  createVolume: async (bookId, title) => {
    return guardWrite(async () => {
      const vols = get().volumes[bookId] || [];
      const volume: NovelVolume = {
        id: novelDb.makeNovelId('vol'),
        bookId,
        title,
        order: vols.length,
      };
      await novelDb.saveNovelVolume(volume);
      _lastRefreshFingerprint = '';
      await get().refresh();
      return true;
    });
  },

  deleteVolume: async (id) => {
    return guardWrite(async () => {
      await novelDb.deleteNovelVolume(id);
      _lastRefreshFingerprint = '';
      await get().refresh();
      return true;
    });
  },

  updateVolume: async (id, title) => {
    return guardWrite(async () => {
      const db = await import('../data/db').then(m => m.getDB());
      const vol = await db.get('novelVolumes', id) as NovelVolume | undefined;
      if (!vol) return false;
      await novelDb.saveNovelVolume({ ...vol, title });
      _lastRefreshFingerprint = '';
      await get().refresh();
      return true;
    });
  },

  createChapter: async (bookId, volumeId, title, content, characters) => {
    return guardWrite(async () => {
      const existing = get().chapters[bookId] || [];
      const existingOrders = new Set(existing.map(c => c.order));
      let order = 1;
      while (existingOrders.has(order)) order++;

      const chapter: NovelChapter = {
        id: novelDb.makeNovelId('chap'),
        bookId,
        volumeId,
        order,
        title,
        content,
        mentions: scanMentions(content, characters.map(c => ({ id: c.id, name: c.title }))),
        read: false,
        updatedAt: Date.now(),
      };
      await novelDb.saveNovelChapter(chapter);

      const book = await novelDb.getNovelBook(bookId);
      if (book) {
        const allChapters = await novelDb.getNovelChapters(bookId);
        await novelDb.saveNovelBook({ ...book, totalChapters: allChapters.length, updatedAt: Date.now() });
      }
      _lastRefreshFingerprint = '';
      await get().refresh();
      return true;
    });
  },

  importChapters: async (bookId, volumeId, txt, characters) => {
    return guardWrite(async () => {
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

      const book = await novelDb.getNovelBook(bookId);
      if (book) {
        const allChapters = await novelDb.getNovelChapters(bookId);
        await novelDb.saveNovelBook({
          ...book,
          totalChapters: allChapters.length,
          updatedAt: Date.now(),
        });
      }

      _lastRefreshFingerprint = '';
      await get().refresh();
      return chapters.length;
    });
  },

  updateChapter: async (id, patch, characters) => {
    return guardWrite(async () => {
      const db = await import('../data/db').then(m => m.getDB());
      const chap = await db.get('novelChapters', id) as NovelChapter | undefined;
      if (!chap) return false;
      const updated = { ...chap, ...patch };
      if (patch.content !== undefined && characters) {
        updated.mentions = scanMentions(patch.content, characters.map(c => ({ id: c.id, name: c.title })));
      }
      updated.updatedAt = Date.now();
      await novelDb.saveNovelChapter(updated);
      _lastRefreshFingerprint = '';
      await get().refresh();
      return true;
    });
  },

  deleteChapter: async (id) => {
    return guardWrite(async () => {
      const chap = await import('../data/db').then(m => m.getDB()).then(db => db.get('novelChapters', id)) as NovelChapter | undefined;
      if (chap) {
        await novelDb.deleteNovelChapter(id);
        const book = await novelDb.getNovelBook(chap.bookId);
        if (book) {
          const allChapters = await novelDb.getNovelChapters(chap.bookId);
          await novelDb.saveNovelBook({ ...book, totalChapters: allChapters.length });
        }
      }
      _lastRefreshFingerprint = '';
      await get().refresh();
      return true;
    });
  },

  markChapterRead: async (bookId, chapterId) => {
    const db = await import('../data/db').then(m => m.getDB());
    const chap = await db.get('novelChapters', chapterId) as NovelChapter | undefined;
    if (!chap) return false;
    const updated = { ...chap, read: true };
    await novelDb.saveNovelChapter(updated);

    const book = await novelDb.getNovelBook(bookId);
    if (book) {
      const allChapters = await novelDb.getNovelChapters(bookId);
      const completed = allChapters.filter(c => c.read).length;
      await novelDb.saveNovelBook({ ...book, completedChapters: completed });
    }
    _lastRefreshFingerprint = '';
    await get().refresh();
    return true;
  },

  saveProgress: async (progress) => {
    await novelDb.saveNovelProgress(progress);
    _lastRefreshFingerprint = '';
    set(s => ({
      progress: { ...s.progress, [progress.bookId]: progress },
    }));
  },
}));

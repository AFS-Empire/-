import { create } from 'zustand';
import type { AnyEntry, Era, CustomSection } from '../types';
import * as db from '../data/db';
import { needVerify } from '../lib/operationKeyGuard';

interface DataState {
  entries: AnyEntry[];
  eras: Era[];
  customSections: CustomSection[];
  loaded: boolean;
  refresh: () => Promise<void>;
  saveEntry: (entry: AnyEntry) => Promise<boolean>;
  deleteEntry: (id: string) => Promise<boolean>;
  saveEra: (era: Era) => Promise<boolean>;
  deleteEra: (id: string) => Promise<boolean>;
  saveCustomSection: (s: CustomSection) => Promise<boolean>;
  deleteCustomSection: (id: string) => Promise<boolean>;
  getById: (id: string) => AnyEntry | undefined;
  getByType: (type: string) => AnyEntry[];
}

export const useDataStore = create<DataState>((set, get) => ({
  entries: [],
  eras: [],
  customSections: [],
  loaded: false,

  refresh: async () => {
    const [entries, eras, customSections] = await Promise.all([
      db.getAllEntries(),
      db.getAllEras(),
      db.getCustomSections(),
    ]);
    set({ entries, eras, customSections, loaded: true });
  },

  saveEntry: async (entry) => {
    // 密钥B验证：未验证则拦截操作
    const ok = needVerify(() => {
      void (async () => {
        await db.saveEntry(entry);
        db.scheduleBackup();
        await get().refresh();
      })();
    });
    return ok;
  },

  deleteEntry: async (id) => {
    // 密钥B验证：未验证则拦截操作
    const ok = needVerify(() => {
      void (async () => {
        await db.deleteEntry(id);
        db.scheduleBackup();
        await get().refresh();
      })();
    });
    return ok;
  },

  saveEra: async (era) => {
    // 密钥B验证：未验证则拦截操作
    const ok = needVerify(() => {
      void (async () => {
        await db.saveEra(era);
        db.scheduleBackup();
        await get().refresh();
      })();
    });
    return ok;
  },

  deleteEra: async (id) => {
    // 密钥B验证：未验证则拦截操作
    const ok = needVerify(() => {
      void (async () => {
        await db.deleteEra(id);
        db.scheduleBackup();
        await get().refresh();
      })();
    });
    return ok;
  },

  saveCustomSection: async (s) => {
    // 密钥B验证：未验证则拦截操作
    const ok = needVerify(() => {
      void (async () => {
        await db.saveCustomSection(s);
        db.scheduleBackup();
        await get().refresh();
      })();
    });
    return ok;
  },

  deleteCustomSection: async (id) => {
    // 密钥B验证：未验证则拦截操作
    const ok = needVerify(() => {
      void (async () => {
        await db.deleteCustomSection(id);
        db.scheduleBackup();
        await get().refresh();
      })();
    });
    return ok;
  },

  getById: (id) => get().entries.find(e => e.id === id),

  getByType: (type) => get().entries.filter(e => e.type === type),
}));

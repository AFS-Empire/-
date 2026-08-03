import { create } from 'zustand';
import type { AnyEntry, Era, CustomSection } from '../types';
import * as db from '../data/db';
import { isOperationVerified } from '../lib/operationKey';
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

/** 写操作执行器：已验证则立即执行并 await，未验证则入队返回 false */
async function guardWrite(execute: () => Promise<void>): Promise<boolean> {
  if (isOperationVerified()) {
    await execute();
    return true;
  }
  // 未验证：入队等待密钥B验证通过后执行
  needVerify(() => {
    void execute();
  });
  return false;
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
    return guardWrite(async () => {
      await db.saveEntry(entry);
      db.scheduleBackup();
      await get().refresh();
    });
  },

  deleteEntry: async (id) => {
    return guardWrite(async () => {
      await db.deleteEntry(id);
      db.scheduleBackup();
      await get().refresh();
    });
  },

  saveEra: async (era) => {
    return guardWrite(async () => {
      await db.saveEra(era);
      db.scheduleBackup();
      await get().refresh();
    });
  },

  deleteEra: async (id) => {
    return guardWrite(async () => {
      await db.deleteEra(id);
      db.scheduleBackup();
      await get().refresh();
    });
  },

  saveCustomSection: async (s) => {
    return guardWrite(async () => {
      await db.saveCustomSection(s);
      db.scheduleBackup();
      await get().refresh();
    });
  },

  deleteCustomSection: async (id) => {
    return guardWrite(async () => {
      await db.deleteCustomSection(id);
      db.scheduleBackup();
      await get().refresh();
    });
  },

  getById: (id) => get().entries.find(e => e.id === id),

  getByType: (type) => get().entries.filter(e => e.type === type),
}));

import { create } from 'zustand';
import type { AnyEntry, Era, CustomSection } from '../types';
import * as db from '../data/db';

interface DataState {
  entries: AnyEntry[];
  eras: Era[];
  customSections: CustomSection[];
  loaded: boolean;
  refresh: () => Promise<void>;
  saveEntry: (entry: AnyEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  saveEra: (era: Era) => Promise<void>;
  deleteEra: (id: string) => Promise<void>;
  saveCustomSection: (s: CustomSection) => Promise<void>;
  deleteCustomSection: (id: string) => Promise<void>;
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
    await db.saveEntry(entry);
    db.scheduleBackup();
    await get().refresh();
  },

  deleteEntry: async (id) => {
    await db.deleteEntry(id);
    db.scheduleBackup();
    await get().refresh();
  },

  saveEra: async (era) => {
    await db.saveEra(era);
    db.scheduleBackup();
    await get().refresh();
  },

  deleteEra: async (id) => {
    await db.deleteEra(id);
    db.scheduleBackup();
    await get().refresh();
  },

  saveCustomSection: async (s) => {
    await db.saveCustomSection(s);
    db.scheduleBackup();
    await get().refresh();
  },

  deleteCustomSection: async (id) => {
    await db.deleteCustomSection(id);
    db.scheduleBackup();
    await get().refresh();
  },

  getById: (id) => get().entries.find(e => e.id === id),

  getByType: (type) => get().entries.filter(e => e.type === type),
}));

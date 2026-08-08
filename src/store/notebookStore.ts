import { create } from 'zustand';
import { getAllNotes, saveNote, deleteNote, togglePinNote, type NotebookNote } from '../data/db';

interface NotebookState {
  notes: NotebookNote[];
  loading: boolean;
  error: string | null;
  loadNotes: () => Promise<void>;
  addNote: (title: string, content: string, color?: string) => Promise<NotebookNote | null>;
  updateNote: (id: number, updates: Partial<NotebookNote>) => Promise<NotebookNote | null>;
  removeNote: (id: number) => Promise<void>;
  togglePin: (id: number) => Promise<void>;
}

export const useNotebookStore = create<NotebookState>((set, get) => ({
  notes: [],
  loading: false,
  error: null,

  loadNotes: async () => {
    set({ loading: true, error: null });
    try {
      const notes = await getAllNotes();
      set({ notes, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  addNote: async (title, content, color) => {
    set({ loading: true, error: null });
    try {
      const note = await saveNote({
        title: title || '无标题笔记',
        content,
        color,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      set(state => ({ notes: [note, ...state.notes], loading: false }));
      return note;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      return null;
    }
  },

  updateNote: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const now = Date.now();
      const merged = { ...updates, id, updatedAt: now } as NotebookNote;
      await saveNote(merged);
      const updated = { ...updates, id, updatedAt: now } as NotebookNote;
      set(state => ({
        notes: state.notes.map(n => n.id === id ? { ...n, ...updated } : n),
        loading: false,
      }));
      // 返回完整笔记（从 state 中取出原笔记合并）
      const original = get().notes.find(n => n.id === id);
      return original ? { ...original, ...updated } : null;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      return null;
    }
  },

  removeNote: async (id) => {
    set({ loading: true, error: null });
    try {
      await deleteNote(id);
      set(state => ({ notes: state.notes.filter(n => n.id !== id), loading: false }));
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  togglePin: async (id) => {
    try {
      await togglePinNote(id);
      set(state => ({
        notes: state.notes.map(n => n.id === id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n),
      }));
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
}));

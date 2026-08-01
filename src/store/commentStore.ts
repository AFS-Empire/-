import { create } from 'zustand';
import type { Comment } from '../types';
import * as db from '../data/db';
import { useAuthStore } from './authStore';

interface CommentState {
  comments: Comment[];
  loaded: boolean;
  refresh: () => Promise<void>;
  postComment: (content: string, targetCode: string, targetId?: string, targetTitle?: string, parentId?: string) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  getByTarget: (targetCode: string) => Comment[];
}

export const useCommentStore = create<CommentState>((set, get) => ({
  comments: [],
  loaded: false,

  refresh: async () => {
    const comments = await db.getAllComments();
    set({ comments, loaded: true });
  },

  postComment: async (content, targetCode, targetId, targetTitle, parentId) => {
    const user = useAuthStore.getState().currentUser;
    if (!user) return;
    const comment: Comment = {
      id: db.genId(),
      author: user.username,
      authorRole: user.role,
      content,
      targetCode,
      targetId,
      targetTitle,
      parentId,
      isPinned: user.role === 'admin',
      createdAt: Date.now(),
    };
    await db.saveComment(comment);
    await get().refresh();
  },

  deleteComment: async (id) => {
    await db.deleteComment(id);
    await get().refresh();
  },

  togglePin: async (id) => {
    await db.togglePinComment(id);
    await get().refresh();
  },

  getByTarget: (targetCode) => {
    return get().comments
      .filter(c => c.targetCode === targetCode)
      .sort((a, b) => {
        // 置顶优先
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return a.createdAt - b.createdAt;
      });
  },
}));

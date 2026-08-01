import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { getUser, saveUser } from '../data/db';
import { verifyPassword, hashPassword, isLegacyHash } from '../lib/crypto';

interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message: string }>;
  guestLogin: () => void;
  logout: () => void;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isAuthenticated: false,

      login: async (username, password) => {
        const user = await getUser(username);
        if (!user) {
          return { success: false, message: '用户不存在' };
        }
        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) {
          return { success: false, message: '密码错误' };
        }
        // 旧哈希格式自动升级为 PBKDF2（首次登录时一次性升级，用户无感）
        if (isLegacyHash(user.passwordHash)) {
          const newHash = await hashPassword(password);
          const upgraded = { ...user, passwordHash: newHash };
          await saveUser(upgraded);
          set({ currentUser: upgraded, isAuthenticated: true });
        } else {
          set({ currentUser: user, isAuthenticated: true });
        }
        return { success: true, message: `欢迎回来，${username}` };
      },

      /** 网页浏览版：以游客身份直接进入，无需账号密码 */
      guestLogin: () => {
        set({
          currentUser: {
            id: 'guest',
            username: '访客',
            passwordHash: '',
            role: 'guest',
            createdAt: Date.now(),
          },
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({ currentUser: null, isAuthenticated: false });
      },

      isAdmin: () => {
        const u = get().currentUser;
        return u?.role === 'admin';
      },
    }),
    { name: 'worldarchive-auth' },
  ),
);

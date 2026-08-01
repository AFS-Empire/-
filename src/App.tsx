import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, Suspense, lazy } from 'react';
import { useAuthStore } from './store/authStore';
import { useDataStore } from './store/dataStore';
import { useCommentStore } from './store/commentStore';
import { seedData } from './data/seed';
import { exportAll, restoreFromBackupIfNeeded } from './data/db';
import { useRipple } from './hooks/useRipple';
import Layout from './components/Layout';
import { FullScreenLoader } from './components/Skeleton';
import { IS_WEB_BUILD } from './lib/buildTarget';

// 路由懒加载：首屏只加载必要代码，其余按需加载
// 把 importer 抽出来复用：lazy() 用一次，首屏后预加载再用一次（Vite 会去重，已加载的立即 resolve）
const importers = [
  () => import('./pages/Login'),
  () => import('./pages/Home'),
  () => import('./pages/Timeline'),
  () => import('./pages/Character'),
  () => import('./pages/Geography'),
  () => import('./pages/Tech'),
  () => import('./pages/Milestone'),
  () => import('./pages/Custom'),
  () => import('./pages/EntryDetail'),
  () => import('./pages/EntryEditor'),
  () => import('./pages/AllIndex'),
  () => import('./pages/CommentSection'),
  () => import('./pages/CommentOverview'),
  () => import('./pages/About'),
];
const [
  Login, Home, Timeline, Character, Geography, Tech,
  Milestone, Custom, EntryDetail, EntryEditor, AllIndex,
  CommentSection, CommentOverview, About,
] = importers.map(lazy);

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} />;
  }
  return <>{children}</>;
}

/**
 * 管理员路由：App 版正常渲染，Web 版直接跳回首页
 * 这样编辑器代码不会在网页版中被加载
 */
function AdminRoute({ children }: { children: React.ReactNode }) {
  if (IS_WEB_BUILD) {
    return <Navigate to="/" replace />;
  }
  return <PrivateRoute>{children}</PrivateRoute>;
}

/** 把当前 IndexedDB 完整快照推给主进程（桌面 App 才有效，浏览器无操作） */
async function pushSnapshot(forceStamp = false): Promise<void> {
  const api = window.archiveApp;
  if (!api) return; // 浏览器环境：跳过
  try {
    const json = await exportAll();
    if (forceStamp) {
      await api.pushFinalSnapshot({ json });
    } else {
      await api.pushAutoSnapshot({ json });
    }
  } catch (e) {
    console.error('[pushSnapshot]', e);
  }
}

/** 按路由返回加载占位
 *  注意：首次加载某懒加载页面时，Suspense 会卡住一小会儿。
 *  用 null 而非骨架屏，让旧页面继续显示直到新页面就绪，避免"灰骨架闪一下再切"的跳变感。
 *  初始全屏加载用 FullScreenLoader（在 loaded 判断里）。
 */
function routeFallback(_pathname: string): React.ReactNode {
  return null;
}

export default function App() {
  const refresh = useDataStore(s => s.refresh);
  const loaded = useDataStore(s => s.loaded);
  const refreshComments = useCommentStore(s => s.refresh);
  const location = useLocation();

  // 启用按钮金粉涟漪（全局事件委托，挂载一次）
  useRipple();

  // 订阅数据/评论变化，用于触发自动快照
  const entriesVersion = useDataStore(s => s.entries.length + s.entries.reduce((acc, e) => acc + (e.updatedAt || 0), 0));
  const commentsVersion = useCommentStore(s => s.comments.length + s.comments.reduce((acc, c) => acc + (c.createdAt || 0), 0));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      // 启动时优先从 localStorage 兜底备份恢复（IndexedDB 空才触发）
      // 必须在 seedData 之前，否则 seedData 会因 IndexedDB 空而写入示例数据，把恢复机会挤掉
      await restoreFromBackupIfNeeded();
      await seedData();
      await refresh();
      await refreshComments();
    })();
  }, []);

  // 数据就绪后，空闲时段预加载所有路由 chunk
  // 这样用户点进二级页面时 chunk 已缓存，Suspense 不会再有空白闪烁
  useEffect(() => {
    if (!loaded) return;
    const run = () => { void Promise.all(importers.map(fn => fn())); };
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (ric) { const id = ric(run); return () => (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id); }
    const t = setTimeout(run, 800);
    return () => clearTimeout(t);
  }, [loaded]);

  // 数据/评论变化时 debounce 2 秒后推快照（节流，避免频繁 IO）
  useEffect(() => {
    if (!loaded) return;
    if (!window.archiveApp) return; // 浏览器无操作
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushSnapshot(false);
    }, 2000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [entriesVersion, commentsVersion, loaded]);

  // 监听主进程"准备退出"事件，立即推送最终快照
  useEffect(() => {
    if (!window.archiveApp) return;
    const handler = () => { void pushSnapshot(true); };
    window.archiveApp.onPrepareQuit(handler);
    return () => { /* ipcRenderer.on 注册的回调无法解绑，进程退出即销毁 */ };
  }, []);

  // 路由切换时给主内容加 page-enter 类（触发淡入动画）
  // 用 key 强制重渲染，确保每次切换都重新播放动画
  const pageKey = location.pathname;

  if (!loaded) {
    return <FullScreenLoader />;
  }

  return (
    <Suspense key={pageKey} fallback={routeFallback(location.pathname)}>
      <div className="page-enter">
        <Routes location={location}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="timeline" element={<PrivateRoute><Timeline /></PrivateRoute>} />
            <Route path="character" element={<PrivateRoute><Character /></PrivateRoute>} />
            <Route path="geography" element={<PrivateRoute><Geography /></PrivateRoute>} />
            <Route path="tech" element={<PrivateRoute><Tech /></PrivateRoute>} />
            <Route path="milestone" element={<PrivateRoute><Milestone /></PrivateRoute>} />
            <Route path="custom" element={<PrivateRoute><Custom /></PrivateRoute>} />
            <Route path="entry/:id" element={<PrivateRoute><EntryDetail /></PrivateRoute>} />
            <Route path="editor/:type" element={<AdminRoute><EntryEditor /></AdminRoute>} />
            <Route path="editor/:type/:id" element={<AdminRoute><EntryEditor /></AdminRoute>} />
            <Route path="index" element={<PrivateRoute><AllIndex /></PrivateRoute>} />
            <Route path="comments" element={<PrivateRoute><CommentOverview /></PrivateRoute>} />
            <Route path="comments/:targetCode" element={<PrivateRoute><CommentSection /></PrivateRoute>} />
            <Route path="about" element={<PrivateRoute><About /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </div>
    </Suspense>
  );
}

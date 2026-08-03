import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, Suspense, useState, lazy } from 'react';
import { useAuthStore } from './store/authStore';
import { useDataStore } from './store/dataStore';
import { useCommentStore } from './store/commentStore';
import { useNovelStore } from './store/novelStore';
import { useBindingStore } from './store/bindingStore';
import { seedData } from './data/seed';
import { exportAll, restoreFromBackupIfNeeded } from './data/db';
import { useRipple } from './hooks/useRipple';
import Layout from './components/Layout';
import { FullScreenLoader } from './components/Skeleton';
import InstallGate from './components/InstallGate';
import OperationKeyDialog from './components/OperationKeyDialog';
import { IS_WEB_BUILD } from './lib/buildTarget';
import { isInstallVerified } from './lib/installKey';
import {
  subscribeOperationKeyListener,
  executePendingActions,
  cancelPendingActions,
} from './lib/operationKeyGuard';
import { verifyOperationKey } from './lib/operationKey';

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
  () => import('./pages/NovelShelf'),
  () => import('./pages/NovelDetail'),
  () => import('./pages/NovelReader'),
];
const [
  Login, Home, Timeline, Character, Geography, Tech,
  Milestone, Custom, EntryDetail, EntryEditor, AllIndex,
  CommentSection, CommentOverview, About,
  NovelShelf, NovelDetail, NovelReader,
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
  const refreshNovel = useNovelStore(s => s.refresh);
  const location = useLocation();

  // 机器码绑定校验（仅 App 端）— 统一走 bindingStore，写操作守卫共用
  const bindingResult = useBindingStore(s => s.result);
  const refreshBinding = useBindingStore(s => s.refresh);

  // 密钥A：首次安装验证状态（仅 App 端）
  const [installVerified, setInstallVerified] = useState(() => {
    if (IS_WEB_BUILD) return true; // Web 版跳过
    return isInstallVerified();
  });

  // 密钥B：操作验证对话框状态
  const [showOperationDialog, setShowOperationDialog] = useState(false);

  // 监听密钥B验证事件（仅 App 端）
  useEffect(() => {
    if (IS_WEB_BUILD) return;
    const unsubscribe = subscribeOperationKeyListener((show) => {
      setShowOperationDialog(show);
    });
    return unsubscribe;
  }, []);

  // 启用按钮金粉涟漪（全局事件委托，挂载一次）
  useRipple();

  // 订阅数据/评论变化，用于触发自动快照
  const entriesVersion = useDataStore(s => s.entries.length + s.entries.reduce((acc, e) => acc + (e.updatedAt || 0), 0));
  const commentsVersion = useCommentStore(s => s.comments.length + s.comments.reduce((acc, c) => acc + (c.createdAt || 0), 0));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      // App 端：机器码绑定校验（网页端跳过）— 结果写入 bindingStore，写操作守卫共用
      if (!IS_WEB_BUILD) {
        const result = await refreshBinding();
        if (!result.match && result.bound) {
          // 设备不匹配，不继续加载
          return;
        }
      }
      // 启动时优先从 localStorage 兜底备份恢复（IndexedDB 空才触发）
      // 必须在 seedData 之前，否则 seedData 会因 IndexedDB 空而写入示例数据，把恢复机会挤掉
      await restoreFromBackupIfNeeded();
      await seedData();
      await refresh();
      await refreshComments();
      await refreshNovel();
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
  // 注意：不能给 Suspense 加 key，否则会卸载重挂载 → 白屏闪烁
  // 动画 key 绑定到 pathname，保证每次切换都重放过渡（放在 div 上而非 Suspense）
  const pageKey = location.pathname;

  // 密钥A：首次安装验证（仅 App 端）
  if (!IS_WEB_BUILD && !installVerified) {
    return (
      <InstallGate
        onVerified={() => setInstallVerified(true)}
      />
    );
  }

  if (!loaded) {
    // App 端设备绑定校验失败 → 锁定界面
    if (bindingResult && bindingResult.bound && !bindingResult.match) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-ink-950 p-6">
          <div className="max-w-sm text-center space-y-4">
            <div className="text-6xl">🔒</div>
            <h1 className="text-xl font-bold text-red-400">设备未授权</h1>
            <p className="text-sm text-ink-400 leading-relaxed">
              检测到当前设备与本机绑定不匹配。
              <br />
              档案数据可能被拷贝到其他设备。
              <br />
              请在本机重新激活，或联系管理员。
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-ghost w-full text-sm"
            >
              重新检测
            </button>
          </div>
        </div>
      );
    }
    return <FullScreenLoader />;
  }

  return (
    <>
      <Suspense fallback={routeFallback(location.pathname)}>
        <div key={pageKey} className="page-enter">
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
              <Route path="novel" element={<PrivateRoute><NovelShelf /></PrivateRoute>} />
              <Route path="novel/:bookId" element={<PrivateRoute><NovelDetail /></PrivateRoute>} />
              <Route path="novel/:bookId/chapter/:chapterId" element={<PrivateRoute><NovelReader /></PrivateRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </div>
      </Suspense>

      {/* 密钥B：操作验证对话框（全局，不受路由影响） */}
      {!IS_WEB_BUILD && (
        <OperationKeyDialog
          show={showOperationDialog}
          onVerified={() => {
            executePendingActions();
          }}
          onCancel={() => {
            cancelPendingActions();
          }}
        />
      )}
    </>
  );
}

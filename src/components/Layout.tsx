import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Scroll,
  Users,
  Map,
  Cog,
  Flag,
  Layers,
  List,
  Menu,
  X,
  LogOut,
  MessageCircle,
  MessagesSquare,
  Monitor,
  Info,
  RefreshCw,
  BookOpen,
  Sun,
  Moon,
  ScrollText,
  StickyNote,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { SECTION_PREFIX } from '../types';
import BackupBar from './BackupBar';
import { IS_WEB_BUILD } from '../lib/buildTarget';
import { useHiddenUnlock } from '../lib/hiddenUnlock';
import { ConfirmDialog, BaseDialog } from './Dialog';

const navItems = [
  { to: '/', label: '首页', icon: Home },
  { to: '/timeline', label: '时间轴', icon: Scroll },
  { to: '/character', label: '角色库', icon: Users },
  { to: '/geography', label: '地理与势力', icon: Map },
  { to: '/tech', label: '科技与设定', icon: Cog },
  { to: '/milestone', label: '剧情里程碑', icon: Flag },
  { to: '/novel', label: '小说馆', icon: BookOpen },
  { to: '/notebook', label: '记忆本', icon: StickyNote },
  { to: '/custom', label: '扩展分类', icon: Layers },
  { to: '/index', label: '全部内容', icon: List },
];

const sectionRoutes: Record<string, string> = {
  '/timeline': SECTION_PREFIX.timeline,
  '/character': SECTION_PREFIX.character,
  '/geography': SECTION_PREFIX.geography,
  '/tech': SECTION_PREFIX.tech,
  '/milestone': SECTION_PREFIX.milestone,
  '/custom': SECTION_PREFIX.custom,
};

export default function Layout() {
  const { isAuthenticated, currentUser, logout } = useAuthStore();
  const refreshData = useDataStore(s => s.refresh);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  const [pendingTheme, setPendingTheme] = useState<'dark' | 'light' | 'parchment'>('dark');
  // 讨论浮动按钮：'intro'(初始5s展示) → 'peek'(缩回只露黄色小边) → 'expanded'(点击后展开小圆球)
  const [fabState, setFabState] = useState<'intro' | 'peek' | 'expanded'>('intro');
  const fabTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isUnlocked = useHiddenUnlock(s => s.isUnlocked);

  // 自动缩回计时器：intro 5s 后 peek；expanded 3s 无操作后 peek
  useEffect(() => {
    if (fabTimerRef.current) clearTimeout(fabTimerRef.current);
    if (fabState === 'intro') {
      fabTimerRef.current = setTimeout(() => setFabState('peek'), 5000);
    } else if (fabState === 'expanded') {
      fabTimerRef.current = setTimeout(() => setFabState('peek'), 3000);
    }
    return () => {
      if (fabTimerRef.current) clearTimeout(fabTimerRef.current);
    };
  }, [fabState]);

  // 路由变化时自动最小化，不挡新页面内容
  useEffect(() => {
    setFabState('peek');
  }, [location.pathname]);

  // 小露黄条(peek)点一下 → 展开(expanded)；展开点主按钮 → 跳转评论区；展开点小叉 → 立刻缩回
  const onPeekClick = () => setFabState('expanded');
  const onMainFabClick = () => goToComments();
  const onCollapseClick = (e: React.MouseEvent) => { e.stopPropagation(); setFabState('peek'); };

  // 主题初始化：从 localStorage 读取，默认深色
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | 'parchment' | null;
    if (saved === 'light') {
      document.documentElement.classList.add('light');
    } else if (saved === 'parchment') {
      document.documentElement.classList.add('parchment');
    }
  }, []);

  const handleThemeClick = () => {
    const el = document.documentElement;
    let current: 'dark' | 'light' | 'parchment' = 'dark';
    if (el.classList.contains('parchment')) current = 'parchment';
    else if (el.classList.contains('light')) current = 'light';
    setPendingTheme(current);
    setShowThemeDialog(true);
  };

  const handleThemeConfirm = () => {
    const el = document.documentElement;
    el.classList.remove('light', 'parchment');
    if (pendingTheme === 'light') {
      el.classList.add('light');
      localStorage.setItem('theme', 'light');
    } else if (pendingTheme === 'parchment') {
      el.classList.add('parchment');
      localStorage.setItem('theme', 'parchment');
    } else {
      localStorage.setItem('theme', 'dark');
    }
    setShowThemeDialog(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  /** 强制刷新页面：卡住或数据不同步时使用 */
  const handleForceRefresh = () => {
    setShowRefreshConfirm(true);
  };

  // 根据当前页面智能跳转评论区
  const goToComments = () => {
    const path = location.pathname;
    // 在条目详情页 → 跳到条目评论区（需要 code，但 Layout 无法直接获取，跳到板块评论）
    for (const [route, code] of Object.entries(sectionRoutes)) {
      if (path.startsWith(route)) {
        navigate(`/comments/${code}`);
        return;
      }
    }
    // 默认跳总评论区
    navigate('/comments/GLOBAL');
  };

  // 未登录：不显示侧边栏与顶栏
  if (!isAuthenticated) {
    return <Outlet />;
  }

  const renderNav = (onNavigate?: () => void) => (
    <nav className="space-y-0.5">
      {navItems.map(item => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 border-l-2 app-nav-item ${
                isActive ? 'active' : ''
              }`
            }
          >
            <Icon size={17} />
            <span className="text-sm tracking-wide">{item.label}</span>
          </NavLink>
        );
      })}
      {/* 评论总览链接 */}
      <div className="gold-divider my-3" />
      <NavLink
        to="/comments"
        end
        onClick={onNavigate}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 border-l-2 app-nav-item ${
            isActive ? 'active' : ''
          }`
        }
      >
        <MessagesSquare size={17} />
        <span className="text-sm tracking-wide">评论总览</span>
      </NavLink>

      {/* 关于页面 */}
      <NavLink
        to="/about"
        onClick={onNavigate}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 border-l-2 app-nav-item ${
            isActive ? 'active' : ''
          }`
        }
      >
        <Info size={17} />
        <span className="text-sm tracking-wide">关于</span>
      </NavLink>

      {/* 本地备份工具栏：App 版始终显示；Web 版仅在隐藏解锁后显示 */}
      {(!IS_WEB_BUILD || isUnlocked) && (
        <>
          <div className="gold-divider my-3" />
          <BackupBar />
        </>
      )}

      {/* 强制刷新按钮（三端通用） */}
      <div className="gold-divider my-3" />
      <button
        onClick={handleForceRefresh}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 border-l-2 border-transparent app-nav-item"
        title="卡住或数据不同步时点击"
      >
        <RefreshCw size={17} />
        <span className="text-sm tracking-wide">强制刷新</span>
      </button>

      {/* 主题切换按钮 */}
      <button
        onClick={handleThemeClick}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 border-l-2 border-transparent app-nav-item"
        title="切换深色/浅色主题"
      >
        <Sun size={17} />
        <span className="text-sm tracking-wide">主题切换</span>
      </button>

      {/* 桌面 App 状态提示 */}
      {typeof window !== 'undefined' && window.archiveApp && (
        <div className="mt-3 px-2 py-1.5 rounded-md bg-gold-900/10 border border-gold-800/30 flex items-center gap-2">
          <Monitor size={12} className="text-gold-400 shrink-0" />
          <span className="text-[11px] text-gold-400/80 leading-snug">本地桌面版 · 数据永久存于本机</span>
        </div>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部导航栏（pt 用 safe-area 避开刘海/状态栏） */}
      <header className="sticky top-0 z-30 app-header" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="lg:hidden btn-ghost p-2"
              aria-label="菜单"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <NavLink to="/" className="flex items-center gap-2.5">
              <img
                src="/logo.jpg"
                alt="奥菲斯帝国档案馆"
                className="logo-ring w-8 h-8 rounded-full object-cover border border-gold-800/60 shadow-sm"
              />
              <span className="gold-title text-base sm:text-lg font-bold">
                奥菲斯帝国档案馆
              </span>
            </NavLink>
          </div>
          <div className="flex items-center gap-3">
            {currentUser && (
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className="tag-gold">
                  {currentUser.role === 'admin' ? '管理员' : '游客'}
                </span>
                <span className="text-gold-400/80 font-medium">{currentUser.username}</span>
              </div>
            )}
            <button onClick={handleLogout} className="btn-ghost text-sm">
              <LogOut size={16} />
              <span className="hidden sm:inline">登出</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* 桌面侧边栏 */}
        <aside className="hidden lg:block w-56 shrink-0 app-sidebar p-4">
          {renderNav()}
        </aside>

        {/* 移动端抽屉 */}
        {sidebarOpen && (
          <>
            <div
              className="lg:hidden fixed inset-0 top-14 z-30 sidebar-overlay"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="lg:hidden fixed left-0 top-14 bottom-0 z-40 w-56 app-sidebar-mobile p-4 overflow-y-auto animate-slide-up">
              {renderNav(() => setSidebarOpen(false))}
            </aside>
          </>
        )}

        {/* 主内容区（pb 留出系统导航栏安全区） */}
        <main className="rune-bg flex-1 min-w-0 p-4 sm:p-6 lg:p-8" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}>
          <Outlet />
        </main>
      </div>

      {/* 右下角讨论：三态 — intro(5s提示球)/peek(缩露黄边)/expanded(展开圆球) */}
      {fabState === 'intro' && (
        <button
          onClick={onMainFabClick}
          className="fixed right-5 z-20 btn-gold rounded-full shadow-xl animate-fade-in"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
          aria-label="讨论"
        >
          <MessageCircle size={18} />
          <span className="text-sm">讨论</span>
        </button>
      )}

      {fabState === 'peek' && (
        <button
          onClick={onPeekClick}
          className="fixed z-20 transition-all duration-300"
          style={{
            right: 0,
            bottom: 'calc(env(safe-area-inset-bottom) + 1.8rem)',
            width: '14px',
            height: '44px',
            background: 'linear-gradient(90deg, transparent 0%, #c9a84c 40%, #d8b860 100%)',
            borderRadius: '8px 0 0 8px',
            boxShadow: '-2px 0 8px rgba(0,0,0,0.3), inset 1px 0 0 rgba(255,255,255,0.25)',
            border: 'none',
            cursor: 'pointer',
          }}
          aria-label="展开讨论按钮"
          title="点击展开"
        />
      )}

      {fabState === 'expanded' && (
        <div
          className="fixed right-4 z-20 animate-fade-in"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
        >
          <div className="relative flex items-center">
            <button
              onClick={onMainFabClick}
              className="btn-gold rounded-full shadow-xl w-14 h-14 flex items-center justify-center"
              style={{ padding: 0 }}
              aria-label="前往讨论区"
              title="前往讨论区"
            >
              <MessageCircle size={22} />
            </button>
            <button
              onClick={onCollapseClick}
              className="absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-xs shadow"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-tertiary)',
                border: '1px solid var(--border-default)',
              }}
              aria-label="收起"
              title="收起"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 强制刷新确认对话框 */}
      <ConfirmDialog
        open={showRefreshConfirm}
        onClose={() => setShowRefreshConfirm(false)}
        title="刷新数据"
        message="重新从本地数据库读取数据，不会丢失已保存的内容。"
        confirmText="刷新"
        onConfirm={async () => {
          try {
            await refreshData();
          } catch (e) {
            console.error('refresh failed', e);
          }
        }}
      />

      {/* 主题切换对话框 */}
      <BaseDialog
        open={showThemeDialog}
        onClose={() => setShowThemeDialog(false)}
        title="切换主题"
      >
        <div className="space-y-4">
          <p style={{ color: 'var(--text-secondary)' }} className="text-sm">选择界面主题，切换会立即生效并记忆选择。</p>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setPendingTheme('dark')}
              className="p-4 rounded-lg border transition-all flex flex-col items-center gap-2"
              style={{
                borderColor: pendingTheme === 'dark' ? 'var(--color-gold-500)' : 'var(--border-default)',
                backgroundColor: pendingTheme === 'dark' ? 'color-mix(in srgb, var(--color-gold-500) 12%, transparent)' : 'var(--bg-elevated)',
              }}
            >
              <Moon size={22} style={{ color: pendingTheme === 'dark' ? 'var(--color-gold-400)' : 'var(--text-tertiary)' }} />
              <span className="text-sm font-medium" style={{ color: pendingTheme === 'dark' ? 'var(--accent-color, var(--color-gold-400))' : 'var(--text-primary)' }}>深色</span>
              <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>鎏金黑底</span>
            </button>
            <button
              onClick={() => setPendingTheme('light')}
              className="p-4 rounded-lg border transition-all flex flex-col items-center gap-2"
              style={{
                borderColor: pendingTheme === 'light' ? 'var(--color-gold-500)' : 'var(--border-default)',
                backgroundColor: pendingTheme === 'light' ? 'color-mix(in srgb, var(--color-gold-500) 12%, transparent)' : 'var(--bg-elevated)',
              }}
            >
              <Sun size={22} style={{ color: pendingTheme === 'light' ? 'var(--color-gold-400)' : 'var(--text-tertiary)' }} />
              <span className="text-sm font-medium" style={{ color: pendingTheme === 'light' ? 'var(--accent-color, var(--color-gold-400))' : 'var(--text-primary)' }}>浅色</span>
              <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>护眼白底</span>
            </button>
            <button
              onClick={() => setPendingTheme('parchment')}
              className="p-4 rounded-lg border transition-all flex flex-col items-center gap-2"
              style={{
                borderColor: pendingTheme === 'parchment' ? 'var(--color-gold-500)' : 'var(--border-default)',
                backgroundColor: pendingTheme === 'parchment' ? 'color-mix(in srgb, var(--color-gold-500) 12%, transparent)' : 'var(--bg-elevated)',
              }}
            >
              <ScrollText size={22} style={{ color: pendingTheme === 'parchment' ? 'var(--color-gold-400)' : 'var(--text-tertiary)' }} />
              <span className="text-sm font-medium" style={{ color: pendingTheme === 'parchment' ? 'var(--accent-color, var(--color-gold-400))' : 'var(--text-primary)' }}>牛皮纸</span>
              <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>复古纸感</span>
            </button>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowThemeDialog(false)} className="btn-ghost text-sm">取消</button>
            <button onClick={handleThemeConfirm} className="btn-gold text-sm">确定</button>
          </div>
        </div>
      </BaseDialog>
    </div>
  );
}

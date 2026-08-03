import { useState } from 'react';
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
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { SECTION_PREFIX } from '../types';
import BackupBar from './BackupBar';
import { IS_WEB_BUILD } from '../lib/buildTarget';
import { useHiddenUnlock } from '../lib/hiddenUnlock';
import { ConfirmDialog } from './Dialog';

const navItems = [
  { to: '/', label: '首页', icon: Home },
  { to: '/timeline', label: '时间轴', icon: Scroll },
  { to: '/character', label: '角色库', icon: Users },
  { to: '/geography', label: '地理与势力', icon: Map },
  { to: '/tech', label: '科技与设定', icon: Cog },
  { to: '/milestone', label: '剧情里程碑', icon: Flag },
  { to: '/novel', label: '小说馆', icon: BookOpen },
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
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isUnlocked = useHiddenUnlock(s => s.isUnlocked);

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
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 border-l-2 ${
                isActive
                  ? 'bg-gold-900/20 text-gold-300 border-gold-500'
                  : 'text-ink-400 hover:text-gold-400/80 hover:bg-ink-800/30 border-transparent'
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
          `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 border-l-2 ${
            isActive
              ? 'bg-gold-900/20 text-gold-300 border-gold-500'
              : 'text-ink-400 hover:text-gold-400/80 hover:bg-ink-800/30 border-transparent'
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
          `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 border-l-2 ${
            isActive
              ? 'bg-gold-900/20 text-gold-300 border-gold-500'
              : 'text-ink-400 hover:text-gold-400/80 hover:bg-ink-800/30 border-transparent'
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
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 border-l-2 border-transparent text-ink-400 hover:text-gold-400/80 hover:bg-ink-800/30"
        title="卡住或数据不同步时点击"
      >
        <RefreshCw size={17} />
        <span className="text-sm tracking-wide">强制刷新</span>
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
      <header className="sticky top-0 z-30 bg-ink-950/95 backdrop-blur border-b border-gold-900/20" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
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
        <aside className="hidden lg:block w-56 shrink-0 border-r border-gold-900/15 bg-ink-950/60 p-4">
          {renderNav()}
        </aside>

        {/* 移动端抽屉 */}
        {sidebarOpen && (
          <>
            <div
              className="lg:hidden fixed inset-0 top-14 z-30 bg-black/60"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="lg:hidden fixed left-0 top-14 bottom-0 z-40 w-56 bg-ink-950 border-r border-gold-900/20 p-4 overflow-y-auto animate-slide-up">
              {renderNav(() => setSidebarOpen(false))}
            </aside>
          </>
        )}

        {/* 主内容区（pb 留出系统导航栏安全区） */}
        <main className="rune-bg flex-1 min-w-0 p-4 sm:p-6 lg:p-8" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}>
          <Outlet />
        </main>
      </div>

      {/* 右下角浮动按钮：快速前往评论区（bottom 用 calc 避开系统导航栏） */}
      <button
        onClick={goToComments}
        className="fixed right-6 z-20 btn-gold rounded-full shadow-lg"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
        aria-label="讨论"
        title="前往评论区"
      >
        <MessageCircle size={18} />
        <span className="text-sm">讨论</span>
      </button>

      {/* 强制刷新确认对话框 */}
      <ConfirmDialog
        open={showRefreshConfirm}
        onClose={() => setShowRefreshConfirm(false)}
        title="刷新数据"
        message="重新从本地数据库读取数据，不会丢失已保存的内容。"
        confirmText="刷新"
        onConfirm={async () => {
          setRefreshing(true);
          try {
            await refreshData();
          } catch (e) {
            console.error('refresh failed', e);
          }
          setRefreshing(false);
        }}
      />
    </div>
  );
}

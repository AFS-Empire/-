import { useNavigate } from 'react-router-dom';
import {
  Scroll,
  Users,
  Map,
  LogIn,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { IS_WEB_BUILD } from '../lib/buildTarget';

export default function Home() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const entries = useDataStore(s => s.entries);
  const eras = useDataStore(s => s.eras);

  const countByType = (type: string) => entries.filter(e => e.type === type).length;

  // 最近更新（取最新5条）
  const recent = [...entries].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

  // 未登录：简介 + 登录引导
  if (!isAuthenticated) {
    return (
      <div className="rune-bg min-h-screen flex items-center justify-center p-4">
        <div className="max-w-xl text-center">
          <div className="gold-divider mb-8 max-w-[200px] mx-auto" />
          <h1 className="gold-title text-3xl sm:text-4xl font-bold mb-4">
            奥菲斯帝国档案馆
          </h1>
          <p className="text-gold-400/60 text-sm tracking-[0.3em] mb-8">
            万世沧桑 · 尽藏于此
          </p>
          <div className="gold-divider mb-8 max-w-[200px] mx-auto" />
          <p className="text-ink-400 leading-relaxed mb-10 text-sm">
            帝国已存续万年。历史是它的痕迹，也是它的面容。此间记录，即为秩序的回声。
          </p>
          <button onClick={() => navigate('/login')} className="btn-gold">
            <LogIn size={18} />
            {IS_WEB_BUILD ? '申请访问' : '登录查阅'}
          </button>
          <p className="text-xs text-ink-600 mt-12 tracking-wide">
            数据存储于本地 · 无需联网
          </p>
        </div>
      </div>
    );
  }

  // 页眉三大入口
  const headerEntries = [
    { to: '/timeline', title: '时间轴', desc: '叙事主线 · 编年史', icon: Scroll, count: eras.length, unit: '纪元' },
    { to: '/character', title: '世界观', desc: '人物网络 · 生平关系', icon: Users, count: countByType('character'), unit: '角色' },
    { to: '/geography', title: '地图', desc: '空间图谱 · 四级嵌套', icon: Map, count: countByType('geography'), unit: '地点' },
  ];

  const sectionLabel: Record<string, string> = {
    timeline: '时间轴',
    character: '角色',
    geography: '地理',
    tech: '科技',
    milestone: '里程碑',
    custom: '扩展',
  };

  return (
    <div className="animate-fade-in max-w-3xl mx-auto px-2 sm:px-0">
      {/* 页眉三大入口 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {headerEntries.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              className="group panel-gold p-5 text-left transition-all duration-300 hover:border-gold-700/50 hover:bg-[var(--bg-elevated)]"
            >
              <div className="flex items-center justify-between mb-3">
                <Icon size={22} className="text-gold-500/70 group-hover:text-gold-400 transition-colors" />
                <ArrowRight size={16} className="text-ink-600 group-hover:text-gold-500/60 transition-colors" />
              </div>
              <h3 className="text-lg font-bold text-gold-200/90 tracking-wide mb-1">{item.title}</h3>
              <p className="text-xs text-ink-500 mb-3">{item.desc}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold gold-text">{item.count}</span>
                <span className="text-xs text-ink-500">{item.unit}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 精选展示区：最近更新 */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <Clock size={16} className="text-gold-500/60" />
          <h2 className="text-sm font-medium text-gold-300/80 tracking-widest">最近更新</h2>
          <div className="gold-divider flex-1" />
        </div>
        {recent.length === 0 ? (
          <div className="panel p-8 text-center text-ink-500 text-sm">暂无档案记录</div>
        ) : (
          <div className="space-y-2">
            {recent.map(entry => (
              <div
                key={entry.id}
                onClick={() => navigate(`/entry/${entry.id}`)}
                className="card-entry flex items-center gap-4 px-4 py-3"
              >
                <span className="tag-gold shrink-0">{sectionLabel[entry.type] || entry.type}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-200 truncate">{entry.title}</div>
                  <div className="text-xs text-ink-500 truncate">{entry.summary}</div>
                </div>
                <span className="text-xs text-ink-600 shrink-0">
                  {new Date(entry.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 精选展示区：概览统计 */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-medium text-gold-300/80 tracking-widest">馆藏概览</h2>
          <div className="gold-divider flex-1" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '时间轴事件', count: countByType('timeline'), to: '/timeline' },
            { label: '角色档案', count: countByType('character'), to: '/character' },
            { label: '地理条目', count: countByType('geography'), to: '/geography' },
            { label: '科技设定', count: countByType('tech'), to: '/tech' },
            { label: '剧情节点', count: countByType('milestone'), to: '/milestone' },
            { label: '扩展条目', count: countByType('custom'), to: '/custom' },
            { label: '纪元数量', count: eras.length, to: '/timeline' },
            { label: '档案总计', count: entries.length, to: '/index' },
          ].map(stat => (
            <button
              key={stat.label}
              onClick={() => navigate(stat.to)}
              className="panel p-4 text-left hover:border-gold-800/40 transition-colors"
            >
              <div className="text-2xl font-bold gold-text mb-1">{stat.count}</div>
              <div className="text-xs text-ink-500">{stat.label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

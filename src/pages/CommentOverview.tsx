import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, MessageSquare, Search } from 'lucide-react';
import { useCommentStore } from '../store/commentStore';
import { SECTION_PREFIX, SECTIONS } from '../types';
import { fmtTime } from '../lib/format';

// 板块前缀 → 中文名
const PREFIX_LABEL: Record<string, string> = {};
SECTIONS.forEach(s => {
  PREFIX_LABEL[SECTION_PREFIX[s.type]] = s.name;
});

const SECTION_PREFIXES = Object.values(SECTION_PREFIX);

type Filter = 'all' | 'global' | 'timeline' | 'character' | 'geography' | 'tech' | 'milestone' | 'custom';

const FILTERS: { key: Filter; label: string; match: (code: string) => boolean }[] = [
  { key: 'all', label: '全部', match: () => true },
  { key: 'global', label: '总评论', match: c => c === 'GLOBAL' },
  { key: 'timeline', label: '时间轴', match: c => c.startsWith('TIME') },
  { key: 'character', label: '角色', match: c => c.startsWith('CHAR') },
  { key: 'geography', label: '地理', match: c => c.startsWith('GEO') },
  { key: 'tech', label: '科技', match: c => c.startsWith('TECH') },
  { key: 'milestone', label: '里程碑', match: c => c.startsWith('MILE') },
  { key: 'custom', label: '扩展', match: c => c.startsWith('CUST') },
];

function codeLabel(code: string): string {
  if (code === 'GLOBAL') return '总评论';
  if (PREFIX_LABEL[code]) return PREFIX_LABEL[code];
  const prefix = SECTION_PREFIXES.find(p => code.startsWith(p));
  return prefix ? `${PREFIX_LABEL[prefix]} · ${code}` : code;
}

export default function CommentOverview() {
  const navigate = useNavigate();
  const comments = useCommentStore(s => s.comments);
  const loaded = useCommentStore(s => s.loaded);
  const refresh = useCommentStore(s => s.refresh);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const f = FILTERS.find(x => x.key === filter)!;
    let list = comments.filter(c => f.match(c.targetCode));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        c => c.content.toLowerCase().includes(q) || c.author.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [comments, filter, search]);

  const quickJumps = [
    { code: 'GLOBAL', label: '总评论区' },
    ...SECTIONS.map(s => ({ code: SECTION_PREFIX[s.type], label: `${s.name}区` })),
  ];

  return (
    <div className="animate-fade-in max-w-3xl mx-auto px-2 sm:px-0 space-y-6">
      {/* 顶部 */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="section-title flex items-center gap-2">
            <MessageCircle size={20} className="text-gold-500/70" />
            评论总览
          </h1>
          <p className="text-sm text-ink-400 mt-1">共 {comments.length} 条讨论</p>
        </div>
      </div>

      {/* 快速跳转 */}
      <div className="panel p-4">
        <div className="text-xs text-gold-400/70 tracking-widest mb-2">快速跳转</div>
        <div className="flex flex-wrap gap-2">
          {quickJumps.map(j => (
            <button
              key={j.code}
              onClick={() => navigate(`/comments/${j.code}`)}
              className="btn-outline text-xs py-1.5 px-3"
            >
              {j.label}
            </button>
          ))}
        </div>
      </div>

      {/* 搜索 + 筛选 */}
      <div className="panel p-4 space-y-3">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索评论内容或作者..."
            className="input-field pl-10 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`tag cursor-pointer ${filter === f.key ? 'tag-gold' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 列表 */}
      {!loaded ? (
        <div className="panel p-12 text-center text-ink-500">载入中...</div>
      ) : filtered.length === 0 ? (
        <div className="panel p-12 text-center">
          <MessageCircle size={40} className="mx-auto text-ink-600 mb-3" />
          <p className="text-ink-400">暂无任何讨论</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="panel p-4 hover:border-gold-800/50 transition-colors">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="font-medium text-gold-100">{c.author}</span>
                <span className={`tag ${c.authorRole === 'admin' ? 'tag-gold' : ''}`}>
                  {c.authorRole === 'admin' ? '管理员' : '访客'}
                </span>
                {c.isPinned && <span className="tag-gold">置顶</span>}
                <button
                  onClick={() => navigate(`/comments/${c.targetCode}`)}
                  className="tag-gold cursor-pointer hover:bg-gold-900/50 transition-colors ml-auto"
                  title={`前往 ${c.targetCode} 评论区`}
                >
                  {codeLabel(c.targetCode)}
                </button>
              </div>
              <p className="text-ink-300 text-sm line-clamp-2 whitespace-pre-wrap">{c.content}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-ink-500">
                  {c.targetTitle && <span className="text-ink-400">{c.targetTitle} · </span>}
                  {fmtTime(c.createdAt)}
                </span>
                {c.parentId && (
                  <span className="text-xs text-ink-600 inline-flex items-center gap-1">
                    <MessageSquare size={11} /> 回复
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

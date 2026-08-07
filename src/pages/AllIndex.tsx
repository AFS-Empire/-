import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, FileText } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { SECTIONS } from '../types';
import type { SectionType } from '../types';

export default function AllIndex() {
  const navigate = useNavigate();
  const entries = useDataStore(s => s.entries);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<SectionType | 'all'>('all');

  // 按拼音首字母分组（简化版：按标题首字符）
  const grouped = useMemo(() => {
    let list = entries;
    if (filterType !== 'all') list = list.filter(e => e.type === filterType);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'zh'));
    const groups: Record<string, typeof entries> = {};
    for (const e of list) {
      const ch = e.title[0]?.toUpperCase() || '#';
      const key = /[A-Z]/.test(ch) ? ch : '#';
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }
    return groups;
  }, [entries, search, filterType]);

  const sortedKeys = Object.keys(grouped).sort();
  const totalCount = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

  const typeLabel: Record<string, string> = {};
  SECTIONS.forEach(s => { typeLabel[s.type] = s.name; });

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* 顶部 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="section-title">全部内容索引</h1>
          <p className="text-sm text-ink-400 mt-1">共 {totalCount} 条档案</p>
        </div>
      </div>

      {/* 搜索 + 筛选 */}
      <div className="panel p-4 mb-6 space-y-3">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索标题、简介或标签..."
            className="input-field pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`tag cursor-pointer ${filterType === 'all' ? 'tag-gold' : ''}`}
          >
            全部
          </button>
          {SECTIONS.map(s => (
            <button
              key={s.type}
              onClick={() => setFilterType(s.type)}
              className={`tag cursor-pointer ${filterType === s.type ? 'tag-gold' : ''}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* 字母索引快捷跳转 */}
      {sortedKeys.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {sortedKeys.map(k => (
            <a
              key={k}
              href={`#group-${k}`}
              className="w-8 h-8 flex items-center justify-center rounded text-sm text-gold-400 hover:bg-gold-900/40 transition-colors"
            >
              {k}
            </a>
          ))}
        </div>
      )}

      {/* 分组列表 */}
      {sortedKeys.length === 0 ? (
        <div className="panel p-12 text-center">
          <FileText size={48} className="mx-auto text-ink-600 mb-3" />
          <p className="text-ink-400">未找到匹配的档案</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedKeys.map(key => (
            <div key={key} id={`group-${key}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-gold-900/40 text-gold-300 font-bold">
                  {key}
                </span>
                <div className="gold-divider flex-1" />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {grouped[key].map(entry => (
                  <div
                    key={entry.id}
                    onClick={() => navigate(`/entry/${entry.id}`)}
                    className="card-entry flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-ink-100 truncate">{entry.title}</div>
                      <div className="text-xs text-ink-500 truncate">{entry.summary}</div>
                    </div>
                    <span className="tag-gold shrink-0">{typeLabel[entry.type] || entry.type}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

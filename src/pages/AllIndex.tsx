import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, FileText, X, ArrowRight } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { SECTIONS } from '../types';
import type { SectionType } from '../types';

export default function AllIndex() {
  const navigate = useNavigate();
  const entries = useDataStore(s => s.entries);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<SectionType | 'all'>('all');
  const [focused, setFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // 搜索联想：实时匹配标题/简介/标签
  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    let list = entries;
    if (filterType !== 'all') list = list.filter(e => e.type === filterType);
    return list
      .filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [entries, search, filterType]);

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

  // 高亮搜索词
  const highlight = (text: string, query: string) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-gold-500/30 text-gold-300 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  // 点击建议
  const selectSuggestion = (id: string) => {
    navigate(`/entry/${id}`);
    setSearch('');
    setActiveSuggestion(-1);
  };

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && activeSuggestion >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeSuggestion].id);
    } else if (e.key === 'Escape') {
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  // 点击外部关闭建议
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-0 animate-fade-in">
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
            ref={inputRef}
            value={search}
            onChange={e => { setSearch(e.target.value); setActiveSuggestion(-1); }}
            onFocus={() => setFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder="搜索标题、简介或标签..."
            className="input-field pl-10 pr-10"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setActiveSuggestion(-1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300"
            >
              <X size={16} />
            </button>
          )}
          {/* 搜索联想下拉 */}
          {focused && search.trim() && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 bg-var(--bg-surface) border border-var(--border-default) rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
            >
              {suggestions.map((entry, idx) => (
                <button
                  key={entry.id}
                  onMouseEnter={() => setActiveSuggestion(idx)}
                  onClick={() => selectSuggestion(entry.id)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                    idx === activeSuggestion
                      ? 'bg-gold-900/30 border-l-2 border-gold-500'
                      : 'border-l-2 border-transparent hover:bg-var(--bg-elevated)'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink-100 truncate">
                      {highlight(entry.title, search)}
                    </div>
                    <div className="text-xs text-ink-500 truncate mt-0.5">
                      {entry.summary ? highlight(entry.summary, search) : <span className="text-ink-600">无简介</span>}
                    </div>
                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {entry.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-var(--bg-elevated) text-ink-400">
                            {highlight(tag, search)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="tag-gold text-[10px]">{typeLabel[entry.type] || entry.type}</span>
                    <ArrowRight size={14} className="text-ink-600" />
                  </div>
                </button>
              ))}
              <div className="border-t border-var(--border-subtle) px-4 py-2 text-xs text-ink-500 flex items-center justify-between">
                <span>↑↓ 选择 · Enter 跳转 · Esc 关闭</span>
                <span>{suggestions.length} 条结果</span>
              </div>
            </div>
          )}
          {focused && search.trim() && suggestions.length === 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 bg-var(--bg-surface) border border-var(--border-default) rounded-lg shadow-lg z-50"
            >
              <div className="px-4 py-6 text-center text-ink-500 text-sm">
                未找到匹配的档案
              </div>
            </div>
          )}
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
                    className="card-entry flex items-center gap-3 px-4 py-3"
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

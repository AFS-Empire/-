import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Plus, Search, Trash2, Pin, PinOff, Edit3, X,
  StickyNote,
} from 'lucide-react';
import { useNotebookStore } from '../store/notebookStore';

const NOTE_COLORS = [
  { name: '默认', value: '' },
  { name: '暖黄', value: '#f5e6b8' },
  { name: '淡粉', value: '#f0d0d0' },
  { name: '浅蓝', value: '#d0e0f0' },
  { name: '青绿', value: '#d0e8d8' },
  { name: '丁香', value: '#e0d0e8' },
];

export { NOTE_COLORS };

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  const oneDay = 86400000;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < oneDay) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < oneDay * 7) return `${Math.floor(diff / oneDay)} 天前`;
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function Notebook() {
  const navigate = useNavigate();
  const { notes, loading, loadNotes, removeNote, togglePin } = useNotebookStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const filtered = notes.filter(n => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
  });

  const sortedNotes = [...filtered].sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    return b.updatedAt - a.updatedAt;
  });

  const handleDelete = async (id: number) => {
    if (confirm('确定删除这条笔记吗？')) {
      await removeNote(id);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-0 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2">
          <X size={20} />
        </button>
        <div className="flex-1">
          <h1 className="section-title">记忆本</h1>
          <p className="text-sm text-ink-400 mt-1">本地灵感碎片 · 共 {notes.length} 条</p>
        </div>
        <Link to="/notebook/new" className="btn-gold flex items-center gap-2 shrink-0">
          <Plus size={16} />
          <span>新建</span>
        </Link>
      </div>

      {notes.length > 0 && (
        <div className="panel p-3 mb-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索笔记..."
              className="input-field pl-9 py-2 text-sm"
            />
          </div>
        </div>
      )}

      {loading && notes.length === 0 ? (
        <div className="panel p-12 text-center">
          <StickyNote size={48} className="mx-auto text-ink-600 mb-3" />
          <p className="text-ink-400">加载中...</p>
        </div>
      ) : sortedNotes.length === 0 ? (
        <div className="panel p-12 text-center">
          <StickyNote size={48} className="mx-auto text-ink-600 mb-3" />
          <p className="text-ink-400 mb-2">{search ? '未找到匹配的笔记' : '还没有笔记'}</p>
          {!search && (
            <Link to="/notebook/new" className="btn-gold text-sm">
              <Plus size={14} className="inline mr-1" />
              记录第一条灵感
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sortedNotes.map(note => (
            <div
              key={note.id}
              className={`panel p-4 cursor-pointer transition-all hover:border-gold-700/50 ${
                note.pinned ? 'border-l-4 border-l-gold-500' : ''
              }`}
              style={note.color ? { backgroundColor: note.color + '22' } : undefined}
              onClick={() => navigate(`/notebook/${note.id}`)}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-medium text-ink-100 truncate flex-1">
                  {note.title || '无标题笔记'}
                </h3>
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => navigate(`/notebook/${note.id}/edit`)}
                    className="p-1 text-ink-500 hover:text-gold-400 transition-colors"
                    title="编辑"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => togglePin(note.id!)}
                    className="p-1 text-ink-500 hover:text-gold-400 transition-colors"
                    title={note.pinned ? '取消置顶' : '置顶'}
                  >
                    {note.pinned ? <Pin size={14} className="text-gold-400" /> : <PinOff size={14} />}
                  </button>
                  <button
                    onClick={() => handleDelete(note.id!)}
                    className="p-1 text-ink-500 hover:text-red-400 transition-colors"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-ink-400 line-clamp-3 whitespace-pre-wrap">
                {note.content || '（空内容）'}
              </p>
              <div className="flex items-center justify-between mt-3 text-xs text-ink-500">
                <span>{formatTime(note.updatedAt)}</span>
                {note.color && (
                  <span
                    className="w-3 h-3 rounded-full border border-var(--border-default)"
                    style={{ backgroundColor: note.color }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

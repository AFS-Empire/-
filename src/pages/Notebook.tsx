import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Trash2, Pin, PinOff, Edit3, X, Check,
  StickyNote, ArrowLeft,
} from 'lucide-react';
import { useNotebookStore } from '../store/notebookStore';
import type { NotebookNote } from '../data/db';

const NOTE_COLORS = [
  { name: '默认', value: '' },
  { name: '暖黄', value: '#f5e6b8' },
  { name: '淡粉', value: '#f0d0d0' },
  { name: '浅蓝', value: '#d0e0f0' },
  { name: '青绿', value: '#d0e8d8' },
  { name: '丁香', value: '#e0d0e8' },
];

function formatTime(ts: number): string {
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

type ViewState =
  | { mode: 'list' }
  | { mode: 'view'; note: NotebookNote }
  | { mode: 'edit'; note: NotebookNote | null; editingId: number | null };

export default function Notebook() {
  const navigate = useNavigate();
  const { notes, loading, loadNotes, addNote, updateNote, removeNote, togglePin } = useNotebookStore();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewState>({ mode: 'list' });
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editColor, setEditColor] = useState('');

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

  const openCreate = () => {
    setEditTitle('');
    setEditContent('');
    setEditColor('');
    setView({ mode: 'edit', note: null, editingId: null });
  };

  const openView = (note: NotebookNote) => {
    setView({ mode: 'view', note });
  };

  const enterEditFromView = (note: NotebookNote) => {
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditColor(note.color || '');
    setView({ mode: 'edit', note, editingId: note.id! });
  };

  const handleSave = async () => {
    if (view.mode !== 'edit') return;
    if (view.editingId !== null) {
      const updated = await updateNote(view.editingId, { title: editTitle, content: editContent, color: editColor });
      if (updated) {
        setView({ mode: 'view', note: updated });
      } else {
        setView({ mode: 'list' });
      }
    } else {
      const created = await addNote(editTitle, editContent, editColor);
      if (created) {
        setView({ mode: 'view', note: created });
      } else {
        setView({ mode: 'list' });
      }
    }
  };

  const handleDelete = async (id: number, fromList: boolean = false) => {
    if (confirm('确定删除这条笔记吗？')) {
      await removeNote(id);
      if (!fromList) setView({ mode: 'list' });
    }
  };

  const backToList = () => setView({ mode: 'list' });

  // ===== 列表页 =====
  if (view.mode === 'list') {
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
          <button
            onClick={openCreate}
            className="btn-gold flex items-center gap-2"
          >
            <Plus size={16} />
            <span>新建</span>
          </button>
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
              <button onClick={openCreate} className="btn-gold text-sm">
                <Plus size={14} className="inline mr-1" />
                记录第一条灵感
              </button>
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
                onClick={() => openView(note)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium text-ink-100 truncate flex-1">
                    {note.title || '无标题笔记'}
                  </h3>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => togglePin(note.id!)}
                      className="p-1 text-ink-500 hover:text-gold-400 transition-colors"
                      title={note.pinned ? '取消置顶' : '置顶'}
                    >
                      {note.pinned ? <Pin size={14} className="text-gold-400" /> : <PinOff size={14} />}
                    </button>
                    <button
                      onClick={() => handleDelete(note.id!, true)}
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

  // ===== 查看页（全屏备忘录样式） =====
  if (view.mode === 'view') {
    const { note } = view;
    return (
      <div
        className="min-h-[calc(100vh-8rem)] flex flex-col animate-fade-in"
        style={note.color ? { backgroundColor: note.color + '15' } : undefined}
      >
        {/* 顶部导航 */}
        <div className="sticky top-0 z-20 flex items-center justify-between gap-2 px-1 py-3 -mx-2 sm:mx-0 mb-4"
          style={{ backgroundColor: 'var(--bg-base)' }}
        >
          <button onClick={backToList} className="btn-ghost p-2 flex items-center gap-1">
            <ArrowLeft size={18} />
            <span className="text-sm text-ink-300 hidden sm:inline">返回</span>
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => togglePin(note.id!)}
              className="btn-ghost p-2"
              title={note.pinned ? '取消置顶' : '置顶'}
            >
              {note.pinned ? <Pin size={18} className="text-gold-400" /> : <PinOff size={18} />}
            </button>
            <button
              onClick={() => handleDelete(note.id!)}
              className="btn-ghost p-2 hover:text-red-400"
              title="删除"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={() => enterEditFromView(note)}
              className="btn-gold py-2 px-3 flex items-center gap-1.5"
            >
              <Edit3 size={16} />
              <span className="text-sm">编辑</span>
            </button>
          </div>
        </div>

        {/* 正文内容 */}
        <div className="flex-1 max-w-2xl w-full mx-auto px-2 sm:px-6 pb-24">
          <h1 className="text-2xl sm:text-3xl font-bold mb-3 text-ink-100 leading-snug">
            {note.title || '无标题笔记'}
          </h1>
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-8 pb-4"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <span>{formatTime(note.updatedAt)}</span>
            {note.color && (
              <span className="w-2.5 h-2.5 rounded-full border border-var(--border-subtle)"
                style={{ backgroundColor: note.color }}
              />
            )}
            {note.pinned && (
              <span className="flex items-center gap-1 text-gold-500">
                <Pin size={12} /> 置顶
              </span>
            )}
          </div>
          <div className="text-base sm:text-lg leading-relaxed whitespace-pre-wrap text-ink-200 break-words">
            {note.content || <span className="text-ink-500">（没有内容）</span>}
          </div>
        </div>
      </div>
    );
  }

  // ===== 编辑页（全屏，毛玻璃遮罩，无模态框） =====
  // （其实是全屏覆盖页，毛玻璃盖住列表，避免了用户看到"底部内容"）
  {
    const isNew = view.editingId === null;
    return (
      <div className="fixed inset-0 z-50 flex flex-col animate-fade-in"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-base) 88%, transparent)',
          backdropFilter: 'blur(14px) saturate(1.1)',
          WebkitBackdropFilter: 'blur(14px) saturate(1.1)',
        }}
      >
        {/* 编辑顶栏 */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0 border-b"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'color-mix(in srgb, var(--bg-surface) 82%, transparent)',
          }}
        >
          <button onClick={backToList} className="btn-ghost p-2 flex items-center gap-1">
            <X size={18} />
            <span className="text-sm text-ink-300 hidden sm:inline">取消</span>
          </button>
          <h3 className="font-bold text-ink-100">
            {isNew ? '新建笔记' : '编辑笔记'}
          </h3>
          <button onClick={handleSave} className="btn-gold py-2 px-3 flex items-center gap-1.5">
            <Check size={16} />
            <span className="text-sm">保存</span>
          </button>
        </div>

        {/* 编辑内容 */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 py-5 space-y-4">
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              placeholder="笔记标题"
              className="w-full text-2xl sm:text-3xl font-bold bg-transparent outline-none text-ink-100 placeholder:text-ink-600 py-2"
              autoFocus
            />
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              placeholder="记录你的灵感..."
              className="w-full min-h-[calc(100vh-22rem)] bg-transparent outline-none text-base sm:text-lg leading-relaxed text-ink-200 placeholder:text-ink-600 resize-none"
            />
          </div>
        </div>

        {/* 颜色选择底栏 */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 shrink-0 border-t"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'color-mix(in srgb, var(--bg-surface) 82%, transparent)',
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-ink-400">颜色：</span>
            {NOTE_COLORS.map(c => (
              <button
                key={c.value || 'default'}
                onClick={() => setEditColor(c.value)}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  editColor === c.value ? 'scale-125' : ''
                }`}
                style={{
                  backgroundColor: c.value || 'color-mix(in srgb, var(--bg-elevated) 80%, transparent)',
                  borderColor: editColor === c.value ? 'var(--color-gold-500)' : 'var(--border-subtle)',
                }}
                title={c.name}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
}

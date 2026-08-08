import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Check } from 'lucide-react';
import { useNotebookStore } from '../store/notebookStore';
import { NOTE_COLORS } from './Notebook';

export default function NotebookEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const noteId = isNew ? null : Number(id);

  const { notes, loadNotes, addNote, updateNote } = useNotebookStore();

  const existing = noteId !== null ? notes.find(n => n.id === noteId) : undefined;

  const [title, setTitle] = useState(existing?.title || '');
  const [content, setContent] = useState(existing?.content || '');
  const [color, setColor] = useState(existing?.color || '');

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // 如果是编辑模式，等笔记加载完后再填充
  useEffect(() => {
    if (!isNew && existing) {
      setTitle(existing.title || '');
      setContent(existing.content || '');
      setColor(existing.color || '');
    }
  }, [isNew, existing]);

  const handleSave = async () => {
    try {
      if (isNew) {
        const created = await addNote(title, content, color);
        if (created) {
          navigate(`/notebook/${created.id}`);
        } else {
          navigate('/notebook');
        }
      } else if (noteId !== null) {
        const updated = await updateNote(noteId, { title, content, color });
        if (updated) {
          navigate(`/notebook/${noteId}`);
        } else {
          navigate('/notebook');
        }
      }
    } catch (e) {
      alert('保存失败：' + (e as Error).message);
    }
  };

  return (
    <div
      className="min-h-[calc(100vh-8rem)] flex flex-col animate-fade-in"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* 编辑顶栏 */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0 border-b"
        style={{
          borderColor: 'var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <button onClick={() => navigate(-1)} className="btn-ghost p-2 shrink-0 flex items-center gap-1">
          <X size={18} />
          <span className="text-sm text-ink-300 hidden sm:inline">取消</span>
        </button>
        <h3 className="font-bold text-ink-100 text-center flex-1 truncate">
          {isNew ? '新建笔记' : '编辑笔记'}
        </h3>
        <button onClick={handleSave} className="btn-gold py-2 px-3 shrink-0 flex items-center gap-1.5">
          <Check size={16} />
          <span className="text-sm">保存</span>
        </button>
      </div>

      {/* 编辑内容 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 py-5 space-y-4">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="笔记标题"
            className="w-full text-2xl sm:text-3xl font-bold bg-transparent outline-none text-ink-100 placeholder:text-ink-600 py-2"
            autoFocus
          />
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
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
          backgroundColor: 'var(--bg-surface)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>颜色：</span>
          {NOTE_COLORS.map(c => (
            <button
              key={c.value || 'default'}
              onClick={() => setColor(c.value)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${
                color === c.value ? 'scale-125' : ''
              }`}
              style={{
                backgroundColor: c.value || 'var(--bg-elevated)',
                borderColor: color === c.value ? 'var(--color-gold-500)' : 'var(--border-subtle)',
              }}
              title={c.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

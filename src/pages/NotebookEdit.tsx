import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Check } from 'lucide-react';
import { useNotebookStore } from '../store/notebookStore';

export default function NotebookEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const noteId = isNew ? null : Number(id);

  const { notes, loadNotes, addNote, updateNote } = useNotebookStore();

  const existing = noteId !== null ? notes.find(n => n.id === noteId) : undefined;

  const [title, setTitle] = useState(existing?.title || '');
  const [content, setContent] = useState(existing?.content || '');

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    if (!isNew && existing) {
      setTitle(existing.title || '');
      setContent(existing.content || '');
    }
  }, [isNew, existing]);

  const handleSave = async () => {
    try {
      if (isNew) {
        const created = await addNote(title, content, existing?.color || '');
        if (created) {
          navigate(`/notebook/${created.id}`, { replace: true });
        } else {
          navigate('/notebook', { replace: true });
        }
      } else if (noteId !== null) {
        const updated = await updateNote(noteId, { title, content, color: existing?.color });
        if (updated) {
          navigate(`/notebook/${noteId}`, { replace: true });
        } else {
          navigate('/notebook', { replace: true });
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
      {/* 一体化顶栏：与页面同背景，无分层感 */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
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

      {/* 正文编辑区 */}
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
            className="w-full min-h-[calc(100vh-18rem)] bg-transparent outline-none text-base sm:text-lg leading-relaxed text-ink-200 placeholder:text-ink-600 resize-none"
          />
        </div>
      </div>
    </div>
  );
}

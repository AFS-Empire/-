import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pin, PinOff, Trash2, Edit3 } from 'lucide-react';
import { useNotebookStore } from '../store/notebookStore';
import { formatTime } from './Notebook';

export default function NotebookView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const noteId = Number(id);
  const { notes, loadNotes, removeNote, togglePin } = useNotebookStore();

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const note = notes.find(n => n.id === noteId);

  if (!note) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <p className="text-ink-400">笔记不存在或已被删除</p>
        <button onClick={() => navigate('/notebook')} className="btn-gold mt-4">
          返回记忆本
        </button>
      </div>
    );
  }

  const handleDelete = async () => {
    if (confirm('确定删除这条笔记吗？')) {
      await removeNote(noteId);
      navigate('/notebook');
    }
  };

  return (
    <div
      className="min-h-[calc(100vh-8rem)] flex flex-col animate-fade-in"
      style={note.color ? { backgroundColor: note.color + '15' } : undefined}
    >
      {/* 顶部导航 */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-2 px-1 py-3 -mx-2 sm:mx-0 mb-4"
        style={{ backgroundColor: 'var(--bg-base)' }}
      >
        <button onClick={() => navigate(-1)} className="btn-ghost p-2 flex items-center gap-1">
          <ArrowLeft size={18} />
          <span className="text-sm text-ink-300 hidden sm:inline">返回</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => togglePin(noteId)}
            className="btn-ghost p-2"
            title={note.pinned ? '取消置顶' : '置顶'}
          >
            {note.pinned ? <Pin size={18} className="text-gold-400" /> : <PinOff size={18} />}
          </button>
          <button
            onClick={handleDelete}
            className="btn-ghost p-2 hover:text-red-400"
            title="删除"
          >
            <Trash2 size={18} />
          </button>
          <button
            onClick={() => navigate(`/notebook/${noteId}/edit`, { replace: true })}
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

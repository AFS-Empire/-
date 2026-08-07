import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Flag } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import type { Milestone as MilestoneEntry } from '../types';
import { ConfirmDialog } from '../components/Dialog';
import { EmptyState } from '../components/Common';
import { IMPORTANCE_LABEL } from '../constants/labels';

type Importance = 'low' | 'medium' | 'high';

const IMPORTANCE_CLASS: Record<Importance, string> = {
  low: 'tag',
  medium: 'tag-gold',
  high: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-900/40 text-red-300 border border-red-800/50',
};

export default function Milestone() {
  const navigate = useNavigate();
  const isAdmin = useAuthStore(s => s.currentUser?.role === 'admin');
  const entries = useDataStore(s => s.entries);
  const deleteEntry = useDataStore(s => s.deleteEntry);

  const [deleteTarget, setDeleteTarget] = useState<{id: string; msg: string} | null>(null);

  const milestones = useMemo(
    () => entries
      .filter((e): e is MilestoneEntry => e.type === 'milestone')
      .sort((a, b) => (a.year || '').localeCompare(b.year || '')),
    [entries],
  );

  const handleDelete = (id: string) => {
    setDeleteTarget({id, msg: '确认删除该里程碑？此操作不可撤销。'});
  };

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-0 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Flag className="w-7 h-7 text-gold-400 mt-1" />
          <div>
            <h1 className="text-3xl font-bold gold-text">剧情里程碑</h1>
            <p className="text-ink-400 mt-1 tracking-wide">关键节点 · 自由文本</p>
          </div>
        </div>
        {isAdmin && (
          <Link className="btn-gold" to="/editor/milestone">
            <Plus className="w-4 h-4" /> 新增
          </Link>
        )}
      </div>

      <div className="gold-divider" />

      {milestones.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="relative pl-6 space-y-3 before:content-[''] before:absolute before:left-[7px] before:top-3 before:bottom-3 before:w-px before:bg-gold-800/50">
          {milestones.map(m => (
            <div key={m.id} className="relative">
              <span className="absolute -left-6 top-5 w-3 h-3 rounded-full bg-gold-500 border-2 border-ink-950 z-10" />
              <div className="card-entry group relative">
                <button className="block w-full text-left" onClick={() => navigate(`/entry/${m.id}`)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="tag-gold">{m.year || '—'}</span>
                    <span className={IMPORTANCE_CLASS[m.importance]}>{IMPORTANCE_LABEL[m.importance]}</span>
                    <span className="text-gold-100 font-bold flex-1 truncate">{m.title}</span>
                  </div>
                  {m.summary && <p className="text-sm text-ink-400 mt-1">{m.summary}</p>}
                </button>
                {isAdmin && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button className="btn-ghost" aria-label="编辑" onClick={() => navigate(`/editor/milestone/${m.id}`)}><Pencil className="w-4 h-4" /></button>
                    <button className="btn-ghost text-red-400" aria-label="删除" onClick={() => handleDelete(m.id)}><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          open={true}
          onClose={() => setDeleteTarget(null)}
          title="确认删除"
          message={deleteTarget.msg}
          confirmText="删除"
          variant="danger"
          onConfirm={async () => {
            await deleteEntry(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}

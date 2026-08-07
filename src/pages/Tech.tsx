import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Cog } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { ConfirmDialog } from '../components/Dialog';
import { EmptyState } from '../components/Common';
import type { TechEntry, TechCategory } from '../types';
import { CATEGORY_LABEL } from '../constants/labels';

export default function Tech() {
  const navigate = useNavigate();
  const isAdmin = useAuthStore(s => s.currentUser?.role === 'admin');
  const entries = useDataStore(s => s.entries);
  const deleteEntry = useDataStore(s => s.deleteEntry);

  const [category, setCategory] = useState<'全部' | TechCategory>('全部');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const techs = useMemo(
    () => entries.filter((e): e is TechEntry => e.type === 'tech'),
    [entries],
  );

  const filtered = useMemo(() => {
    if (category === '全部') return techs;
    return techs.filter(t => t.category === category);
  }, [techs, category]);

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
  };

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-0 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Cog className="w-7 h-7 text-gold-400 mt-1" />
          <div>
            <h1 className="text-3xl font-bold gold-text">科技与设定</h1>
            <p className="text-ink-400 mt-1 tracking-wide">统一仓库 · 可细分</p>
          </div>
        </div>
        {isAdmin && (
          <Link className="btn-gold" to="/editor/tech">
            <Plus className="w-4 h-4" /> 新增
          </Link>
        )}
      </div>

      <div className="gold-divider" />

      <div className="flex items-center gap-2 flex-wrap">
        {(['全部', 'weapon', 'mecha', 'facility', 'system', 'creature', 'other'] as const).map(cat => (
          <button
            key={cat}
            className={category === cat ? 'btn-gold' : 'btn-ghost'}
            onClick={() => setCategory(cat)}
          >
            {cat === '全部' ? '全部' : CATEGORY_LABEL[cat]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <div key={t.id} className="card-entry group relative">
              <button className="block w-full text-left px-4 py-4" onClick={() => navigate(`/entry/${t.id}`)}>
                <div className="flex items-center gap-2">
                  <span className="text-gold-100 font-bold text-lg truncate flex-1">{t.title}</span>
                  <span className="tag-gold shrink-0">{CATEGORY_LABEL[t.category]}</span>
                </div>
                {t.summary && <p className="text-sm text-ink-400 mt-1 line-clamp-2">{t.summary}</p>}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {t.firstAppearance && <span className="tag">{t.firstAppearance}</span>}
                  {t.organization && <span className="tag">{t.organization}</span>}
                </div>
              </button>
              {isAdmin && (
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button className="btn-ghost" aria-label="编辑" onClick={() => navigate(`/editor/tech/${t.id}`)}><Pencil className="w-4 h-4" /></button>
                  <button className="btn-ghost text-red-400" aria-label="删除" onClick={() => handleDelete(t.id)}><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          open={true}
          onClose={() => setDeleteTarget(null)}
          title="确认删除"
          message="确认删除该条目？此操作不可撤销。"
          confirmText="删除"
          variant="danger"
          onConfirm={async () => {
            await deleteEntry(deleteTarget);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Users, Search } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import type { Character as CharacterEntry } from '../types';
import { ConfirmDialog, Picker } from '../components/Dialog';
import { EmptyState } from '../components/Common';

export default function Character() {
  const navigate = useNavigate();
  const isAdmin = useAuthStore(s => s.currentUser?.role === 'admin');
  const entries = useDataStore(s => s.entries);
  const deleteEntry = useDataStore(s => s.deleteEntry);

  const [keyword, setKeyword] = useState('');
  const [faction, setFaction] = useState('全部');
  const [deleteTarget, setDeleteTarget] = useState<{id: string; msg: string} | null>(null);

  const characters = useMemo(
    () => entries.filter((e): e is CharacterEntry => e.type === 'character'),
    [entries],
  );

  const factions = useMemo(() => {
    const set = new Set<string>();
    for (const c of characters) if (c.faction) set.add(c.faction);
    return ['全部', ...Array.from(set)];
  }, [characters]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return characters.filter(c => {
      if (faction !== '全部' && c.faction !== faction) return false;
      if (!kw) return true;
      const inTitle = c.title.toLowerCase().includes(kw);
      const inTags = c.tags.some(t => t.toLowerCase().includes(kw));
      return inTitle || inTags;
    });
  }, [characters, keyword, faction]);

  const handleDelete = (id: string) => {
    setDeleteTarget({id, msg: '确认删除该角色？此操作不可撤销。'});
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Users className="w-7 h-7 text-gold-400 mt-1" />
          <div>
            <h1 className="text-3xl font-bold gold-text">角色库</h1>
            <p className="text-ink-400 mt-1 tracking-wide">人物网络 · 生平关系</p>
          </div>
        </div>
        {isAdmin && (
          <Link className="btn-gold" to="/editor/character">
            <Plus className="w-4 h-4" /> 新增角色
          </Link>
        )}
      </div>

      <div className="gold-divider" />

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input-field pl-9"
            placeholder="按姓名或标签搜索..."
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
        </div>
        <Picker
          value={faction}
          onChange={setFaction}
          options={factions.map(f => ({ value: f, label: f }))}
          className="md:w-48"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="card-entry group relative">
              <button className="block w-full text-left" onClick={() => navigate(`/entry/${c.id}`)}>
                <div className="text-gold-100 font-bold text-lg truncate">{c.title}</div>
                {c.identity && <p className="text-sm text-gold-400 mt-1">{c.identity}</p>}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {c.organization && <span className="tag">{c.organization}</span>}
                  {c.faction && <span className="tag-gold">{c.faction}</span>}
                  {c.status && <span className="tag">{c.status}</span>}
                </div>
                {c.summary && <p className="text-sm text-ink-400 mt-2 line-clamp-2">{c.summary}</p>}
              </button>
              {isAdmin && (
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button className="btn-ghost" onClick={() => navigate(`/editor/character/${c.id}`)} aria-label="编辑角色"><Pencil className="w-4 h-4" /></button>
                  <button className="btn-ghost text-red-400" onClick={() => handleDelete(c.id)} aria-label="删除角色"><Trash2 className="w-4 h-4" /></button>
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

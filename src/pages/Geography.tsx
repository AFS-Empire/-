import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Map as MapIcon, ChevronDown, ChevronRight, Globe, Building2, MapPin } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import type { Geography as GeoEntry, GeoLevel } from '../types';
import { ConfirmDialog } from '../components/Dialog';
import { EmptyState } from '../components/Common';
import { LEVEL_LABEL } from '../constants/labels';

const LEVEL_ICON: Record<GeoLevel, ComponentType<{ className?: string }>> = {
  galaxy: Globe,
  planet: Globe,
  city: Building2,
  area: MapPin,
};

const ROOT_KEY = '__root__';

export default function Geography() {
  const navigate = useNavigate();
  const isAdmin = useAuthStore(s => s.currentUser?.role === 'admin');
  const entries = useDataStore(s => s.entries);
  const deleteEntry = useDataStore(s => s.deleteEntry);

  const [levelFilter, setLevelFilter] = useState<'全部' | GeoLevel>('全部');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<{id: string; msg: string} | null>(null);

  const geos = useMemo(
    () => entries.filter((e): e is GeoEntry => e.type === 'geography'),
    [entries],
  );

  const childrenMap = useMemo(() => {
    const map = new Map<string, GeoEntry[]>();
    for (const g of geos) {
      const pid = g.parentId || ROOT_KEY;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(g);
    }
    return map;
  }, [geos]);

  const roots = childrenMap.get(ROOT_KEY) || [];

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const handleDelete = (id: string) => {
    setDeleteTarget({id, msg: '确认删除该地点？其下级地点将变为未分类。'});
  };

  const renderNode = (node: GeoEntry, depth: number) => {
    const children = childrenMap.get(node.id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expanded[node.id];
    const Icon = LEVEL_ICON[node.level];
    return (
      <div key={node.id} style={{ paddingLeft: depth * 20 }}>
        <div className="card-entry group flex items-center gap-2 mb-2">
          {hasChildren ? (
            <button className="text-gold-500 hover:text-gold-300 shrink-0" onClick={() => toggle(node.id)}>
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <Icon className="w-4 h-4 text-gold-500 shrink-0" />
          <button className="flex-1 text-left min-w-0" onClick={() => navigate(`/entry/${node.id}`)}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-gold-100 font-medium truncate">{node.title}</span>
              <span className="tag">{LEVEL_LABEL[node.level]}</span>
              {node.faction && <span className="tag-gold">{node.faction}</span>}
            </div>
            {node.summary && <p className="text-xs text-ink-400 truncate mt-0.5">{node.summary}</p>}
          </button>
          {isAdmin && (
            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
              <button className="btn-ghost" aria-label="编辑" onClick={() => navigate(`/editor/geography/${node.id}`)}><Pencil className="w-4 h-4" /></button>
              <button className="btn-ghost text-red-400" aria-label="删除" onClick={() => handleDelete(node.id)}><Trash2 className="w-4 h-4" /></button>
            </div>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div>{children.map(c => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  const flatFiltered = useMemo(() => {
    if (levelFilter === '全部') return null;
    return geos.filter(g => g.level === levelFilter);
  }, [geos, levelFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <MapIcon className="w-7 h-7 text-gold-400 mt-1" />
          <div>
            <h1 className="text-3xl font-bold gold-text">地理与势力</h1>
            <p className="text-ink-400 mt-1 tracking-wide">空间图谱 · 四级嵌套</p>
          </div>
        </div>
        {isAdmin && (
          <Link className="btn-gold" to="/editor/geography">
            <Plus className="w-4 h-4" /> 新增地点
          </Link>
        )}
      </div>

      <div className="gold-divider" />

      <div className="flex items-center gap-2 flex-wrap">
        {(['全部', 'galaxy', 'planet', 'city', 'area'] as const).map(lv => (
          <button
            key={lv}
            className={levelFilter === lv ? 'btn-gold' : 'btn-ghost'}
            onClick={() => setLevelFilter(lv)}
          >
            {lv === '全部' ? '全部' : LEVEL_LABEL[lv]}
          </button>
        ))}
      </div>

      {geos.length === 0 ? (
        <EmptyState />
      ) : flatFiltered ? (
        flatFiltered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {flatFiltered.map(g => {
              const Icon = LEVEL_ICON[g.level];
              return (
                <div key={g.id} className="card-entry group flex items-center gap-2">
                  <Icon className="w-4 h-4 text-gold-500 shrink-0" />
                  <button className="flex-1 text-left min-w-0" onClick={() => navigate(`/entry/${g.id}`)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gold-100 font-medium truncate">{g.title}</span>
                      <span className="tag">{LEVEL_LABEL[g.level]}</span>
                      {g.faction && <span className="tag-gold">{g.faction}</span>}
                    </div>
                    {g.summary && <p className="text-xs text-ink-400 truncate mt-0.5">{g.summary}</p>}
                  </button>
                  {isAdmin && (
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                      <button className="btn-ghost" aria-label="编辑" onClick={() => navigate(`/editor/geography/${g.id}`)}><Pencil className="w-4 h-4" /></button>
                      <button className="btn-ghost text-red-400" aria-label="删除" onClick={() => handleDelete(g.id)}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : roots.length === 0 ? (
        <div className="panel p-12 text-center text-ink-500">所有地点均已挂载到上级，无根节点</div>
      ) : (
        <div>{roots.map(r => renderNode(r, 0))}</div>
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

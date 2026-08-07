import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Scroll, Settings, X, Save } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { useBindingStore } from '../store/bindingStore';
import { genId } from '../data/db';
import { ConfirmDialog, AlertDialog } from '../components/Dialog';
import { EmptyState } from '../components/Common';
import type { Era, TimelineEvent } from '../types';

const UNCATEGORIZED = '__uncategorized__';

const emptyEra = (): Era => ({
  id: genId(),
  name: '',
  startYear: '',
  endYear: '',
  description: '',
  order: 0,
});

export default function Timeline() {
  const navigate = useNavigate();
  const isAdmin = useAuthStore(s => s.currentUser?.role === 'admin');
  const isBound = useBindingStore(s => s.isBound);
  const entries = useDataStore(s => s.entries);
  const eras = useDataStore(s => s.eras);
  const saveEra = useDataStore(s => s.saveEra);
  const deleteEra = useDataStore(s => s.deleteEra);
  const deleteEntry = useDataStore(s => s.deleteEntry);

  const [showEraPanel, setShowEraPanel] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editingEra, setEditingEra] = useState<Era | null>(null);
  const [confirmState, setConfirmState] = useState<{open: boolean; msg: string; action: (() => void) | null}>({open: false, msg: '', action: null});
  const [alertMsg, setAlertMsg] = useState('');

  const events = useMemo(
    () => entries.filter((e): e is TimelineEvent => e.type === 'timeline'),
    [entries],
  );

  const sortedEras = useMemo(() => [...eras].sort((a, b) => a.order - b.order), [eras]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const ev of events) {
      const key = ev.eraId || UNCATEGORIZED;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  const toggle = (id: string) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  // 写操作守卫：机器未绑定 → 拒绝；验证由 dataStore.guardWrite 统一处理
  const handleDeleteEvent = (id: string) => {
    if (!isBound) { setAlertMsg('设备未绑定，无法删除'); return; }
    setConfirmState({open: true, msg: '确认删除该事件？此操作不可撤销。', action: () => deleteEntry(id)});
  };

  const handleDeleteEra = (id: string) => {
    if (!isBound) { setAlertMsg('设备未绑定，无法删除'); return; }
    setConfirmState({open: true, msg: '确认删除该纪元？纪元下的事件将变为"未分类"。', action: () => deleteEra(id)});
  };

  const handleSaveEra = async () => {
    if (!editingEra) return;
    if (!editingEra.name.trim()) {
      setAlertMsg('请填写纪元名称');
      return;
    }
    if (!isBound) { setAlertMsg('设备未绑定，无法保存'); return; }
    const eraToSave = editingEra;
    await saveEra(eraToSave);
    setEditingEra(null);
  };

  const uncategorized = grouped.get(UNCATEGORIZED) || [];
  const isEmpty = sortedEras.length === 0 && events.length === 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Scroll className="w-7 h-7 text-gold-400 mt-1" />
          <div>
            <h1 className="text-3xl font-bold gold-text">时间轴</h1>
            <p className="text-ink-400 mt-1 tracking-wide">叙事主线 · 编年史</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              className="btn-outline"
              onClick={() => { setShowEraPanel(v => !v); setEditingEra(null); }}
            >
              <Settings className="w-4 h-4" /> 管理纪元
            </button>
          )}
          {isAdmin && (
            <Link className="btn-gold" to="/editor/timeline">
              <Plus className="w-4 h-4" /> 新增事件
            </Link>
          )}
        </div>
      </div>

      <div className="gold-divider" />

      {showEraPanel && isAdmin && (
        <div className="panel-gold p-5 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="section-title">纪元管理</h2>
            <button className="btn-ghost" onClick={() => setShowEraPanel(false)}><X className="w-4 h-4" /></button>
          </div>

          <div className="space-y-2">
            {sortedEras.length === 0 && <p className="text-ink-500 text-sm">暂无纪元</p>}
            {sortedEras.map(era => (
              <div key={era.id} className="flex items-center justify-between gap-3 p-3 bg-ink-850 rounded-lg border border-ink-700">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gold-200 font-medium">{era.name}</span>
                    <span className="text-xs text-ink-400">{era.startYear} ~ {era.endYear}</span>
                    <span className="tag">序 {era.order}</span>
                  </div>
                  {era.description && <p className="text-sm text-ink-400 mt-1 truncate">{era.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button className="btn-ghost" aria-label="编辑" onClick={() => setEditingEra({ ...era })}><Pencil className="w-4 h-4" /></button>
                  <button className="btn-ghost text-red-400" aria-label="删除" onClick={() => handleDeleteEra(era.id)}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>

          {editingEra && (
            <div key={editingEra.id} className="p-4 bg-[var(--bg-elevated)] rounded-lg border border-gold-800/50 space-y-3">
              <h3 className="text-gold-300 font-medium">{editingEra.name ? '编辑纪元' : '新增纪元'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label-text">纪元名称</label>
                  <input className="input-field" defaultValue={editingEra.name} onBlur={e => setEditingEra(prev => prev ? { ...prev, name: e.target.value } : prev)} placeholder="如：帝国纪元" />
                </div>
                <div>
                  <label className="label-text">排序</label>
                  <input type="number" className="input-field" defaultValue={editingEra.order} onBlur={e => setEditingEra(prev => prev ? { ...prev, order: Number(e.target.value) } : prev)} />
                </div>
                <div>
                  <label className="label-text">起始时间</label>
                  <input className="input-field" defaultValue={editingEra.startYear} onBlur={e => setEditingEra(prev => prev ? { ...prev, startYear: e.target.value } : prev)} placeholder="自由文本" />
                </div>
                <div>
                  <label className="label-text">结束时间</label>
                  <input className="input-field" defaultValue={editingEra.endYear} onBlur={e => setEditingEra(prev => prev ? { ...prev, endYear: e.target.value } : prev)} placeholder="自由文本" />
                </div>
              </div>
              <div>
                <label className="label-text">描述</label>
                <textarea className="input-field" rows={2} defaultValue={editingEra.description} onBlur={e => setEditingEra(prev => prev ? { ...prev, description: e.target.value } : prev)} />
              </div>
              <div className="flex justify-end gap-2">
                <button className="btn-ghost" onClick={() => setEditingEra(null)}>取消</button>
                <button className="btn-gold" onClick={handleSaveEra}><Save className="w-4 h-4" /> 保存</button>
              </div>
            </div>
          )}

          {!editingEra && (
            <button className="btn-outline w-full" onClick={() => setEditingEra(emptyEra())}>
              <Plus className="w-4 h-4" /> 新增纪元
            </button>
          )}
        </div>
      )}

      {isEmpty && (
        <EmptyState />
      )}

      <div className="space-y-4">
        {sortedEras.map(era => {
          const list = grouped.get(era.id) || [];
          const isCollapsed = collapsed[era.id];
          return (
            <div key={era.id} className="panel-gold overflow-hidden">
              <button
                className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-ink-850 transition-colors"
                onClick={() => toggle(era.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isCollapsed
                    ? <ChevronRight className="w-5 h-5 text-gold-500 shrink-0" />
                    : <ChevronDown className="w-5 h-5 text-gold-500 shrink-0" />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-bold text-gold-200">{era.name}</span>
                      <span className="tag-gold">{era.startYear} ~ {era.endYear}</span>
                      <span className="tag">事件 {list.length}</span>
                    </div>
                    {era.description && <p className="text-sm text-ink-400 mt-1">{era.description}</p>}
                  </div>
                </div>
              </button>
              {!isCollapsed && (
                <div className="px-4 pb-4 space-y-2">
                  <div className="gold-divider mb-3" />
                  {list.length === 0 ? (
                    <p className="text-ink-500 text-sm py-2">该纪元暂无事件</p>
                  ) : (
                    list.map(ev => (
                      <div key={ev.id} className="card-entry flex items-start gap-3 group">
                        <button onClick={() => navigate(`/entry/${ev.id}`)} className="flex-1 flex items-start gap-3 text-left min-w-0">
                          <span className="tag-gold shrink-0 mt-0.5">{ev.year || '—'}</span>
                          <div className="min-w-0">
                            <div className="text-gold-100 font-medium truncate">{ev.title}</div>
                            {ev.summary && <p className="text-sm text-ink-400 line-clamp-2 mt-0.5">{ev.summary}</p>}
                          </div>
                        </button>
                        {isAdmin && (
                          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                            <button className="btn-ghost" aria-label="编辑" onClick={() => navigate(`/editor/timeline/${ev.id}`)}><Pencil className="w-4 h-4" /></button>
                            <button className="btn-ghost text-red-400" aria-label="删除" onClick={() => handleDeleteEvent(ev.id)}><Trash2 className="w-4 h-4" /></button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {uncategorized.length > 0 && (
          <div className="panel overflow-hidden">
            <button
              className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-ink-850 transition-colors"
              onClick={() => toggle(UNCATEGORIZED)}
            >
              <div className="flex items-center gap-3">
                {collapsed[UNCATEGORIZED]
                  ? <ChevronRight className="w-5 h-5 text-ink-400" />
                  : <ChevronDown className="w-5 h-5 text-ink-400" />}
                <span className="text-lg font-bold text-ink-200">未分类</span>
                <span className="tag">事件 {uncategorized.length}</span>
              </div>
            </button>
            {!collapsed[UNCATEGORIZED] && (
              <div className="px-4 pb-4 space-y-2">
                <div className="gold-divider mb-3" />
                {uncategorized.map(ev => (
                  <div key={ev.id} className="card-entry flex items-start gap-3 group">
                    <button onClick={() => navigate(`/entry/${ev.id}`)} className="flex-1 flex items-start gap-3 text-left min-w-0">
                      <span className="tag shrink-0 mt-0.5">{ev.year || '—'}</span>
                      <div className="min-w-0">
                        <div className="text-gold-100 font-medium truncate">{ev.title}</div>
                        {ev.summary && <p className="text-sm text-ink-400 line-clamp-2 mt-0.5">{ev.summary}</p>}
                      </div>
                    </button>
                    {isAdmin && (
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                        <button className="btn-ghost" aria-label="编辑" onClick={() => navigate(`/editor/timeline/${ev.id}`)}><Pencil className="w-4 h-4" /></button>
                        <button className="btn-ghost text-red-400" aria-label="删除" onClick={() => handleDeleteEvent(ev.id)}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmState.open}
        onClose={() => setConfirmState({...confirmState, open: false})}
        title="确认操作"
        message={confirmState.msg}
        confirmText="删除"
        variant="danger"
        onConfirm={() => { confirmState.action?.(); }}
      />
      <AlertDialog open={!!alertMsg} onClose={() => setAlertMsg('')} title="提示" message={alertMsg} />
    </div>
  );
}

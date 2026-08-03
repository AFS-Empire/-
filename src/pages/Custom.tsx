import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Layers, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { useBindingStore } from '../store/bindingStore';
import { genId } from '../data/db';
import { ConfirmDialog, AlertDialog } from '../components/Dialog';
import { EmptyState } from '../components/Common';
import type { CustomEntry, CustomSection } from '../types';

export default function Custom() {
  const navigate = useNavigate();
  const isAdmin = useAuthStore(s => s.currentUser?.role === 'admin');
  const isBound = useBindingStore(s => s.isBound);
  const entries = useDataStore(s => s.entries);
  const customSections = useDataStore(s => s.customSections);
  const saveCustomSection = useDataStore(s => s.saveCustomSection);
  const deleteCustomSection = useDataStore(s => s.deleteCustomSection);
  const deleteEntry = useDataStore(s => s.deleteEntry);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CustomSection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'section' | 'entry'; id: string; msg: string } | null>(null);
  const [alertMsg, setAlertMsg] = useState('');

  const countBy = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      if (e.type !== 'custom') continue;
      const ce = e as CustomEntry;
      map.set(ce.sectionId, (map.get(ce.sectionId) || 0) + 1);
    }
    return map;
  }, [entries]);

  const sectionEntries = useMemo(() => {
    if (!selectedId) return [];
    return entries.filter(
      (e): e is CustomEntry => e.type === 'custom' && (e as CustomEntry).sectionId === selectedId,
    );
  }, [entries, selectedId]);

  const selected = customSections.find(s => s.id === selectedId);

  // 写操作守卫：机器未绑定 → 拒绝；已绑定 → 弹 PIN 校验通过后执行
  const handleDeleteSection = (id: string) => {
    if (!isBound) { setAlertMsg('设备未绑定，无法删除'); return; }
    setDeleteTarget({ kind: 'section', id, msg: '确认删除该分类？分类下的条目不会被删除但将失去归属。' });
  };

  const handleSaveSection = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      setAlertMsg('请填写分类名称');
      return;
    }
    if (!isBound) { setAlertMsg('设备未绑定，无法保存'); return; }
    const sectionToSave = editing;
    await saveCustomSection(sectionToSave);
    setEditing(null);
  };

  const handleDeleteEntry = (id: string) => {
    if (!isBound) { setAlertMsg('设备未绑定，无法删除'); return; }
    setDeleteTarget({ kind: 'entry', id, msg: '确认删除该条目？' });
  };

  // 删除确认通过后，验证由 dataStore.guardWrite 统一处理
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    if (target.kind === 'section') {
      await deleteCustomSection(target.id);
      if (selectedId === target.id) setSelectedId(null);
    } else {
      await deleteEntry(target.id);
    }
  };

  // ---- Section detail view ----
  if (selectedId && selected) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="text-3xl">{selected.icon || '📁'}</span>
            <div>
              <h1 className="text-3xl font-bold gold-text">{selected.name}</h1>
              {selected.description && <p className="text-ink-400 mt-1 tracking-wide">{selected.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost" onClick={() => setSelectedId(null)}>返回分类</button>
            {isAdmin && (
              <Link className="btn-gold" to={`/editor/custom?sectionId=${selected.id}`}>
                <Plus className="w-4 h-4" /> 新增条目
              </Link>
            )}
          </div>
        </div>

        <div className="gold-divider" />

        {sectionEntries.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectionEntries.map(e => (
              <div key={e.id} className="card-entry group relative">
                <button className="block w-full text-left" onClick={() => navigate(`/entry/${e.id}`)}>
                  <div className="text-gold-100 font-bold truncate">{e.title}</div>
                  {e.summary && <p className="text-sm text-ink-400 mt-1 line-clamp-2">{e.summary}</p>}
                </button>
                {isAdmin && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button className="btn-ghost" aria-label="编辑" onClick={() => navigate(`/editor/custom/${e.id}`)}><Pencil className="w-4 h-4" /></button>
                    <button className="btn-ghost text-red-400" aria-label="删除" onClick={() => handleDeleteEntry(e.id)}><Trash2 className="w-4 h-4" /></button>
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
            onConfirm={confirmDelete}
          />
        )}
        <AlertDialog open={!!alertMsg} onClose={() => setAlertMsg('')} title="提示" message={alertMsg} />
      </div>
    );
  }

  // ---- Section list view ----
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Layers className="w-7 h-7 text-gold-400 mt-1" />
          <div>
            <h1 className="text-3xl font-bold gold-text">扩展分类</h1>
            <p className="text-ink-400 mt-1 tracking-wide">自定义板块 · 预留入口</p>
          </div>
        </div>
        {isAdmin && (
          <button
            className="btn-gold"
            onClick={() => setEditing({ id: genId(), name: '', description: '', icon: '📁', createdAt: Date.now() })}
          >
            <Plus className="w-4 h-4" /> 新建分类
          </button>
        )}
      </div>

      <div className="gold-divider" />

      {editing && (
        <div key={editing.id} className="panel-gold p-5 space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="section-title">{editing.createdAt && !editing.name ? '新建分类' : '编辑分类'}</h2>
            <button className="btn-ghost" onClick={() => setEditing(null)}><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label-text">图标（emoji）</label>
              <input className="input-field" defaultValue={editing.icon} onBlur={e => setEditing(prev => prev ? { ...prev, icon: e.target.value } : prev)} placeholder="📁" />
            </div>
            <div className="md:col-span-2">
              <label className="label-text">分类名称</label>
              <input className="input-field" defaultValue={editing.name} onBlur={e => setEditing(prev => prev ? { ...prev, name: e.target.value } : prev)} placeholder="如：势力关系" />
            </div>
          </div>
          <div>
            <label className="label-text">描述</label>
            <textarea className="input-field" rows={2} defaultValue={editing.description} onBlur={e => setEditing(prev => prev ? { ...prev, description: e.target.value } : prev)} />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setEditing(null)}>取消</button>
            <button className="btn-gold" onClick={handleSaveSection}>保存</button>
          </div>
        </div>
      )}

      {customSections.length === 0 && !editing ? (
        <div className="panel p-12 text-center text-ink-500">暂无分类，点击"新建分类"开始</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customSections.map(s => (
            <div key={s.id} className="card-entry group relative">
              <button className="block w-full text-left" onClick={() => setSelectedId(s.id)}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{s.icon || '📁'}</span>
                  <div className="min-w-0">
                    <div className="text-gold-100 font-bold truncate">{s.name}</div>
                    <div className="text-xs text-ink-400 mt-0.5">{countBy.get(s.id) || 0} 条条目</div>
                  </div>
                </div>
                {s.description && <p className="text-sm text-ink-400 mt-2 line-clamp-2">{s.description}</p>}
              </button>
              {isAdmin && (
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button className="btn-ghost" aria-label="编辑" onClick={() => setEditing({ ...s })}><Pencil className="w-4 h-4" /></button>
                  <button className="btn-ghost text-red-400" aria-label="删除" onClick={() => handleDeleteSection(s.id)}><Trash2 className="w-4 h-4" /></button>
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
          onConfirm={confirmDelete}
        />
      )}
      <AlertDialog open={!!alertMsg} onClose={() => setAlertMsg('')} title="提示" message={alertMsg} />
    </div>
  );
}

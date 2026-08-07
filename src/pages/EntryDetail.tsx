import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Link2, MessageCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { getEntryCode } from '../data/db';
import { ConfirmDialog } from '../components/Dialog';
import type {
  Character,
  CustomEntry,
  Geography,
  Milestone,
  TechEntry,
  TimelineEvent,
} from '../types';
import { LEVEL_LABEL, CATEGORY_LABEL, IMPORTANCE_LABEL } from '../constants/labels';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-gold-400 w-16 shrink-0">{label}</span>
      <span className="text-ink-200 break-words">{value}</span>
    </div>
  );
}

export default function EntryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAdmin = useAuthStore(s => s.currentUser?.role === 'admin');
  const entry = useDataStore(s => (id ? s.getById(id) : undefined));
  const allEntries = useDataStore(s => s.entries);
  const deleteEntry = useDataStore(s => s.deleteEntry);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!entry) {
    return (
      <div className="space-y-6 animate-fade-in">
        <button className="btn-ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /> 返回</button>
        <div className="panel p-12 text-center text-ink-500">条目不存在或已被删除</div>
      </div>
    );
  }

  const handleDelete = () => {
    setConfirmDelete(true);
  };

  const renderExtra = () => {
    switch (entry.type) {
      case 'character': {
        const c = entry as Character;
        const items: Array<[string, string]> = [];
        if (c.identity) items.push(['身份', c.identity]);
        if (c.organization) items.push(['组织', c.organization]);
        if (c.faction) items.push(['阵营', c.faction]);
        if (c.race) items.push(['种族', c.race]);
        if (c.status) items.push(['状态', c.status]);
        if (items.length === 0) return null;
        return (
          <div className="panel p-4 space-y-2">
            {items.map(([k, v]) => <Field key={k} label={k} value={v} />)}
          </div>
        );
      }
      case 'geography': {
        const g = entry as Geography;
        return (
          <div className="panel p-4 space-y-2">
            <Field label="层级" value={LEVEL_LABEL[g.level]} />
            {g.faction && <Field label="势力" value={g.faction} />}
          </div>
        );
      }
      case 'tech': {
        const t = entry as TechEntry;
        return (
          <div className="panel p-4 space-y-2">
            <Field label="分类" value={CATEGORY_LABEL[t.category]} />
            {t.firstAppearance && <Field label="首现" value={t.firstAppearance} />}
            {t.organization && <Field label="组织" value={t.organization} />}
          </div>
        );
      }
      case 'timeline': {
        const t = entry as TimelineEvent;
        return (
          <div className="panel p-4 space-y-2">
            {t.year && <Field label="时间" value={t.year} />}
            {t.eraName && <Field label="纪元" value={t.eraName} />}
          </div>
        );
      }
      case 'milestone': {
        const m = entry as Milestone;
        return (
          <div className="panel p-4 space-y-2">
            {m.year && <Field label="时间" value={m.year} />}
            <Field label="重要度" value={IMPORTANCE_LABEL[m.importance]} />
          </div>
        );
      }
      case 'custom': {
        const c = entry as CustomEntry;
        return (
          <div className="panel p-4 space-y-2">
            <Field label="分类ID" value={c.sectionId} />
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto px-2 sm:px-0">
      <div className="flex items-center justify-between">
        <button className="btn-ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /> 返回</button>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Link className="btn-outline" to={`/editor/${entry.type}/${entry.id}`}>
              <Pencil className="w-4 h-4" /> 编辑
            </Link>
            <button className="btn-ghost text-red-400" onClick={handleDelete}><Trash2 className="w-4 h-4" /> 删除</button>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="tag-gold font-mono">{getEntryCode(allEntries, entry.id)}</span>
          <button
            onClick={() => navigate(`/comments/${getEntryCode(allEntries, entry.id)}`)}
            className="btn-ghost text-sm"
          >
            <MessageCircle size={14} />
            讨论此条目
          </button>
        </div>
        <h1 className="text-3xl font-bold gold-text">{entry.title}</h1>
        {entry.summary && <p className="text-ink-300 mt-2">{entry.summary}</p>}
      </div>

      {entry.coverImage && (
        <img
          src={entry.coverImage}
          alt={entry.title}
          className="w-full max-h-96 object-cover rounded-xl border border-gold-800/50"
        />
      )}

      {renderExtra()}

      {entry.content && (
        <div className="panel p-5">
          <p className="text-ink-200 whitespace-pre-wrap leading-relaxed">{entry.content}</p>
        </div>
      )}

      {entry.images && entry.images.length > 0 && (
        <div>
          <h2 className="section-title mb-3">图片</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {entry.images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`图片 ${i + 1}`}
                className="w-full h-40 object-cover rounded-lg border border-ink-700"
              />
            ))}
          </div>
        </div>
      )}

      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {entry.tags.map(t => <span key={t} className="tag-gold">{t}</span>)}
        </div>
      )}

      {entry.links.length > 0 && (
        <div>
          <h2 className="section-title mb-3 flex items-center gap-2"><Link2 className="w-5 h-5" /> 关联条目</h2>
          <div className="space-y-2">
            {entry.links.map(link => (
              <Link
                key={link.id}
                to={`/entry/${link.id}`}
                className="card-entry w-full flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-gold-100 font-medium truncate">{link.title}</div>
                  {link.relation && <div className="text-xs text-ink-400 mt-0.5">{link.relation}</div>}
                </div>
                <span className="tag shrink-0">{link.type}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          open={true}
          onClose={() => setConfirmDelete(false)}
          title="确认删除"
          message="确认删除该条目？此操作不可撤销。"
          confirmText="删除"
          variant="danger"
          onConfirm={async () => {
            await deleteEntry(entry.id);
            setConfirmDelete(false);
            navigate(-1);
          }}
        />
      )}
    </div>
  );
}

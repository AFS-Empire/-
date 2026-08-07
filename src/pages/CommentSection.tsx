import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CornerDownRight, MessageSquare, Pin, Send, Trash2 } from 'lucide-react';
import { useCommentStore } from '../store/commentStore';
import { useAuthStore } from '../store/authStore';
import { fmtTime } from '../lib/format';
import { useDataStore } from '../store/dataStore';
import { getEntryCode } from '../data/db';
import { ConfirmDialog } from '../components/Dialog';
import { SECTION_PREFIX, SECTIONS } from '../types';
import type { AnyEntry, Comment } from '../types';

// 板块前缀 → 中文名
const PREFIX_LABEL: Record<string, string> = {};
SECTIONS.forEach(s => {
  PREFIX_LABEL[SECTION_PREFIX[s.type]] = s.name;
});

type TargetInfo =
  | { kind: 'global'; title: string }
  | { kind: 'section'; code: string; title: string }
  | { kind: 'entry'; code: string; entry: AnyEntry | undefined; title: string };

function parseTarget(code: string, codeMap: Map<string, AnyEntry>): TargetInfo {
  if (code === 'GLOBAL' || !code) return { kind: 'global', title: '总评论区' };
  if (PREFIX_LABEL[code]) return { kind: 'section', code, title: `${PREFIX_LABEL[code]}评论区` };
  return { kind: 'entry', code, entry: codeMap.get(code), title: `${code} 评论区` };
}

type ResolveResult =
  | { ok: true; code: string; targetId?: string; targetTitle?: string }
  | { ok: false; error: string };

export default function CommentSection() {
  const { targetCode: rawCode } = useParams<{ targetCode: string }>();
  const navigate = useNavigate();
  const targetCode = rawCode || 'GLOBAL';

  const comments = useCommentStore(s => s.comments);
  const loaded = useCommentStore(s => s.loaded);
  const refresh = useCommentStore(s => s.refresh);
  const postComment = useCommentStore(s => s.postComment);
  const deleteComment = useCommentStore(s => s.deleteComment);
  const togglePin = useCommentStore(s => s.togglePin);

  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = useAuthStore(s => s.currentUser?.role === 'admin');
  const entries = useDataStore(s => s.entries);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 编号 → 条目 映射（用于解析条目级 targetCode 与 GLOBAL 的编号输入）
  const codeMap = useMemo(() => {
    const m = new Map<string, AnyEntry>();
    for (const e of entries) m.set(getEntryCode(entries, e.id), e);
    return m;
  }, [entries]);

  const info = parseTarget(targetCode, codeMap);

  // 当前目标的评论：置顶优先，再按时间正序
  const targetComments = useMemo(() => {
    return comments
      .filter(c => c.targetCode === targetCode)
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return a.createdAt - b.createdAt;
      });
  }, [comments, targetCode]);

  const topLevel = targetComments.filter(c => !c.parentId);
  const childrenOf = (id: string) => targetComments.filter(c => c.parentId === id);

  const [content, setContent] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const resolveCodeInput = (raw: string): ResolveResult => {
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed) return { ok: true, code: 'GLOBAL' };
    if (PREFIX_LABEL[trimmed]) return { ok: true, code: trimmed };
    const entry = codeMap.get(trimmed);
    if (entry) return { ok: true, code: trimmed, targetId: entry.id, targetTitle: entry.title };
    return { ok: false, error: `编号 ${trimmed} 未识别，请填写如 TIME / TIME-001 的有效编号` };
  };

  const handlePost = async () => {
    const text = content.trim();
    if (!text) {
      setError('请输入评论内容');
      return;
    }
    let code = targetCode;
    let targetId: string | undefined;
    let targetTitle: string | undefined;
    if (info.kind === 'global') {
      const r = resolveCodeInput(codeInput);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      code = r.code;
      targetId = r.targetId;
      targetTitle = r.targetTitle;
    } else if (info.kind === 'entry') {
      targetId = info.entry?.id;
      targetTitle = info.entry?.title;
    }
    setError('');
    await postComment(text, code, targetId, targetTitle);
    setContent('');
    setCodeInput('');
  };

  const handleReply = async (parent: Comment) => {
    const text = replyContent.trim();
    if (!text) return;
    await postComment(text, parent.targetCode, parent.targetId, parent.targetTitle, parent.id);
    setReplyContent('');
    setReplyingTo(null);
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
  };

  const renderComment = (c: Comment, isChild = false) => {
    const kids = childrenOf(c.id);
    return (
      <div key={c.id} className={isChild ? 'ml-6 sm:ml-8' : ''}>
        <div
          className="panel p-4"
          style={c.isPinned ? { borderLeft: '3px solid var(--color-gold-500)' } : undefined}
        >
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="font-medium text-gold-100">{c.author}</span>
            <span className={`tag ${c.authorRole === 'admin' ? 'tag-gold' : ''}`}>
              {c.authorRole === 'admin' ? '管理员' : '访客'}
            </span>
            {c.isPinned && (
              <span className="tag-gold inline-flex items-center gap-1">
                <Pin size={11} /> 置顶
              </span>
            )}
            <span className="text-xs text-ink-500 ml-auto">{fmtTime(c.createdAt)}</span>
          </div>
          <p className="text-ink-200 whitespace-pre-wrap leading-relaxed text-sm">{c.content}</p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => {
                setReplyingTo(replyingTo === c.id ? null : c.id);
                setReplyContent('');
              }}
              className="btn-ghost text-xs py-1 px-2"
            >
              <CornerDownRight size={13} /> 回复
            </button>
            {isAdmin && (
              <>
                <button onClick={() => togglePin(c.id)} className="btn-ghost text-xs py-1 px-2">
                  <Pin size={13} /> {c.isPinned ? '取消置顶' : '置顶'}
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="btn-ghost text-xs py-1 px-2 text-red-400"
                >
                  <Trash2 size={13} /> 删除
                </button>
              </>
            )}
          </div>
          {replyingTo === c.id && (
            <div className="mt-3 space-y-2">
              <textarea
                value={replyContent}
                onChange={e => setReplyContent(e.target.value)}
                placeholder={`回复 @${c.author}...`}
                rows={2}
                className="input-field text-sm"
              />
              <div className="flex gap-2">
                <button onClick={() => handleReply(c)} className="btn-gold text-sm py-1.5 px-3">
                  <Send size={13} /> 发送
                </button>
                <button
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyContent('');
                  }}
                  className="btn-ghost text-sm py-1.5 px-3"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
        {kids.length > 0 && (
          <div className="mt-2 space-y-2">
            {kids.map(k => renderComment(k, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fade-in max-w-3xl mx-auto px-2 sm:px-0 space-y-6">
      {/* 顶部 */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="section-title flex items-center gap-2">
            <MessageSquare size={20} className="text-gold-500/70" />
            {info.title}
          </h1>
          <p className="text-sm text-ink-400 mt-1">共 {targetComments.length} 条讨论</p>
        </div>
      </div>

      {/* 条目级：显示关联条目标题 */}
      {info.kind === 'entry' && info.entry && (
        <div className="panel-gold p-3 text-sm">
          <span className="text-gold-400/80">关联条目：</span>
          <span className="text-gold-100 font-medium">{info.entry.title}</span>
        </div>
      )}
      {info.kind === 'entry' && !info.entry && (
        <div className="panel p-3 text-sm text-ink-400">该编号对应的条目已不存在</div>
      )}

      {/* 发布区 */}
      <div className="panel-gold p-4 space-y-3">
        {info.kind === 'global' && (
          <div>
            <label className="label-text">指定编号（可选，留空发到总评论区）</label>
            <input
              value={codeInput}
              onChange={e => setCodeInput(e.target.value)}
              placeholder="如 TIME / TIME-001 / CHAR-002"
              className="input-field text-sm"
            />
          </div>
        )}
        <div>
          <label className="label-text">发表见解</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={currentUser ? '写下你的见解...' : '请先登录后发表评论'}
            rows={3}
            className="input-field text-sm"
            disabled={!currentUser}
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          {isAdmin ? (
            <span className="text-xs text-gold-400/70">管理员发言将自动置顶</span>
          ) : (
            <span />
          )}
          <button
            onClick={handlePost}
            disabled={!currentUser}
            className="btn-gold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} /> 发布
          </button>
        </div>
      </div>

      {/* 评论列表 */}
      {!loaded ? (
        <div className="panel p-12 text-center text-ink-500">载入中...</div>
      ) : topLevel.length === 0 ? (
        <div className="panel p-12 text-center">
          <MessageSquare size={40} className="mx-auto text-ink-600 mb-3" />
          <p className="text-ink-400">暂无讨论，发表第一条见解吧</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topLevel.map(c => renderComment(c))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          open={true}
          onClose={() => setDeleteTarget(null)}
          title="确认删除"
          message="确认删除该评论？子回复将一并删除。"
          confirmText="删除"
          variant="danger"
          onConfirm={async () => {
            await deleteComment(deleteTarget);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}

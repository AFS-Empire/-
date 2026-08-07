import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, List, Settings2, X } from 'lucide-react';
import { useNovelStore } from '../store/novelStore';
import { useDataStore } from '../store/dataStore';
import { useBindingStore } from '../store/bindingStore';
import { IS_WEB_BUILD } from '../lib/buildTarget';
import type { Character } from '../types';

/* ============================================================
   阅读模式配置：5 种背景主题 + 5 级字号 + 3 级行距
   ============================================================ */
type BgTheme = 'dark' | 'parchment' | 'green' | 'beige' | 'paper';
type FontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type LineHeight = 'compact' | 'normal' | 'loose';

interface ReaderThemeConfig {
  label: string;
  swatch: string;     // 色板预览色
  bg: string;         // 页面背景
  surface: string;    // 顶/底栏背景
  text: string;       // 正文
  title: string;      // 标题
  sub: string;        // 次要文字
  border: string;     // 分隔线
  accent: string;     // 强调色（进度条/高亮）
  vignette: boolean;  // 是否加厚重内阴影
}

const READER_THEMES: Record<BgTheme, ReaderThemeConfig> = {
  dark: {
    label: '深夜',
    swatch: '#0d0d0f',
    bg: '#0d0d0f',
    surface: '#0d0d0f',
    text: '#e2e2e4',
    title: '#e0c068',
    sub: '#76767e',
    border: 'rgba(143,89,28,0.2)',
    accent: '#c8902a',
    vignette: false,
  },
  parchment: {
    label: '羊皮纸',
    swatch: '#e8dab8',
    bg: '#e8dab8',
    surface: '#e0d0a8',
    text: '#3a2a15',
    title: '#5a3a18',
    sub: '#6a5230',
    border: 'rgba(90,58,24,0.25)',
    accent: '#8f591c',
    vignette: true,
  },
  green: {
    label: '护眼绿',
    swatch: '#c7edcc',
    bg: '#c7edcc',
    surface: '#b8e0bd',
    text: '#2a3a2a',
    title: '#1a4a2a',
    sub: '#4a5a4a',
    border: 'rgba(26,74,42,0.2)',
    accent: '#3a7a4a',
    vignette: false,
  },
  beige: {
    label: '米黄',
    swatch: '#faf3e0',
    bg: '#faf3e0',
    surface: '#f0e8d0',
    text: '#4a3520',
    title: '#5a3a18',
    sub: '#7a6a4a',
    border: 'rgba(90,58,24,0.2)',
    accent: '#8f591c',
    vignette: false,
  },
  paper: {
    label: '浅白',
    swatch: '#f5f5f7',
    bg: '#f5f5f7',
    surface: '#eeeef0',
    text: '#1a1a1a',
    title: '#3a3a3a',
    sub: '#666666',
    border: 'rgba(0,0,0,0.1)',
    accent: '#8f591c',
    vignette: false,
  },
};

const FONT_SIZES: Record<FontSize, { label: string; px: number }> = {
  xs: { label: '特小', px: 14 },
  sm: { label: '小', px: 16 },
  md: { label: '中', px: 18 },
  lg: { label: '大', px: 20 },
  xl: { label: '特大', px: 23 },
};

const LINE_HEIGHTS: Record<LineHeight, { label: string; value: number }> = {
  compact: { label: '紧凑', value: 1.7 },
  normal: { label: '标准', value: 2.0 },
  loose: { label: '宽松', value: 2.5 },
};

const READER_SETTINGS_KEY = 'readerSettings';
interface ReaderSettings {
  bgTheme: BgTheme;
  fontSize: FontSize;
  lineHeight: LineHeight;
}

function loadReaderSettings(): ReaderSettings {
  const defaults: ReaderSettings = { bgTheme: 'dark', fontSize: 'md', lineHeight: 'normal' };
  try {
    const raw = localStorage.getItem(READER_SETTINGS_KEY);
    if (!raw) return defaults;
    const p = JSON.parse(raw) as Partial<ReaderSettings>;
    return {
      bgTheme: p.bgTheme && READER_THEMES[p.bgTheme] ? p.bgTheme : 'dark',
      fontSize: p.fontSize && FONT_SIZES[p.fontSize] ? p.fontSize : 'md',
      lineHeight: p.lineHeight && LINE_HEIGHTS[p.lineHeight] ? p.lineHeight : 'normal',
    };
  } catch {
    return defaults;
  }
}

export default function NovelReader() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const navigate = useNavigate();
  const isBound = useBindingStore(s => s.isBound);
  const chapters = useNovelStore(s => bookId ? (s.chapters[bookId] || []) : []);
  const books = useNovelStore(s => s.books);
  const markChapterRead = useNovelStore(s => s.markChapterRead);
  const saveProgress = useNovelStore(s => s.saveProgress);
  const updateChapter = useNovelStore(s => s.updateChapter);
  const allCharacters = useDataStore(s => s.entries.filter(e => e.type === 'character'));

  const book = books.find(b => b.id === bookId);
  const bookChapters = useMemo(
    () => [...chapters].sort((a, b) => a.order - b.order),
    [chapters]
  );
  const currentIndex = bookChapters.findIndex(c => c.id === chapterId);
  const chapter = currentIndex >= 0 ? bookChapters[currentIndex] : undefined;

  // 阅读模式设置（从 localStorage 初始化）
  const initial = useRef<ReaderSettings>(loadReaderSettings());
  const [bgTheme, setBgTheme] = useState<BgTheme>(initial.current.bgTheme);
  const [fontSize, setFontSize] = useState<FontSize>(initial.current.fontSize);
  const [lineHeight, setLineHeight] = useState<LineHeight>(initial.current.lineHeight);

  // 设置变更即持久化
  useEffect(() => {
    const s: ReaderSettings = { bgTheme, fontSize, lineHeight };
    try { localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }, [bgTheme, fontSize, lineHeight]);

  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [activeChar, setActiveChar] = useState<Character | null>(null);
  const [scrollRatio, setScrollRatio] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const theme = READER_THEMES[bgTheme];

  // 剧透保护状态
  const isSpoilerUnlocked = book ? (book.completedChapters >= book.totalChapters && book.totalChapters > 0) : false;
  const showMentions = book ? (book.spoilerMode === 'open' || isSpoilerUnlocked) : true;

  // 获取角色档案
  const charMap = useMemo(() => {
    const map: Record<string, Character> = {};
    for (const e of allCharacters) {
      map[e.id] = e as Character;
    }
    return map;
  }, [allCharacters]);

  const paragraphs = useMemo(() => {
    if (!chapter) return [] as string[];
    return chapter.content.split(/\n\n+/).filter(p => p.length > 0);
  }, [chapter]);

  // 计算 mention 位置（段落级）
  const mentionIndices = useMemo(() => {
    if (!chapter || !showMentions) return new Map<number, Array<{ name: string; charId: string }>>();
    const map = new Map<number, Array<{ name: string; charId: string }>>();
    const processed = new Set<string>();

    for (let pi = 0; pi < paragraphs.length; pi++) {
      const para = paragraphs[pi];
      for (const m of chapter.mentions) {
        if (processed.has(m.charId)) continue;
        const idx = para.indexOf(m.name);
        if (idx >= 0) {
          if (!map.has(pi)) map.set(pi, []);
          map.get(pi)!.push({ name: m.name, charId: m.charId });
          processed.add(m.charId);
        }
      }
    }
    return map;
  }, [chapter, paragraphs, showMentions]);

  // 加载进度
  useEffect(() => {
    if (!chapter || !containerRef.current) return;
    const progress = useNovelStore.getState().progress[bookId!];
    if (progress && progress.lastChapterId === chapterId) {
      requestAnimationFrame(() => {
        if (containerRef.current) {
          const scrollable = containerRef.current;
          scrollable.scrollTop = progress.scrollRatio * scrollable.scrollHeight;
        }
      });
    }
    if (!chapter.read && book) {
      markChapterRead(bookId!, chapterId!);
    }
  }, [chapter, book, markChapterRead, bookId, chapterId]);

  // 滚动监听（保存进度）
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !chapter) return;
    const el = containerRef.current;
    const ratio = el.scrollHeight > el.clientHeight ? el.scrollTop / (el.scrollHeight - el.clientHeight) : 0;
    setScrollRatio(ratio);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveProgress({
        bookId: bookId!,
        lastChapterId: chapterId!,
        scrollRatio: ratio,
        updatedAt: Date.now(),
      });
    }, 1000);
  }, [chapter, bookId, chapterId, saveProgress]);

  // 键盘导航
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        navigate(`/novel/${bookId}/chapter/${bookChapters[currentIndex - 1].id}`, { replace: true });
      } else if (e.key === 'ArrowRight' && currentIndex < bookChapters.length - 1) {
        navigate(`/novel/${bookId}/chapter/${bookChapters[currentIndex + 1].id}`, { replace: true });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIndex, bookChapters, bookId, navigate]);

  if (!chapter || !book) {
    return (
      <div className="text-center py-20 text-ink-500">
        <p>章节不存在</p>
        <button onClick={() => navigate('/novel')} className="btn-gold mt-4">返回书架</button>
      </div>
    );
  }

  const prevChapter = currentIndex > 0 ? bookChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < bookChapters.length - 1 ? bookChapters[currentIndex + 1] : null;

  const renderParagraph = (para: string, pi: number) => {
    const mentionsInPara = mentionIndices.get(pi);
    if (!mentionsInPara || !showMentions) {
      return <p key={pi} className="novel-para">{para}</p>;
    }

    const parts: React.ReactNode[] = [];
    let key = 0;

    const firstMention = mentionsInPara[0];
    if (firstMention) {
      const idx = para.indexOf(firstMention.name);
      if (idx >= 0) {
        if (idx > 0) parts.push(<span key={key++}>{para.slice(0, idx)}</span>);
        parts.push(
          <span
            key={key++}
            className="mention-highlight"
            onClick={(e) => {
              e.stopPropagation();
              const char = charMap[firstMention.charId];
              if (char) setActiveChar(char);
            }}
          >
            {firstMention.name}
          </span>
        );
        if (idx + firstMention.name.length < para.length) {
          parts.push(<span key={key++}>{para.slice(idx + firstMention.name.length)}</span>);
        }
      } else {
        parts.push(<span key={key++}>{para}</span>);
      }
    } else {
      parts.push(<span key={key++}>{para}</span>);
    }

    return <p key={pi} className="novel-para">{parts}</p>;
  };

  // 容器注入阅读主题 CSS 变量，供 mention-highlight 等使用
  const readerStyleVars: React.CSSProperties = {
    // @ts-expect-error 自定义 CSS 属性
    '--reader-accent': theme.accent,
    backgroundColor: theme.bg,
    color: theme.text,
  };

  return (
    <div
      className={`min-h-screen flex flex-col ${theme.vignette ? 'reader-vignette' : ''}`}
      style={readerStyleVars}
    >
      {/* 顶部栏 */}
      <header
        className="sticky top-0 z-20 backdrop-blur border-b"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(`/novel/${bookId}`)} className="btn-ghost p-2">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium truncate max-w-[200px]" style={{ color: theme.title }}>{chapter.title}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowToc(true)} className="btn-ghost p-2" title="目录">
              <List size={18} />
            </button>
            <button onClick={() => setShowSettings(true)} className="btn-ghost p-2" title="设置">
              <Settings2 size={18} />
            </button>
          </div>
        </div>
        {/* 阅读进度条 */}
        <div className="h-0.5 bg-transparent">
          <div className="h-full transition-all" style={{ width: `${scrollRatio * 100}%`, backgroundColor: theme.accent }} />
        </div>
      </header>

      {/* 阅读区 */}
      <main
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
        style={{ maxWidth: '48rem', margin: '0 auto', width: '100%', padding: '2rem 1.5rem' }}
      >
        {/* 章节标题 */}
        <h2 className="text-center text-xl font-bold mb-8" style={{ color: theme.title }}>{chapter.title}</h2>

        {/* 顶光影 */}
        <div
          className="pointer-events-none fixed inset-x-0 top-12 h-12"
          style={{ background: `linear-gradient(to bottom, ${theme.bg}, transparent)` }}
        />

        {/* 正文 */}
        <div
          className="novel-content space-y-4"
          style={{
            fontSize: `${FONT_SIZES[fontSize].px}px`,
            lineHeight: LINE_HEIGHTS[lineHeight].value,
            textIndent: '2em',
          }}
        >
          {paragraphs.map((para, pi) => renderParagraph(para, pi))}
        </div>

        {/* 底光影 */}
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 h-12"
          style={{ background: `linear-gradient(to top, ${theme.bg}, transparent)` }}
        />

        {/* 章节末尾导航 */}
        <div className="flex items-center justify-between mt-12 pt-6" style={{ borderTopColor: theme.border, borderTopWidth: 1 }}>
          <button
            onClick={() => prevChapter && navigate(`/novel/${bookId}/chapter/${prevChapter.id}`, { replace: true })}
            disabled={!prevChapter}
            className="btn-ghost text-sm disabled:opacity-30"
          >
            <ChevronLeft size={16} /> 上一章
          </button>
          <span className="text-xs" style={{ color: theme.sub }}>{currentIndex + 1} / {bookChapters.length}</span>
          <button
            onClick={() => nextChapter && navigate(`/novel/${bookId}/chapter/${nextChapter.id}`, { replace: true })}
            disabled={!nextChapter}
            className="btn-ghost text-sm disabled:opacity-30"
          >
            下一章 <ChevronRight size={16} />
          </button>
        </div>
      </main>

      {/* 底部导航栏 */}
      <div
        className="sticky bottom-0 z-20 border-t"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="flex items-center justify-center gap-8 h-14">
          <button
            onClick={() => prevChapter && navigate(`/novel/${bookId}/chapter/${prevChapter.id}`, { replace: true })}
            disabled={!prevChapter}
            className="flex flex-col items-center disabled:opacity-30"
            style={{ color: theme.sub }}
            aria-label="上一章"
          >
            <ChevronLeft size={20} />
            <span className="text-xs mt-0.5">上一章</span>
          </button>
          <button
            onClick={() => setShowToc(true)}
            className="flex flex-col items-center"
            style={{ color: theme.sub }}
            aria-label="目录"
          >
            <List size={20} />
            <span className="text-xs mt-0.5">目录</span>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex flex-col items-center"
            style={{ color: theme.sub }}
            aria-label="设置"
          >
            <Settings2 size={20} />
            <span className="text-xs mt-0.5">设置</span>
          </button>
          <button
            onClick={() => nextChapter && navigate(`/novel/${bookId}/chapter/${nextChapter.id}`, { replace: true })}
            disabled={!nextChapter}
            className="flex flex-col items-center disabled:opacity-30"
            style={{ color: theme.sub }}
            aria-label="下一章"
          >
            <ChevronRight size={20} />
            <span className="text-xs mt-0.5">下一章</span>
          </button>
        </div>
      </div>

      {/* 目录抽屉 */}
      {showToc && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-end" onClick={() => setShowToc(false)}>
          <div
            className="w-80 max-w-full h-full overflow-y-auto p-4"
            style={{ backgroundColor: theme.bg }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold" style={{ color: theme.title }}>目录</h3>
              <button onClick={() => setShowToc(false)} className="btn-ghost p-1">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-1">
              {bookChapters.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setShowToc(false);
                    navigate(`/novel/${bookId}/chapter/${c.id}`, { replace: true });
                  }}
                  className="w-full text-left px-3 py-2 rounded text-sm transition-colors"
                  style={
                    c.id === chapterId
                      ? { backgroundColor: `${theme.accent}22`, color: theme.accent }
                      : { color: theme.text }
                  }
                >
                  {c.read && <span style={{ color: theme.accent }} className="mr-1">✓</span>}
                  {i + 1}. {c.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 设置抽屉 */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-end" onClick={() => setShowSettings(false)}>
          <div
            className="w-72 h-full p-4 overflow-y-auto"
            style={{ backgroundColor: theme.bg }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold" style={{ color: theme.title }}>阅读设置</h3>
              <button onClick={() => setShowSettings(false)} className="btn-ghost p-1">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-6">
              {/* 背景色 */}
              <div>
                <label className="text-sm font-medium" style={{ color: theme.title }}>背景</label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {(Object.keys(READER_THEMES) as BgTheme[]).map(key => {
                    const t = READER_THEMES[key];
                    const active = bgTheme === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setBgTheme(key)}
                        title={t.label}
                        className="w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center"
                        style={{
                          backgroundColor: t.swatch,
                          borderColor: active ? theme.accent : theme.border,
                          boxShadow: active ? `0 0 0 2px ${theme.accent}55` : 'none',
                        }}
                      >
                        {active && (
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: theme.accent }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] mt-1.5" style={{ color: theme.sub }}>{READER_THEMES[bgTheme].label}</p>
              </div>

              {/* 字号 */}
              <div>
                <label className="text-sm font-medium" style={{ color: theme.title }}>字号</label>
                <div className="flex gap-1.5 mt-2">
                  {(Object.keys(FONT_SIZES) as FontSize[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setFontSize(s)}
                      className="flex-1 py-2 rounded border text-sm transition-all"
                      style={
                        fontSize === s
                          ? { borderColor: theme.accent, backgroundColor: `${theme.accent}1a`, color: theme.accent }
                          : { borderColor: theme.border, color: theme.sub }
                      }
                    >
                      {FONT_SIZES[s].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 行距 */}
              <div>
                <label className="text-sm font-medium" style={{ color: theme.title }}>行距</label>
                <div className="flex gap-2 mt-2">
                  {(Object.keys(LINE_HEIGHTS) as LineHeight[]).map(l => (
                    <button
                      key={l}
                      onClick={() => setLineHeight(l)}
                      className="flex-1 py-2 rounded border text-sm transition-all"
                      style={
                        lineHeight === l
                          ? { borderColor: theme.accent, backgroundColor: `${theme.accent}1a`, color: theme.accent }
                          : { borderColor: theme.border, color: theme.sub }
                      }
                    >
                      {LINE_HEIGHTS[l].label}
                    </button>
                  ))}
                </div>
              </div>

              {book?.spoilerMode === 'unlock' && !isSpoilerUnlocked && (
                <div
                  className="text-xs p-3 rounded"
                  style={{
                    backgroundColor: `${theme.accent}11`,
                    border: `1px solid ${theme.border}`,
                    color: theme.sub,
                  }}
                >
                  <p className="font-medium mb-1" style={{ color: theme.accent }}>解锁模式</p>
                  <p>读完本书后，角色名下划线和卡片才会显示。当前进度 {book.completedChapters}/{book.totalChapters}</p>
                </div>
              )}
              {!IS_WEB_BUILD && (
                <div className="pt-4" style={{ borderTopColor: theme.border, borderTopWidth: 1 }}>
                  <button
                    onClick={() => {
                      if (!isBound) return;
                      setEditTitle(chapter.title);
                      setEditContent(chapter.content);
                      setShowEditor(true);
                      setShowSettings(false);
                    }}
                    className="btn-gold w-full text-sm"
                  >
                    编辑本章
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 章节编辑器弹窗 */}
      {showEditor && chapter && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowEditor(false)}>
          <div
            className="panel-gold w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gold-900/30">
              <h3 className="gold-title font-bold">编辑章节</h3>
              <button onClick={() => setShowEditor(false)} className="btn-ghost p-1">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm text-ink-400 mb-1.5">章节标题</label>
                <input
                  className="input-field w-full"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="如：第一章 初遇"
                />
              </div>
              <div>
                <label className="block text-sm text-ink-400 mb-1.5">章节正文（段落之间空一行）</label>
                <textarea
                  className="input-field w-full font-serif leading-relaxed"
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={20}
                  placeholder={"写的真实是为了让你看清脚下的路……\n\n离得太近会看不清……"}
                />
                <div className="flex justify-between mt-2 text-xs text-ink-600">
                  <span>{editContent.length} 字</span>
                  <span>{editContent.split(/\n\n+/).filter(p => p.trim()).length} 段落</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gold-900/30">
              <button
                onClick={() => setShowEditor(false)}
                className="btn-ghost text-sm"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  const charList = allCharacters as Character[];
                  const titleToSave = editTitle.trim();
                  const contentToSave = editContent;
                  await updateChapter(chapter.id, {
                    title: titleToSave,
                    content: contentToSave,
                  }, charList);
                  setShowEditor(false);
                }}
                className="btn-gold text-sm"
              >
                保存并重新扫描角色
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 角色卡片弹窗 */}
      {activeChar && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setActiveChar(null)}>
          <div
            className="panel-gold max-w-md w-full p-5 animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="gold-title text-lg font-bold">{activeChar.title}</h3>
              <button onClick={() => setActiveChar(null)} className="btn-ghost p-1">
                <X size={16} />
              </button>
            </div>
            {activeChar.summary && (
              <p className="text-sm text-ink-400 mb-3">{activeChar.summary}</p>
            )}
            {activeChar.content && (
              <p className="text-sm text-ink-300 leading-relaxed max-h-48 overflow-y-auto">
                {activeChar.content.length > 300 ? activeChar.content.slice(0, 300) + '...' : activeChar.content}
              </p>
            )}
            <button
              onClick={() => {
                setActiveChar(null);
                navigate(`/character`);
              }}
              className="btn-gold w-full mt-4 text-sm"
            >
              查看完整档案
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, List, Settings2, X } from 'lucide-react';
import { useNovelStore } from '../store/novelStore';
import { useDataStore } from '../store/dataStore';
import { useBindingStore } from '../store/bindingStore';
import { useRequirePin } from '../hooks/useRequirePin';
import { IS_WEB_BUILD } from '../lib/buildTarget';
import type { Character } from '../types';

export default function NovelReader() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const navigate = useNavigate();
  const isBound = useBindingStore(s => s.isBound);
  const { requirePin, PinGuard } = useRequirePin();
  const chapters = useNovelStore(s => s.chapters);
  const books = useNovelStore(s => s.books);
  const markChapterRead = useNovelStore(s => s.markChapterRead);
  const saveProgress = useNovelStore(s => s.saveProgress);
  const updateChapter = useNovelStore(s => s.updateChapter);
  const allEntries = useDataStore(s => s.entries);

  const book = books.find(b => b.id === bookId);
  const bookChapters = bookId ? (chapters[bookId] || []).sort((a, b) => a.order - b.order) : [];
  const currentIndex = bookChapters.findIndex(c => c.id === chapterId);
  const chapter = currentIndex >= 0 ? bookChapters[currentIndex] : undefined;

  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [activeChar, setActiveChar] = useState<Character | null>(null);
  const [scrollRatio, setScrollRatio] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 剧透保护状态
  const isSpoilerUnlocked = book ? (book.completedChapters >= book.totalChapters && book.totalChapters > 0) : false;
  const showMentions = book ? (book.spoilerMode === 'open' || isSpoilerUnlocked) : true;

  // 获取角色档案
  const charMap = useMemo(() => {
    const map: Record<string, Character> = {};
    for (const e of allEntries) {
      if (e.type === 'character') map[e.id] = e as Character;
    }
    return map;
  }, [allEntries]);

  const paragraphs = useMemo(() => {
    if (!chapter) return [] as string[];
    return chapter.content.split(/\n\n+/).filter(p => p.length > 0);
  }, [chapter]);

  // 计算 mention 位置（段落级）
  const mentionIndices = useMemo(() => {
    if (!chapter || !showMentions) return new Map<number, Array<{ name: string; charId: string }>>();
    const map = new Map<number, Array<{ name: string; charId: string }>>();
    const processed = new Set<string>(); // 记录已处理角色，避免突变源数据

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
      // 延迟一帧滚动到位置
      requestAnimationFrame(() => {
        if (containerRef.current) {
          const scrollable = containerRef.current;
          scrollable.scrollTop = progress.scrollRatio * scrollable.scrollHeight;
        }
      });
    }
    // 标记为已读
    if (!chapter.read && book) {
      markChapterRead(bookId!, chapterId!);
    }
  }, [chapterId]);

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
        navigate(`/novel/${bookId}/chapter/${bookChapters[currentIndex - 1].id}`);
      } else if (e.key === 'ArrowRight' && currentIndex < bookChapters.length - 1) {
        navigate(`/novel/${bookId}/chapter/${bookChapters[currentIndex + 1].id}`);
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

  const fontSizeClass = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' }[fontSize];
  const themeClass = theme === 'light' ? 'bg-stone-50 text-stone-800' : 'bg-ink-950 text-ink-200';
  const titleClass = theme === 'light' ? 'text-stone-900' : 'text-gold-300';

  const prevChapter = currentIndex > 0 ? bookChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < bookChapters.length - 1 ? bookChapters[currentIndex + 1] : null;

  const renderParagraph = (para: string, pi: number) => {
    const mentionsInPara = mentionIndices.get(pi);
    if (!mentionsInPara || !showMentions) {
      return <p key={pi} className="novel-para">{para}</p>;
    }

    // 找到所有需要高亮的位置
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let key = 0;

    // 只取第一个匹配（首次出现）
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

  return (
    <div className={`min-h-screen flex flex-col ${themeClass}`}>
      {/* 顶部栏 */}
      <header className={`sticky top-0 z-20 backdrop-blur border-b ${theme === 'light' ? 'bg-stone-50/90 border-stone-200' : 'bg-ink-950/90 border-gold-900/20'}`}>
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(`/novel/${bookId}`)} className="btn-ghost p-2">
              <ChevronLeft size={18} />
            </button>
            <span className={`text-sm font-medium truncate max-w-[200px] ${titleClass}`}>{chapter.title}</span>
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
          <div className="h-full bg-gold-500 transition-all" style={{ width: `${scrollRatio * 100}%` }} />
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
        <h2 className={`text-center text-xl font-bold mb-8 ${titleClass}`}>{chapter.title}</h2>

        {/* 顶光影 */}
        <div className={`pointer-events-none fixed inset-x-0 top-12 h-12 ${theme === 'light' ? 'bg-gradient-to-b from-stone-50 to-transparent' : 'bg-gradient-to-b from-ink-950 to-transparent'}`} />

        {/* 正文 */}
        <div className={`novel-content ${fontSizeClass} leading-relaxed space-y-4`} style={{ textIndent: '2em' }}>
          {paragraphs.map((para, pi) => renderParagraph(para, pi))}
        </div>

        {/* 底光影 */}
        <div className={`pointer-events-none fixed inset-x-0 bottom-0 h-12 ${theme === 'light' ? 'bg-gradient-to-t from-stone-50 to-transparent' : 'bg-gradient-to-t from-ink-950 to-transparent'}`} />

        {/* 章节末尾导航 */}
        <div className="flex items-center justify-between mt-12 pt-6 border-t border-ink-800/30">
          <button
            onClick={() => prevChapter && navigate(`/novel/${bookId}/chapter/${prevChapter.id}`)}
            disabled={!prevChapter}
            className="btn-ghost text-sm disabled:opacity-30"
          >
            <ChevronLeft size={16} /> 上一章
          </button>
          <span className="text-xs text-ink-500">{currentIndex + 1} / {bookChapters.length}</span>
          <button
            onClick={() => nextChapter && navigate(`/novel/${bookId}/chapter/${nextChapter.id}`)}
            disabled={!nextChapter}
            className="btn-ghost text-sm disabled:opacity-30"
          >
            下一章 <ChevronRight size={16} />
          </button>
        </div>
      </main>

      {/* 底部导航栏 */}
      <div className={`sticky bottom-0 z-20 border-t ${theme === 'light' ? 'bg-stone-50 border-stone-200' : 'bg-ink-950/95 border-gold-900/20'}`}>
        <div className="flex items-center justify-center gap-8 h-14">
          <button
            onClick={() => prevChapter && navigate(`/novel/${bookId}/chapter/${prevChapter.id}`)}
            disabled={!prevChapter}
            className="flex flex-col items-center disabled:opacity-30"
            aria-label="上一章"
          >
            <ChevronLeft size={20} />
            <span className="text-xs mt-0.5">上一章</span>
          </button>
          <button
            onClick={() => setShowToc(true)}
            className="flex flex-col items-center"
            aria-label="目录"
          >
            <List size={20} />
            <span className="text-xs mt-0.5">目录</span>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex flex-col items-center"
            aria-label="设置"
          >
            <Settings2 size={20} />
            <span className="text-xs mt-0.5">设置</span>
          </button>
          <button
            onClick={() => nextChapter && navigate(`/novel/${bookId}/chapter/${nextChapter.id}`)}
            disabled={!nextChapter}
            className="flex flex-col items-center disabled:opacity-30"
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
            className={`w-80 max-w-full h-full overflow-y-auto ${theme === 'light' ? 'bg-stone-50' : 'bg-ink-950'} p-4`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-bold ${titleClass}`}>目录</h3>
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
                    navigate(`/novel/${bookId}/chapter/${c.id}`);
                  }}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    c.id === chapterId
                      ? 'bg-gold-900/30 text-gold-300'
                      : theme === 'light'
                        ? 'text-stone-700 hover:bg-stone-100'
                        : 'text-ink-300 hover:bg-ink-900/50'
                  }`}
                >
                  {c.read && <span className="text-gold-500 mr-1">✓</span>}
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
            className={`w-72 h-full ${theme === 'light' ? 'bg-stone-50' : 'bg-ink-950'} p-4`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className={`font-bold ${titleClass}`}>阅读设置</h3>
              <button onClick={() => setShowSettings(false)} className="btn-ghost p-1">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className={`text-sm ${titleClass}`}>字号</label>
                <div className="flex gap-2 mt-2">
                  {(['sm', 'md', 'lg'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setFontSize(s)}
                      className={`flex-1 py-2 rounded border text-sm ${
                        fontSize === s
                          ? 'border-gold-500 bg-gold-900/20 text-gold-300'
                          : 'border-ink-700 text-ink-400'
                      }`}
                    >
                      {s === 'sm' ? '小' : s === 'md' ? '中' : '大'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={`text-sm ${titleClass}`}>主题</label>
                <div className="flex gap-2 mt-2">
                  {(['dark', 'light'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`flex-1 py-2 rounded border text-sm ${
                        theme === t
                          ? 'border-gold-500 bg-gold-900/20 text-gold-300'
                          : 'border-ink-700 text-ink-400'
                      }`}
                    >
                      {t === 'dark' ? '夜间' : '日间'}
                    </button>
                  ))}
                </div>
              </div>
              {book?.spoilerMode === 'unlock' && !isSpoilerUnlocked && (
                <div className="text-xs text-ink-500 p-3 rounded bg-ink-900/40 border border-gold-900/20">
                  <p className="text-gold-500/80 font-medium mb-1">解锁模式</p>
                  <p>读完本书后，角色名下划线和卡片才会显示。当前进度 {book.completedChapters}/{book.totalChapters}</p>
                </div>
              )}
              {!IS_WEB_BUILD && (
                <div className="pt-4 border-t border-ink-800/30">
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
                onClick={() => {
                  const charList = allEntries.filter(e => e.type === 'character') as Character[];
                  const titleToSave = editTitle.trim();
                  const contentToSave = editContent;
                  requirePin('保存章节', async () => {
                    await updateChapter(chapter.id, {
                      title: titleToSave,
                      content: contentToSave,
                    }, charList);
                    setShowEditor(false);
                  });
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

      {PinGuard}
    </div>
  );
}

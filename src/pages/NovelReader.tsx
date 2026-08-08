import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, List, Settings2, X } from 'lucide-react';
import { useNovelStore } from '../store/novelStore';
import { useDataStore } from '../store/dataStore';
import { useBindingStore } from '../store/bindingStore';
import { IS_WEB_BUILD } from '../lib/buildTarget';
import type { Character, NovelChapter } from '../types';

const EMPTY_CHAPTERS: NovelChapter[] = [];

/* ============================================================
   阅读模式：3 套主题
   不叠加蒙板，而是直接覆盖全局 CSS 变量
   让整个页面（包括 Layout 的 rune-bg 符文水印）统一变色
   ============================================================ */
type ReaderTheme = 'dark' | 'light' | 'parchment';
type FontSize = 'sm' | 'md' | 'lg' | 'xl';
type LineHeight = 'compact' | 'normal' | 'loose';
type ReadMode = 'scroll' | 'page';

interface ReaderThemeConfig {
  label: string;
  swatch: string;
  titleColor: string;
  accentColor: string;
  vars: Record<string, string>;
  // 牛皮纸专用：直接画在 .novel-content 上的 background（纹理和文字是同一元素的前景+背景，天然同步动）
  contentBg?: string;
}

const READER_THEMES: Record<ReaderTheme, ReaderThemeConfig> = {
  dark: {
    label: '深色',
    swatch: '#0c0c0c',
    titleColor: '#c9a84c',
    accentColor: '#c9a84c',
    vars: {
      '--bg-base': '#0c0c0c',
      '--bg-surface': '#0c0c0c',
      '--bg-elevated': '#161616',
      '--text-primary': '#c8c2b4',
      '--text-secondary': '#9a9488',
      '--text-tertiary': '#6e6a60',
      '--border-default': '#2a2a28',
      '--border-subtle': '#1e1e1c',
      '--rune-opacity': '0.35',
      '--rune-filter': 'brightness(1.45) saturate(0.85)',
    },
  },
  light: {
    label: '浅色',
    swatch: '#f7f2e6',
    titleColor: '#8a6a20',
    accentColor: '#8a6a20',
    vars: {
      '--bg-base': '#f7f2e6',
      '--bg-surface': '#f7f2e6',
      '--bg-elevated': '#f0eadc',
      '--text-primary': '#443e34',
      '--text-secondary': '#6b6558',
      '--text-tertiary': '#8a8478',
      '--border-default': '#d8d0c0',
      '--border-subtle': '#e0d8c8',
      '--rune-opacity': '0.40',
      '--rune-filter': 'brightness(1.15) saturate(0.8)',
    },
  },
  parchment: {
    label: '牛皮纸',
    swatch: '#cbae77',
    titleColor: '#4d2e0e',
    accentColor: '#4d2e0e',
    vars: {
      // 基础底色 = 牛皮纸整体基调，novel-content 边缘/缝隙露出时和内容底色一致
      '--bg-base': '#d4bf82',
      '--bg-surface': '#d4bf82',
      '--bg-elevated': '#bfa569',
      '--text-primary': '#3a2818',
      '--text-secondary': '#5a4832',
      '--text-tertiary': '#7a6850',
      '--border-default': '#a68d5c',
      '--border-subtle': '#b39a6b',
      '--rune-opacity': '0.18',
      '--rune-filter': 'brightness(1.0) saturate(0.5)',
    },
    // — 牛皮纸纹理 = SVG feTurbulence(fractalNoise) 多层合成 —
    // 应用在 .novel-content 的 background-image 上，与文字属于同一 DOM 元素，
    // 滑动/翻页时文字和纹理必然同步移动，不会出现"悬浮不动/错位"bug
    // 合成顺序（从上到下 CSS）：径向微提亮 → 老化斑驳 → 絮状纤维 → 细小气孔 → 基础暖色渐变
    contentBg: (() => {
      const SVG_PORES = encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>
          <filter id='p' x='0' y='0' width='100%' height='100%'>
            <feTurbulence type='fractalNoise' baseFrequency='4.6' numOctaves='2' stitchTiles='stitch' seed='7'/>
            <feColorMatrix type='matrix' values='0 0 0 0 0.14  0 0 0 0 0.07  0 0 0 0 0.02  0 0 0 0.18 0'/>
          </filter>
          <rect width='300' height='300' filter='url(#p)'/>
        </svg>`
      );
      const SVG_FIBER = encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>
          <filter id='f' x='0' y='0' width='100%' height='100%'>
            <feTurbulence type='fractalNoise' baseFrequency='1.5 0.035' numOctaves='2' stitchTiles='stitch' seed='13'/>
            <feColorMatrix type='matrix' values='0 0 0 0 0.30  0 0 0 0 0.17  0 0 0 0 0.06  0 0 0 0.16 0'/>
          </filter>
          <rect width='300' height='300' filter='url(#f)'/>
        </svg>`
      );
      const SVG_STAIN = encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='1200'>
          <filter id='s' x='0' y='0' width='100%' height='100%'>
            <feTurbulence type='fractalNoise' baseFrequency='0.011' numOctaves='3' stitchTiles='stitch' seed='29'/>
            <feColorMatrix type='matrix' values='0 0 0 0 0.25  0 0 0 0 0.13  0 0 0 0 0.04  0 0 0 0.20 0'/>
          </filter>
          <rect width='1200' height='1200' filter='url(#s)'/>
        </svg>`
      );

      const pores   = `url("data:image/svg+xml;utf8,${SVG_PORES}") 0 0 / 300px 300px repeat`;
      const fiber   = `url("data:image/svg+xml;utf8,${SVG_FIBER}") 0 0 / 300px 300px repeat`;
      const stain   = `url("data:image/svg+xml;utf8,${SVG_STAIN}")  0 0 / 1200px 1200px repeat`;
      const vignette = 'radial-gradient(ellipse 80% 40% at 50% 30%, rgba(255,242,205,0.20) 0%, rgba(255,235,185,0.04) 50%, rgba(255,225,170,0) 75%) 0 0 / 100% 100% no-repeat';
      // 基础牛皮纸底色：暖黄褐 → 稍微的色差，不是纯色滤镜
      const base    = 'linear-gradient(160deg, #e2cc8e 0%, #d6bf7d 42%, #c7ad6a 82%, #b99c5b 100%) 0 0 / 100% 100% no-repeat';

      return [vignette, stain, fiber, pores, base].join(', ');
    })(),
  },
};

const FONT_SIZES: Record<FontSize, { label: string; px: number }> = {
  sm: { label: '小', px: 16 },
  md: { label: '中', px: 18 },
  lg: { label: '大', px: 20 },
  xl: { label: '特大', px: 23 },
};

const LINE_HEIGHTS: Record<LineHeight, { label: string; value: number }> = {
  compact: { label: '紧凑', value: 1.8 },
  normal: { label: '标准', value: 2.0 },
  loose: { label: '宽松', value: 2.4 },
};

const READER_SETTINGS_KEY = 'readerSettings';
interface ReaderSettings {
  theme: ReaderTheme;
  fontSize: FontSize;
  lineHeight: LineHeight;
  readMode: ReadMode;
}

function loadReaderSettings(): ReaderSettings {
  const defaults: ReaderSettings = { theme: 'dark', fontSize: 'md', lineHeight: 'normal', readMode: 'scroll' };
  try {
    const raw = localStorage.getItem(READER_SETTINGS_KEY);
    if (!raw) return defaults;
    const p = JSON.parse(raw) as Partial<ReaderSettings>;
    return {
      theme: p.theme && READER_THEMES[p.theme] ? p.theme : 'dark',
      fontSize: p.fontSize && FONT_SIZES[p.fontSize] ? p.fontSize : 'md',
      lineHeight: p.lineHeight && LINE_HEIGHTS[p.lineHeight] ? p.lineHeight : 'normal',
      readMode: p.readMode === 'page' || p.readMode === 'scroll' ? p.readMode : 'scroll',
    };
  } catch {
    return defaults;
  }
}

export default function NovelReader() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const navigate = useNavigate();
  const isBound = useBindingStore(s => s.isBound);
  const chapters = useNovelStore(s => bookId ? (s.chapters[bookId] || EMPTY_CHAPTERS) : EMPTY_CHAPTERS);
  const books = useNovelStore(s => s.books);
  const markChapterRead = useNovelStore(s => s.markChapterRead);
  const saveProgress = useNovelStore(s => s.saveProgress);
  const updateChapter = useNovelStore(s => s.updateChapter);
  const entries = useDataStore(s => s.entries);
  const allCharacters = useMemo(
    () => entries.filter(e => e.type === 'character') as Character[],
    [entries]
  );

  const book = books.find(b => b.id === bookId);
  const bookChapters = useMemo(
    () => [...chapters].sort((a, b) => a.order - b.order),
    [chapters]
  );
  const currentIndex = bookChapters.findIndex(c => c.id === chapterId);
  const chapter = currentIndex >= 0 ? bookChapters[currentIndex] : undefined;

  // 阅读设置
  const initial = useRef<ReaderSettings>(loadReaderSettings());
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>(initial.current.theme);
  const [fontSize, setFontSize] = useState<FontSize>(initial.current.fontSize);
  const [lineHeight, setLineHeight] = useState<LineHeight>(initial.current.lineHeight);
  const [readMode, setReadMode] = useState<ReadMode>(initial.current.readMode);

  // 持久化阅读设置
  useEffect(() => {
    try {
      localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify({ theme: readerTheme, fontSize, lineHeight, readMode }));
    } catch { /* ignore */ }
  }, [readerTheme, fontSize, lineHeight, readMode]);

  // 核心：覆盖全局 CSS 变量，让整个页面统一变色
  // 退出时恢复原值，不污染其他页面
  const savedVarsRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const root = document.documentElement;
    const vars = READER_THEMES[readerTheme].vars;

    // 首次进入：保存原始值
    if (Object.keys(savedVarsRef.current).length === 0) {
      for (const key of Object.keys(vars)) {
        savedVarsRef.current[key] = root.style.getPropertyValue(key);
      }
    }

    // 覆盖
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }

    return () => {
      // 恢复
      for (const [key, original] of Object.entries(savedVarsRef.current)) {
        if (original) {
          root.style.setProperty(key, original);
        } else {
          root.style.removeProperty(key);
        }
      }
    };
  }, [readerTheme]);

  // UI 状态
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [activeChar, setActiveChar] = useState<Character | null>(null);
  const [scrollRatio, setScrollRatio] = useState(0);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markedReadRef = useRef<string | null>(null);
  const restoredRef = useRef<string | null>(null);

  // ===== 翻页模式状态 =====
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageDims, setPageDims] = useState({ w: 0, h: 0 });
  const [contentWidth, setContentWidth] = useState(0);
  const [flipDir, setFlipDir] = useState<'left' | 'right' | null>(null);
  const pagedWrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const goToLastPageRef = useRef(false);
  const pendingRestoreRatioRef = useRef<number | null>(null);
  const isPageAnimatingRef = useRef(false);

  const theme = READER_THEMES[readerTheme];

  // 剧透保护
  const isSpoilerUnlocked = book ? (book.completedChapters >= book.totalChapters && book.totalChapters > 0) : false;
  const showMentions = book ? (book.spoilerMode === 'open' || isSpoilerUnlocked) : true;

  // 角色映射
  const charMap = useMemo(() => {
    const map: Record<string, Character> = {};
    for (const e of allCharacters) {
      map[e.id] = e as Character;
    }
    return map;
  }, [allCharacters]);

  // 段落
  const paragraphs = useMemo(() => {
    if (!chapter) return [] as string[];
    return chapter.content.split(/\n\n+/).filter(p => p.length > 0);
  }, [chapter]);

  // 角色提及位置
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

  // ===== 翻页模式：body 滚动锁定 =====
  useEffect(() => {
    if (readMode === 'page') {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [readMode]);

  // ===== 翻页模式：测量容器尺寸 =====
  useEffect(() => {
    if (readMode !== 'page') return;
    const wrapper = pagedWrapperRef.current;
    if (!wrapper) return;

    const measure = () => {
      const rect = wrapper.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      if (w > 0 && h > 0) {
        setPageDims(prev => prev.w !== w || prev.h !== h ? { w, h } : prev);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [readMode]);

  // ===== 翻页模式：计算总页数（测量 + 强制重置 + 双重验证） =====
  useEffect(() => {
    if (readMode !== 'page' || pageDims.w === 0) return;
    const content = contentRef.current;
    if (!content) return;
    let rafId1: number | null = null;
    let rafId2: number | null = null;
    let rafId3: number | null = null;

    // —— 第 1 帧：强制清除 contentWidth，保证浏览器用原生 column-width 重排
    // （如果带着旧 width 直接测，scrollWidth=旧值，排页边界会错位）
    setContentWidth(0);
    content.style.width = 'auto';
    content.style.transform = 'translateX(0px)';

    rafId1 = requestAnimationFrame(() => {
      // —— 第 2 帧：浏览器已重新排版，读真实 scrollWidth
      const scrollW1 = content.scrollWidth;
      const pageW = Math.max(1, pageDims.w);
      const rawPages = scrollW1 / pageW;
      const rawCeil = Math.ceil(rawPages);

      rafId2 = requestAnimationFrame(() => {
        // —— 第 3 帧：双重验证，如果 scrollWidth 抖动则再测一次取大值
        const scrollW2 = content.scrollWidth;
        const finalW = Math.max(scrollW1, scrollW2);
        let total = Math.max(1, Math.ceil(finalW / pageW));

        // 安全兜底：如果 scrollWidth/pageW 离"刚好装满整数页"只差 <3px，
        // 说明是浏览器 subpixel 误差导致多算出一页（文字没有真的溢到那页），
        // 但必须对齐，不能少算 —— 所以 total 只向上不向下
        const alignedWidth = total * pageW;

        // 设置 content 实际宽度 —— 对齐到整数页，保证 translate(x*pageW) 正好是每页的列头
        setContentWidth(alignedWidth);

        rafId3 = requestAnimationFrame(() => {
          // —— 第 4 帧：写 width 后再校验一次 content.scrollWidth 是不是 ≥ alignedWidth
          // 如果写入 alignedWidth 后，CSS column 再多排出一小段，
          // scrollWidth 变大则需要再补一页（长篇文字常见情况）
          const contentEl = contentRef.current;
          if (!contentEl) return;
          const newScrollW = contentEl.scrollWidth;
          if (newScrollW > alignedWidth + 1) {
            const realTotal = Math.max(total, Math.ceil(newScrollW / pageW));
            const realAlign = realTotal * pageW;
            setTotalPages(realTotal);
            setContentWidth(realAlign);
            total = realTotal;
          } else {
            setTotalPages(total);
          }

          // 进度/跳转恢复（放在最后一次校验通过之后）
          if (goToLastPageRef.current) {
            setCurrentPage(Math.max(0, total - 1));
            goToLastPageRef.current = false;
          } else if (pendingRestoreRatioRef.current !== null) {
            const page = Math.round(pendingRestoreRatioRef.current * Math.max(1, total - 1));
            setCurrentPage(Math.max(0, Math.min(page, total - 1)));
            pendingRestoreRatioRef.current = null;
          } else {
            setCurrentPage(prev => Math.min(prev, total - 1));
          }
        });
      });
    });
    return () => {
      if (rafId1) cancelAnimationFrame(rafId1);
      if (rafId2) cancelAnimationFrame(rafId2);
      if (rafId3) cancelAnimationFrame(rafId3);
    };
  }, [readMode, pageDims.w, pageDims.h, chapter?.id, fontSize, lineHeight, paragraphs.length]);

  // 加载阅读进度 + 标记已读（仅首次加载该章节时执行）
  useEffect(() => {
    if (!chapter || !bookId || !chapterId) return;

    // 恢复进度
    if (restoredRef.current !== chapterId) {
      restoredRef.current = chapterId;
      setCurrentPage(0);
      const progress = useNovelStore.getState().progress[bookId];
      if (progress && progress.lastChapterId === chapterId) {
        if (readMode === 'scroll') {
          requestAnimationFrame(() => {
            const target = progress.scrollRatio * (document.body.scrollHeight - window.innerHeight);
            window.scrollTo({ top: Math.max(0, target) });
          });
        } else {
          pendingRestoreRatioRef.current = progress.scrollRatio;
        }
      }
    }

    // 标记已读
    if (!chapter.read && book && markedReadRef.current !== chapterId) {
      markedReadRef.current = chapterId;
      markChapterRead(bookId, chapterId);
    }
  }, [chapter, book, bookId, chapterId, markChapterRead, readMode]);

  // 滚动监听：更新进度条 + 防抖保存进度（仅滚动模式）
  useEffect(() => {
    if (readMode !== 'scroll' || !chapter || !bookId || !chapterId) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const max = document.body.scrollHeight - window.innerHeight;
        const ratio = max > 0 ? window.scrollY / max : 0;
        setScrollRatio(Math.min(1, Math.max(0, ratio)));
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [chapter, bookId, chapterId, readMode]);

  // 翻页模式：基于页码更新进度
  useEffect(() => {
    if (readMode !== 'page') return;
    if (totalPages <= 1) {
      setScrollRatio(0);
    } else {
      setScrollRatio(currentPage / (totalPages - 1));
    }
  }, [readMode, currentPage, totalPages]);

  // 防抖保存进度
  useEffect(() => {
    if (!bookId || !chapterId || scrollRatio === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveProgress({
        bookId,
        lastChapterId: chapterId,
        scrollRatio,
        updatedAt: Date.now(),
      });
    }, 1500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [scrollRatio, bookId, chapterId, saveProgress]);

  // 键盘导航
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (readMode === 'page') {
        if (e.key === 'ArrowLeft') {
          if (currentPage > 0) {
            setCurrentPage(p => p - 1);
          } else if (currentIndex > 0) {
            goToLastPageRef.current = true;
            navigate(`/novel/${bookId}/chapter/${bookChapters[currentIndex - 1].id}`, { replace: true });
          }
        } else if (e.key === 'ArrowRight') {
          if (currentPage < totalPages - 1) {
            setCurrentPage(p => p + 1);
          } else if (currentIndex < bookChapters.length - 1) {
            navigate(`/novel/${bookId}/chapter/${bookChapters[currentIndex + 1].id}`, { replace: true });
          }
        }
      } else {
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
          navigate(`/novel/${bookId}/chapter/${bookChapters[currentIndex - 1].id}`, { replace: true });
        } else if (e.key === 'ArrowRight' && currentIndex < bookChapters.length - 1) {
          navigate(`/novel/${bookId}/chapter/${bookChapters[currentIndex + 1].id}`, { replace: true });
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [readMode, currentPage, totalPages, currentIndex, bookChapters, bookId, navigate]);

  if (!chapter || !book) {
    return (
      <div className="text-center py-20" style={{ color: 'var(--text-tertiary)' }}>
        <p className="text-lg mb-4">章节不存在</p>
        <button onClick={() => navigate('/novel')} className="btn-gold">返回书架</button>
      </div>
    );
  }

  const prevChapter = currentIndex > 0 ? bookChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < bookChapters.length - 1 ? bookChapters[currentIndex + 1] : null;

  // ===== 翻页模式导航 =====
  const goNextPage = () => {
    if (isPageAnimatingRef.current) return;
    if (currentPage < totalPages - 1) {
      isPageAnimatingRef.current = true;
      setFlipDir('left');
      setCurrentPage(p => p + 1);
      setTimeout(() => {
        isPageAnimatingRef.current = false;
        setFlipDir(null);
      }, 350);
    } else if (nextChapter) {
      navigate(`/novel/${bookId}/chapter/${nextChapter.id}`, { replace: true });
    }
  };

  const goPrevPage = () => {
    if (isPageAnimatingRef.current) return;
    if (currentPage > 0) {
      isPageAnimatingRef.current = true;
      setFlipDir('right');
      setCurrentPage(p => p - 1);
      setTimeout(() => {
        isPageAnimatingRef.current = false;
        setFlipDir(null);
      }, 350);
    } else if (prevChapter) {
      goToLastPageRef.current = true;
      navigate(`/novel/${bookId}/chapter/${prevChapter.id}`, { replace: true });
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (readMode !== 'page') return;
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (readMode !== 'page' || !touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goNextPage();
      else goPrevPage();
    }
    touchStartRef.current = null;
  };

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
            style={{ borderBottomColor: theme.accentColor }}
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

  // 翻页模式内容样式
  const isPageMode = readMode === 'page';
  const pagedContentStyle: React.CSSProperties = isPageMode && pageDims.w > 0 && contentWidth > 0 ? {
    columnWidth: `${pageDims.w}px`,
    columnGap: '0px',
    columnFill: 'auto',
    height: `${pageDims.h}px`,
    width: `${contentWidth}px`,
    maxWidth: 'none',
    transform: `translateX(-${currentPage * pageDims.w}px)`,
    transition: 'transform 0.32s cubic-bezier(0.33, 0.12, 0.3, 1)',
    overflow: 'visible',
  } : isPageMode ? { visibility: 'hidden', maxWidth: 'none' } : {};

  return (
    <div
      className={isPageMode
        ? 'max-w-2xl mx-auto px-2 sm:px-0 flex flex-col'
        : 'max-w-2xl mx-auto px-2 sm:px-0 pb-20'
      }
      style={isPageMode ? { height: '100dvh' } : {}}
    >
      {/* 顶部工具栏 */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center py-3 mb-2 relative z-10 shrink-0">
        <div className="flex items-center">
          <button
            onClick={() => navigate(`/novel/${bookId}`)}
            className="btn-ghost p-2"
          >
            <ChevronLeft size={20} />
          </button>
        </div>
        <span
          className="text-sm font-medium truncate px-2 max-w-full text-center"
          style={{ color: theme.titleColor }}
        >
          {chapter.title}
        </span>
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => setShowToc(true)} className="btn-ghost p-2" title="目录">
            <List size={18} />
          </button>
          <button onClick={() => setShowSettings(true)} className="btn-ghost p-2" title="设置">
            <Settings2 size={18} />
          </button>
        </div>
      </div>

      {/* 阅读进度条 */}
      <div className="h-0.5 mb-4 mx-2 rounded-full relative z-10 shrink-0" style={{ backgroundColor: 'var(--border-subtle)' }}>
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{
            width: `${scrollRatio * 100}%`,
            backgroundColor: theme.accentColor,
            opacity: 0.6,
          }}
        />
      </div>

      {isPageMode ? (
        /* ===== 翻页模式 ===== */
        <div
          ref={pagedWrapperRef}
          className="flex-1 overflow-hidden relative"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            ref={contentRef}
            className="novel-content chapter-enter"
            style={{
              fontSize: `${FONT_SIZES[fontSize].px}px`,
              lineHeight: LINE_HEIGHTS[lineHeight].value,
              background: theme.contentBg || undefined,
              ...pagedContentStyle,
            }}
          >
            {/* 章节标题（在分页内容内，仅第一页显示） */}
            <h1
              className="text-center mb-3"
              style={{
                color: theme.titleColor,
                fontSize: `${Math.round(FONT_SIZES[fontSize].px * 1.5)}px`,
                letterSpacing: '0.08em',
                fontWeight: 600,
              }}
            >
              {chapter.title}
            </h1>
            <div
              className="w-12 h-px mx-auto mb-10"
              style={{ backgroundColor: `${theme.accentColor}60` }}
            />
            {paragraphs.map((para, pi) => renderParagraph(para, pi))}
            {/* 本章完分隔 */}
            <div className="flex items-center justify-center gap-3 my-10">
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
              <span className="text-xs tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                · 本章完 ·
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
            </div>
          </div>

          {/* 点击翻页区域：左1/4上一页，右1/4下一页，中间留给角色点击 */}
          <div
            className="absolute left-0 top-0 w-1/4 h-full z-10"
            onClick={goPrevPage}
          />
          <div
            className="absolute right-0 top-0 w-1/4 h-full z-10"
            onClick={goNextPage}
          />

          {/* 翻页动画：阴影叠层 — 翻左边（下一页）暗左边缘，翻右边（上一页）暗右边缘 */}
          <div
            className="pointer-events-none absolute inset-0 z-[15] transition-opacity duration-300"
            style={{
              opacity: flipDir === 'left' ? 1 : 0,
              background: 'linear-gradient(90deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.14) 18%, transparent 45%, rgba(0,0,0,0.04) 100%)',
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 z-[15] transition-opacity duration-300"
            style={{
              opacity: flipDir === 'right' ? 1 : 0,
              background: 'linear-gradient(270deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.14) 18%, transparent 45%, rgba(0,0,0,0.04) 100%)',
            }}
          />
          {/* 翻页中缝高光 */}
          <div
            className="pointer-events-none absolute top-0 h-full z-[16] transition-all duration-300"
            style={{
              left: flipDir === 'left' ? '0%' : flipDir === 'right' ? '100%' : '50%',
              width: '2px',
              opacity: flipDir ? 0.5 : 0,
              transform: flipDir === 'right' ? 'translateX(-100%)' : 'none',
              background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.35) 40%, rgba(255,255,255,0.25) 60%, transparent 100%)',
              boxShadow: '0 0 6px rgba(255,255,255,0.15)',
            }}
          />

          {/* 页码指示器 */}
          <div
            className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs pointer-events-none z-10"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {currentPage + 1} / {totalPages}
          </div>
        </div>
      ) : (
        /* ===== 滚动模式（原有逻辑不变） ===== */
        <>
          {/* 章节标题 */}
          <h1
            className="text-center mb-3"
            style={{
              color: theme.titleColor,
              fontSize: `${Math.round(FONT_SIZES[fontSize].px * 1.5)}px`,
              letterSpacing: '0.08em',
              fontWeight: 600,
            }}
          >
            {chapter.title}
          </h1>

          {/* 标题装饰线 */}
          <div
            className="w-12 h-px mx-auto mb-10"
            style={{ backgroundColor: `${theme.accentColor}60` }}
          />

          {/* 正文 */}
          <div
            className="novel-content chapter-enter"
            style={{
              fontSize: `${FONT_SIZES[fontSize].px}px`,
              lineHeight: LINE_HEIGHTS[lineHeight].value,
              background: theme.contentBg || undefined,
            }}
          >
            {paragraphs.map((para, pi) => renderParagraph(para, pi))}
          </div>

          {/* 章节结尾分隔 */}
          <div className="flex items-center justify-center gap-3 my-10">
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
            <span
              className="text-xs tracking-widest"
              style={{ color: 'var(--text-tertiary)' }}
            >
              · 本章完 ·
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
          </div>
        </>
      )}

      {/* 章节导航 */}
      <div className="flex items-center justify-between text-sm px-2 py-3 relative z-10 shrink-0">
        {isPageMode ? (
          <>
            <button
              onClick={goPrevPage}
              className="flex items-center gap-1 transition-opacity"
              style={{ color: theme.accentColor }}
            >
              <ChevronLeft size={16} />
              {currentPage > 0 ? '上一页' : '上一章'}
            </button>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
              {isPageMode ? `第${currentIndex + 1}章 ${currentPage + 1}/${totalPages}页` : `${currentIndex + 1} / ${bookChapters.length}`}
            </span>
            <button
              onClick={goNextPage}
              className="flex items-center gap-1 transition-opacity"
              style={{ color: theme.accentColor }}
            >
              {currentPage < totalPages - 1 ? '下一页' : '下一章'}
              <ChevronRight size={16} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => prevChapter && navigate(`/novel/${bookId}/chapter/${prevChapter.id}`, { replace: true })}
              disabled={!prevChapter}
              className="flex items-center gap-1 disabled:opacity-30 transition-opacity"
              style={{ color: prevChapter ? theme.accentColor : 'var(--text-tertiary)' }}
            >
              <ChevronLeft size={16} /> 上一章
            </button>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
              {currentIndex + 1} / {bookChapters.length}
            </span>
            <button
              onClick={() => nextChapter && navigate(`/novel/${bookId}/chapter/${nextChapter.id}`, { replace: true })}
              disabled={!nextChapter}
              className="flex items-center gap-1 disabled:opacity-30 transition-opacity"
              style={{ color: nextChapter ? theme.accentColor : 'var(--text-tertiary)' }}
            >
              下一章 <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>

      {/* 目录抽屉 */}
      {showToc && (
        <div
          className="fixed inset-0 z-50 flex"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowToc(false)}
        >
          <div
            className="ml-auto w-80 max-w-full h-full overflow-y-auto animate-slide-up"
            style={{ backgroundColor: 'var(--bg-surface)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 h-12 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="font-bold" style={{ color: theme.titleColor }}>目录</h3>
              <button onClick={() => setShowToc(false)} className="btn-ghost p-1">
                <X size={18} />
              </button>
            </div>
            <div className="py-2">
              {bookChapters.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setShowToc(false);
                    navigate(`/novel/${bookId}/chapter/${c.id}`, { replace: true });
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3"
                  style={{
                    backgroundColor: c.id === chapterId ? `${theme.accentColor}18` : 'transparent',
                    color: c.id === chapterId ? theme.accentColor : 'var(--text-primary)',
                  }}
                >
                  <span
                    className="text-xs w-6 shrink-0"
                    style={{ color: c.id === chapterId ? theme.accentColor : 'var(--text-tertiary)' }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1 truncate">{c.title}</span>
                  {c.read && <span style={{ color: theme.accentColor, fontSize: '0.7rem' }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 设置抽屉 */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowSettings(false)}
        >
          <div
            className="ml-auto w-72 h-full overflow-y-auto animate-slide-up"
            style={{ backgroundColor: 'var(--bg-surface)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 h-12 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="font-bold" style={{ color: theme.titleColor }}>阅读设置</h3>
              <button onClick={() => setShowSettings(false)} className="btn-ghost p-1">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-6">
              {/* 阅读模式 */}
              <div>
                <label className="text-sm font-medium mb-3 block" style={{ color: 'var(--text-primary)' }}>阅读模式</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setReadMode('scroll')}
                    className="flex-1 py-2 rounded text-sm transition-all"
                    style={{
                      backgroundColor: readMode === 'scroll' ? `${theme.accentColor}20` : 'transparent',
                      color: readMode === 'scroll' ? theme.accentColor : 'var(--text-tertiary)',
                      border: `1px solid ${readMode === 'scroll' ? theme.accentColor : 'var(--border-default)'}`,
                    }}
                  >
                    滚动
                  </button>
                  <button
                    onClick={() => setReadMode('page')}
                    className="flex-1 py-2 rounded text-sm transition-all"
                    style={{
                      backgroundColor: readMode === 'page' ? `${theme.accentColor}20` : 'transparent',
                      color: readMode === 'page' ? theme.accentColor : 'var(--text-tertiary)',
                      border: `1px solid ${readMode === 'page' ? theme.accentColor : 'var(--border-default)'}`,
                    }}
                  >
                    翻页
                  </button>
                </div>
              </div>

              {/* 主题 */}
              <div>
                <label className="text-sm font-medium mb-3 block" style={{ color: 'var(--text-primary)' }}>阅读主题</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(READER_THEMES) as ReaderTheme[]).map(key => {
                    const t = READER_THEMES[key];
                    const active = readerTheme === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setReaderTheme(key)}
                        className="flex flex-col items-center gap-1.5 py-2 rounded-lg transition-all"
                        style={{
                          border: `1px solid ${active ? t.accentColor : 'var(--border-default)'}`,
                          backgroundColor: active ? `${t.accentColor}15` : 'transparent',
                        }}
                      >
                        <span
                          className="w-8 h-8 rounded-full border-2"
                          style={{
                            backgroundColor: t.swatch,
                            borderColor: active ? t.accentColor : 'var(--border-default)',
                          }}
                        />
                        <span className="text-xs" style={{ color: active ? t.accentColor : 'var(--text-tertiary)' }}>
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 字号 */}
              <div>
                <label className="text-sm font-medium mb-3 block" style={{ color: 'var(--text-primary)' }}>字号</label>
                <div className="flex gap-1.5">
                  {(Object.keys(FONT_SIZES) as FontSize[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setFontSize(s)}
                      className="flex-1 py-2 rounded text-sm transition-all"
                      style={{
                        backgroundColor: fontSize === s ? `${theme.accentColor}20` : 'transparent',
                        color: fontSize === s ? theme.accentColor : 'var(--text-tertiary)',
                        border: `1px solid ${fontSize === s ? theme.accentColor : 'var(--border-default)'}`,
                      }}
                    >
                      {FONT_SIZES[s].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 行距 */}
              <div>
                <label className="text-sm font-medium mb-3 block" style={{ color: 'var(--text-primary)' }}>行距</label>
                <div className="flex gap-2">
                  {(Object.keys(LINE_HEIGHTS) as LineHeight[]).map(l => (
                    <button
                      key={l}
                      onClick={() => setLineHeight(l)}
                      className="flex-1 py-2 rounded text-sm transition-all"
                      style={{
                        backgroundColor: lineHeight === l ? `${theme.accentColor}20` : 'transparent',
                        color: lineHeight === l ? theme.accentColor : 'var(--text-tertiary)',
                        border: `1px solid ${lineHeight === l ? theme.accentColor : 'var(--border-default)'}`,
                      }}
                    >
                      {LINE_HEIGHTS[l].label}
                    </button>
                  ))}
                </div>
              </div>

              {book?.spoilerMode === 'unlock' && !isSpoilerUnlocked && (
                <div
                  className="p-3 rounded text-xs"
                  style={{
                    backgroundColor: `${theme.accentColor}10`,
                    border: `1px solid ${theme.accentColor}30`,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <p className="font-medium mb-1" style={{ color: theme.accentColor }}>解锁模式</p>
                  <p>读完本书后，角色名下划线和卡片才会显示。当前进度 {book.completedChapters}/{book.totalChapters}</p>
                </div>
              )}

              {!IS_WEB_BUILD && (
                <div className="pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
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

      {/* 章节编辑器 */}
      {showEditor && chapter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowEditor(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl overflow-hidden"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="font-bold" style={{ color: theme.titleColor }}>编辑章节</h3>
              <button onClick={() => setShowEditor(false)} className="btn-ghost p-1">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>章节标题</label>
                <input
                  className="input-field w-full"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="如：第一章 初遇"
                />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>章节正文（段落之间空一行）</label>
                <textarea
                  className="input-field w-full font-serif leading-relaxed"
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={20}
                />
                <div className="flex justify-between mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  <span>{editContent.length} 字</span>
                  <span>{editContent.split(/\n\n+/).filter(p => p.trim()).length} 段落</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button onClick={() => setShowEditor(false)} className="btn-ghost text-sm">取消</button>
              <button
                onClick={async () => {
                  const charList = allCharacters as Character[];
                  await updateChapter(chapter.id, {
                    title: editTitle.trim(),
                    content: editContent,
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

      {/* 角色卡片 */}
      {activeChar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setActiveChar(null)}
        >
          <div
            className="max-w-md w-full p-5 rounded-xl animate-fade-in"
            style={{ backgroundColor: 'var(--bg-surface)', border: `1px solid ${theme.accentColor}40` }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold" style={{ color: theme.titleColor }}>{activeChar.title}</h3>
              <button onClick={() => setActiveChar(null)} className="btn-ghost p-1">
                <X size={16} />
              </button>
            </div>
            {activeChar.summary && (
              <p className="text-sm mb-3" style={{ color: 'var(--text-primary)' }}>{activeChar.summary}</p>
            )}
            {activeChar.content && (
              <p className="text-sm leading-relaxed max-h-48 overflow-y-auto" style={{ color: 'var(--text-secondary)' }}>
                {activeChar.content.length > 300 ? activeChar.content.slice(0, 300) + '...' : activeChar.content}
              </p>
            )}
            <button
              onClick={() => { setActiveChar(null); navigate('/character'); }}
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

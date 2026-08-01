import type { NovelMention } from '../types';

/**
 * 解析 TXT 文件为章节列表
 *
 * 支持的章节标题格式：
 *   第1章 标题
 *   第1章—标题
 *   第一章 标题
 *   第一章—标题
 *
 * 不支持卷信息（口袋写作导出 TXT 不含卷），卷需在 App 里手动创建
 */
export interface ParsedChapter {
  order: number;
  title: string;
  content: string;       // 原始正文（段落之间有空行）
  paragraphs: string[];  // 按段落分割后的数组（已清理空行）
}

export function parseNovelTxt(text: string): ParsedChapter[] {
  const lines = text.split(/\r?\n/);

  // 章节标题正则：兼容阿拉伯数字 + 中文数字
  // 第1章 / 第一章 / 第一百二十三章
  const chapterRe = /^第\s*[0-9零一二三四五六七八九十百千万]+\s*章[\s—\-]/;

  const chapters: ParsedChapter[] = [];
  let currentOrder = 0;
  let currentTitle = '';
  let currentLines: string[] = [];
  let inChapter = false;

  const flushChapter = () => {
    if (!inChapter) return;
    const paragraphs = cleanParagraphs(currentLines);
    chapters.push({
      order: currentOrder,
      title: currentTitle,
      content: paragraphs.join('\n\n'),
      paragraphs,
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (chapterRe.test(trimmed)) {
      // 保存上一章
      flushChapter();
      // 开始新章
      inChapter = true;
      currentOrder = chapters.length + 1;
      currentTitle = extractChapterTitle(trimmed);
      currentLines = [];
    } else if (inChapter) {
      currentLines.push(trimmed);
    }
  }
  // 保存最后一章
  flushChapter();

  return chapters;
}

/** 从章节标题行提取标题文本（去掉"第X章—"或"第X章 "前缀） */
function extractChapterTitle(line: string): string {
  // 去掉"第X章"部分
  const afterChapter = line.replace(/^第\s*[0-9零一二三四五六七八九十百千万]+\s*章/, '');
  // 去掉开头的分隔符（—、-、空格）
  return afterChapter.replace(/^[\s—\-]+/, '').trim() || `第${line.match(/[0-9零一二三四五六七八九十百千万]+/)?.[0] || '?'}章`;
}

/** 清理空行、合并过短的段落 */
function cleanParagraphs(lines: string[]): string[] {
  const result: string[] = [];
  let buffer: string[] = [];

  for (const line of lines) {
    if (!line) {
      // 空行：作为段落分隔
      if (buffer.length > 0) {
        result.push(buffer.join(''));
        buffer = [];
      }
    } else {
      buffer.push(line);
    }
  }
  if (buffer.length > 0) result.push(buffer.join(''));

  // 过滤掉极短的"章节说明"（如"前言"两字单独成段）
  // 但保留所有有实质内容的段落
  return result.filter(p => p.length > 0);
}

/**
 * 扫描正文中出现的角色名，生成 mentions 索引
 * 仅匹配「档案馆中存在的角色」——单向匹配，不猜
 */
export function scanMentions(
  content: string,
  knownCharacters: Array<{ id: string; name: string }>,
): NovelMention[] {
  const mentions: NovelMention[] = [];
  const lower = content;
  const seen = new Set<string>();

  for (const char of knownCharacters) {
    if (!char.name || char.name.length < 2) continue;
    // 找到角色名在正文中的首次出现位置
    const idx = lower.indexOf(char.name);
    if (idx === -1) continue;
    // 避免重复（有些角色名是其他角色名的子串，如"张三"和"张三丰"）
    if (seen.has(char.id)) continue;
    // 验证：确保不是更长名字的子串
    // 比如 "王" 出现在 "王小明" 里，不能算 "王" 的出现
    const before = lower[idx - 1] || '';
    const after = lower[idx + char.name.length] || '';
    const isWordBoundary = !isCjkChar(before) && !isCjkChar(after);
    // 对于 2 字以上的名字，宽松一点（中文没有空格分词）
    if (char.name.length >= 2 || isWordBoundary) {
      mentions.push({
        charId: char.id,
        name: char.name,
        firstOffset: idx,
      });
      seen.add(char.id);
    }
  }

  // 按出现位置排序
  return mentions.sort((a, b) => a.firstOffset - b.firstOffset);
}

/** 判断是否为中日韩统一表意文字 */
function isCjkChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (code >= 0x4e00 && code <= 0x9fff) ||
         (code >= 0x3400 && code <= 0x4dbf);
}

/** 从段落数组中找到某 offset 所在的段落索引和段内偏移 */
export function locateOffset(paragraphs: string[], offset: number): { paraIndex: number; paraOffset: number } {
  let remaining = offset;
  for (let i = 0; i < paragraphs.length; i++) {
    const len = paragraphs[i].length;
    if (remaining <= len) {
      return { paraIndex: i, paraOffset: remaining };
    }
    remaining -= len + 2; // +2 是段落间的 \n\n
  }
  return { paraIndex: paragraphs.length - 1, paraOffset: paragraphs[paragraphs.length - 1]?.length || 0 };
}

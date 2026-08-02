import type { NovelMention } from '../types';

/**
 * 解析 TXT 文件为章节列表
 *
 * 支持的章节标题格式：
 *   · 关键词章：楔子 / 序章 / 序言 / 前言 / 引子 / 序幕 / 尾声 / 后记 / 附录（允许后跟空格+副标题）
 *   · 数字章：第1章 标题 / 第1章—标题 / 第一章 / 第三十八回 / 第四节 / 第五卷 / 第二部 / 第七篇
 *   · 兼容：序号与关键词之间含空格（"第 一百二十三 回"）、中文数字"〇/零/两/亿"
 */
export interface ParsedChapter {
  order: number;
  title: string;
  content: string;       // 原始正文（段落之间有空行）
  paragraphs: string[];  // 按段落分割后的数组（已清理空行）
}

/**
 * 识别是否为章节标题行（含副标题）
 * 楔子 夜、序章 毁灭、第1章 开始、第三十八回、尾声 落、后记 谢
 */
function isChapterLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  // 1) 关键词标题（前8个常见独立词，后跟空格+副标题可选）
  const keywordRe = /^(楔子|序章|序言|前言|引子|序幕|尾声|后记|附录)([\s　—\-—–][^\n\r]{0,80})?$/;
  if (keywordRe.test(t)) return true;
  // 2) 第 X [章回节卷集部篇]（支持阿拉伯+中文数字+空格穿插）
  const numRe = /^第\s*[0-9零〇一二三四五六七八九十百千万亿两\d]+\s*[章回节卷集部篇]([\s　—\-—–][^\n\r]{0,80})?$/;
  return numRe.test(t);
}

export function parseNovelTxt(text: string): ParsedChapter[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

  const chapters: ParsedChapter[] = [];
  let currentOrder = 0;
  let currentTitle = '';
  let currentLines: string[] = [];
  let inChapter = false;
  let preChapterLines: string[] = [];  // 第一个章节标题之前的文字（前言/版权声明等）

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

  let firstChapterFound = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (isChapterLine(trimmed)) {
      // 保存上一章
      flushChapter();
      // 如果这是第一个章节标题且前面有内容 → 加作「前言」
      if (!firstChapterFound && preChapterLines.length > 0) {
        const preParas = cleanParagraphs(preChapterLines);
        if (preParas.length > 0) {
          chapters.push({
            order: 0,
            title: '前言',
            content: preParas.join('\n\n'),
            paragraphs: preParas,
          });
        }
      }
      firstChapterFound = true;
      // 开新章（正文章节从 1 开始累加；前言 order=0 不算）
      inChapter = true;
      currentOrder = chapters.filter(c => c.order > 0).length + 1;
      currentTitle = extractChapterTitle(trimmed);
      currentLines = [];
    } else if (inChapter) {
      currentLines.push(trimmed);
    } else {
      // 第一个章节之前的内容
      preChapterLines.push(trimmed);
    }
  }
  flushChapter();

  // 若全文完全没有章节标记，则整个作为「正文」一章
  if (chapters.length === 0) {
    const paras = cleanParagraphs(lines.map(l => l.trim()));
    if (paras.length > 0) {
      chapters.push({ order: 1, title: '正文', content: paras.join('\n\n'), paragraphs: paras });
    }
  }

  return chapters;
}

/** 从章节标题行提取完整标题：
 *   "第1章 开始" → "第1章 开始"
 *   "楔子 夜"   → "楔子 夜"
 *   "尾声"      → "尾声"
 *  当行本身就是清晰的标题时，不再强剥前缀，只清理首尾空格；
 *  若副标题是空的（如"第1章"后无文字），保留"第1章"原标题。
 */
function extractChapterTitle(line: string): string {
  const t = line.trim();
  // 对「第X章」开头的行，去掉分隔符后的空标题统一成"第X章 原始标题名"
  const num = t.match(/^(第\s*[0-9零〇一二三四五六七八九十百千万亿两\d]+\s*[章回节卷集部篇])[\s　—\-—–]*(.*)$/);
  if (num) {
    const head = num[1].replace(/\s+/g, '');  // "第 1 章" → "第1章"
    const tail = num[2].trim();
    return tail ? `${head} ${tail}` : head;
  }
  // 关键词标题：直接返回trim结果
  return t;
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
 *
 * 子串去重：若多个角色名在同一 firstOffset 均能命中（如 "奥菲斯" vs "奥菲斯大帝"），
 * 只保留最长的一个，避免短名"吃掉"长名下划线、渲染错乱
 */
export function scanMentions(
  content: string,
  knownCharacters: Array<{ id: string; name: string }>,
): NovelMention[] {
  const mentions: NovelMention[] = [];
  const seen = new Set<string>();

  for (const char of knownCharacters) {
    if (!char.name || char.name.length < 2) continue;
    const idx = content.indexOf(char.name);
    if (idx === -1) continue;
    if (seen.has(char.id)) continue;
    // 子串名（2字以上）在中文语境下直接信任，不做边界检查
    mentions.push({
      charId: char.id,
      name: char.name,
      firstOffset: idx,
    });
    seen.add(char.id);
  }

  // —— 冲突消解：同一 offset 只保留名字最长的 ——
  const byOffset = new Map<number, NovelMention>();
  for (const m of mentions) {
    const prev = byOffset.get(m.firstOffset);
    if (!prev || m.name.length > prev.name.length) {
      byOffset.set(m.firstOffset, m);
    }
  }
  // 再额外处理：不同 offset 但彼此覆盖的情况（短名落在长名的范围内），也剔除短名
  // 按 offset 升序后线性扫描，判断区间是否重叠包含
  const sorted = Array.from(byOffset.values()).sort((a, b) => a.firstOffset - b.firstOffset);
  const filtered: NovelMention[] = [];
  for (const m of sorted) {
    const end = m.firstOffset + m.name.length;
    // 检查是否被前一个更长的覆盖（前一个end > 当前firstOffset AND 前一个名更长）
    const overlappedByPrev = filtered.length > 0 &&
      (filtered[filtered.length - 1].firstOffset + filtered[filtered.length - 1].name.length) > m.firstOffset &&
      filtered[filtered.length - 1].name.length > m.name.length;
    if (!overlappedByPrev) filtered.push(m);
  }
  return filtered;
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

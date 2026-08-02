#!/usr/bin/env node
/**
 * TXT 解析器边界用例测试（严格镜像 src/lib/txtParser.ts 最新实现）
 */
import { strict as assert } from 'node:assert';

/* ──────── 严格镜像 src/lib/txtParser.ts ──────── */
function isChapterLine(line) {
  const t = line.trim();
  if (!t) return false;
  const keywordRe = /^(楔子|序章|序言|前言|引子|序幕|尾声|后记|附录)([\s　—\-—–][^\n\r]{0,80})?$/;
  if (keywordRe.test(t)) return true;
  const numRe = /^第\s*[0-9零〇一二三四五六七八九十百千万亿两\d]+\s*[章回节卷集部篇]([\s　—\-—–][^\n\r]{0,80})?$/;
  return numRe.test(t);
}
function extractChapterTitle(line) {
  const t = line.trim();
  const num = t.match(/^(第\s*[0-9零〇一二三四五六七八九十百千万亿两\d]+\s*[章回节卷集部篇])[\s　—\-—–]*(.*)$/);
  if (num) {
    const head = num[1].replace(/\s+/g, '');
    const tail = num[2].trim();
    return tail ? `${head} ${tail}` : head;
  }
  return t;
}
function cleanParagraphs(lines) {
  const result = [];
  let buffer = [];
  for (const line of lines) {
    if (!line) {
      if (buffer.length > 0) {
        result.push(buffer.join(''));
        buffer = [];
      }
    } else {
      buffer.push(line);
    }
  }
  if (buffer.length > 0) result.push(buffer.join(''));
  return result.filter(p => p.length > 0);
}
function parseNovelTxt(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const chapters = [];
  let currentOrder = 0;
  let currentTitle = '';
  let currentLines = [];
  let inChapter = false;
  let preChapterLines = [];
  const flush = () => {
    if (!inChapter) return;
    const paragraphs = cleanParagraphs(currentLines);
    chapters.push({ order: currentOrder, title: currentTitle, content: paragraphs.join('\n\n'), paragraphs });
  };
  let first = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (isChapterLine(trimmed)) {
      flush();
      if (!first && preChapterLines.length > 0) {
        const p = cleanParagraphs(preChapterLines);
        if (p.length > 0) {
          chapters.push({ order: 0, title: '前言', content: p.join('\n\n'), paragraphs: p });
        }
      }
      first = true;
      inChapter = true;
      currentOrder = chapters.filter(c => c.order > 0).length + 1;
      currentTitle = extractChapterTitle(trimmed);
      currentLines = [];
    } else if (inChapter) {
      currentLines.push(trimmed);
    } else {
      preChapterLines.push(trimmed);
    }
  }
  flush();
  if (chapters.length === 0) {
    const p = cleanParagraphs(lines.map(l => l.trim()));
    if (p.length > 0) chapters.push({ order: 1, title: '正文', content: p.join('\n\n'), paragraphs: p });
  }
  return chapters;
}

/* ─────────────────── 用例 ─────────────────── */
const cases = [];
function test(name, fn) { cases.push({ name, fn }); }
let passed = 0, failed = 0;

test('BOM头能被去除', () => {
  const chs = parseNovelTxt('\uFEFF第1章 开始\n内容');
  assert.equal(chs.length, 1);
  assert.equal(chs[0].title, '第1章 开始');
  assert.ok(chs[0].content.includes('内容'));
});
test('CRLF换行正确识别', () => {
  const chs = parseNovelTxt('第1章 一\r\n内容\r\n第2章 二\r\n正文');
  assert.equal(chs.length, 2);
  assert.ok(chs[0].content.includes('内容'));
  assert.equal(chs[1].title, '第2章 二');
});
test('识别前言（第一章前文字）', () => {
  const chs = parseNovelTxt('版权所有\n翻印必究\n\n第1章 起\n段落');
  assert.equal(chs[0].title, '前言');
  assert.ok(chs[0].content.includes('版权所有'));
  assert.equal(chs[1].title, '第1章 起');
});
test('识别序章单独作为一章', () => {
  const chs = parseNovelTxt('序章 毁灭\n大地崩塌\n第1章 重生\n醒来');
  assert.ok(chs[0].title.includes('序章'));
  assert.equal(chs[1].title, '第1章 重生');
});
test('识别后记/尾声/楔子（4章独立）', () => {
  const t = '楔子 夜\n月光\n第1章 晨光\n早起\n尾声 落\n夕阳\n后记 谢\n感谢';
  const chs = parseNovelTxt(t);
  const titles = chs.map(c => c.title.split(' ')[0]);
  assert.deepEqual(titles, ['楔子', '第1章', '尾声', '后记']);
});
test('章节之间大量空行被清理', () => {
  const t = '第1章 a\n\n\n\n\n\n正文\n\n\n\n第2章 b\n\n\n正文2';
  const chs = parseNovelTxt(t);
  assert.equal(chs[0].content, '正文');
  assert.equal(chs[1].content, '正文2');
});
test('中文数字章节：第三十八章', () => {
  const chs = parseNovelTxt('第三十八章 归来\n内容');
  assert.ok(chs[0].title.startsWith('第三十八章'));
});
test('混合中文+空格章节：第 一百二十三 回', () => {
  const chs = parseNovelTxt('第 一百二十三 回 血战\n内容');
  assert.ok(chs[0].title.startsWith('第一百二十三回'));
});
test('阿拉伯数字章节：第123章', () => {
  const chs = parseNovelTxt('第123章 标题\n正文');
  assert.equal(chs[0].title, '第123章 标题');
});
test('节/卷/部/篇 作为分隔符', () => {
  const t = '第一节\n甲\n第二篇\n乙';
  const chs = parseNovelTxt(t);
  assert.equal(chs[0].title, '第一节');
  assert.equal(chs[1].title, '第二篇');
});
test('乱序章节（第3章后第1章）也能拆分并顺序保持', () => {
  const t = '第3章 晚\n333\n第1章 早\n111\n第2章 中\n222';
  const chs = parseNovelTxt(t);
  assert.equal(chs.length, 3);
  assert.equal(chs[0].title, '第3章 晚');
  assert.equal(chs[1].title, '第1章 早');
  assert.equal(chs[2].title, '第2章 中');
  // order 字段是按出现顺序依次 1、2、3，不做排序干预
  assert.deepEqual(chs.map(c => c.order), [1, 2, 3]);
});
test('超长单章（4万+字）能拆分', () => {
  const longBody = '这是一段很长的正文。'.repeat(5000);
  const t = `第1章 唯一章\n${longBody}\n后续`;
  const chs = parseNovelTxt(t);
  assert.equal(chs.length, 1);
  assert.ok(chs[0].paragraphs.join('').length > 40000);
});
test('正文完全没有章节标记时 → 默认「正文」一章', () => {
  const chs = parseNovelTxt('hello\nworld\nfoo\nbar');
  assert.equal(chs.length, 1);
  assert.equal(chs[0].title, '正文');
});
test('章节标题后无正文也能创建章节', () => {
  const t = '第1章\n\n第2章';
  const chs = parseNovelTxt(t);
  assert.equal(chs.length, 2);
  assert.equal(chs[0].title, '第1章');
  assert.equal(chs[1].title, '第2章');
});
test('章节标题中的多余首尾空格被trim', () => {
  const chs = parseNovelTxt('   第1章  带空格   \n内容');
  assert.equal(chs[0].title, '第1章 带空格');
});
test('附录能识别为一章', () => {
  const chs = parseNovelTxt('第1章 开\n正文\n附录 资料\naaa');
  assert.equal(chs.length, 2);
  assert.equal(chs[1].title, '附录 资料');
});
test('引子也能识别为一章', () => {
  const chs = parseNovelTxt('引子—起点\n风\n第1章 后来\nxx');
  assert.ok(chs[0].title.startsWith('引子'));
});

/* ─────────────────── 运行 ─────────────────── */
console.log(`🧪 TXT解析器边界测试：${cases.length} 个用例（严格镜像真实代码）`);
for (const c of cases) {
  try {
    c.fn();
    console.log(`  ✅ ${c.name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${c.name}`);
    console.error('     ', e.message);
    failed++;
  }
}
console.log('='.repeat(50));
console.log(`📊 ${passed} / ${passed + failed}`);
if (failed > 0) process.exit(1);
console.log('🎉 全部通过！');

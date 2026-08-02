#!/usr/bin/env node
/**
 * TXT 解析器边界测试（纯 JS 版，内嵌 parser 源码）
 */

// ============ 内嵌 txtParser.ts 的纯JS实现 ============
function parseNovelTxt(text) {
  const lines = text.split(/\r?\n/);
  const chapterRe = /^第\s*[0-9零一二三四五六七八九十百千万]+\s*章([\s—\-]|$)/;
  const chapters = [];
  let currentOrder = 0;
  let currentTitle = '';
  let currentLines = [];
  let inChapter = false;
  let preChapterLines = [];

  const flushChapter = () => {
    if (!inChapter) return;
    const paragraphs = cleanParagraphs(currentLines);
    chapters.push({ order: currentOrder, title: currentTitle, content: paragraphs.join('\n\n'), paragraphs });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (chapterRe.test(trimmed)) {
      flushChapter();
      if (chapters.length === 0 && preChapterLines.length > 0) {
        const preParas = cleanParagraphs(preChapterLines);
        if (preParas.length > 0) {
          chapters.push({ order: 0, title: '前言', content: preParas.join('\n\n'), paragraphs: preParas });
        }
      }
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
  flushChapter();
  return chapters;
}
function extractChapterTitle(line) {
  const afterChapter = line.replace(/^第\s*[0-9零一二三四五六七八九十百千万]+\s*章/, '');
  const title = afterChapter.replace(/^[\s—\-]+/, '').trim();
  if (title) return title;
  const numMatch = line.match(/[0-9零一二三四五六七八九十百千万]+/);
  return `第${numMatch?.[0] || '?'}章`;
}
function cleanParagraphs(lines) {
  const result = [];
  let buffer = [];
  for (const line of lines) {
    if (!line) {
      if (buffer.length > 0) { result.push(buffer.join('')); buffer = []; }
    } else {
      buffer.push(line);
    }
  }
  if (buffer.length > 0) result.push(buffer.join(''));
  return result.filter(p => p.length > 0);
}
function scanMentions(content, knownCharacters) {
  const mentions = [];
  const seen = new Set();
  for (const char of knownCharacters) {
    if (!char.name || char.name.length < 2) continue;
    const idx = content.indexOf(char.name);
    if (idx === -1) continue;
    if (seen.has(char.id)) continue;
    mentions.push({ charId: char.id, name: char.name, firstOffset: idx });
    seen.add(char.id);
  }
  // 冲突消解：同一 offset 只保留最长名
  const byOffset = new Map();
  for (const m of mentions) {
    const prev = byOffset.get(m.firstOffset);
    if (!prev || m.name.length > prev.name.length) byOffset.set(m.firstOffset, m);
  }
  const sorted = Array.from(byOffset.values()).sort((a, b) => a.firstOffset - b.firstOffset);
  const filtered = [];
  for (const m of sorted) {
    const overlapped = filtered.length > 0 &&
      (filtered[filtered.length - 1].firstOffset + filtered[filtered.length - 1].name.length) > m.firstOffset &&
      filtered[filtered.length - 1].name.length > m.name.length;
    if (!overlapped) filtered.push(m);
  }
  return filtered;
}
function isCjkChar(ch) {
  const code = ch.charCodeAt(0);
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
}
function locateOffset(paragraphs, offset) {
  let remaining = offset;
  for (let i = 0; i < paragraphs.length; i++) {
    const len = paragraphs[i].length;
    if (remaining <= len) return { paraIndex: i, paraOffset: remaining };
    remaining -= len + 2;
  }
  return { paraIndex: paragraphs.length - 1, paraOffset: paragraphs[paragraphs.length - 1]?.length || 0 };
}

// ============ 测试框架 ============
let passed = 0, failed = 0;
function eq(desc, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`  ✅ ${desc}`); passed++; }
  else { console.error(`  ❌ ${desc}\n     期望:`, JSON.stringify(expected), '\n     实际:', JSON.stringify(actual)); failed++; }
}
function assert(desc, cond) {
  if (cond) { console.log(`  ✅ ${desc}`); passed++; }
  else { console.error(`  ❌ ${desc}`); failed++; }
}

// ============ Tests ============

console.log('\n🧪 Test 1: 用户真实样本（前言+第1章）');
{
  const txt = `前言

　　写的真实是为了让你看清脚下的路，写的虚假是为了让你摘下锈蚀锁链。

　　离得太近会看不清，离得太远会看不见。

　　第一章

　　霞光区（Dawnlight District）

　　荆棘街八一六号

　　早上八点三十二分

　　晨光似淡黄色的刃，割开奈特城上空的晨雾。蔚蓝的苍穹似乎有些褪色，看起来不太美妙。`;
  const chs = parseNovelTxt(txt);
  eq('章节总数=2', chs.length, 2);
  eq('第0章order=0', chs[0].order, 0);
  eq('第0章标题=前言', chs[0].title, '前言');
  assert('前言段落数>=2', chs[0].paragraphs.length >= 2);
  eq('第1章order=1', chs[1].order, 1);
  eq('第1章标题=第一章', chs[1].title, '第一章');
  assert('第1章段落数>=4', chs[1].paragraphs.length >= 4);
}

console.log('\n🧪 Test 2: 无前言，直接第一章');
{
  const txt = `第1章 开始

　　这是开头。

第2章 继续

　　这是第二章。`;
  const chs = parseNovelTxt(txt);
  eq('章节总数=2', chs.length, 2);
  eq('第1章标题=开始', chs[0].title, '开始');
  eq('第2章order=2', chs[1].order, 2);
  eq('第2章标题=继续', chs[1].title, '继续');
}

console.log('\n🧪 Test 3: 不同分隔符');
{
  const txt = `第1章 空格标题

　　a

第2章—破折号标题

　　b

第3章　全角空格标题

　　c

第四章
　　d`;
  const chs = parseNovelTxt(txt);
  eq('章节数=4', chs.length, 4);
  eq('第1章=空格标题', chs[0].title, '空格标题');
  eq('第2章=破折号标题', chs[1].title, '破折号标题');
  eq('第3章=全角空格标题', chs[2].title, '全角空格标题');
  eq('第四章（无副标题）=第四章', chs[3].title, '第四章');
}

console.log('\n🧪 Test 4: 中文数字章节');
{
  const txt = `第一章 开头

　　a

第二十三章 中

　　b

第一百章 末

　　c`;
  const chs = parseNovelTxt(txt);
  eq('章节数=3', chs.length, 3);
  eq('orders=[1,2,3]（按出现顺序不按数字）', chs.map(c => c.order), [1, 2, 3]);
  eq('第一章=开头', chs[0].title, '开头');
  eq('第二十三章=中', chs[1].title, '中');
  eq('第一百章=末', chs[2].title, '末');
}

console.log('\n🧪 Test 5: 章节间大量空行不影响段落');
{
  const txt = `第1章 测试

　　段落一。




　　段落二。



第2章 下一章

　　下一章的段落。`;
  const chs = parseNovelTxt(txt);
  eq('第一章段落数=2（空行合并）', chs[0].paragraphs.length, 2);
}

console.log('\n🧪 Test 6: 正文中的"第X章"不被误判为新章');
{
  const txt = `第1章 正确的标题

　　他在书里看到了第三章的内容。

　　第五章写的其实不对。

第2章 继续

　　完。`;
  const chs = parseNovelTxt(txt);
  eq('只有2章（正文里的不算）', chs.length, 2);
  eq('第1章段落数=2', chs[0].paragraphs.length, 2);
}

console.log('\n🧪 Test 7: 超长单章（2万字符/200段）');
{
  let big = '第1章 超长章\n\n';
  for (let i = 0; i < 200; i++) big += `　　这是第${i + 1}段，用来测试虚拟滚动性能。每段大概五十个字左右，看看分割和内存占用。\n\n`;
  const chs = parseNovelTxt(big);
  eq('章节数=1', chs.length, 1);
  eq('段落数=200', chs[0].paragraphs.length, 200);
  const total = chs[0].paragraphs.reduce((a, b) => a + b.length, 0);
  assert(`总字符${total} > 7500（200段×~40字）`, total > 7500);
}

console.log('\n🧪 Test 8: 章节号乱序按出现顺序编order');
{
  const txt = `第1章 a

　　1

第十章 b

　　10

第五章 c

　　5`;
  const chs = parseNovelTxt(txt);
  eq('orders=[1,2,3]（不读章节号里的数字）', chs.map(c => c.order), [1, 2, 3]);
}

console.log('\n🧪 Test 9: 后记/番外 无"第X章"归入最后一章（已知限制）');
{
  const txt = `第1章 正文

　　正文完。

后记

　　作者的话。

番外 一

　　小剧场。`;
  const chs = parseNovelTxt(txt);
  eq('识别1章（后记并入最后一章）', chs.length, 1);
  assert('内容包含后记', chs[0].content.includes('后记'));
  assert('内容包含番外', chs[0].content.includes('番外'));
  console.log('  ℹ️  已知限制：无"第X章"格式的后记/番外需要App内手动分章');
}

console.log('\n🧪 Test 10: scanMentions 角色名扫描');
{
  const content = '晨光似淡黄色的刃，割开奈特城上空的晨雾。奥菲斯站在窗前，看着奥菲斯的背影远去。旁边还有奥菲斯大帝。';
  const chars = [{ id: '1', name: '奥菲斯' }, { id: '2', name: '奥菲斯大帝' }, { id: '3', name: '不存在' }, { id: '4', name: '晨' }];
  const ms = scanMentions(content, chars);
  const ids = ms.map(m => m.charId);
  assert('包含奥菲斯', ids.includes('1'));
  assert('包含奥菲斯大帝', ids.includes('2'));
  assert('不包含不存在', !ids.includes('3'));
}

console.log('\n🧪 Test 11: locateOffset');
{
  const paras = ['ABCDE', '1234567890', '甲乙丙丁'];
  const r1 = locateOffset(paras, 2);
  eq('offset 2 → para 0, 偏移 2', r1, { paraIndex: 0, paraOffset: 2 });
  const r2 = locateOffset(paras, 10); // 5 + 2(\n\n) + 3
  eq('offset 10 → para 1, 偏移 3', r2, { paraIndex: 1, paraOffset: 3 });
}

console.log('\n🧪 Test 12: BOM头 + \\r\\n 换行');
{
  const txt = '\uFEFF第1章 BOM测试\r\n\r\n\u3000\u3000正文第一行。\r\n\r\n第2章 继续\r\n\r\n\u3000\u3000第二行。';
  const chs = parseNovelTxt(txt);
  eq('章节数=2', chs.length, 2);
  eq('第1章标题=BOM测试', chs[0].title, 'BOM测试');
  eq('第1章段落数=1', chs[0].paragraphs.length, 1);
}

console.log('\n🧪 Test 13: 50章 × 10段，共500段（章节分割压力测试）');
{
  let big = '';
  for (let i = 1; i <= 50; i++) {
    big += `第${i}章 章${i}号\n\n`;
    for (let j = 0; j < 10; j++) big += `　　第${i}章第${j + 1}段内容。\n\n`;
  }
  const chs = parseNovelTxt(big);
  eq('50章全部识别', chs.length, 50);
  eq('每章10段（最后一章）', chs[49].paragraphs.length, 10);
  eq('第1章order=1', chs[0].order, 1);
  eq('第50章order=50', chs[49].order, 50);
  eq('第25章标题正确', chs[24].title, '章25号');
}

// 汇总
console.log('\n' + '='.repeat(50));
console.log(`📊 TXT解析器测试：通过 ${passed} / ${passed + failed}`);
if (failed > 0) { console.error(`❌ ${failed} 个失败`); process.exit(1); }
else console.log('🎉 全部通过！');

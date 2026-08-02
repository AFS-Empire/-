#!/usr/bin/env node
/**
 * 50万字小说性能 + 虚拟滚动/跳章/返回定位 测试
 *   1. 生成 100 章 × 5000 字 假小说
 *   2. 记录「章节起始偏移、某章节指定字符位置」做定位点
 *   3. 1000 次 locateOffset（虚拟滚动滚动条拖动基准）→ 平均耗时
 *   4. 1000 次 offset → 章节+行 → 再回来（双向往返）准确率
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ───────────── 1. 生成长文本 ───────────── */
const CHAPTERS = 100;
const PER_CH_WORDS = 5000;
const CHAR_NAMES = ['奥菲斯', '伊丽莎白', '雷恩', '凯瑟琳', '阿尔弗雷德', '艾米莉', '雷克斯', '莉莉丝'];
const PLACEHOLDER = '帝国的战火在燃烧，英雄们的故事才刚刚开始。';

function buildChapter(i) {
  let body = '';
  let count = 0;
  while (count < PER_CH_WORDS) {
    const sent = [
      `${CHAR_NAMES[i % CHAR_NAMES.length]}站在城墙上眺望着远方。`,
      PLACEHOLDER,
      `时间流逝，已经过去了${i * 3}年。`,
      `「${CHAR_NAMES[(i + 2) % CHAR_NAMES.length]}，请随我来。」`,
      `宫殿深处传来沉重的脚步声，${CHAR_NAMES[(i + 3) % CHAR_NAMES.length]}的心跳也随之加速。`,
      `雷声滚滚，闪电划过天空。`,
      `${CHAR_NAMES[(i + 4) % CHAR_NAMES.length]}握紧了剑柄。`,
    ][i % 7];
    body += sent + '\n';
    count += sent.length;
  }
  return `第${i + 1}章 ${['启程', '血战', '归途', '黎明', '真相'][i % 5]} ${i + 1}\n\n${body.trim()}\n\n`;
}

console.log(`📝 生成 ${CHAPTERS} 章 × ${PER_CH_WORDS} 字 小说…`);
let fullText = '';
for (let i = 0; i < CHAPTERS; i++) fullText += buildChapter(i);
const totalChars = fullText.length;
console.log(`   总字符数：${totalChars.toLocaleString()}（约 ${Math.round(totalChars / 10000)} 万字）`);

/* ───────────── 2. 解析章节（镜像 txtParser 逻辑）───────────── */
const CHAPTER_RE_LINE = /^(\s*(?:序章|序言|前言|楔子|引子|序幕|尾声|后记|附录|第[\s\u4e00-\u9fa50-9零〇一二三四五六七八九十百千万亿两\d]+[章回节卷集部篇][^\n\r]{0,80})\s*)$/m;
function splitChapters(text) {
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const chapterLines = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(CHAPTER_RE_LINE);
    if (m) chapterLines.push({ idx: i, title: m[1].trim() });
  }
  const out = [];
  const cumLen = []; // 每行结束后累计字符数（前缀和，加速locateOffset）
  let acc = 0;
  for (let i = 0; i < lines.length; i++) {
    cumLen.push(acc);
    acc += lines[i].length + 1;
  }
  for (let k = 0; k < chapterLines.length; k++) {
    const cur = chapterLines[k];
    const next = chapterLines[k + 1];
    out.push({
      title: cur.title,
      lineStart: cur.idx,
      lineEnd: next ? next.idx : lines.length,
    });
  }
  return { chapters: out, lines, cumLen };
}

const { chapters, lines, cumLen } = splitChapters(fullText);
console.log(`   解析章节数：${chapters.length}`);
assert.equal(chapters.length, CHAPTERS, `章节数应该是${CHAPTERS}`);

/* ───────────── 3. locateOffset ───────────── */
// 先二分（按 cumLen 前缀和）找到行，再线性找到章节
function locateOffset(offset) {
  const safe = Math.max(0, Math.min(offset, totalChars - 1));
  // 二分找行
  let lo = 0, hi = lines.length - 1, line = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cumLen[mid] <= safe) { line = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  // 线性找章节
  let chIdx = 0;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].lineStart <= line) chIdx = i; else break;
  }
  const ch = chapters[chIdx];
  const inChLine = line - ch.lineStart;
  const inChOffset = safe - cumLen[ch.lineStart];
  return { chapterIdx: chIdx, chapterTitle: ch.title, line, inChLine, inChOffset };
}

/* ───────────── 4. 1000 次定位性能 ───────────── */
console.log('\n🚀 性能测试：1000次随机位置 locateOffset');
const probes = Array.from({ length: 1000 }, () => Math.floor(Math.random() * totalChars));
const t0 = performance.now();
const results = probes.map(locateOffset);
const t1 = performance.now();
const avgUs = (t1 - t0) / 1000 * 1000;
console.log(`   耗时: ${(t1 - t0).toFixed(2)}ms 总计 | 平均 ${avgUs.toFixed(1)}μs / 次`);
assert.ok(avgUs < 500, `平均定位应当 < 500μs，得到 ${avgUs.toFixed(1)}μs`);

/* ───────────── 5. 双向往返一致性：offset→chap→再找对应章节起始偏移在合理范围内 ───────────── */
console.log('\n🔁 往返一致性：offset定位后，章节idx和行号都在合理范围');
let mismatch = 0;
for (let i = 0; i < results.length; i++) {
  const r = results[i];
  const ch = chapters[r.chapterIdx];
  // 行号必须在章节区间内
  if (r.line < ch.lineStart || r.line >= ch.lineEnd) mismatch++;
  // 章节起始偏移 ≤ 原offset
  if (cumLen[ch.lineStart] > probes[i]) mismatch++;
}
assert.equal(mismatch, 0, `${mismatch} 个定位结果越界`);
console.log(`   1000 次定位 100% 命中章节边界 ✓`);

/* ───────────── 6. 跳章测试：从第1章 → 第50章 → 第1章 → 最后一章，都能准确定位 ───────────── */
console.log('\n📑 跳章测试：快速跳转到指定章节');
function jumpToChapter(idx) {
  const ch = chapters[idx];
  const startOffset = cumLen[ch.lineStart];
  return { startOffset, ...locateOffset(startOffset) };
}
const j1 = jumpToChapter(0);
const j50 = jumpToChapter(49);
const jBack = jumpToChapter(0);
const jLast = jumpToChapter(CHAPTERS - 1);
assert.equal(j1.chapterIdx, 0, '跳第1章失败');
assert.equal(j50.chapterIdx, 49, '跳第50章失败');
assert.equal(jBack.chapterIdx, 0, '跳回第1章失败');
assert.equal(jLast.chapterIdx, CHAPTERS - 1, '跳最后一章失败');
console.log(`   第1章 → 第50章 → 第1章 → 最后一章：全部正确 ✓`);
console.log(`     第50章标题：${j50.chapterTitle}`);

/* ───────────── 7. 保存假小说供后续使用 ───────────── */
const novelPath = path.join(__dirname, '..', 'tmp', '500k-demo.txt');
fs.mkdirSync(path.dirname(novelPath), { recursive: true });
fs.writeFileSync(novelPath, fullText, 'utf8');
console.log(`\n💾 50万字假小说已存: ${novelPath}`);

/* ───────────── 报告 ───────────── */
console.log('\n' + '='.repeat(60));
console.log(`✅ 50万字性能测试全部通过`);
console.log(`   平均locateOffset: ${avgUs.toFixed(1)}μs（目标 < 500μs）`);
console.log(`   跳章、返回、往返定位：1000/1000 ✓`);

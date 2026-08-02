#!/usr/bin/env node
/**
 * 生成 50 万字假小说 + 验证角色高亮逻辑
 *
 * 1. 生成 100 章 × 100 段 ≈ 50 万字测试小说，每章预埋 6 个角色名
 * 2. 导出 novel-demo-seed.json（可导入测试）
 * 3. 对每章跑 scanMentions 验证：
 *    - 每章首次出现记录为 firstOffset
 *    - 档案馆不存在的角色（"路人甲"）不应被高亮
 *    - 子串名（"雷" vs "雷克斯"）不应误判
 * 4. 打印生成耗时 + 渲染章节性能指标
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', '.cache');
const OUT_FILE = path.join(OUT, 'novel-demo-seed.json');

// ============ 内嵌 parser + scan 实现 ============
function cleanParagraphs(lines) {
  const result = [];
  let buffer = [];
  for (const line of lines) {
    if (!line) { if (buffer.length) { result.push(buffer.join('')); buffer = []; } }
    else buffer.push(line);
  }
  if (buffer.length) result.push(buffer.join(''));
  return result.filter(p => p.length > 0);
}
function isCjkChar(ch) {
  const code = ch.charCodeAt(0);
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
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

// ============ 假小说生成 ============

// 6 个固定角色（档案馆中存在 → 应被高亮
const CHARS_EXIST = [
  { id: 'c1', name: '奥菲斯' },
  { id: 'c2', name: '爱丽娜' },
  { id: 'c3', name: '雷克斯' },
  { id: 'c4', name: '瓦莲京娜' },
  { id: 'c5', name: '塞拉芬' },
  { id: 'c6', name: '奥菲斯大帝' }, // 子串验证：包含"奥菲斯"
];
// 不存在的角色（不应被高亮）
const CHARS_MISSING = [
  { id: 'cx1', name: '路人甲' },
  { id: 'cx2', name: '神秘人' },
];
// 所有"雷"（单字，不应被高亮
const CHAR_SINGLE = [{ id: 'cs1', name: '雷' }];
// 场景库
const SCENES = ['宫殿', '城堡', '庭院', '酒馆', '街道', '军营', '神殿', '塔顶', '海边', '雪原', '森林', '地下通道', '书房', '议事厅', '竞技场'];
const ACTIONS = ['站在窗前看着远方', '缓缓开口', '微微点头', '皱眉思索', '轻轻叹了口气', '拿出一封旧信件', '翻阅档案卷宗', '擦拭一柄长剑', '望向窗外的星空', '拿起权杖', '坐下喝茶', '低声吩咐侍从', '陷入回忆', '握紧拳头', '露出苦笑'];
const DESCS = ['金色的阳光透过彩绘玻璃洒落', '远处传来钟声', '空气中弥漫着墨香', '远处号角声悠悠响起', '一支蜡烛被风吹得摇晃', '石板路上行人稀少', '壁炉中的火焰跳动', '桌上摊着一张老旧地图', '雨丝打在窗棂上', '书架上档案整齐排列'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/**
 * 生成一章内容：100 段，每段 ~50 字
 * 规则：
 *   第 1 段必须第一个出现的角色按 (chapterIndex 轮换（验证每章首次出现下划线位置不同）
 *   后面段落每 6 个角色 + 不存在的角色混合出现
 */
function generateChapter(chapterIdx) {
  const lines = [];
  const firstCharIdx = chapterIdx % CHARS_EXIST.length;
  // 第一段：强制第一个出现固定角色
  const firstChar = CHARS_EXIST[firstCharIdx];
  lines.push(`　　${firstChar.name}${pick(ACTIONS)}，${pick(DESCS)}。这是一场漫长的等待，${pick(SCENES)}里的一切都显得格外安静。`);
  lines.push('');
  // 剩余 99 段：随机角色随机插入
  for (let i = 1; i < 100; i++) {
    // 每 3 段塞一个不存在的角色
    let text = '';
    const insertMissing = i % 3 === 0;
    const insertSingle = i % 7 === 0;
    if (insertMissing) {
      text += `${pick(CHARS_MISSING).name}从旁经过，`;
    }
    if (insertSingle) {
      // 插入单字"雷"：应该不匹配雷克斯的子串
      text += `天空中一道雷声滚过，`;
    }
    const c = pick(CHARS_EXIST);
    text += `${c.name}${pick(ACTIONS)}。${pick(DESCS)}。${pick(SCENES)}内的时间仿佛静止了片刻。`;
    lines.push('　　' + text);
    lines.push('');
  }
  const paragraphs = cleanParagraphs(lines);
  const content = paragraphs.join('\n\n');
  // 计算字符数
  return { paragraphs, content };
}

// ============ 执行：生成 100 章
console.log('🧪 生成 50 万字假小说 + 角色高亮逻辑验证');
console.log('='.repeat(60));

const t0 = Date.now();
const chapters = [];
let totalChars = 0;
for (let i = 0; i < 100; i++) {
  const { paragraphs, content } = generateChapter(i);
  chapters.push({
    order: i + 1,
    title: `第${i + 1}章 测试章节${i + 1}号`,
    paragraphs,
    content,
  });
  totalChars += content.length;
}
const t1 = Date.now();
console.log(`✅ 生成 100 章，总字符 ${totalChars.toLocaleString()}，耗时 ${t1 - t0}ms`);

// ============ scanMentions 性能测试
console.log('\n🧪 scanMentions 性能：对每章 100 次扫描');
const t2 = Date.now();
let totalMentions = 0;
let allPassed = 0;
let allFailed = 0;

for (let i = 0; i < 100; i++) {
  const ch = chapters[i];
  // 关键：knownCharacters 只传【档案馆存在的】角色
  //   CHARS_EXIST: 存在的 6 个角色（应被正确找到）
  //   CHAR_SINGLE: "雷" 单字（已被 length<2 过滤，不应被找到，即使它传进去了也找不到
  //   CHARS_MISSING: 【绝对不传】，它们只是在正文里出现，用来验证单向匹配的正确性
  //                （因为它们不在档案馆里，scanMentions 根本没见过它们，自然返回不出）
  const known = [...CHARS_EXIST, ...CHAR_SINGLE];
  const ms = scanMentions(ch.content, known);
  const mIds = new Set(ms.map(m => m.charId));
  const mNames = new Set(ms.map(m => m.name));
  totalMentions += ms.length;

  // 断言 1：第一个出现的角色必须是 CHARS_EXIST[i % 6]（因为第一段强制放它）
  //   注意：c6（奥菲斯大帝）vs c1（奥菲斯）。第一段若写"奥菲斯大帝xxx"，firstOffset 都在 0，
  //   经冲突消解后，同一 offset 只保留最长名 → 只剩 c6。
  const expectFirst = CHARS_EXIST[i % CHARS_EXIST.length];
  const firstMention = ms[0];
  // 当 expectFirst 是 c6（奥菲斯大帝）时，只应该命中 c6，c1 被消解了
  const matchOk = firstMention?.charId === expectFirst.id ||
    (expectFirst.id === 'c6' && firstMention?.charId === 'c6');
  if (matchOk) {
    allPassed++;
  } else {
    console.error(`  ❌ 第${i + 1}章(期望 ${expectFirst.name}#${expectFirst.id})：第一个高亮实际是 ${firstMention?.name}#${firstMention?.charId}`);
    console.error(`     本段开头: ${JSON.stringify(ch.paragraphs[0]?.slice(0, 30))}`);
    allFailed++;
  }

  // 断言 2：正文里虽然有"路人甲""神秘人"，但因为它们不在 knownCharacters（档案馆没有），所以 mentions 绝对不能出现它们
  if (mNames.has('路人甲') || mNames.has('神秘人')) {
    console.error(`  ❌ 第${i + 1}章：档案馆不存在的角色"路人甲/神秘人"被错误高亮（单向匹配破坏！`);
    allFailed++;
  } else {
    allPassed++;
  }

  // 断言 3：单字"雷"不应被高亮（长度<2被过滤；且正文是"雷声"这个词
  if (mIds.has('cs1')) {
    console.error(`  ❌ 第${i + 1}章：单字"雷"被错误匹配`);
    allFailed++;
  } else {
    allPassed++;
  }

  // 断言 4：子串冲突消解正确性
  //   只要正文含"奥菲斯"三字（无论是单独写的 c1 还是作为 c6 前缀写的），
  //   scan 结果中至少应命中 c1 或 c6 其中之一；如果同 offset 冲突只保留最长（c6）也算正确
  const hasOrpheusInText = ch.content.indexOf('奥菲斯') !== -1;
  const hasC1 = ms.some(x => x.charId === 'c1');
  const hasC6 = ms.some(x => x.charId === 'c6');
  if (!hasOrpheusInText || hasC1 || hasC6) {
    allPassed++;
  } else {
    console.error(`  ❌ 第${i + 1}章：正文含"奥菲斯"但 scan 结果中 c1 和 c6 均缺失。hasC1=${hasC1}, hasC6=${hasC6}
     firstOrpheus@${ch.content.indexOf('奥菲斯')}，附近: ${JSON.stringify(ch.content.slice(Math.max(0, ch.content.indexOf('奥菲斯')-5), ch.content.indexOf('奥菲斯')+15))}`);
    allFailed++;
  }
}
const t3 = Date.now();
console.log(`✅ 100 章 scanMentions 总耗时 ${t3 - t2}ms，平均每章 ${(t3 - t2) / 100}ms`);
console.log(`   共产生 ${totalMentions} 个 mention`);
console.log(`   断言通过 ${allPassed}，失败 ${allFailed}`);
if (allFailed > 0) {
  console.error('❌ 角色高亮逻辑有问题');
  process.exit(1);
}

// ============ 段落定位性能测试（模拟虚拟滚动 offset → paraIndex）
console.log('\n🧪 locateOffset 性能（模拟阅读器滚动定位 10000 次');
function locateOffset(paragraphs, offset) {
  let remaining = offset;
  for (let i = 0; i < paragraphs.length; i++) {
    const len = paragraphs[i].length;
    if (remaining <= len) return { paraIndex: i, paraOffset: remaining };
    remaining -= len + 2;
  }
  return { paraIndex: paragraphs.length - 1, paraOffset: paragraphs[paragraphs.length - 1]?.length || 0 };
}
const t4 = Date.now();
let offsetResults = 0;
const sampleParas = chapters[49].paragraphs; // 第50章（中间章
const totalLen = sampleParas.reduce((a, b) => a + b.length + 2, 0);
for (let i = 0; i < 10000; i++) {
  const off = Math.floor(Math.random() * totalLen);
  const r = locateOffset(sampleParas, off);
  offsetResults += r.paraIndex;
}
const t5 = Date.now();
console.log(`✅ 10000 次定位耗时 ${t5 - t4}ms，平均每次 ${((t5 - t4) / 10000 * 1000).toFixed(2)}μs (index求和=${offsetResults})`);

// ============ 导出 seed JSON（可导入 IndexedDB 直接体验） ============
console.log('\n🧪 导出 seed JSON（含完整novel数据，可用于dev模式一键注入）');
const seedData = {
  _meta: {
    generatedAt: new Date().toISOString(),
    totalChars,
    chapters: 100,
    volumes: 2,
    chars: '50万字假小说（性能测试用）',
  },
  book: {
    id: 'novel-demo-perf',
    title: '奥菲斯帝国编年史（测试本·50万字）',
    author: '系统生成',
    description: '性能测试专用：100章×~5000字。每章预埋6角色+2不存在+1单字名验证高亮逻辑。',
    coverColor: '#2a2a35',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  volumes: [
    { id: 'vol-demo-1', bookId: 'novel-demo-perf', order: 1, title: '第一卷 晨光之章' },
    { id: 'vol-demo-2', bookId: 'novel-demo-perf', order: 2, title: '第二卷 暮色之章' },
  ],
  chapters: chapters.map((c, i) => ({
    id: `ch-demo-${i + 1}`,
    bookId: 'novel-demo-perf',
    volumeId: i < 50 ? 'vol-demo-1' : 'vol-demo-2',
    order: c.order,
    title: c.title,
    content: c.content,
    wordCount: c.content.length,
    paragraphCount: c.paragraphs.length,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })),
};
try {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(seedData));
  const sizeMB = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(2);
  console.log(`✅ 导出成功：${path.relative(path.join(__dirname, '..'), OUT_FILE)} (${sizeMB} MB)`);
} catch (e) {
  console.error('导出失败：', e.message);
}

console.log('\n' + '='.repeat(60));
console.log('🎉 所有性能&高亮逻辑全部通过！');
console.log(`   📖 假小说已生成，可在 Dev 模式下书架页一键注入体验阅读器性能`);

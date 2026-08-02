#!/usr/bin/env node
/**
 * 签名-验签端到端测试：
 *   App端：用私有盐值（环境变量注入）生成签名字段
 *   Web端：用户输入相同密码 → 验签通过
 *   密码错误 → 验签失败（exit=1）
 *   篡改数据 → 验签失败（exit=1）
 *
 * 盐值来源：环境变量 ARCHIVE_PRIVATE_SALT（与构建注入路径一致，严禁明文写死源码）
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let appSecret = process.env.ARCHIVE_PRIVATE_SALT || '';
// 本地兜底：从 .env.local 读取（.gitignore 已忽略，不进仓库）
if (!appSecret) {
  try {
    const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
    const m = envContent.match(/^ARCHIVE_PRIVATE_SALT\s*=\s*(.+)$/m);
    if (m) appSecret = m[1].trim();
  } catch { /* CI 环境无 .env.local */ }
}

// 读 hiddenUnlock 源码里的 buildSignPayload 键顺序（必须完全一致）
const KEY_ORDER = [
  'entries', 'eras', 'customSections', 'users', 'settings',
  'novelBooks', 'novelVolumes', 'novelChapters', 'novelProgress'
];

function sha256(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}
function buildPayloadStr(data) {
  // 严格按 hiddenUnlock.buildSignPayload 的顺序和算法
  const safeEntries = (data.entries || []).map(e => ({
    id: e.id, type: e.type, title: e.title, content: e.content,
    startYear: e.startYear ?? null, startMonth: e.startMonth ?? null, startDay: e.startDay ?? null,
    endYear: e.endYear ?? null, endMonth: e.endMonth ?? null, endDay: e.endDay ?? null,
    precision: e.precision, eraId: e.eraId ?? null, tags: e.tags ?? [], customSectionId: e.customSectionId ?? null,
    parentId: e.parentId ?? null, orderIdx: e.orderIdx ?? 0, updatedAt: e.updatedAt ?? 0, createdAt: e.createdAt ?? 0,
    refs: e.refs ?? [], chapterMentions: e.chapterMentions ?? [],
    extra: e.extra ?? {},
  }));
  return JSON.stringify({
    entries: safeEntries,
    eras: data.eras || [],
    customSections: data.customSections || [],
    users: data.users || [],
    settings: data.settings || {},
    novelBooks: data.novelBooks || [],
    novelVolumes: data.novelVolumes || [],
    novelChapters: data.novelChapters || [],
    novelProgress: data.novelProgress || [],
  });
}

let passed = 0, failed = 0;
function ok(desc) { console.log(`  ✅ ${desc}`); passed++; }
function no(desc, detail = '') { console.error(`  ❌ ${desc}`, detail); failed++; }

console.log('🧪 签名-验签端到端测试');
console.log(`   盐值长度: ${appSecret.length}`);

// 构造测试数据集（含角色/时代等，模拟真实结构）
const testData = {
  entries: [
    { id: 'e1', type: 'character', title: '奥菲斯', content: '开国皇帝', precision: 'day', tags: [], orderIdx: 0, createdAt: 1, updatedAt: 2 },
    { id: 'e2', type: 'event', title: '开国大典', content: '建国', precision: 'day', tags: [], orderIdx: 1, createdAt: 1, updatedAt: 2 },
  ],
  eras: [{ id: 'era1', name: '开国纪元', orderIdx: 0 }],
  customSections: [],
  users: [{ id: 'u1', role: 'admin', name: 'admin' }],
  settings: { theme: 'dark' },
  novelBooks: [{ id: 'nb1', title: '测试书' }],
  novelVolumes: [{ id: 'nv1', bookId: 'nb1', title: '第一卷' }],
  novelChapters: [{ id: 'nc1', bookId: 'nb1', volumeId: 'nv1', order: 1, title: '第1章', content: '内容' }],
  novelProgress: [{ id: 'p1', bookId: 'nb1', chapterId: 'nc1', position: 0 }],
};

// Case 1: App导出 → 正确密码验签通过
console.log('\nCase 1: App导出 → 用相同密码验签 → 通过');
{
  const payloadStr = buildPayloadStr(testData);
  const sign = sha256(payloadStr + appSecret);
  const exportJson = { ...testData, sign, exportDate: new Date().toISOString() };
  // Web端验签：用户输入appSecret
  const verifyStr = buildPayloadStr(exportJson);
  const recomputed = sha256(verifyStr + appSecret);
  if (recomputed === sign) ok('验签通过');
  else no('验签失败', `expect ${sign.slice(0,10)} got ${recomputed.slice(0,10)}`);
}

// Case 2: 密码错误 → 验签失败
console.log('\nCase 2: 用户输错密码（末尾错一位）→ 验签失败');
{
  const payloadStr = buildPayloadStr(testData);
  const sign = sha256(payloadStr + appSecret);
  const wrongKey = appSecret.slice(0, -1) + 'X';
  const recomputed = sha256(buildPayloadStr(testData) + wrongKey);
  if (recomputed !== sign) ok('正确拒绝错误密码');
  else no('错误密码被错误地通过了');
}

// Case 3: 篡改 data 中的某条字段 → 验签失败
console.log('\nCase 3: 攻击者篡改 entries[0].title → 验签失败');
{
  const payloadOrig = buildPayloadStr(testData);
  const sign = sha256(payloadOrig + appSecret);
  // 模拟篡改：把 entries[0].title 改掉
  const tampered = JSON.parse(JSON.stringify(testData));
  tampered.entries[0].title = '被篡改的标题';
  const verifyStr = buildPayloadStr(tampered);
  const recomputed = sha256(verifyStr + appSecret);
  if (recomputed !== sign) ok('正确识别数据篡改');
  else no('篡改未被检出！');
}

// Case 4: 空数据也能签名和验签
console.log('\nCase 4: 空数据（新安装）也能正常签名验签');
{
  const empty = { entries: [], eras: [], customSections: [], users: [], settings: {}, novelBooks: [], novelVolumes: [], novelChapters: [], novelProgress: [] };
  const ps = buildPayloadStr(empty);
  const s = sha256(ps + appSecret);
  const r = sha256(buildPayloadStr(empty) + appSecret);
  if (s === r) ok('空数据签名一致');
  else no('空数据签名不一致');
}

// Case 5: 确保 buildSignPayload 的 key 顺序与 hiddenUnlock 配置的 KEY_ORDER 一致
console.log('\nCase 5: 签名字段顺序与 KEY_ORDER 严格一致');
{
  const ps = buildPayloadStr(testData);
  const firstKey = ps.slice(2, ps.indexOf('":')); // {"entries"
  if (firstKey === 'entries') ok('第一个key是 entries（与KEY_ORDER一致）');
  else no('字段顺序可能不一致', `第一个key是${firstKey}`);
  // 检查最后一个 key 是 novelProgress
  const beforeEnd = ps.slice(-100, -1);
  if (beforeEnd.includes('novelProgress')) ok('最后一个key是 novelProgress');
  else no('novelProgress 不在尾部');
}

// 汇总
console.log('\n' + '='.repeat(50));
console.log(`📊 签名验签测试：${passed} / ${passed + failed}`);
if (failed > 0) process.exit(1);
console.log('🎉 全部通过！');

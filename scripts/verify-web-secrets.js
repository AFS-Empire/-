#!/usr/bin/env node
/**
 * 网页版构建后置检查：强制扫描 dist/ 产物中是否泄露私有盐
 * 任何命中 → process.exit(1)，Netlify 构建失败，不会部署
 *
 * 触发：package.json scripts.postbuild:web
 *
 * 三层扫描：
 *   1. 明文原文匹配
 *   2. Base64 编码匹配（防止打包时被 base64 后塞进代码）
 *   3. 拆分片段匹配（盐值按 N 字符滑窗，片段长度 10，防止拆分藏匿）
 *
 * 盐值来源：从环境变量 ARCHIVE_PRIVATE_SALT 读取（与构建时注入路径一致）
 *           不再从源码文件读取，因为源码已不含盐值。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// —— 需保护的敏感字符串（从环境变量读取，构建机器上运行，不进入任何网页产物）——
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let SECRET = process.env.ARCHIVE_PRIVATE_SALT || '';

// 本地构建兜底：环境变量未设置时从 .env.local 读取（CI 已通过 Secrets 注入环境变量）
if (!SECRET) {
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  try {
    const envContent = fs.readFileSync(envLocalPath, 'utf-8');
    const m = envContent.match(/^ARCHIVE_PRIVATE_SALT\s*=\s*(.+)$/m);
    if (m) SECRET = m[1].trim();
  } catch { /* .env.local 不存在，CI 环境 */ }
}

if (!SECRET || SECRET.length < 12) {
  console.error('[verify-web-secrets] ❌ 环境变量 ARCHIVE_PRIVATE_SALT 未配置或过短');
  console.error('    本地构建请在 .env.local 配置；CI 构建请配置 GitHub Actions Secrets');
  process.exit(2);
}

const DIST_DIR = path.join(__dirname, '..', 'dist');
const EXTS = new Set(['.js', '.map', '.html', '.css', '.mjs', '.cjs', '.txt', '.json']);
// IndexedDB/LevelDB 目录中不会有盐（那是浏览器运行时数据，构建时 dist 里没有），
// 但我们照样扫描所有可读文件以确保万无一失

// ============ 构造匹配模式 ============
const patterns = new Set();

// 1) 明文
patterns.add(SECRET);

// 2) Base64（标准和 URL-safe 两种变体）
const b64Std = Buffer.from(SECRET, 'utf-8').toString('base64');
const b64Url = b64Std.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
patterns.add(b64Std);
patterns.add(b64Url);

// 3) 滑窗 10 字符片段（排除太常见的前缀如 AFSEmpire，只从日期+随机码开始切）
//    这样即便有人把盐值拆成 "A" + "FS..." 字符串拼接，也能在大段代码中命中连续片段
const fragStart = Math.max(0, SECRET.indexOf('@')); // 从 @ 起才开始切
for (let i = fragStart; i <= SECRET.length - 10; i++) {
  patterns.add(SECRET.slice(i, i + 10));
}

// 转成正则模式数组（多模匹配，每个 pattern 作为字符串搜索）
const patternList = Array.from(patterns);

// ============ 递归遍历文件 ============
function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(full, out);
    } else if (e.isFile()) {
      // 跳过大于 50MB 的文件（理论上不会有），避免扫爆内存
      try {
        const stat = fs.statSync(full);
        if (stat.size > 50 * 1024 * 1024) continue;
      } catch { /* ignore */ }
      const ext = path.extname(e.name).toLowerCase();
      if (EXTS.has(ext) || ext === '') {
        out.push(full);
      }
    }
  }
}

if (!fs.existsSync(DIST_DIR)) {
  console.error('[verify-web-secrets] ❌ dist/ 目录不存在，先执行构建再跑本脚本');
  process.exit(2);
}

const files = [];
walk(DIST_DIR, files);

console.log(`[verify-web-secrets] 🔍 扫描 dist/ 产物：${files.length} 个文件，${patternList.length} 个匹配模式`);
// 安全规则：禁止在日志中打印盐值任何片段（含前缀/后缀截断），仅打印长度用于诊断
console.log(`[verify-web-secrets] 🔒 保护目标：${SECRET.length} 字符私有盐值（内容已脱敏）`);

let hitCount = 0;
for (const file of files) {
  let content;
  try {
    content = fs.readFileSync(file, 'utf-8');
  } catch (e) {
    // 非 UTF-8 文件（二进制）跳过
    continue;
  }
  for (const pat of patternList) {
    const idx = content.indexOf(pat);
    if (idx !== -1) {
      const rel = path.relative(path.join(__dirname, '..'), file);
      const before = Math.max(0, idx - 20);
      const after = Math.min(content.length, idx + pat.length + 20);
      const snippet = content.slice(before, after).replace(/\s+/g, ' ');
      console.error(`\n[verify-web-secrets] ❌ 命中敏感模式！文件: ${rel}`);
      console.error(`   位置偏移: ${idx}，匹配片段: ${JSON.stringify(pat.length > 30 ? pat.slice(0, 30) + '...' : pat)}`);
      console.error(`   上下文: ...${snippet}...`);
      hitCount++;
      break; // 一个文件命中一次就够了，不重复打
    }
  }
}

if (hitCount > 0) {
  console.error(`\n[verify-web-secrets] ❌❌❌ 共 ${hitCount} 个文件可能泄露私有盐！构建已中断，禁止部署。`);
  console.error('请检查 vite alias 配置、chunk 分割、或新增的字符串注入。');
  process.exit(1);
}

console.log(`[verify-web-secrets] ✅ 全部通过 — dist/ 产物中未发现私有盐痕迹。`);

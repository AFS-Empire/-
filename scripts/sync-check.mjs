#!/usr/bin/env node
/**
 * 同步检查脚本 —— 每次 push 后必须跑一次
 *
 * 做三件事：
 *   1. 检查本地 git 是否有未 push 的 commit
 *   2. 抓线上 https://afs-jzy-archive.netlify.app 的 JS 文件名
 *   3. 对比本地最新构建的 dist/assets/index-*.js 文件名是否一致
 *
 * 用法：npm run sync
 * 如果不一致 → 说明 Netlify 还在构建中或部署失败，需要等待或排查
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const SITE_URL = 'https://afs-jzy-archive.netlify.app';

console.log('═══════════════════════════════════════════════');
console.log('  同步检查 · 确保线上代码 = 本地最新代码');
console.log('═══════════════════════════════════════════════\n');

// ── 1. 检查 git 是否有未 push 的 commit ──
console.log('1️⃣  Git 状态');
const aheadRaw = execSync('git rev-list --count origin/main..HEAD 2>/dev/null || echo 0', { cwd: root, encoding: 'utf-8' }).trim();
const ahead = parseInt(aheadRaw, 10) || 0;
const lastCommit = execSync('git log --oneline -1', { cwd: root, encoding: 'utf-8' }).trim();
if (ahead > 0) {
  console.log(`   ⚠️  本地有 ${ahead} 个未 push 的 commit！`);
  console.log(`   → 运行: git push`);
} else {
  console.log(`   ✅ 本地代码已 push 到 GitHub`);
}
console.log(`   最新 commit: ${lastCommit}\n`);

// ── 2. 抓线上 JS 文件名 ──
console.log('2️⃣  线上版本 (Netlify)');
let onlineJs = null;
try {
  const resp = await fetch(SITE_URL);
  const html = await resp.text();
  const match = html.match(/assets\/index-[^"]+\.js/);
  onlineJs = match ? match[0] : null;
  console.log(`   线上 JS: ${onlineJs || '未找到'}\n`);
} catch (e) {
  console.log(`   ❌ 无法访问 ${SITE_URL}：${e.message}\n`);
}

// ── 3. 对比本地构建 ──
console.log('3️⃣  本地构建 (dist/)');
const distDir = path.join(root, 'dist', 'assets');
let localJs = null;
if (fs.existsSync(distDir)) {
  const files = fs.readdirSync(distDir).filter(f => f.startsWith('index-') && f.endsWith('.js'));
  if (files.length > 0) {
    localJs = `assets/${files[0]}`;
    console.log(`   本地 JS: ${localJs}\n`);
  }
} else {
  console.log(`   ⚠️  dist/ 不存在，需要先 npm run build:web\n`);
}

// ── 4. 对比结论 ──
console.log('───────────────────────────────────────────────');
if (onlineJs && localJs) {
  if (onlineJs === localJs) {
    console.log('✅ 同步成功！线上代码 = 本地最新构建');
    console.log(`\n   网址: ${SITE_URL}`);
    console.log('   提示: 浏览器请用 Ctrl+Shift+R / Cmd+Shift+R 强制刷新\n');
  } else {
    console.log('⚠️  版本不一致！');
    console.log(`   线上: ${onlineJs}`);
    console.log(`   本地: ${localJs}`);
    console.log('   → Netlify 可能还在构建中，等 1-2 分钟后重新运行 npm run sync');
    console.log('   → 或检查 https://app.netlify.com 看构建日志\n');
    process.exit(1);
  }
} else if (onlineJs && !localJs) {
  console.log('⚠️  本地没有 dist/，无法对比。先运行 npm run build:web');
  console.log(`   线上版本: ${onlineJs}\n`);
} else {
  console.log('⚠️  无法完成对比，请手动检查\n');
  process.exit(1);
}

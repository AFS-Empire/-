#!/usr/bin/env node
/**
 * 生成 APK 下载页 index.html 与 version.json
 * 从环境变量读取 VERSION / BUILD_NUM / APK_PATH / DATE
 * 输出到 dist/apk/ 目录
 *
 * 在 GitHub Actions 中调用，避免在 YAML 里写内联 heredoc 破坏缩进。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const version = process.env.VERSION;
const buildNum = process.env.BUILD_NUM;
const apkPath = process.env.APK_PATH;

if (!version || !buildNum || !apkPath) {
  console.error('Usage: VERSION=v1.0.x BUILD_NUM=123 APK_PATH=orpheus-archive.apk node scripts/generate-apk-index.mjs');
  process.exit(1);
}

let size = 'unknown';
try {
  const st = fs.statSync(apkPath);
  size = String(st.size);
} catch {}

let date;
try {
  date = execSync('date -u +%Y-%m-%dT%H:%M:%SZ', { encoding: 'utf-8' }).trim();
} catch {
  date = new Date().toISOString();
}

const outDir = path.join('dist', 'apk');
fs.mkdirSync(outDir, { recursive: true });

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>奥菲斯帝国档案馆 · APK 下载</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d0d0f;color:#e8d5b7;font-family:-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
.card{text-align:center;padding:2rem;max-width:400px;width:100%}
h1{color:#d4a857;font-size:1.5rem;margin-bottom:.5rem}
.ver{color:#8a8074;font-size:.85rem;margin-bottom:1.5rem}
.btn{display:inline-block;background:linear-gradient(135deg,#d4a857,#b8862e);color:#1a1a1c;text-decoration:none;padding:.9rem 2rem;border-radius:.75rem;font-weight:bold;font-size:1.1rem;transition:transform .15s;cursor:pointer;border:none;width:100%;margin-bottom:.75rem}
.btn:active{transform:scale(.97)}
.btn.secondary{background:transparent;color:#d4a857;border:1px solid #d4a857}
.hint{color:#6a6258;font-size:.75rem;margin-top:1.5rem;line-height:1.6}
.status{color:#d4a857;font-size:.85rem;margin-bottom:1rem;min-height:1.2rem}
</style>
</head>
<body>
<div class="card">
<h1>奥菲斯帝国档案馆</h1>
<p class="ver">Android 安装包</p>
<div class="status" id="status">正在检查版本...</div>
<a href="orpheus-archive.apk" id="downloadBtn" class="btn" style="display:none">下载 APK (${version})</a>
<button id="refreshBtn" class="btn secondary" onclick="checkVersion()">检查最新版本</button>
<p class="hint">开启「允许安装未知来源应用」后安装<br>覆盖更新不会丢失档案数据</p>
</div>
<script>
function checkVersion(){
fetch('version.json?t='+Date.now())
.then(r=>r.json())
.then(d=>{
document.getElementById('status').textContent='当前版本: '+d.version;
document.getElementById('downloadBtn').style.display='inline-block';
document.getElementById('downloadBtn').textContent='下载 '+d.version;
})
.catch(()=>{
document.getElementById('status').textContent='版本信息加载中';
document.getElementById('downloadBtn').style.display='inline-block';
});
}
checkVersion();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log('✅ index.html 已生成');

const versionJson = JSON.stringify({
  version,
  build: Number(buildNum),
  date,
  size,
});
fs.writeFileSync(path.join(outDir, 'version.json'), versionJson);
console.log('✅ version.json 已生成');

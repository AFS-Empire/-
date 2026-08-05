#!/usr/bin/env node
/**
 * Android 工程配置脚本
 *
 * 本脚本只做一件事：写入 proguard-rules.pro
 *
 * IMPORTANT: 绝不修改 AndroidManifest.xml！
 * Manifest 的权限/Intent-filter 修改由 CI workflow 直接用 shell 命令完成。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const androidAppDir = path.join(root, 'android', 'app');

if (!fs.existsSync(androidAppDir)) {
  console.error('❌ android/app 目录不存在，请先运行 npx cap add android');
  process.exit(1);
}

// ── 写入 ProGuard 规则 ──
const proguardPath = path.join(androidAppDir, 'proguard-rules.pro');
const proguardRules = `# ===== Orpheus Archive ProGuard Rules =====

# Capacitor plugin entry points (reflection)
-keep class com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keep @com.getcapacitor.NativePlugin class * { *; }

# WebView JS Bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# App main entry
-keep class com.orpheus.archive.** { *; }

# Gson / JSON
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# Obfuscation
-repackageclasses ''
-allowaccessmodification
-optimizationpasses 3
`;

fs.writeFileSync(proguardPath, proguardRules);
console.log('✅ proguard-rules.pro 已写入');
console.log('ℹ️  AndroidManifest.xml 未被修改（由 CI shell 处理）');
console.log('🎉 配置完成');

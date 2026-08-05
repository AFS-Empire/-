#!/usr/bin/env node
/**
 * Android 工程配置脚本（极简安全版）
 *
 * 原则：
 *   1. 全程使用 indexOf + substring 做"插入"操作，绝不使用 replace
 *   2. 绝不修改任何标签名（<application、<manifest 等永远保留英文）
 *   3. 每一步修改后立即验证标签完整性
 *   4. Capacitor 模板自带 icon/roundIcon，本脚本只补权限 + Intent-filter + allowBackup 改值
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const androidAppDir = path.join(root, 'android', 'app');

function verifyTag(manifest, tag) {
  if (manifest.indexOf(tag) === -1) {
    console.error(`  ❌ 标签 ${tag} 丢失！`);
    return false;
  }
  return true;
}

if (!fs.existsSync(androidAppDir)) {
  console.error('❌ android/app 目录不存在，请先运行 npx cap add android');
  process.exit(1);
}

let hasError = false;

// ── 1. 写入 ProGuard 规则 ──
try {
  const proguardPath = path.join(androidAppDir, 'proguard-rules.pro');
  const proguardRules = `# ===== 奥菲斯帝国档案馆 ProGuard 规则 =====

# 保留 Capacitor 插件入口（反射调用）
-keep class com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keep @com.getcapacitor.NativePlugin class * { *; }

# 保留 WebView JS Bridge 接口（JS 通过反射调 Java）
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# 保留 App 主入口
-keep class com.orpheus.archive.** { *; }

# 保留泛型签名（Gson / JSON 解析需要）
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# 混淆优化
-repackageclasses ''
-allowaccessmodification
-optimizationpasses 3
`;
  fs.writeFileSync(proguardPath, proguardRules);
  console.log('✅ proguard-rules.pro 已写入');
} catch (e) {
  console.error('⚠️ proguard-rules.pro 写入失败:', e.message);
  hasError = true;
}

// ── 2. 修改 AndroidManifest.xml ──
try {
  const manifestPath = path.join(androidAppDir, 'src', 'main', 'AndroidManifest.xml');
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ AndroidManifest.xml 不存在');
    process.exit(1);
  }

  const original = fs.readFileSync(manifestPath, 'utf-8');
  let manifest = original;
  let modified = false;

  // ===== 原始结构校验 =====
  console.log('\n=== 原始 manifest 结构校验 ===');
  if (!verifyTag(manifest, '<application'))   { hasError = true; }
  if (!verifyTag(manifest, '</application>')) { hasError = true; }
  if (!verifyTag(manifest, '<manifest'))      { hasError = true; }
  if (!verifyTag(manifest, '</manifest>'))    { hasError = true; }
  if (!verifyTag(manifest, '</activity>'))    { hasError = true; }
  if (hasError) {
    console.error('❌ 原始 manifest 结构异常，退出处理');
    process.exit(1);
  }
  console.log('✅ 所有必需标签都存在');

  // ===== 修改 1：allowBackup true -> false =====
  // 不用 replace，用 indexOf 找到确切字符串位置再 substring
  const ALLOW_BACKUP_TRUE = 'android:allowBackup="true"';
  const ALLOW_BACKUP_FALSE = 'android:allowBackup="false"';
  {
    const idx = manifest.indexOf(ALLOW_BACKUP_TRUE);
    if (idx !== -1) {
      manifest = manifest.substring(0, idx) + ALLOW_BACKUP_FALSE + manifest.substring(idx + ALLOW_BACKUP_TRUE.length);
      console.log('✅ allowBackup 改为 false');
      modified = true;
      if (!verifyTag(manifest, '<application')) { hasError = true; console.error('  allowBackup 修改后 <application 丢失！'); }
    } else if (manifest.indexOf(ALLOW_BACKUP_FALSE) !== -1) {
      console.log('✅ allowBackup 已是 false');
    } else {
      // <application 标签里没有 allowBackup 属性，在 > 前插入
      const appTagStart = manifest.indexOf('<application');
      const appTagEnd = manifest.indexOf('>', appTagStart);
      if (appTagStart !== -1 && appTagEnd !== -1) {
        manifest = manifest.substring(0, appTagEnd) + ' ' + ALLOW_BACKUP_FALSE + manifest.substring(appTagEnd);
        console.log('✅ 补充 allowBackup="false"');
        modified = true;
        if (!verifyTag(manifest, '<application')) { hasError = true; }
      }
    }
  }

  // ===== 修改 2：在 <application 之前插入缺失的权限 =====
  const permItems = [
    '<uses-permission android:name="android.permission.INTERNET" />',
    '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
    '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />',
    '<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />',
    '<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />',
  ];
  {
    const appTagStart = manifest.indexOf('<application');
    const missing = permItems.filter(p => manifest.indexOf(p) === -1);
    if (missing.length > 0) {
      const insertStr = missing.map(p => `    ${p}`).join('\n') + '\n';
      manifest = manifest.substring(0, appTagStart) + insertStr + manifest.substring(appTagStart);
      console.log(`✅ 新增权限: ${missing.length} 项`);
      modified = true;
      if (!verifyTag(manifest, '<application')) { hasError = true; console.error('  权限插入后 <application 丢失！'); }
    } else {
      console.log('✅ 所有权限已存在');
    }
  }

  // ===== 修改 3：在 </activity> 之前插入文件 Intent-filter =====
  const VIEW_INTENT = 'android.intent.action.VIEW';
  const intentFilterStr = `
        <!-- 接收外部 JSON 文件：打开方式 / 分享 -->
        <intent-filter android:autoVerify="true">
            <action android:name="android.intent.action.VIEW" />
            <action android:name="android.intent.action.SEND" />
            <action android:name="android.intent.action.SEND_MULTIPLE" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:mimeType="application/json" />
            <data android:mimeType="application/octet-stream" />
            <data android:scheme="content" />
            <data android:scheme="file" />
        </intent-filter>`;
  {
    if (manifest.indexOf(VIEW_INTENT) === -1) {
      const activityClose = manifest.indexOf('</activity>');
      if (activityClose !== -1) {
        manifest = manifest.substring(0, activityClose) + `    ${intentFilterStr}\n    ` + manifest.substring(activityClose);
        console.log('✅ 文件 Intent-filter 已注入');
        modified = true;
        if (!verifyTag(manifest, '<application')) { hasError = true; console.error('  Intent-filter 插入后 <application 丢失！'); }
        if (!verifyTag(manifest, '</activity>')) { hasError = true; console.error('  Intent-filter 插入后 </activity> 丢失！'); }
      } else {
        console.warn('⚠️ 未找到 </activity>，跳过 Intent-filter');
      }
    } else {
      console.log('✅ Intent-filter 已存在');
    }
  }

  // ===== 最终校验 =====
  console.log('\n=== 最终校验 ===');
  if (!verifyTag(manifest, '<application'))   { hasError = true; }
  if (!verifyTag(manifest, '</application>')) { hasError = true; }
  if (!verifyTag(manifest, '<manifest'))      { hasError = true; }
  if (!verifyTag(manifest, '</manifest>'))    { hasError = true; }
  if (!verifyTag(manifest, '</activity>'))    { hasError = true; }

  // 检查 icon 属性仍在
  if (!manifest.includes('android:icon=')) {
    console.warn('⚠️ manifest 中未找到 android:icon 属性');
  } else {
    console.log('✅ android:icon 属性存在');
  }
  if (!manifest.includes('android:roundIcon=')) {
    console.warn('⚠️ manifest 中未找到 android:roundIcon 属性');
  } else {
    console.log('✅ android:roundIcon 属性存在');
  }

  if (hasError) {
    console.error('❌ 修改后 manifest 结构异常，不写文件！');
    console.error('   manifest 前 1000 字符:', manifest.substring(0, 1000));
    process.exit(1);
  }

  if (modified) {
    // ===== 输出改动 diff（unified 格式）=====
    console.log('\n=== manifest 改动内容 ===');
    const origLines = original.split('\n');
    const newLines = manifest.split('\n');
    let maxLen = Math.max(origLines.length, newLines.length);
    let diffCount = 0;
    for (let i = 0; i < maxLen; i++) {
      const o = origLines[i];
      const n = newLines[i];
      if (o !== n) {
        diffCount++;
        const lineNo = i + 1;
        if (o !== undefined) console.log(`  -L${lineNo}: ${o}`);
        if (n !== undefined) console.log(`  +L${lineNo}: ${n}`);
        if (diffCount > 50) {
          console.log(`  ... (还有 ${maxLen - i - 1} 行改动，省略)`);
          break;
        }
      }
    }
    if (diffCount === 0) {
      console.log('  (无内容变化)');
    }
    console.log('=== 改动结束 ===\n');

    fs.writeFileSync(manifestPath, manifest);
    console.log('✅ AndroidManifest.xml 已写回');
  } else {
    console.log('\nℹ️ manifest 无需修改，保持原样');
  }
} catch (e) {
  console.error('⚠️ AndroidManifest.xml 处理失败:', e.message);
  console.error(e.stack);
  hasError = true;
}

if (hasError) {
  console.warn('\n⚠️ 部分步骤失败');
  process.exit(1);
}
console.log('\n🎉 Android 工程配置完成');
process.exit(0);

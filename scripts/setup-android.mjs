#!/usr/bin/env node
/**
 * Android 工程生成后自动配置：
 *   1. 写入 ProGuard 规则文件
 *   2. 更新 AndroidManifest.xml（权限 + 文件 Intent + 图标引用）
 *
 * 原则：只追加/修改属性，绝不破坏 XML 结构
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

# 保留 Serializable / Parcelable（数据传输用）
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

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
    hasError = true;
  } else {
    let manifest = fs.readFileSync(manifestPath, 'utf-8');

    // --- 2a. 验证 manifest 结构完整性 ---
    const appTagMatches = manifest.match(/<application\s/g);
    if (!appTagMatches || appTagMatches.length === 0) {
      console.error('❌ manifest 无 <application> 标签，结构异常');
      hasError = true;
    } else if (appTagMatches.length > 1) {
      console.error('❌ manifest 有多个 <application> 标签，结构异常！');
      console.error('   标签位置:', manifest.split('<application').map((_, i) => i).join(', '));
      hasError = true;
    }

    // --- 2b. 确保有 icon 和 roundIcon 属性 ---
    const hasIcon = manifest.includes('android:icon=');
    const hasRoundIcon = manifest.includes('android:roundIcon=');

    // 找到 <application 标签并补充缺失的属性
    manifest = manifest.replace(
      /<application([^>]*)>/,
      (match, attrs) => {
        let newAttrs = attrs;
        if (!hasIcon && !newAttrs.includes('android:icon=')) {
          newAttrs += ' android:icon="@mipmap/ic_launcher"';
        }
        if (!hasRoundIcon && !newAttrs.includes('android:roundIcon=')) {
          newAttrs += ' android:roundIcon="@mipmap/ic_launcher_round"';
        }
        return `<application${newAttrs}>`;
      }
    );

    // --- 2c. 添加缺失的权限 ---
    const permissions = [
      '<uses-permission android:name="android.permission.INTERNET" />',
      '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
      '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />',
      '<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />',
      '<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />',
    ];
    const manifestTagMatch = manifest.match(/<manifest[^>]*>/);
    if (manifestTagMatch) {
      const manifestTag = manifestTagMatch[0];
      for (const perm of permissions) {
        if (!manifest.includes(perm)) {
          manifest = manifest.replace(manifestTag, `${manifestTag}\n    ${perm}`);
        }
      }
    }

    // --- 2d. 修改 allowBackup ---
    manifest = manifest.replace(
      'android:allowBackup="true"',
      'android:allowBackup="false"'
    );

    // --- 2e. 注入文件 Intent-filter ---
    const intentFilterBlock = `
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

    if (!manifest.includes('android.intent.action.VIEW')) {
      // 找到第一个 </activity> 前的位置插入
      manifest = manifest.replace(
        /(<\/activity>)/,
        `    ${intentFilterBlock}\n    $1`
      );
    }

    // --- 2f. 验证修改后结构仍正确 ---
    const finalAppTags = manifest.match(/<application\s/g);
    if (finalAppTags && finalAppTags.length !== 1) {
      console.error('❌ 修改后 manifest 结构异常（<application> 数量不对）');
      hasError = true;
    }

    fs.writeFileSync(manifestPath, manifest);
    console.log('✅ AndroidManifest.xml 已更新');
    console.log('   icon:', manifest.includes('android:icon="@mipmap/ic_launcher"') ? '已设置' : '未设置');
    console.log('   roundIcon:', manifest.includes('android:roundIcon="@mipmap/ic_launcher_round"') ? '已设置' : '未设置');
    console.log('   structure:', finalAppTags && finalAppTags.length === 1 ? '正常' : '异常');
  }
} catch (e) {
  console.error('⚠️ AndroidManifest.xml 更新失败:', e.message);
  hasError = true;
}

if (hasError) {
  console.warn('\n⚠️ 部分配置步骤失败（非致命，继续构建）');
}
console.log('\n🎉 Android 工程配置完成');
process.exit(0);

#!/usr/bin/env node
/**
 * Android 工程生成后自动配置（仅安全操作）：
 *   1. 写入 ProGuard 规则文件（纯文本，不影响 gradle 结构）
 *   2. 更新 AndroidManifest.xml 权限和备份设置
 *
 * 本脚本**绝对不修改 build.gradle**，签名配置通过 gradle.properties 注入。
 * 所有步骤均为非致命：单步失败只记录警告，不阻断后续步骤。
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

// ── 2. 修改 AndroidManifest.xml 添加权限 + 文件 Intent 处理 ──
try {
  const manifestPath = path.join(androidAppDir, 'src', 'main', 'AndroidManifest.xml');
  if (fs.existsSync(manifestPath)) {
    let manifest = fs.readFileSync(manifestPath, 'utf-8');
    const permissions = [
      '<uses-permission android:name="android.permission.INTERNET" />',
      '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
      '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />',
      '<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />',
      '<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />',
    ];
    for (const perm of permissions) {
      if (!manifest.includes(perm)) {
        manifest = manifest.replace('<application', `${perm}\n    <application`);
      }
    }
    manifest = manifest.replace(
      'android:allowBackup="true"',
      'android:allowBackup="false"'
    );

    // 注入文件 Intent-filter：接收外部 JSON 文件的"打开"和"分享"
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
      manifest = manifest.replace(
        /(<\/activity>)/,
        `    ${intentFilterBlock}\n    </activity>`
      );
    }

    fs.writeFileSync(manifestPath, manifest);
    console.log('✅ AndroidManifest.xml 已更新（权限 + 文件 Intent）');
  }

  // 确保 icon 属性指向 @mipmap/ic_launcher
  if (fs.existsSync(manifestPath)) {
    let m2 = fs.readFileSync(manifestPath, 'utf-8');
    if (!m2.includes('android:icon=')) {
      m2 = m2.replace(
        '<activity',
        '<application android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round" >\n        <activity'
      );
      fs.writeFileSync(manifestPath, m2);
      console.log('✅ AndroidManifest.xml icon 属性已设置');
    }
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

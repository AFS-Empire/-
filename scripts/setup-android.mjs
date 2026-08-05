#!/usr/bin/env node
/**
 * Android 工程生成后自动配置：
 *   1. 写入 ProGuard 规则文件
 *   2. 添加权限 + Intent-filter + allowBackup 修改
 *
 * 重要：绝不修改 <application> 标签！Capacitor 模板已正确设置 icon/roundIcon
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
    const original = manifest;

    // --- 2a. 验证 manifest 基本结构 ---
    const appStart = manifest.indexOf('<application');
    const appEnd = manifest.indexOf('</application>');
    if (appStart === -1 || appEnd === -1) {
      console.error('❌ manifest 缺少 <application> 标签，结构异常');
      hasError = true;
    } else {
      console.log('✅ <application> 标签存在');
    }

    // --- 2b. 确保 icon/roundIcon 属性存在（只补不删） ---
    // 找到 <application 标签内的最后一个属性前，插入缺失的属性
    if (appStart !== -1) {
      const appTagEnd = manifest.indexOf('>', appStart);
      const appTag = manifest.substring(appStart, appTagEnd + 1);

      const needIcon = !appTag.includes('android:icon=');
      const needRound = !appTag.includes('android:roundIcon=');

      if (needIcon || needRound) {
        // 找到 <application 标签的最后一个字符（>之前），插入属性
        let insertAttrs = '';
        if (needIcon) insertAttrs += ' android:icon="@mipmap/ic_launcher"';
        if (needRound) insertAttrs += ' android:roundIcon="@mipmap/ic_launcher_round"';

        manifest = manifest.substring(0, appTagEnd) + insertAttrs + manifest.substring(appTagEnd);
        console.log(`  补充属性:${needIcon ? ' android:icon' : ''}${needRound ? ' android:roundIcon' : ''}`);
      } else {
        console.log('✅ icon/roundIcon 属性已存在');
      }
    }

    // --- 2c. 在 <application> 标签之前插入缺失的权限 ---
    const permissions = [
      '<uses-permission android:name="android.permission.INTERNET" />',
      '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
      '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />',
      '<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />',
      '<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />',
    ];

    // 重新定位 appStart（因为 manifest 可能已被修改）
    const appStart2 = manifest.indexOf('<application');
    const permsToAdd = [];
    for (const perm of permissions) {
      if (!manifest.includes(perm)) {
        permsToAdd.push(perm);
      }
    }
    if (permsToAdd.length > 0) {
      manifest = manifest.substring(0, appStart2) + permsToAdd.map(p => `    ${p}`).join('\n') + '\n' + manifest.substring(appStart2);
      console.log(`  添加了 ${permsToAdd.length} 个权限`);
    } else {
      console.log('✅ 所有权限已存在');
    }

    // --- 2d. 修改 allowBackup ---
    if (manifest.includes('android:allowBackup="true"')) {
      manifest = manifest.replace('android:allowBackup="true"', 'android:allowBackup="false"');
      console.log('✅ allowBackup 已改为 false');
    } else {
      console.log('✅ allowBackup 已是 false 或不存在');
    }

    // --- 2e. 注入文件 Intent-filter ---
    if (!manifest.includes('android.intent.action.VIEW')) {
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

      const activityClose = manifest.indexOf('</activity>');
      if (activityClose !== -1) {
        manifest = manifest.substring(0, activityClose) + `    ${intentFilterBlock}\n    ` + manifest.substring(activityClose);
        console.log('✅ 文件 Intent-filter 已注入');
      } else {
        console.warn('⚠️ 未找到 </activity> 标签，跳过 Intent-filter 注入');
      }
    } else {
      console.log('✅ 文件 Intent-filter 已存在');
    }

    // --- 2f. 最终验证 ---
    const finalAppStart = manifest.indexOf('<application');
    const finalAppEnd = manifest.indexOf('</application>');
    if (finalAppStart === -1 || finalAppEnd === -1) {
      console.error('❌ 修改后 manifest 结构异常：<application> 标签丢失！');
      console.error('   manifest 内容前 500 字符:', manifest.substring(0, 500));
      hasError = true;
    } else {
      console.log('✅ 修改后 manifest 结构正常');
    }

    fs.writeFileSync(manifestPath, manifest);
    console.log('✅ AndroidManifest.xml 已更新');
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

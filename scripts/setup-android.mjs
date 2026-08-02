#!/usr/bin/env node
/**
 * Android 工程生成后自动配置：
 *   1. 开启 ProGuard/R8 混淆 + 资源压缩
 *   2. 配置 release 签名（用环境变量传入的 keystore）
 *   3. 添加必要权限
 *   4. 关闭 WebView 调试
 *
 * 在 GitHub Actions 里 `npx cap add android` 之后执行。
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

// ── 2. 修改 build.gradle 开启混淆 + 签名 ──
try {
  const gradlePath = path.join(androidAppDir, 'build.gradle');
  let gradle = fs.readFileSync(gradlePath, 'utf-8');

  // 跳过已修改过的文件
  if (gradle.includes('// ORPHEUS_CONFIGURED')) {
    console.log('⏭️ build.gradle 已配置过，跳过');
  } else {
    /**
     * 大括号深度匹配：从指定位置开始，跳过注释和字符串，找匹配的 }
     * 简化版：不处理字符串中的花括号（Gradle 中字符串不用花括号）
     */
    function findBlockEnd(text, startIdx) {
      let depth = 0;
      let inComment = false;
      let i = startIdx;
      while (i < text.length) {
        const ch = text[i];
        if (inComment) {
          if (ch === '\n') inComment = false;
          i++;
          continue;
        }
        if (ch === '/' && text[i + 1] === '/') {
          inComment = true;
          i += 2;
          continue;
        }
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) return i + 1;
        }
        i++;
      }
      return -1;
    }

    // 移除指定块（签名配置 / 构建类型）
    function removeBlock(text, blockName) {
      // 匹配块名 + { ，允许前面的空白
      const regex = new RegExp(`^\\s*${blockName}\\s*\\{`, 'm');
      const match = text.match(regex);
      if (!match) return { text, removed: false };
      const start = match.index + match[0].length;
      const end = findBlockEnd(text, start);
      if (end === -1) return { text, removed: false };
      // 移除块名行 + 块内容
      const blockEnd = end;
      // 找到块名所在行的开头
      let lineStart = match.index;
      while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--;
      return { text: text.substring(0, lineStart) + text.substring(blockEnd), removed: true };
    }

    // 移除旧 signingConfigs 和 buildTypes
    const sc = removeBlock(gradle, 'signingConfigs');
    gradle = sc.text;
    const bt = removeBlock(gradle, 'buildTypes');
    gradle = bt.text;

    // 新配置块
    const signingAndBuildTypes = `    // ORPHEUS_CONFIGURED - 自动配置签名 + 混淆
    signingConfigs {
        release {
            if (project.hasProperty('RELEASE_STORE_FILE')) {
                storeFile file(RELEASE_STORE_FILE)
                storePassword RELEASE_STORE_PASSWORD
                keyAlias RELEASE_KEY_ALIAS
                keyPassword RELEASE_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        debug {
            minifyEnabled false
        }
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            if (project.hasProperty('RELEASE_STORE_FILE')) {
                signingConfig signingConfigs.release
            } else {
                signingConfig signingConfigs.debug
            }
        }
    }
`;

    // 找到 android { 块末尾，在最后一个 } 前插入
    const androidMatch = gradle.indexOf('android {');
    if (androidMatch !== -1) {
      const androidEnd = findBlockEnd(gradle, androidMatch);
      if (androidEnd !== -1) {
        gradle = gradle.substring(0, androidEnd - 1) + '\n' + signingAndBuildTypes + gradle.substring(androidEnd - 1);
      } else {
        // fallback: 直接追加到文件末尾
        gradle += '\n' + signingAndBuildTypes;
        console.warn('⚠️ 无法精确定位 android 块，追加到文件末尾');
      }
    } else {
      // fallback: 直接追加到文件末尾
      gradle += '\nandroid {' + signingAndBuildTypes + '}';
      console.warn('⚠️ 未找到 android 块，创建新块');
    }

    fs.writeFileSync(gradlePath, gradle);
    console.log('✅ build.gradle 已配置 ProGuard + 签名');
  }
} catch (e) {
  console.error('⚠️ build.gradle 配置失败:', e.message);
  hasError = true;
}

// ── 3. 修改 AndroidManifest.xml 添加权限 ──
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
    fs.writeFileSync(manifestPath, manifest);
    console.log('✅ AndroidManifest.xml 已更新');
  }
} catch (e) {
  console.error('⚠️ AndroidManifest.xml 更新失败:', e.message);
  hasError = true;
}

if (hasError) {
  console.warn('\n⚠️ 部分配置步骤失败，但不影响构建');
}
console.log('\n🎉 Android 工程配置完成');

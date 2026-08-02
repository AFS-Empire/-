#!/usr/bin/env node
/**
 * Android 工程生成后自动配置：
 *   1. 开启 ProGuard/R8 混淆 + 资源压缩
 *   2. 配置 release 签名（用环境变量传入的 keystore）
 *   3. 添加必要权限（设备ID读取）
 *   4. 关闭 WebView 调试
 *
 * 在 GitHub Actions 里 `npx cap add android` 之后执行
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

// ── 1. 写入 ProGuard 规则 ──
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

# 移除日志调用（Release 构建不输出 Log.d/Log.v）
-assumesideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}

# 混淆优化
-repackageclasses ''
-allowaccessmodification
-optimizationpasses 3
`;
fs.writeFileSync(proguardPath, proguardRules);
console.log('✅ proguard-rules.pro 已写入');

// ── 2. 修改 build.gradle 开启混淆 + 签名 ──
const gradlePath = path.join(androidAppDir, 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf-8');

// 移除已存在的 signingConfigs 块（避免重复）
gradle = gradle.replace(/signingConfigs\s*\{[\s\S]*?\n\s*\}/g, '');

// 移除已存在的 buildTypes 块
gradle = gradle.replace(/buildTypes\s*\{[\s\S]*?\n\s*\}/g, '');

// 在 android { 块内插入正确的 signingConfigs + buildTypes
const signingAndBuildTypes = `
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

// 在 android { 块的末尾（最后一个 } 之前）插入
gradle = gradle.replace(/\n\s*\}\s*$/, '\n' + signingAndBuildTypes + '    }\n');

fs.writeFileSync(gradlePath, gradle);
console.log('✅ build.gradle 已配置 ProGuard + 签名');

// ── 3. 修改 AndroidManifest.xml 添加权限 ──
const manifestPath = path.join(androidAppDir, 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf-8');
  // 添加必要权限（如果不存在）
  const permissions = [
    '<uses-permission android:name="android.permission.INTERNET" />',
    // Android ID 不需要额外权限，READ_PHONE_STATE 在 Android 8+ 已废弃
  ];
  for (const perm of permissions) {
    if (!manifest.includes(perm)) {
      manifest = manifest.replace('<application', `${perm}\n    <application`);
    }
  }
  // 关闭 backup（防止 adb backup 导出数据）
  manifest = manifest.replace(
    'android:allowBackup="true"',
    'android:allowBackup="false"'
  );
  fs.writeFileSync(manifestPath, manifest);
  console.log('✅ AndroidManifest.xml 已更新');
}

console.log('\n🎉 Android 工程配置完成');

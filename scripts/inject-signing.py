#!/usr/bin/env python3
"""
在 build.gradle 中追加签名配置 + 代码混淆配置。
- 在 buildTypes{ 前面插入 signingConfigs{ release{ ... } }
- 在 release{ 后面插入 signingConfig signingConfigs.release
- 在 release{ 块内插入 minifyEnabled true / shrinkResources true / proguardFiles
幂等：已存在 ORPHEUS_SIGNING_CONFIGURED 标记时跳过。
"""
import sys, re, os

gradle_file = sys.argv[1]
content = open(gradle_file).read()

if "ORPHEUS_SIGNING_CONFIGURED" in content:
    print("⏭️ 签名+混淆配置已存在，跳过")
    sys.exit(0)

changed = False

# 1. 在 buildTypes { 前插入 signingConfigs {
bt_pattern = re.compile(r'^(\s*)buildTypes\s*\{', re.MULTILINE)
m = bt_pattern.search(content)
if m:
    indent = m.group(1)
    signing_block = f"""\
{indent}// ORPHEUS_SIGNING_CONFIGURED
{indent}signingConfigs {{
{indent}    release {{
{indent}        storeFile file(RELEASE_STORE_FILE)
{indent}        storePassword RELEASE_STORE_PASSWORD
{indent}        keyAlias RELEASE_KEY_ALIAS
{indent}        keyPassword RELEASE_KEY_PASSWORD
{indent}    }}
{indent}}}\n
"""
    content = content[:m.start()] + signing_block + content[m.start():]
    changed = True
    print("✅ signingConfigs 已插入")
else:
    print("⚠️ 未找到 buildTypes 块")

# 2. 在 buildTypes { release { 后面插入 signingConfig + minifyEnabled + shrinkResources
rel_pattern = re.compile(r'(buildTypes\s*\{\s*\n\s*release\s*\{)')
m2 = rel_pattern.search(content)
if m2:
    line_start = m2.end()
    insert = (
        '\n            signingConfig signingConfigs.release'
        '\n            minifyEnabled true'
        '\n            shrinkResources true'
        '\n            proguardFiles getDefaultProguardFile(\'proguard-android-optimize.txt\'), \'proguard-rules.pro\''
    )
    content = content[:line_start] + insert + content[line_start:]
    changed = True
    print("✅ signingConfig + minifyEnabled + shrinkResources 已插入")
else:
    print("⚠️ 未找到 buildTypes.release 块")

if changed:
    with open(gradle_file, "w") as f:
        f.write(content)
    print("🎉 build.gradle 签名+混淆注入完成")
else:
    print("⚠️ 未做任何修改")
    sys.exit(1)

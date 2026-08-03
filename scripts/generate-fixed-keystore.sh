#!/bin/bash
# ============================================
# 生成固定签名密钥脚本
# 用于确保每次 APK 构建签名一致，保留用户数据
# ============================================

set -e

echo "=========================================="
echo "   奥菲斯档案馆 · 生成固定签名密钥"
echo "=========================================="
echo ""

KEYSTORE_NAME="orpheus-release-key.jks"
KEY_ALIAS="orpheus"
STORE_PASS="OrpheusArchive2026"
KEY_PASS="OrpheusArchive2026"
VALIDITY=36500  # 有效期100年

echo "📌 注意：这个密钥非常重要！"
echo "   - 请妥善保存生成的 ${KEYSTORE_NAME} 文件"
echo "   - 以后所有版本都必须使用这同一个密钥"
echo "   - 如果丢失，旧用户的数据将无法保留"
echo ""

# 检查是否已存在
if [ -f "$KEYSTORE_NAME" ]; then
    read -p "⚠️  ${KEYSTORE_NAME} 已存在，是否覆盖？(y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "已取消。"
        exit 0
    fi
fi

# 生成密钥
echo ""
echo "🔐 正在生成密钥..."
keytool -genkey -v \
    -keystore "$KEYSTORE_NAME" \
    -storetype JKS \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity "$VALIDITY" \
    -storepass "$STORE_PASS" \
    -keypass "$KEY_PASS" \
    -dname "CN=AFS-JZY, OU=Archive, O=OrpheusEmpire, L=Unknown, ST=Unknown, C=CN"

echo ""
echo "✅ 密钥生成成功：${KEYSTORE_NAME}"
ls -lh "$KEYSTORE_NAME"

# 转换为 Base64 方便传输
echo ""
echo "=========================================="
echo "  下一步：将密钥上传到 GitHub Secrets"
echo "=========================================="
echo ""
echo "1. 复制下面这一行长长的字符串（这就是密钥内容）："
echo ""
base64 -w0 "$KEYSTORE_NAME" > /tmp/keystore-base64.txt
wc -c /tmp/keystore-base64.txt
echo ""
echo "💡 提示：Base64 内容已保存到 /tmp/keystore-base64.txt"
echo "   您可以用编辑器打开它，然后全选复制"
echo ""
echo "2. 打开 GitHub 仓库 → Settings → Secrets and variables → Actions"
echo ""
echo "3. 点击 [New repository secret]，填写："
echo "   Name:   ANDROID_KEYSTORE_BASE64"
echo "   Value:  （粘贴刚才复制的 Base64 字符串）"
echo ""
echo "4. 点击 [Add secret] 保存即可！"
echo ""
echo "=========================================="
echo "  保存的密码信息（请勿修改，与代码中一致）："
echo "   Store Password: ${STORE_PASS}"
echo "   Key Password:   ${KEY_PASS}"
echo "   Alias:          ${KEY_ALIAS}"
echo "=========================================="

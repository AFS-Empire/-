# 打包说明（极简版）

## 一、装环境（只做一次）

1. 装 **Node.js**：https://nodejs.org/ 选 LTS 版，一路下一步
2. 装 **Android Studio**（只打 APK 才需要）：https://developer.android.com/studio

## 二、打包（3 条命令）

把 `worldarchive` 文件夹拷到电脑，终端进目录：

```bash
cd worldarchive
npm install            # 装依赖，3-5 分钟（已配国内镜像）
```

### 打 Windows 安装包
```bash
npm run build:win
```
→ 完成后看 `release/` 文件夹，双击 `.exe` 安装

### 打安卓 APK
```bash
npm run cap:add:android    # 第一次才要，初始化安卓工程
npm run build:android
```
→ 完成后 APK 在 `android/app/build/outputs/apk/release/app-release.apk`，传手机安装

## 三、数据互通（电脑↔手机）

- **电脑→手机**：电脑端侧边栏「备份」→ 生成 JSON → 微信发自己 → 手机端「恢复」选这个文件
- **手机→电脑**：手机端「备份」→ 系统分享面板发微信 → 电脑接收 → 电脑端「恢复」

## 四、升级 App（数据不丢）

直接装新版覆盖旧版即可，数据自动保留。
底层架构大改时，先「备份」导出 JSON，装完新版再「恢复」。

---

**卡住了？** 把终端报错截图发我，我帮你看。

# 奥菲斯帝国档案馆 · AFS-JZY

> 帝国已存续万年。历史是它的痕迹，也是它的面容。此间记录，即为秩序的回声。
>
> — **奥菲斯·龙岩**

AFS-JZY 出品的世界观档案管理系统。纯前端 SPA + IndexedDB 本地存储，三端可用：

| 端 | 形态 | 数据存储 | 导入/导出方式 |
|---|---|---|---|
| 🌐 Web | 浏览器 / PWA（可「添加到主屏幕」当 App 用） | 浏览器 IndexedDB（沙箱里） | 浏览器下载 JSON 文件 / 文件选择器导入 / 手机浏览器系统分享面板 |
| 🤖 移动 App | Capacitor 壳打包的 Android APK | App 私有目录 + IndexedDB | 系统分享面板把 JSON 发到微信/QQ/网盘；系统文件选择器选 JSON 导入 |
| 🖥️ 桌面 App | Electron 壳打包的 Windows/macOS/Linux 可执行文件 | 系统用户目录（userData）下的 JSON + 自动备份历史 | 真正的系统「另存为」对话框 / 「打开」对话框 |

---

## 快速开始（本地开发）

```bash
npm install
npm run dev      # 启动 http://localhost:5173
```

默认管理员账号（首次启动自动创建，改密后即可）：

| 账号 | 密码 | 角色 |
|---|---|---|
| `1360335662@qq.com` | `AFS—JZY` | admin |

> 密码哈希用 **PBKDF2-SHA256 · 10 万次迭代加盐**。动态 PIN 基于 30 秒窗口 + 私有盐（AFS-JZY::1360335662::ophis::archive），仅管理员能导出/导入。

---

## B 方案 · 网页版一键部署（你要做的操作不到 3 分钟）

代码里已经写好 `vercel.json` 和 `netlify.toml`，你**选一个平台**，点一下按钮就完成，不需要改任何配置。

### 方式 1：Vercel（推荐，国内访问更快一点）

1. 把整个 `worldarchive` 文件夹推到 GitHub 上（新建一个 Public 或 Private 仓库都行）
   - 不会推？最傻瓜方式：GitHub 网页端 → 右上角 `+` → `New repository` → 勾上 "Add a README file" 不用勾，直接 Create → 进去点 **"uploading an existing file"** → 把 `worldarchive` 里所有文件（除了 `node_modules`、`dist`、`dist-electron`，这些 `.gitignore` 已经帮你排除了）拖进去 → 绿色按钮 Commit changes。
2. 浏览器打开 <https://vercel.com/new>
3. 点 **"Add GitHub Account"** 给它权限访问你刚建的仓库
4. 选中仓库 → 点 **Import**
5. **所有配置都不用改**（`vercel.json` 已经把框架、Build Command、Output Directory、SPA rewrite、缓存头都配好了），直接点 **Deploy**
6. 等大约 1~2 分钟，它会给你一个地址，形如 `https://你的项目名.vercel.app`
7. 用手机浏览器打开这个地址，**导入/导出会真的触发系统权限弹窗**（不再是预览卡片的阉割版）

### 方式 2：Netlify（备选，同样 1 分钟）

1. 同样先把代码推到 GitHub
2. 打开 <https://app.netlify.com/drop>
3. 有两种方式：
   - **最简单（不用连 GitHub）**：在本地运行 `npm run build`，会生成 `dist` 文件夹，把整个 `dist` 文件夹拖到那个网页里的虚线框，它立刻给你一个公网地址。缺点是以后更新要重新拖。
   - **可持续部署**：点顶部 `Sites` → `Add new site` → `Import an existing project` → 选 GitHub → 选仓库 → Deploy。配置它会自动读 `netlify.toml`，不用改。

### Web 版上手机怎么装成 App？（PWA）

用 Chrome / Safari 打开部署好的地址：

- **安卓 Chrome**：右上角菜单 ⋮ → **"添加到主屏幕" / "安装应用"**
- **iOS Safari**：底部分享按钮 → **"添加到主屏幕"**

之后主屏就有「帝国档案」图标，点进去是全屏独立 App、离线也能打开（IndexedDB 数据留在本地）。

### 注意：Web 版数据只存在本机浏览器

Web 版（Vercel/Netlify 那个）虽然部署在公网，但**所有档案数据 100% 存在你自己设备的 IndexedDB 沙箱里**，服务器上什么都不留。
你清浏览器缓存就没了，所以一定要记得**导出备份 JSON 到网盘或微信文件传输助手**。

---

## C 方案 · 打包成独立 Android APK（真 App，不依赖浏览器）

前置：需要一台有 **Android Studio** 或 **JDK 17+** 的电脑（等你有稳定环境了再做）。Capacitor 依赖已装好，命令也已经写在 `package.json`：

```bash
# 1. 先确保 Web 资源能打包
npm run build

# 2. 第一次：生成 android 目录（把 web 资源同步到壳里）
npm run cap:add:android

# 2. 之后每次更新 Web 代码，只需要执行
npm run cap:sync

# 3a. 连上安卓手机开开发者调试，直接装到手机里
npm run cap:run:android

# 3b. 或者打 Release APK（没签名的 release 包，需要自己用 apksigner 签名）
npm run build:android
# 产物路径：android/app/build/outputs/apk/release/app-release.apk
```

签名（装到没开调试的手机上必须）：

```bash
# 生成一次签名证书（记住密码，丢了没法更新）
keytool -genkey -v -keystore archive-keystore.keystore -alias archive -keyalg RSA -keysize 2048 -validity 36500

# 给 APK 签名
apksigner sign --ks archive-keystore.keystore --ks-key-alias archive \
  --out 奥菲斯帝国档案馆-v1.0.0.apk \
  android/app/build/outputs/apk/release/app-release-unsigned.apk
```

桌面 App（Windows/macOS/Linux）同理：

```bash
npm run build:win      # 产物 release/奥菲斯帝国档案馆-1.0.0-win-x64.exe
npm run build:mac
npm run build:linux
```

---

## 为什么预览卡片里导入/导出没反应？是代码错了吗？

**不是代码的问题，是平台的预览卡片把文件权限阉割了。**

- 导入按钮用的是原生 `<input type="file" accept=".json">`——真浏览器点下去，手机上一定会弹出「选择文件」/「照片和媒体」/「使用相机」那套权限选择 + 文件选择器。
- 导出按钮用的是 `Blob` + `<a download>` 下载，以及手机浏览器的 `navigator.share` 系统分享——真浏览器里会弹出「下载到本地」/「发送给朋友」面板。
- 预览卡片本质是一个沙箱 iframe，被平台加了 `sandbox="allow-scripts allow-same-origin"` 之类的属性，**禁用了文件选择、下载弹窗、系统分享**，所以你点了就像模型机上按电源键——按得到，但开不了机。

把项目部署到 Vercel / Netlify 之后，或者用 Capacitor 打包成 APK 之后，这些流程**全部会正常触发系统权限对话框**，跟你图片里展示的那种一样。

---

## 项目结构速览

```
worldarchive/
├─ public/
│  ├─ favicon.svg              应用图标
│  ├─ icons.svg / runes.svg    装饰素材
│  └─ manifest.webmanifest     PWA 安装清单（署名 AFS—JZY）
├─ src/
│  ├─ pages/                   一级/二级页面（Home / Login / Character / Geography / Timeline / Milestone / Tech / EntryEditor / EntryDetail / Custom / CommentOverview / AllIndex / About）
│  ├─ components/
│  │  ├─ BackupBar.tsx         导出/导入工具栏（三端兼容：桌面IPC / 移动系统分享 / 浏览器下载）
│  │  ├─ PinDialog.tsx         6 位动态 PIN 二次校验弹窗
│  │  ├─ Layout.tsx            顶部导航 + 面包屑 + 安全水印
│  │  └─ Skeleton.tsx          骨架屏占位
│  ├─ data/
│  │  ├─ db.ts                 IndexedDB 全量导出 / 导入（idb 库封装）
│  │  └─ seed.ts               默认管理员种子（1360335662@qq.com / AFS-JZY）
│  ├─ lib/
│  │  ├─ crypto.ts             PBKDF2-SHA256 + HMAC-SHA256 纯 JS 实现 + 动态 PIN 计算 + 回退 native crypto.subtle
│  │  ├─ mobile.ts             Capacitor 移动端适配层（状态栏 / 安卓返回键 / 系统分享 / 文件选择）
│  │  └─ watermark.ts          安全水印（用户名+时间，截图溯源）
│  ├─ hooks/useRipple.ts       金色点击涟漪（事件委托全局监听）
│  ├─ store/                   Zustand 状态（认证 / 档案 / 评论）
│  ├─ index.css                Tailwind v4 + 金色主题 + 动画（pageEnter/ripple/skeletonPulse）
│  ├─ App.tsx                  路由 + Suspense 切换 + 登录守卫
│  └─ main.tsx                 入口 + 初始化移动端适配
├─ electron/                   桌面端壳（main.ts + preload.ts 注入 archiveApp）
├─ index.html                  PWA meta / manifest / theme-color
├─ vite.config.ts              Vite 配置（Release 模式下 alias 调试模块为 noop 移除旁路）
├─ capacitor.config.json       Capacitor 配置（com.orpheus.archive，署名 AFS—JZY）
├─ vercel.json                 ★ Vercel 一键部署配置
├─ netlify.toml                ★ Netlify 一键部署配置
└─ package.json                所有 npm scripts（dev/build/build:android/build:win 等）
```

---

## Release 发布（正式版去掉调试模块）

生产构建时加 `ARCHIVE_RELEASE=1` 环境变量，Vite 会在编译期把 `src/debug/devTools.ts` **整个 alias 为空实现 `devTools.noop.ts`**，调试 PIN、后门开关这些代码直接从 bundle 里消失，避免静态分析拆壳拿到：

```bash
# 网页版正式发布（Vercel/Netlify 建议配在平台环境变量里）
ARCHIVE_RELEASE=1 npm run build

# 打包 APK / 桌面 App 时也建议带
ARCHIVE_RELEASE=1 npm run build:android
ARCHIVE_RELEASE=1 npm run build:win
```

Vercel 上配置：项目 → Settings → Environment Variables → Add New：`Key = ARCHIVE_RELEASE`，`Value = 1`，Production 勾上 → Save。重新 Deploy 即可。

---

## 署名 / 联系方式

- 产品：**奥菲斯帝国档案馆**
- 署名：**AFS—JZY**
- 联系：[1360335662@qq.com](mailto:1360335662@qq.com)

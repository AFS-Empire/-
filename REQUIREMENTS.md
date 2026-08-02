# 奥菲斯帝国档案馆 - 项目需求备忘录

> **此文件为 AI 助手上下文恢复用的持久化需求记录。**
> 每次对话开始时，AI 助手应先读取此文件，确保不丢失用户的核心要求。
> 每次用户提出新要求后，AI 助手应更新此文件并提交到仓库。

---

## 一、项目概述

- **项目名称**：奥菲斯帝国档案馆（Orpheus Archive）
- **类型**：Android 本地离线应用（Capacitor + React + TypeScript）
- **设计风格**：黑底鎏金（深色背景 #0d0d0f，金色文字 #d4a857/#e8d5b7，渐变装饰，圆角面板）
- **数据存储**：IndexedDB 本地存储，无需联网
- **仓库地址**：https://github.com/AFS-Empire/-
- **Netlify 域名**：https://afs-jzy-archive.netlify.app

## 二、用户核心要求（必须遵守）

### 1. 禁止使用安卓系统原生弹窗
- **禁止**使用 `alert()`、`confirm()`、`prompt()` 等 Web 原生对话框
- **禁止**在 UI 层直接用 `<input type="file">` 触发系统文件选择器（在 WebView 中会显示老旧白色卡片）
- **必须**统一使用项目自研的 Dialog 组件（`src/components/Dialog.tsx`）
- **必须**通过统一平台层调用文件能力（见下方平台分层规定），禁止直接写原生 DOM 文件选择逻辑
- 所有弹窗必须匹配项目黑底鎏金设计风格

### 2. 输入框光标问题
- Android WebView 中受控输入（`value` + `onChange`）会导致光标跳到末尾
- **必须**使用非受控模式：`defaultValue` + `ref` + `onBlur`/保存时读取
- 参考实现：`src/pages/EntryEditor.tsx` 中的 `useTextField` hook

### 3. 数据安全
- 强制刷新**不能**清空用户数据
- **禁止**使用 `window.location.reload()`
- **必须**使用 `dataStore.refresh()` 软刷新

### 4. 代码备份
- 每次修改完成后**必须** `git commit` + `git push` 到 GitHub
- 用户要求记录在此文件中，防止 AI 上下文压缩后丢失
- 每次有新要求时更新此文件

### 5. 代码架构分层（强制规定）
**禁止**在业务代码（page/component/store 目录）中写平台混用的 `if (isWeb) {...} else {...}` 双份逻辑。

#### 三层目录：
| 层级 | 路径 | 职责 | 允许的 API |
|---|---|---|---|
| 公共通用层 | `src/types` `src/data` `src/store` `src/components` `src/lib`(不含`filePicker.ts`/`mobile.ts`/`machineBinding.ts`) | 双端完全通用逻辑 | 纯 TS、React、Zustand、idb — 禁止 Capacitor 引用；禁止平台 if-else |
| 网页专属层 | `src/platform/web.ts` | 浏览器端能力实现 | 纯 DOM/BOM API（Blob、FileReader、a.click()、navigator.share） — 禁止 Capacitor |
| App 专属层 | `src/platform/app.ts` | 安卓 App 能力实现 | 仅 Capacitor 插件（Camera/Filesystem/Share/Device/StatusBar/NavigationBar 等） — 禁止浏览器独有下载逻辑 |
| 统一入口 | `src/platform/index.ts` | 平台选择与导出 | 业务代码**唯一**的平台调用入口 |

#### 业务代码唯一合法的平台能力调用方式：
```ts
import { platform } from '../platform';
platform.saveFile('backup.json', json, 'application/json');
platform.bindMachine();   // 网页端会自动走 NO-OP，无需判断
platform.pickImage();     // App 端走 Camera，Web 端走 input
```

#### 双重隔离保障：
1. **编译时**：Vite 通过 `IS_WEB_BUILD` 常量 Tree Shaking 掉另一平台代码（web 构建不含任何 Capacitor 代码）
2. **运行时**：Capacitor 原生检测做二次兜底，防止编译配置弄错

#### 打包命令：
| 命令 | 输出 | 用途 |
|---|---|---|
| `npm run build:web` | `dist/` 网页静态产物 | Netlify 部署（网页端） |
| `npm run build:android` | `android/app/build/outputs/apk/release/` APK | 本地 Capacitor 打包（App 端） |
| `npm run build` | Electron 产物 | 桌面端（保留） |

#### 旧库文件处理（过渡期注意）：
以下旧文件目前保留但不再被业务层直接引用。如需彻底删除，请先确认 grep 显示 0 结果后再执行：
- `src/lib/filePicker.ts` — 已由 `platform` 合并
- `src/lib/mobile.ts` — 已由 `platform/app.ts` + `platform/web.ts` 合并
- `src/lib/machineBinding.ts` — 已由 `platform/app.ts`（真实实现）+ `platform/web.ts`（NO-OP）合并

### 6. APK 分发
- GitHub Releases 自动构建（主渠道）
- Netlify 备份渠道：APK 放在 `afs-jzy-archive.netlify.app/apk/` 子目录
- GitHub 下载可能因网络问题不可用，Netlify 作为备份
- Netlify Token 需要用户手动提供（存为 GitHub Secrets 的 `NETLIFY_AUTH_TOKEN` + `NETLIFY_SITE_ID`）

## 三、技术栈

- **前端框架**：React 19 + TypeScript
- **路由**：React Router DOM 7
- **状态管理**：Zustand
- **样式**：Tailwind CSS 4
- **移动端**：Capacitor 6（Android）
- **存储**：IndexedDB（idb 库）
- **图标**：lucide-react
- **构建**：Vite
- **CI/CD**：GitHub Actions（自动构建 APK + 发布 Release + 部署 Netlify）

## 四、已修复的问题记录

| 日期 | 问题 | 修复方案 |
|------|------|----------|
| 2026-08-02 | 原生对话框导致黑屏 | 替换为自定义 Dialog 组件 |
| 2026-08-02 | 输入光标跳到末尾 | 改为非受控输入模式 |
| 2026-08-02 | 强制刷新清空数据 | 改为 dataStore.refresh() 软刷新 |
| 2026-08-02 | 导出给网页链接 | 修复 isMobileApp() 检测，使用 Capacitor Share |
| 2026-08-02 | 导入文件栏空白 | 移除 accept 限制，添加存储权限 |
| 2026-08-02 | input[type=file] 触发老弹窗 | 改用 Capacitor Camera/Filesystem 插件 |
| 2026-08-02 | 网页端/App 端代码耦合混杂 | 三层架构拆分 common/platform.web/platform.app + 统一 platform/index.ts 入口 |

## 五、待办/已知问题

- [ ] Netlify secrets 需要用户配置（NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN）到 GitHub → Settings → Secrets and variables → Actions → New repository secret
- [ ] GitHub 下载在用户网络环境下可能不可用（需用 Netlify 备份渠道）
- [ ] 图片多选在移动端只能逐张选择（Capacitor Camera 插件限制）

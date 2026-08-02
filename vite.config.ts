import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'

// Release 构建：用环境变量 ARCHIVE_RELEASE=1 触发
// 把调试模块替换为 noop，彻底从产物中移除安全旁路代码
const isRelease = process.env.ARCHIVE_RELEASE === '1'

// 网页浏览版：VITE_BUILD_TARGET=web 触发
// 管理员登录代码从编译产物中移除，只保留游客浏览 + 隐藏导入导出
const isWebBuild = process.env.VITE_BUILD_TARGET === 'web'

// 绝对路径辅助
const abs = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig(({ mode }) => {
  // loadEnv 读取 .env / .env.local / .env.[mode]，不会泄露到客户端
  // 只有显式以 VITE_ 前缀才会暴露给前端代码
  const env = loadEnv(mode, process.cwd(), '')

  // 盐值仅 App/桌面构建需要注入；Web 构建强制为空（appSecret.web.ts 已兜底）
  // 优先级：process.env（CI 注入）> loadEnv（.env.local 本地开发）
  const archiveSalt = isWebBuild
    ? ''
    : (process.env.VITE_ARCHIVE_SALT || process.env.ARCHIVE_PRIVATE_SALT || env.ARCHIVE_PRIVATE_SALT || env.VITE_ARCHIVE_SALT || '')

  return {
    plugins: [react(), tailwindcss()],
    // Release 构建时：调试模块 alias 到空实现，编译期移除所有旁路代码
    // Web 构建时：appSecret.ts → appSecret.web.ts，盐值从产物中彻底消失
    resolve: {
      alias: [
        ...(isRelease
          ? [{ find: /^.*devTools$/, replacement: abs('./src/debug/devTools.noop.ts') }]
          : []),
        ...(isWebBuild
          ? [{ find: /^.*appSecret$/, replacement: abs('./src/lib/appSecret.web.ts') }]
          : []),
      ],
    },
    define: {
      __DEBUG_BUILD__: JSON.stringify(!isRelease),
      // 网页版编译时注入，组件里通过 import.meta.env.VITE_BUILD_TARGET 读取
      'import.meta.env.VITE_BUILD_TARGET': JSON.stringify(isWebBuild ? 'web' : 'app'),
      // 盐值在构建时内联为常量；Web 构建强制空字符串
      'import.meta.env.VITE_ARCHIVE_SALT': JSON.stringify(archiveSalt),
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
    },
  }
})

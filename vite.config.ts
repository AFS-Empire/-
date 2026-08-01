import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Release 构建：用环境变量 ARCHIVE_RELEASE=1 触发
// 把调试模块替换为 noop，彻底从产物中移除安全旁路代码
const isRelease = process.env.ARCHIVE_RELEASE === '1'

// 网页浏览版：VITE_BUILD_TARGET=web 触发
// 管理员登录代码从编译产物中移除，只保留游客浏览 + 隐藏导入导出
const isWebBuild = process.env.VITE_BUILD_TARGET === 'web'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Release 构建时：调试模块 alias 到空实现，编译期移除所有旁路代码
  resolve: {
    alias: isRelease
      ? [{ find: /^.*devTools$/, replacement: new URL('./src/debug/devTools.noop.ts', import.meta.url).pathname }]
      : [],
  },
  define: {
    __DEBUG_BUILD__: JSON.stringify(!isRelease),
    // 网页版编译时注入，组件里通过 import.meta.env.VITE_BUILD_TARGET 读取
    'import.meta.env.VITE_BUILD_TARGET': JSON.stringify(isWebBuild ? 'web' : 'app'),
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})

/**
 * 构建目标控制
 *
 * VITE_BUILD_TARGET=web  → 网页浏览版（无管理员登录，纯浏览 + 隐藏导入导出）
 * VITE_BUILD_TARGET=app  → 完整版（管理员登录 + 所有编辑功能）
 *
 * 用法：
 * - 在组件里 import { IS_WEB_BUILD } from '../lib/buildTarget'
 * - if (IS_WEB_BUILD) { ... 网页版逻辑 ... }
 *
 * Vite 在编译时会把 import.meta.env.VITE_BUILD_TARGET 替换为字符串字面量，
 * 如果设为 'web'，所有 IS_WEB_BUILD === false 的分支会被 Tree Shaking 移除。
 */
export const IS_WEB_BUILD: boolean = import.meta.env.VITE_BUILD_TARGET === 'web';

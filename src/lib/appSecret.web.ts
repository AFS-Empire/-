/**
 * 网页端盐值空实现
 *
 * 网页构建时 appSecret.ts → appSecret.web.ts（通过 vite alias 替换）
 * 网页产物中不存在任何盐值，只有算法
 */
export const APP_PRIVATE_SALT = '';

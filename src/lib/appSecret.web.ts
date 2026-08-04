/**
 * 网页端密钥空实现
 *
 * 网页构建时 appSecret.ts → appSecret.web.ts（通过 vite alias 替换）
 * 网页产物中不存在任何密钥，只有算法。
 *
 * 三段式命名与 appSecret.ts 对齐（均为空字符串）：
 *  - APP_INSTALL_KEY_A   网页端无设备绑定概念
 *  - APP_OPERATION_KEY_B 网页端无写操作（纯浏览）
 *  - APP_DATA_SALT       网页端验签密钥由用户输入（sessionKey），不内置
 */
export const APP_INSTALL_KEY_A = '';
export const APP_OPERATION_KEY_B = '';
export const APP_DATA_SALT = '';

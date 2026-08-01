/**
 * 原创标记与数字水印
 *
 * 三处分散植入策略：
 * 1. 全局常量（main.tsx 挂载到 window）—— 前端不可见，但 F12 能看到
 * 2. 字符串拆分水印（本文件）—— 把署名拆成多段，散落在不同函数里
 * 3. 导出 JSON 内嵌水印（exportAll 调用）—— 永久写入备份文件
 *
 * 注意：纯前端环境下标记无法防"系统性反编译清除"，
 * 但能防"简单改界面/改 package.json 名字"的盗用，并作为事后举证证据链。
 */

/** 创作者署名（完整） */
export const CREATOR = 'AFS—JZY';
/** 联系方式 */
export const CONTACT = '1360335662@qq.com';
/** 项目版权声明 */
export const COPYRIGHT = '© 2026 奥菲斯帝国档案馆 · 保留所有权利';

/**
 * 拆分水印 —— 把署名拆成多段，散落在不同函数里拼接
 * 盗用者要清除必须逐行读代码找到所有片段
 */
const _w1 = 'A';
const _w2 = 'F';
const _w3 = 'S';
const _w4 = 'J';
const _w5 = 'Z';
const _w6 = 'Y';

/** 隐式拼接函数（不直接返回署名，增加静态分析难度） */
function _compose(): string {
  return [_w1, _w2, _w3, '—', _w4, _w5, _w6].join('');
}

/**
 * 生成导出 JSON 的水印对象
 * 嵌入到备份文件的元数据里，作为"这份档案源自本项目"的举证
 */
export function buildExportWatermark(): Record<string, string> {
  return {
    _copyright: COPYRIGHT,
    _author: _compose(),
    _contact: CONTACT,
    _source: 'ophis-archive',
    _watermark_version: '1.0',
  };
}

/**
 * 校验导入的 JSON 是否包含本项目水印
 * 返回 true 表示是本项目导出的档案
 */
export function verifyImportWatermark(data: unknown): { hasWatermark: boolean; author?: string } {
  if (!data || typeof data !== 'object') return { hasWatermark: false };
  const obj = data as Record<string, unknown>;
  const author = obj._author;
  const copyright = obj._copyright;
  // 只要包含任一标记字段且内容匹配，就认为是本项目导出的
  if (typeof author === 'string' && author === _compose()) {
    return { hasWatermark: true, author };
  }
  if (typeof copyright === 'string' && copyright === COPYRIGHT) {
    return { hasWatermark: true };
  }
  return { hasWatermark: false };
}

/**
 * 给 Array.prototype 挂一个不可枚举的符号属性
 * 作为隐形标记，普通的 for...in / JSON.stringify 都看不到
 * 只有用 Object.getOwnPropertySymbols 才能发现
 */
const ARCHIVE_MARK = Symbol('ophis_archive_mark');

export function installHiddenMark(): void {
  try {
    if (typeof Array === 'undefined') return;
    // 防止重复安装
    if ((Array.prototype as any)[ARCHIVE_MARK]) return;
    Object.defineProperty(Array.prototype, ARCHIVE_MARK, {
      value: `${_compose()}|${CONTACT}`,
      writable: false,
      configurable: false,
      enumerable: false,
    });
  } catch {
    // 某些环境可能禁止修改原型，忽略错误
  }
}

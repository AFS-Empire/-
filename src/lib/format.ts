/**
 * 格式化工具函数
 */

/** 格式化时间戳为中文日期字符串 */
export function fmtTime(t: number): string {
  return new Date(t).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

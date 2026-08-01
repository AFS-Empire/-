/**
 * 点击涟漪 —— 全局事件委托
 *
 * 在根节点监听 click，凡匹配选择器的可点击元素（按钮 + 卡片）
 * 都会在点击位置插入一个 .ripple span，CSS 负责扩散动画，动画结束自动移除。
 *
 * 用事件委托而非给每个按钮绑事件，避免组件里到处写 onClick。
 * 只需在 App 挂载时调用一次 useRipple()。
 */
import { useEffect } from 'react';

// 覆盖所有按钮类 + 可点击的卡片类（首页三大入口、统计卡片、条目卡片等）
const RIPPLE_SELECTORS = '.btn-gold, .btn-ghost, .btn-outline, .card-entry, .panel-gold[role="button"], .panel[role="button"], button.panel-gold, button.panel';

export function useRipple(): void {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.(RIPPLE_SELECTORS) as HTMLElement | null;
      if (!target) return;
      // 保险：直接在元素上保证定位上下文 + 裁剪，不依赖 CSS 是否声明
      if (getComputedStyle(target).position === 'static') target.style.position = 'relative';
      if (getComputedStyle(target).overflow !== 'hidden') target.style.overflow = 'hidden';
      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      // 类名用 ripple-fx（定义在 effects.css，独立于 Tailwind 管线，保证生效）
      const span = document.createElement('span');
      span.className = 'ripple-fx';
      span.style.width = `${size}px`;
      span.style.height = `${size}px`;
      span.style.left = `${x}px`;
      span.style.top = `${y}px`;
      target.appendChild(span);
      span.addEventListener('animationend', () => span.remove(), { once: true });
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);
}

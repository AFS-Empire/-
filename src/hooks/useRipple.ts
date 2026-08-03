import { useEffect } from 'react';

const RIPPLE_SELECTORS = '.btn-gold, .btn-ghost, .btn-outline, .card-entry, .panel-gold[role="button"], .panel[role="button"], button.panel-gold, button.panel';

export function useRipple(): void {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.(RIPPLE_SELECTORS) as HTMLElement | null;
      if (!target) return;

      // 限制：同一个按钮同时最多保留 2 个涟漪元素，避免快速点击时 DOM 堆积
      const existing = target.querySelectorAll(':scope > .ripple-fx');
      if (existing.length >= 2) {
        existing.forEach((n, i) => i < existing.length - 1 && n.remove());
      }

      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      const span = document.createElement('span');
      span.className = 'ripple-fx';
      span.style.width = `${size}px`;
      span.style.height = `${size}px`;
      span.style.left = `${x}px`;
      span.style.top = `${y}px`;
      target.appendChild(span);

      // 双保险清理：animationend + 硬超时兜底（Android WebView animationend 可能不触发）
      const cleanup = () => {
        if (span.parentNode) span.remove();
      };
      span.addEventListener('animationend', cleanup, { once: true });
      setTimeout(cleanup, 900);
    };

    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);
}

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// 全局滚动位置存储（内存中，按路径保存）
const scrollStore = new Map<string, number>();

// 阻止浏览器默认滚动恢复（让我们完全掌控）
if (typeof window !== 'undefined' && 'scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

/**
 * 在页面组件中调用此 hook 以保存/恢复滚动位置。
 * 返回时回到离开前的位置，首次进入时滚到顶部。
 */
export function usePageScroll() {
  const location = useLocation();
  const pathRef = useRef(location.pathname);

  useEffect(() => {
    const prevPath = pathRef.current;
    const nextPath = location.pathname;

    // 保存上一个页面的滚动位置
    if (prevPath !== nextPath) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      scrollStore.set(prevPath, scrollY);
    }

    // 恢复当前页面的滚动位置
    const saved = scrollStore.get(nextPath);
    if (saved !== undefined) {
      // 用多个时机尝试恢复，确保内容已渲染
      const restoreAt = () => window.scrollTo(0, saved);
      requestAnimationFrame(restoreAt);
      setTimeout(restoreAt, 50);
      setTimeout(restoreAt, 200);
    } else {
      // 没存过的话滚到顶部
      window.scrollTo(0, 0);
    }

    pathRef.current = nextPath;
  }, [location.pathname]);

  // 组件卸载时保存当前位置（以防路由切换时未保存）
  useEffect(() => {
    return () => {
      const scrollY = window.scrollY || 0;
      scrollStore.set(pathRef.current, scrollY);
    };
  }, []);
}

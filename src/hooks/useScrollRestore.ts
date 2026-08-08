// 滚动位置持久化：按路由路径保存/恢复滚动位置
// 当用户在列表页滚动到某个位置后，点击进入详情页，再返回时应恢复到之前的位置

const scrollPositions = new Map<string, number>();

export function saveScrollPosition(path: string, scrollY: number) {
  scrollPositions.set(path, scrollY);
}

export function getScrollPosition(path: string): number | null {
  return scrollPositions.get(path) ?? null;
}

export function clearScrollPosition(path: string) {
  scrollPositions.delete(path);
}

export function clearAllScrollPositions() {
  scrollPositions.clear();
}

/**
 * React hook: 页面挂载时恢复滚动位置，卸载时保存当前位置
 * @param path 当前路由路径
 */
export function useScrollPreserve(path: string) {
  useEffect(() => {
    // 挂载时恢复
    const saved = getScrollPosition(path);
    if (saved !== null) {
      // 用 requestAnimationFrame 等下一帧，确保布局渲染完成
      requestAnimationFrame(() => {
        window.scrollTo(0, saved);
      });
    } else {
      // 没存过的话滚到顶部
      window.scrollTo(0, 0);
    }

    // 保存滚动位置的处理函数
    const handleSave = () => {
      saveScrollPosition(path, window.scrollY);
    };

    // 监听 beforeunload 和 visibilitychange
    window.addEventListener('beforeunload', handleSave);
    document.addEventListener('visibilitychange', handleSave);

    // 组件卸载时保存
    return () => {
      handleSave();
      window.removeEventListener('beforeunload', handleSave);
      document.removeEventListener('visibilitychange', handleSave);
    };
  }, [path]);
}

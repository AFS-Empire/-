/**
 * 骨架屏 —— 加载时显示，替代裸转圈
 * 形状贴近真实内容，减少"白屏"的跳变感
 */

/** 条目列表/详情的骨架 */
export function EntrySkeleton() {
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto" aria-label="加载中">
      {/* 返回栏占位 */}
      <div className="flex items-center justify-between">
        <div className="skeleton-block w-20 h-8 rounded-lg" />
        <div className="skeleton-block w-24 h-8 rounded-lg" />
      </div>
      {/* 标题占位 */}
      <div className="space-y-2">
        <div className="skeleton-block w-24 h-6 rounded" />
        <div className="skeleton-block w-2/3 h-9 rounded" />
        <div className="skeleton-block w-full h-4 rounded" />
        <div className="skeleton-block w-4/5 h-4 rounded" />
      </div>
      {/* 卡片占位 */}
      <div className="skeleton-block w-full h-48 rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="skeleton-block h-20 rounded-xl" />
        <div className="skeleton-block h-20 rounded-xl" />
      </div>
    </div>
  );
}

/** 列表页骨架（角色/时间轴/地理等列表） */
export function ListSkeleton() {
  return (
    <div className="space-y-3 animate-fade-in" aria-label="加载中">
      <div className="skeleton-block w-40 h-8 rounded-lg" />
      <div className="skeleton-block w-full h-12 rounded-lg" />
      <div className="skeleton-block w-full h-12 rounded-lg" />
      <div className="skeleton-block w-full h-12 rounded-lg" />
      <div className="skeleton-block w-full h-12 rounded-lg" />
    </div>
  );
}

/** 首页骨架 */
export function HomeSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in" aria-label="加载中">
      <div className="text-center space-y-3">
        <div className="skeleton-block w-64 h-10 mx-auto rounded" />
        <div className="skeleton-block w-48 h-4 mx-auto rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="skeleton-block h-40 rounded-xl" />
        <div className="skeleton-block h-40 rounded-xl" />
        <div className="skeleton-block h-40 rounded-xl" />
      </div>
    </div>
  );
}

/** 通用全屏加载（App 初始启动用） */
export function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-gold-700 border-t-gold-300 animate-spin" />
        <p className="text-gold-400 tracking-widest">载入档案库...</p>
      </div>
    </div>
  );
}

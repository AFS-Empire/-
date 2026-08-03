/**
 * 通用全屏加载（App 初始启动用）
 */
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

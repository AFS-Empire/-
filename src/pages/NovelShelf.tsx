import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Trash2, EyeOff } from 'lucide-react';
import { useNovelStore } from '../store/novelStore';
import { useBindingStore } from '../store/bindingStore';
import { useRequirePin } from '../hooks/useRequirePin';
import { IS_WEB_BUILD } from '../lib/buildTarget';
import { ConfirmDialog, PromptDialog, ModeSelectDialog, AlertDialog } from '../components/Dialog';

export default function NovelShelf() {
  const navigate = useNavigate();
  const isBound = useBindingStore(s => s.isBound);
  const { requirePin, PinGuard } = useRequirePin();
  const books = useNovelStore(s => s.books);
  const createBook = useNovelStore(s => s.createBook);
  const deleteBook = useNovelStore(s => s.deleteBook);
  const chapters = useNovelStore(s => s.chapters);
  const progress = useNovelStore(s => s.progress);

  const [showNameDialog, setShowNameDialog] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [alertMsg, setAlertMsg] = useState('');

  const handleCreateClick = () => {
    if (!isBound) { setAlertMsg('设备未绑定，无法新建小说'); return; }
    setPendingName('');
    setShowNameDialog(true);
  };

  const handleNameConfirm = (value: string) => {
    if (!value.trim()) {
      setShowNameDialog(false);
      return;
    }
    setPendingName(value.trim());
    setShowModeDialog(true);
  };

  // 创建小说：弹 PIN 校验通过后执行
  const handleModeSelect = (mode: 'open' | 'unlock') => {
    if (!pendingName) return;
    const name = pendingName;
    requirePin('新建小说', async () => {
      const book = await createBook(name, mode);
      navigate(`/novel/${book.id}`);
    });
  };

  // 删除小说：确认通过后弹 PIN 校验
  const handleDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    requirePin('删除小说', async () => {
      await deleteBook(target.id);
    });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen size={22} className="text-gold-400" />
          <h1 className="gold-title text-xl font-bold">小说馆 · 书架</h1>
          <span className="text-xs text-ink-500">共 {books.length} 本</span>
        </div>
        {!IS_WEB_BUILD && (
          <button onClick={handleCreateClick} className="btn-gold">
            <Plus size={16} />
            新建小说
          </button>
        )}
      </div>

      {books.length === 0 ? (
        <div className="panel p-12 text-center">
          <BookOpen size={48} className="text-gold-900/40 mx-auto mb-4" />
          <p className="text-ink-400 mb-2">书架空空如也</p>
          {IS_WEB_BUILD ? (
            <p className="text-xs text-ink-600">请在桌面版 App 中创建并导入小说</p>
          ) : (
            <p className="text-xs text-ink-600">点击右上角「新建小说」创建第一本书</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {books.map(book => {
            const bookChapters = chapters[book.id] || [];
            const prog = progress[book.id];
            const pct = book.totalChapters > 0 ? Math.round((book.completedChapters / book.totalChapters) * 100) : 0;

            return (
              <div
                key={book.id}
                onClick={() => navigate(`/novel/${book.id}`)}
                className="panel-gold p-4 cursor-pointer group hover:border-gold-700/50 transition-all"
              >
                <div className="aspect-[3/4] bg-gradient-to-br from-ink-800 to-ink-950 rounded-lg mb-3 flex items-center justify-center border border-gold-900/30 relative overflow-hidden">
                  <BookOpen size={36} className="text-gold-700/50" />
                  {book.spoilerMode === 'unlock' && (
                    <div className="absolute top-2 right-2">
                      <EyeOff size={14} className="text-gold-600/70" />
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-gold-200 truncate group-hover:text-gold-100">
                  {book.title}
                </h3>
                <div className="flex items-center justify-between mt-2 text-xs text-ink-500">
                  <span>{book.totalChapters} 章</span>
                  <span>{pct}%</span>
                </div>
                {bookChapters.length > 0 && prog && (
                  <div className="mt-1.5 h-1 bg-ink-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                {!IS_WEB_BUILD && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (!isBound) { setAlertMsg('设备未绑定，无法删除'); return; }
                      setDeleteTarget({ id: book.id, title: book.title });
                    }}
                    className="absolute top-1 right-1 p-1 rounded text-ink-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 输入小说名称 */}
      <PromptDialog
        open={showNameDialog}
        onClose={() => setShowNameDialog(false)}
        title="新建小说"
        message="请输入小说名称："
        placeholder="如：星辰之书"
        defaultValue={pendingName}
        onConfirm={handleNameConfirm}
      />

      {/* 选择模式 */}
      <ModeSelectDialog
        open={showModeDialog}
        onClose={() => setShowModeDialog(false)}
        onSelect={handleModeSelect}
      />

      {/* 删除确认 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="删除小说"
        message={deleteTarget ? `确定删除「${deleteTarget.title}」？所有章节和阅读进度将一并删除，此操作不可恢复。` : ''}
        confirmText="删除"
        variant="danger"
        onConfirm={handleDelete}
      />
      <AlertDialog open={!!alertMsg} onClose={() => setAlertMsg('')} title="提示" message={alertMsg} />
      {PinGuard}
    </div>
  );
}

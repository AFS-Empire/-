import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Trash2, EyeOff, Image as ImageIcon } from 'lucide-react';
import { useNovelStore } from '../store/novelStore';
import { useBindingStore } from '../store/bindingStore';
import { IS_WEB_BUILD } from '../lib/buildTarget';
import { isOperationVerified } from '../lib/operationKey';
import { needVerify } from '../lib/operationKeyGuard';
import { ConfirmDialog, PromptDialog, ModeSelectDialog, AlertDialog } from '../components/Dialog';

export default function NovelShelf() {
  const navigate = useNavigate();
  const isBound = useBindingStore(s => s.isBound);
  const books = useNovelStore(s => s.books);
  const createBook = useNovelStore(s => s.createBook);
  const deleteBook = useNovelStore(s => s.deleteBook);
  const progress = useNovelStore(s => s.progress);

  const [showNameDialog, setShowNameDialog] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [alertMsg, setAlertMsg] = useState('');
  const updateBook = useNovelStore(s => s.updateBook);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const coverTargetBookIdRef = useRef<string>('');

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
    const name = value.trim();
    setPendingName(name);
    // 先检查验证状态，避免在 createBook 内部触发状态更新导致渲染冲突
    if (isOperationVerified()) {
      setShowModeDialog(true);
    } else {
      // 未验证：触发验证流程，验证通过后自动显示模式选择
      needVerify(() => {
        setShowModeDialog(true);
      });
    }
  };

  // 创建小说：此时已确保通过验证，guardWrite 会直接执行
  const handleModeSelect = async (mode: 'open' | 'unlock') => {
    if (!pendingName) return;
    const name = pendingName;
    setShowModeDialog(false);
    const book = await createBook(name, mode);
    if (book) {
      navigate(`/novel/${book.id}`);
    }
  };

  // 删除小说：验证由 novelStore 内部的 guardWrite 统一处理
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    await deleteBook(target.id);
  };

  // 封面上传：文件转 base64，最大 2MB 压缩，存到 book.cover
  const handleCoverClick = (bookId: string) => {
    if (!isBound) { setAlertMsg('设备未绑定，无法修改封面'); return; }
    coverTargetBookIdRef.current = bookId;
    coverInputRef.current?.click();
  };
  const handleCoverClear = async (bookId: string) => {
    if (!isBound) { setAlertMsg('设备未绑定'); return; }
    await updateBook(bookId, { cover: undefined });
  };
  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const bookId = coverTargetBookIdRef.current;
    if (!bookId) return;

    // 限制文件大小，超了走 canvas 压缩
    const maxSize = 2 * 1024 * 1024;
    let dataUrl: string;
    if (file.size <= maxSize && file.type.startsWith('image/')) {
      dataUrl = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
    } else {
      dataUrl = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const targetW = 600;
            const scale = targetW / img.width;
            canvas.width = targetW;
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            res(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.onerror = rej;
          img.src = reader.result as string;
        };
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
    }
    await updateBook(bookId, { cover: dataUrl });
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
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {books.map(book => {
              const prog = progress[book.id];
              const pct = book.totalChapters > 0 ? Math.round((book.completedChapters / book.totalChapters) * 100) : 0;

              return (
                <div
                  key={book.id}
                  className="panel-gold p-3 cursor-pointer group relative"
                  onClick={() => navigate(`/novel/${book.id}`)}
                >
                  {/* 封面区域 */}
                  <div className="aspect-[3/4] rounded-lg mb-3 border border-gold-900/30 relative overflow-hidden group/cover">
                    {book.cover ? (
                      <img
                        src={book.cover}
                        alt={book.title}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-ink-800 to-ink-950 flex items-center justify-center">
                        <BookOpen size={36} className="text-gold-700/50" />
                      </div>
                    )}
                    {book.spoilerMode === 'unlock' && (
                      <div className="absolute top-2 right-2">
                        <EyeOff size={14} className="text-gold-600/80" />
                      </div>
                    )}
                    {!IS_WEB_BUILD && (
                      <div className="absolute inset-0 bg-black/55 opacity-0 group-hover/cover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); handleCoverClick(book.id); }}
                          className="btn-gold text-xs py-1 px-3"
                        >
                          <ImageIcon size={12} />
                          {book.cover ? '更换封面' : '上传封面'}
                        </button>
                        {book.cover && (
                          <button
                            onClick={e => { e.stopPropagation(); handleCoverClear(book.id); }}
                            className="text-xs text-ink-300 hover:text-red-400 transition-colors"
                          >
                            清除封面
                          </button>
                        )}
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
                  {book.totalChapters > 0 && prog && (
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
                      className="absolute top-1 right-1 p-1 rounded text-ink-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverFileChange}
          />
        </>
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
    </div>
  );
}

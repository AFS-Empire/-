import { useParams, useNavigate } from 'react-router-dom';
import { useState, useRef } from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, Edit3, FileText, Eye, EyeOff, Upload } from 'lucide-react';
import { useNovelStore } from '../store/novelStore';
import { useDataStore } from '../store/dataStore';
import { IS_WEB_BUILD } from '../lib/buildTarget';

export default function NovelDetail() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const chapters = useNovelStore(s => s.chapters);
  const volumes = useNovelStore(s => s.volumes);
  const books = useNovelStore(s => s.books);
  const createVolume = useNovelStore(s => s.createVolume);
  const deleteVolume = useNovelStore(s => s.deleteVolume);
  const updateVolume = useNovelStore(s => s.updateVolume);
  const importChapters = useNovelStore(s => s.importChapters);
  const updateBook = useNovelStore(s => s.updateBook);
  const characters = useDataStore(s => s.entries.filter(e => e.type === 'character'));

  const book = books.find(b => b.id === bookId);
  const bookChapters = bookId ? (chapters[bookId] || []) : [];
  const bookVolumes = bookId ? (volumes[bookId] || []) : [];

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingTitle, setEditingTitle] = useState(false);

  if (!book) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-ink-400">小说不存在</p>
        <button onClick={() => navigate('/novel')} className="btn-gold mt-4">返回书架</button>
      </div>
    );
  }

  const toggleExpand = (volId: string) => {
    setExpanded(prev => ({ ...prev, [volId]: !prev[volId] }));
  };

  const handleCreateVolume = async () => {
    const title = prompt('请输入分卷名称（如"夏"）：');
    if (!title) return;
    await createVolume(bookId!, title);
  };

  const handleImportTXT = async (file: File) => {
    if (!file || !bookId) return;
    if (bookVolumes.length === 0) {
      alert('请先创建至少一个分卷，然后再导入章节');
      return;
    }
    const targetVolumeId = bookVolumes[0].id; // 默认导入到第一个卷
    const text = await file.text();
    const count = await importChapters(bookId, targetVolumeId, text, characters);
    if (count > 0) {
      alert(`成功导入 ${count} 章`);
    } else {
      alert('未能解析出任何章节，请检查 TXT 格式');
    }
  };

  const groupedByVolume = (volId: string) =>
    bookChapters.filter(c => c.volumeId === volId).sort((a, b) => a.order - b.order);

  const unassigned = bookChapters.filter(c => !c.volumeId);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* 书信息 */}
      <div className="panel-gold p-5">
        <div className="flex items-start justify-between">
          <div>
            {editingTitle ? (
              <input
                className="input-field text-xl font-bold"
                defaultValue={book.title}
                onBlur={async e => {
                  setEditingTitle(false);
                  await updateBook(bookId!, { title: e.target.value });
                }}
                autoFocus
              />
            ) : (
              <h1
                className="gold-title text-xl font-bold cursor-pointer hover:text-gold-300"
                onClick={() => !IS_WEB_BUILD && setEditingTitle(true)}
              >
                {book.title}
              </h1>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-ink-500">
              <span>共 {book.totalChapters} 章</span>
              <span className="flex items-center gap-1">
                {book.spoilerMode === 'unlock' ? (
                  <>
                    <EyeOff size={12} /> 解锁模式
                  </>
                ) : (
                  <>
                    <Eye size={12} /> 开放模式
                  </>
                )}
              </span>
              {book.completedChapters > 0 && (
                <span className="text-gold-500">已读 {book.completedChapters}/{book.totalChapters}</span>
              )}
            </div>
          </div>
          {!IS_WEB_BUILD && (
            <div className="flex gap-2">
              <button
                onClick={() => updateBook(bookId!, { spoilerMode: book.spoilerMode === 'open' ? 'unlock' : 'open' })}
                className="btn-ghost p-2"
                title="切换剧透保护模式"
              >
                {book.spoilerMode === 'open' ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 操作栏 */}
      {!IS_WEB_BUILD && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleCreateVolume} className="btn-gold text-sm">
            <Plus size={14} /> 新建分卷
          </button>
          <button onClick={() => fileRef.current?.click()} className="btn-ghost text-sm">
            <Upload size={14} /> 导入 TXT
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleImportTXT(f);
              if (fileRef.current) fileRef.current.value = '';
            }}
          />
        </div>
      )}

      {/* 分卷列表 */}
      {bookVolumes.length === 0 && unassigned.length === 0 ? (
        <div className="panel p-8 text-center text-ink-500">
          <FileText size={32} className="mx-auto mb-3 text-gold-900/30" />
          <p className="text-sm">还没有分卷和章节</p>
          <p className="text-xs text-ink-600 mt-1">
            {IS_WEB_BUILD ? '请在桌面版中导入' : '点击「新建分卷」开始组织目录'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {bookVolumes.map(vol => {
            const volChapters = groupedByVolume(vol.id);
            const isOpen = expanded[vol.id] ?? true;
            return (
              <div key={vol.id} className="panel overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-ink-900/30"
                  onClick={() => toggleExpand(vol.id)}
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown size={16} className="text-gold-500" /> : <ChevronRight size={16} className="text-ink-500" />}
                    <span className="font-medium text-gold-200">{vol.title}</span>
                    <span className="text-xs text-ink-500">({volChapters.length} 章)</span>
                  </div>
                  {!IS_WEB_BUILD && (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={async () => {
                          const name = prompt('修改分卷名称：', vol.title);
                          if (name) await updateVolume(vol.id, name);
                        }}
                        className="p-1 rounded hover:text-gold-400 text-ink-500"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`删除分卷「${vol.title}」及其所有章节？`)) await deleteVolume(vol.id);
                        }}
                        className="p-1 rounded hover:text-red-400 text-ink-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
                {isOpen && (
                  <div className="border-t border-gold-900/20">
                    {volChapters.length === 0 ? (
                      <p className="p-3 text-xs text-ink-600">暂无章节</p>
                    ) : (
                      volChapters.map(chap => (
                        <div
                          key={chap.id}
                          onClick={() => navigate(`/novel/${bookId}/chapter/${chap.id}`)}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-ink-900/40 cursor-pointer border-b border-ink-800/30 last:border-0"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {chap.read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0" />
                            )}
                            <span className={`text-sm truncate ${chap.read ? 'text-ink-500' : 'text-ink-200'}`}>
                              {chap.title}
                            </span>
                          </div>
                          <span className="text-xs text-ink-600 shrink-0">{chap.content.length}字</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* 未分配章节 */}
          {unassigned.length > 0 && (
            <div className="panel p-3">
              <p className="text-xs text-red-400 mb-2">以下章节未分配到分卷：</p>
              {unassigned.map(chap => (
                <div
                  key={chap.id}
                  onClick={() => navigate(`/novel/${bookId}/chapter/${chap.id}`)}
                  className="flex items-center justify-between p-2 hover:bg-ink-900/40 cursor-pointer"
                >
                  <span className="text-sm text-ink-300">{chap.title}</span>
                  <span className="text-xs text-ink-600">{chap.content.length}字</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

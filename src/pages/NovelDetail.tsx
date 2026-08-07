import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, Edit3, FileText, Eye, EyeOff, Upload } from 'lucide-react';
import { useNovelStore } from '../store/novelStore';
import { useDataStore } from '../store/dataStore';
import { useBindingStore } from '../store/bindingStore';
import { IS_WEB_BUILD } from '../lib/buildTarget';
import { platform } from '../platform';
import { ConfirmDialog, PromptDialog, AlertDialog } from '../components/Dialog';
import type { NovelChapter, NovelVolume } from '../types';

const EMPTY_CHAPTERS: NovelChapter[] = [];
const EMPTY_VOLUMES: NovelVolume[] = [];

export default function NovelDetail() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const isBound = useBindingStore(s => s.isBound);
  const bookChapters = useNovelStore(s => bookId ? (s.chapters[bookId] || EMPTY_CHAPTERS) : EMPTY_CHAPTERS);
  const bookVolumes = useNovelStore(s => bookId ? (s.volumes[bookId] || EMPTY_VOLUMES) : EMPTY_VOLUMES);
  const books = useNovelStore(s => s.books);
  const createVolume = useNovelStore(s => s.createVolume);
  const deleteVolume = useNovelStore(s => s.deleteVolume);
  const updateVolume = useNovelStore(s => s.updateVolume);
  const importChapters = useNovelStore(s => s.importChapters);
  const updateBook = useNovelStore(s => s.updateBook);
  const createChapter = useNovelStore(s => s.createChapter);
  const deleteChapter = useNovelStore(s => s.deleteChapter);
  const updateChapter = useNovelStore(s => s.updateChapter);
  const entries = useDataStore(s => s.entries);
  const characters = useMemo(() => entries.filter(e => e.type === 'character'), [entries]);

  const book = books.find(b => b.id === bookId);

  const groupedByVolumeMap = useMemo(() => {
    const map: Record<string, NovelChapter[]> = {};
    for (const vol of bookVolumes) {
      map[vol.id] = bookChapters.filter(c => c.volumeId === vol.id).sort((a, b) => a.order - b.order);
    }
    return map;
  }, [bookChapters, bookVolumes]);

  const unassigned = useMemo(() => bookChapters.filter(c => !c.volumeId), [bookChapters]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingTitle, setEditingTitle] = useState(false);

  // Dialog state
  const [promptState, setPromptState] = useState<{
    open: boolean;
    title: string;
    message: string;
    placeholder?: string;
    defaultValue?: string;
    multiline?: boolean;
    onConfirm: (value: string) => void;
  } | null>(null);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [alertState, setAlertState] = useState<{
    open: boolean;
    title: string;
    message: string;
  } | null>(null);

  // 写操作守卫：先检查机器绑定，验证由 store 内部的 guardWrite 统一处理
  const openPrompt = (
    title: string, message: string, placeholder: string,
    defaultValue: string, onConfirm: (value: string) => void | Promise<void>, multiline = false,
  ) => {
    if (!isBound) { openAlert('提示', '设备未绑定，无法操作'); return; }
    setPromptState({ open: true, title, message, placeholder, defaultValue, onConfirm, multiline });
  };

  const openConfirm = (title: string, message: string, onConfirm: () => void | Promise<void>) => {
    if (!isBound) { openAlert('提示', '设备未绑定，无法操作'); return; }
    setConfirmState({ open: true, title, message, onConfirm });
  };

  const openAlert = (title: string, message: string) => {
    setAlertState({ open: true, title, message });
  };

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

  const handleCreateVolumeClick = () => {
    openPrompt('新建分卷', '请输入分卷名称（如"夏"）：', '分卷名称', '', async (name) => {
      if (!name.trim()) return;
      await createVolume(bookId!, name.trim());
    }, false);
  };

  // 导入 TXT：先检查机器绑定 + 选文件，验证由 store 内部处理
  const handleImportTXT = async () => {
    if (!bookId) return;
    if (!isBound) { openAlert('提示', '设备未绑定，无法导入'); return; }
    if (bookVolumes.length === 0) {
      openAlert('提示', '请先创建至少一个分卷，然后再导入章节');
      return;
    }
    const result = await platform.pickTextFile();
    if (!result) return;
    const targetVolumeId = bookVolumes[0].id;
    const text = result.content;
    const count = await importChapters(bookId, targetVolumeId, text, characters);
    if (count === false) {
      // guardWrite 返回 false 表示需要验证，对话框会自动弹出
      return;
    }
    if (count > 0) {
      openAlert('导入成功', `成功导入 ${count} 章`);
    } else {
      openAlert('导入失败', '未能解析出任何章节，请检查 TXT 格式');
    }
  };

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
                  if (!isBound) { openAlert('提示', '设备未绑定，无法保存'); return; }
                  const newTitle = e.target.value;
                  await updateBook(bookId!, { title: newTitle });
                }}
                autoFocus
              />
            ) : (
              <h1
                className="gold-title text-xl font-bold cursor-pointer hover:text-gold-300"
                onClick={() => !IS_WEB_BUILD && isBound && setEditingTitle(true)}
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
                onClick={async () => {
                  if (!isBound) { openAlert('提示', '设备未绑定，无法操作'); return; }
                  const newMode = book.spoilerMode === 'open' ? 'unlock' : 'open';
                  await updateBook(bookId!, { spoilerMode: newMode });
                }}
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
          <button
            onClick={() => { if (!isBound) { openAlert('提示', '设备未绑定，无法操作'); return; } handleCreateVolumeClick(); }}
            className="btn-gold text-sm"
          >
            <Plus size={14} /> 新建分卷
          </button>
          <button type="button" onClick={handleImportTXT} className="btn-ghost text-sm">
            <Upload size={14} /> 导入 TXT
          </button>
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
            const volChapters = groupedByVolumeMap[vol.id] || [];
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
                        onClick={() => {
                          openPrompt('修改分卷名称', '请输入新的分卷名称：', '分卷名称', vol.title, async (name) => {
                            if (name.trim()) await updateVolume(vol.id, name.trim());
                          }, false);
                        }}
                        className="p-1.5 rounded hover:text-gold-400 text-ink-500"
                        aria-label="修改分卷名称"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => {
                          openConfirm('删除分卷', `删除分卷「${vol.title}」及其所有章节？此操作不可恢复。`, async () => {
                            await deleteVolume(vol.id);
                          });
                        }}
                        className="p-1.5 rounded hover:text-red-400 text-ink-500"
                        aria-label="删除分卷"
                      >
                        <Trash2 size={14} />
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
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-ink-900/40 cursor-pointer border-b border-ink-800/30 last:border-0 group"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {chap.read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0" />
                            )}
                            <span className={`text-sm truncate ${chap.read ? 'text-ink-500' : 'text-ink-200'}`}>
                              {chap.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-ink-600">{chap.content.length}字</span>
                            {!IS_WEB_BUILD && (
                              <div className="flex items-center gap-0.5 opacity-50 hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => {
                                    openPrompt('修改章节标题', '请输入新的章节标题：', '章节标题', chap.title, async (name) => {
                                      if (name.trim()) await updateChapter(chap.id, { title: name.trim() });
                                    }, false);
                                  }}
                                  className="p-1.5 rounded hover:text-gold-400 text-ink-500"
                                  title="编辑标题"
                                  aria-label="编辑章节标题"
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  onClick={() => {
                                    openConfirm('删除章节', `删除章节「${chap.title}」？此操作不可恢复。`, async () => {
                                      await deleteChapter(chap.id);
                                    });
                                  }}
                                  className="p-1.5 rounded hover:text-red-400 text-ink-500"
                                  title="删除章节"
                                  aria-label="删除章节"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {!IS_WEB_BUILD && (
                      <div className="p-2 border-t border-ink-800/30">
                        <button
                          onClick={() => {
                            openPrompt('新建章节', '请输入章节标题（如：第一章 初遇）：', '章节标题', '', async (title) => {
                              if (!title.trim()) return;
                              openPrompt('章节内容', '可以之后在阅读页修改。输入章节内容：', '章节内容', '', async (content) => {
                                await createChapter(bookId!, vol.id, title.trim(), content, characters);
                              }, true);
                            }, false);
                          }}
                          className="w-full py-1.5 text-xs text-ink-500 hover:text-gold-400 rounded hover:bg-ink-900/30 flex items-center justify-center gap-1"
                        >
                          <Plus size={12} /> 新建章节
                        </button>
                      </div>
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

      {/* 通用 Prompt Dialog */}
      {promptState && (
        <PromptDialog
          open={promptState.open}
          onClose={() => setPromptState(null)}
          title={promptState.title}
          message={promptState.message}
          placeholder={promptState.placeholder}
          defaultValue={promptState.defaultValue}
          multiline={promptState.multiline}
          onConfirm={promptState.onConfirm}
        />
      )}

      {/* 通用 Confirm Dialog */}
      {confirmState && (
        <ConfirmDialog
          open={confirmState.open}
          onClose={() => setConfirmState(null)}
          title={confirmState.title}
          message={confirmState.message}
          confirmText="删除"
          variant="danger"
          onConfirm={confirmState.onConfirm}
        />
      )}

      {/* 通用 Alert Dialog */}
      {alertState && (
        <AlertDialog
          open={alertState.open}
          onClose={() => setAlertState(null)}
          title={alertState.title}
          message={alertState.message}
        />
      )}
    </div>
  );
}

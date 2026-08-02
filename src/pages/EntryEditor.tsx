import { useMemo, useState, useRef, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Upload, X, Search, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { genId } from '../data/db';
import { AlertDialog } from '../components/Dialog';
import type { AnyEntry, GeoLevel, LinkRef, TechCategory } from '../types';

interface FormState {
  title: string;
  summary: string;
  content: string;
  coverImage: string;
  images: string[];
  tags: string;
  links: LinkRef[];
  eraId: string;
  year: string;
  identity: string;
  organization: string;
  faction: string;
  race: string;
  status: string;
  level: GeoLevel;
  parentId: string;
  category: TechCategory;
  firstAppearance: string;
  importance: 'low' | 'medium' | 'high';
  sectionId: string;
}

const VALID_TYPES = ['timeline', 'character', 'geography', 'tech', 'milestone', 'custom'] as const;
type EditableType = typeof VALID_TYPES[number];

const TYPE_TITLE: Record<EditableType, string> = {
  timeline: '时间轴事件',
  character: '角色',
  geography: '地点',
  tech: '科技设定',
  milestone: '里程碑',
  custom: '条目',
};

const GEO_LEVELS: GeoLevel[] = ['galaxy', 'planet', 'city', 'area'];
const GEO_LEVEL_LABEL: Record<GeoLevel, string> = { galaxy: '星系', planet: '星球', city: '城市', area: '区域' };
const TECH_CATEGORIES: TechCategory[] = ['weapon', 'mecha', 'facility', 'system', 'creature', 'other'];
const TECH_CATEGORY_LABEL: Record<TechCategory, string> = {
  weapon: '武器', mecha: '机甲', facility: '设施', system: '制度', creature: '生物', other: '其他',
};

const readFileAsDataURL = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

function initForm(existing: AnyEntry | undefined, presetSectionId: string | null): FormState {
  if (existing) {
    const get = <K extends keyof AnyEntry>(k: K): AnyEntry[K] => existing[k];
    return {
      title: existing.title,
      summary: existing.summary,
      content: existing.content,
      coverImage: existing.coverImage || '',
      images: existing.images ? [...existing.images] : [],
      tags: existing.tags.join(', '),
      links: existing.links.map(l => ({ ...l })),
      eraId: (get('eraId' as keyof AnyEntry) as string) || '',
      year: (get('year' as keyof AnyEntry) as string) || '',
      identity: (get('identity' as keyof AnyEntry) as string) || '',
      organization: (get('organization' as keyof AnyEntry) as string) || '',
      faction: (get('faction' as keyof AnyEntry) as string) || '',
      race: (get('race' as keyof AnyEntry) as string) || '',
      status: (get('status' as keyof AnyEntry) as string) || '',
      level: (get('level' as keyof AnyEntry) as GeoLevel) || 'galaxy',
      parentId: (get('parentId' as keyof AnyEntry) as string) || '',
      category: (get('category' as keyof AnyEntry) as TechCategory) || 'other',
      firstAppearance: (get('firstAppearance' as keyof AnyEntry) as string) || '',
      importance: (get('importance' as keyof AnyEntry) as 'low' | 'medium' | 'high') || 'medium',
      sectionId: (get('sectionId' as keyof AnyEntry) as string) || presetSectionId || '',
    };
  }
  return {
    title: '', summary: '', content: '', coverImage: '', images: [], tags: '', links: [],
    eraId: '', year: '', identity: '', organization: '', faction: '', race: '', status: '',
    level: 'galaxy', parentId: '', category: 'other', firstAppearance: '',
    importance: 'medium', sectionId: presetSectionId || '',
  };
}

/**
 * 非受控文本输入 hook —— 解决 Android WebView 中受控输入时光标跳到末尾的问题。
 * 使用 defaultValue 初始化，ref 读取值，不触发重新渲染。
 */
function useTextField(initial: string) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const setRef = useCallback((el: HTMLInputElement | HTMLTextAreaElement | null) => {
    ref.current = el;
  }, []);
  const getValue = useCallback(() => ref.current?.value ?? initial, [initial]);
  return { ref: setRef, defaultValue: initial, getValue };
}

export default function EntryEditor() {
  const { type, id } = useParams<{ type: string; id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isAdmin = useAuthStore(s => s.currentUser?.role === 'admin');
  const entries = useDataStore(s => s.entries);
  const eras = useDataStore(s => s.eras);
  const customSections = useDataStore(s => s.customSections);
  const getById = useDataStore(s => s.getById);
  const saveEntry = useDataStore(s => s.saveEntry);

  const existing = id ? getById(id) : undefined;
  const initialForm = useMemo(() => initForm(existing, searchParams.get('sectionId')), [existing, searchParams]);

  // 非受控文本字段 —— 不触发重新渲染，光标不会跳
  const titleField = useTextField(initialForm.title);
  const summaryField = useTextField(initialForm.summary);
  const contentField = useTextField(initialForm.content);
  const tagsField = useTextField(initialForm.tags);
  const yearField = useTextField(initialForm.year);
  const identityField = useTextField(initialForm.identity);
  const orgField = useTextField(initialForm.organization);
  const factionField = useTextField(initialForm.faction);
  const raceField = useTextField(initialForm.race);
  const statusField = useTextField(initialForm.status);
  const firstAppearanceField = useTextField(initialForm.firstAppearance);

  // 下拉选择和状态字段 —— 这些不受光标问题影响
  const [coverImage, setCoverImage] = useState(initialForm.coverImage);
  const [images, setImages] = useState<string[]>(initialForm.images);
  const [links, setLinks] = useState<LinkRef[]>(initialForm.links);
  const [eraId, setEraId] = useState(initialForm.eraId);
  const [level, setLevel] = useState<GeoLevel>(initialForm.level);
  const [parentId, setParentId] = useState(initialForm.parentId);
  const [category, setCategory] = useState<TechCategory>(initialForm.category);
  const [importance, setImportance] = useState<'low' | 'medium' | 'high'>(initialForm.importance);
  const [sectionId, setSectionId] = useState(initialForm.sectionId);

  const [linkSearch, setLinkSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');

  const linkResults = useMemo(() => {
    const kw = linkSearch.trim().toLowerCase();
    if (!kw) return [];
    return entries
      .filter(e => e.id !== existing?.id && !links.some(l => l.id === e.id))
      .filter(e => e.title.toLowerCase().includes(kw) || e.tags.some(t => t.toLowerCase().includes(kw)))
      .slice(0, 10);
  }, [entries, linkSearch, links, existing]);

  const geographyOptions = useMemo(
    () => entries.filter(e => e.type === 'geography' && e.id !== existing?.id),
    [entries, existing],
  );

  if (!isAdmin) {
    return (
      <div className="space-y-4 animate-fade-in">
        <p className="text-ink-400">无权限</p>
        <button className="btn-ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /> 返回</button>
      </div>
    );
  }

  if (!type || !VALID_TYPES.includes(type as EditableType)) {
    return (
      <div className="space-y-4 animate-fade-in">
        <p className="text-ink-400">未知条目类型</p>
        <button className="btn-ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /> 返回</button>
      </div>
    );
  }

  if (id && !existing) {
    return (
      <div className="space-y-4 animate-fade-in">
        <p className="text-ink-400">未找到要编辑的条目</p>
        <button className="btn-ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /> 返回</button>
      </div>
    );
  }

  const editType = type as EditableType;

  const addLink = (e: AnyEntry) => {
    setLinks(prev => [...prev, { id: e.id, type: e.type, title: e.title, relation: '' }]);
    setLinkSearch('');
  };

  const removeLink = (linkId: string) => {
    setLinks(prev => prev.filter(l => l.id !== linkId));
  };

  const updateLinkRelation = (linkId: string, relation: string) => {
    setLinks(prev => prev.map(l => (l.id === linkId ? { ...l, relation } : l)));
  };

  const handleCoverUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataURL(file);
    setCoverImage(dataUrl);
  };

  const handleImagesUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const urls = await Promise.all(files.map(readFileAsDataURL));
    setImages(prev => [...prev, ...urls]);
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const buildEntry = (): AnyEntry => {
    const now = Date.now();
    const title = titleField.getValue().trim();
    const summary = summaryField.getValue().trim();
    const content = contentField.getValue();
    const tags = tagsField.getValue().split(',').map(t => t.trim()).filter(Boolean);
    const common = {
      id: existing?.id || genId(),
      title,
      summary,
      content,
      coverImage: coverImage || undefined,
      images: images.length ? images : undefined,
      tags,
      links,
      customFields: existing?.customFields,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      order: existing?.order,
    };
    switch (editType) {
      case 'timeline':
        return {
          ...common,
          type: 'timeline',
          eraId,
          year: yearField.getValue(),
          eraName: eras.find(e => e.id === eraId)?.name,
        } as AnyEntry;
      case 'character':
        return {
          ...common,
          type: 'character',
          identity: identityField.getValue(),
          organization: orgField.getValue(),
          faction: factionField.getValue(),
          race: raceField.getValue(),
          status: statusField.getValue(),
        } as AnyEntry;
      case 'geography':
        return {
          ...common,
          type: 'geography',
          level,
          parentId: parentId || undefined,
          faction: factionField.getValue(),
        } as AnyEntry;
      case 'tech':
        return {
          ...common,
          type: 'tech',
          category,
          firstAppearance: firstAppearanceField.getValue(),
          organization: orgField.getValue(),
        } as AnyEntry;
      case 'milestone':
        return {
          ...common,
          type: 'milestone',
          year: yearField.getValue(),
          importance,
        } as AnyEntry;
      case 'custom':
        return {
          ...common,
          type: 'custom',
          sectionId,
        } as AnyEntry;
    }
  };

  const handleSave = async () => {
    const title = titleField.getValue().trim();
    if (!title) {
      setAlertMsg('请填写标题');
      return;
    }
    if (editType === 'timeline' && !eraId) {
      setAlertMsg('请选择纪元（或在纪元管理中先创建）');
      return;
    }
    if (editType === 'custom' && !sectionId) {
      setAlertMsg('请选择所属分类');
      return;
    }
    setSaving(true);
    try {
      const entry = buildEntry();
      await saveEntry(entry);
      navigate(`/entry/${entry.id}`);
    } catch (err) {
      setAlertMsg('保存失败：' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <button className="btn-ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /> 取消</button>
        <h1 className="text-xl font-bold text-gold-200">
          {existing ? '编辑' : '新增'}{TYPE_TITLE[editType]}
        </h1>
        <button className="btn-gold" onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4" /> {saving ? '保存中...' : '保存'}
        </button>
      </div>

      <div className="gold-divider" />

      {/* Common fields */}
      <div className="panel-gold p-5 space-y-4">
        <h2 className="section-title">基础信息</h2>
        <div>
          <label className="label-text">标题 *</label>
          <input className="input-field" ref={titleField.ref} defaultValue={titleField.defaultValue} placeholder="条目标题" />
        </div>
        <div>
          <label className="label-text">一句话简介</label>
          <input className="input-field" ref={summaryField.ref} defaultValue={summaryField.defaultValue} placeholder="简短描述" />
        </div>
        <div>
          <label className="label-text">正文内容</label>
          <textarea className="input-field" rows={8} ref={contentField.ref as React.RefObject<HTMLTextAreaElement>} defaultValue={contentField.defaultValue} placeholder="支持换行的正文..." />
        </div>
        <div>
          <label className="label-text">标签（逗号分隔）</label>
          <input className="input-field" ref={tagsField.ref} defaultValue={tagsField.defaultValue} placeholder="标签1, 标签2" />
        </div>
      </div>

      {/* Type-specific fields */}
      <div className="panel-gold p-5 space-y-4">
        <h2 className="section-title">类型字段</h2>

        {editType === 'timeline' && (
          <>
            <div>
              <label className="label-text">所属纪元 *</label>
              <select className="input-field" value={eraId} onChange={e => setEraId(e.target.value)}>
                <option value="">请选择</option>
                {eras.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">发生时间</label>
              <input className="input-field" ref={yearField.ref} defaultValue={yearField.defaultValue} placeholder="自由文本，如：建元元年" />
            </div>
          </>
        )}

        {editType === 'character' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label-text">身份/职位</label>
              <input className="input-field" ref={identityField.ref} defaultValue={identityField.defaultValue} />
            </div>
            <div>
              <label className="label-text">所属组织</label>
              <input className="input-field" ref={orgField.ref} defaultValue={orgField.defaultValue} />
            </div>
            <div>
              <label className="label-text">阵营</label>
              <input className="input-field" ref={factionField.ref} defaultValue={factionField.defaultValue} />
            </div>
            <div>
              <label className="label-text">种族</label>
              <input className="input-field" ref={raceField.ref} defaultValue={raceField.defaultValue} />
            </div>
            <div>
              <label className="label-text">状态</label>
              <input className="input-field" ref={statusField.ref} defaultValue={statusField.defaultValue} placeholder="在世/陨落/失踪" />
            </div>
          </div>
        )}

        {editType === 'geography' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label-text">层级</label>
              <select className="input-field" value={level} onChange={e => setLevel(e.target.value as GeoLevel)}>
                {GEO_LEVELS.map(lv => <option key={lv} value={lv}>{GEO_LEVEL_LABEL[lv]}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">关联势力</label>
              <input className="input-field" ref={factionField.ref} defaultValue={factionField.defaultValue} />
            </div>
            <div className="md:col-span-2">
              <label className="label-text">上级地点</label>
              <select className="input-field" value={parentId} onChange={e => setParentId(e.target.value)}>
                <option value="">无（顶级）</option>
                {geographyOptions.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.title}（{GEO_LEVEL_LABEL[(g as { level: GeoLevel }).level]}）
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {editType === 'tech' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label-text">分类</label>
              <select className="input-field" value={category} onChange={e => setCategory(e.target.value as TechCategory)}>
                {TECH_CATEGORIES.map(c => <option key={c} value={c}>{TECH_CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">首次出现</label>
              <input className="input-field" ref={firstAppearanceField.ref} defaultValue={firstAppearanceField.defaultValue} />
            </div>
            <div className="md:col-span-2">
              <label className="label-text">相关组织</label>
              <input className="input-field" ref={orgField.ref} defaultValue={orgField.defaultValue} />
            </div>
          </div>
        )}

        {editType === 'milestone' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label-text">发生时间</label>
              <input className="input-field" ref={yearField.ref} defaultValue={yearField.defaultValue} placeholder="自由文本" />
            </div>
            <div>
              <label className="label-text">重要程度</label>
              <select className="input-field" value={importance} onChange={e => setImportance(e.target.value as 'low' | 'medium' | 'high')}>
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </div>
          </div>
        )}

        {editType === 'custom' && (
          <div>
            <label className="label-text">所属分类 *</label>
            <select className="input-field" value={sectionId} onChange={e => setSectionId(e.target.value)}>
              <option value="">请选择</option>
              {customSections.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Cover image */}
      <div className="panel-gold p-5 space-y-3">
        <h2 className="section-title">封面图</h2>
        <label className="btn-outline cursor-pointer inline-flex">
          <Upload className="w-4 h-4" /> 上传封面
          <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
        </label>
        {coverImage && (
          <div className="relative inline-block">
            <img src={coverImage} alt="封面预览" className="w-full max-h-64 object-cover rounded-lg border border-gold-800/50" />
            <button
              type="button"
              className="absolute top-2 right-2 p-1 rounded bg-ink-950/80 text-red-400 hover:text-red-300"
              onClick={() => setCoverImage('')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Image gallery */}
      <div className="panel-gold p-5 space-y-3">
        <h2 className="section-title">附加图片</h2>
        <label className="btn-outline cursor-pointer inline-flex">
          <Upload className="w-4 h-4" /> 添加图片
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleImagesUpload} />
        </label>
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative group">
                <img src={img} alt={`图片 ${i + 1}`} className="w-full h-24 object-cover rounded-lg border border-ink-700" />
                <button
                  type="button"
                  className="absolute top-1 right-1 p-1 rounded bg-ink-950/80 text-red-400 hover:text-red-300"
                  onClick={() => removeImage(i)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Links management */}
      <div className="panel-gold p-5 space-y-3">
        <h2 className="section-title">关联条目</h2>
        <div className="relative">
          <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input-field pl-9"
            placeholder="搜索条目标题或标签以添加关联..."
            value={linkSearch}
            onChange={e => setLinkSearch(e.target.value)}
          />
        </div>
        {linkSearch && linkResults.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-auto bg-ink-850 rounded-lg border border-ink-700 p-1">
            {linkResults.map(e => (
              <button
                key={e.id}
                type="button"
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded hover:bg-ink-800 text-left"
                onClick={() => addLink(e)}
              >
                <span className="text-ink-200 text-sm truncate">{e.title}</span>
                <span className="tag shrink-0">{e.type}</span>
              </button>
            ))}
          </div>
        )}
        {linkSearch && linkResults.length === 0 && (
          <p className="text-sm text-ink-500">未找到匹配条目</p>
        )}
        {links.length > 0 && (
          <div className="space-y-2">
            {links.map(link => (
              <div key={link.id} className="flex items-center gap-2 p-2 bg-ink-850 rounded-lg border border-ink-700">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gold-100 truncate">{link.title}</div>
                  <input
                    className="w-full bg-transparent text-xs text-ink-400 mt-1 outline-none border-b border-transparent focus:border-gold-700"
                    placeholder="关系描述，如：师父、出生地"
                    defaultValue={link.relation || ''}
                    onChange={e => updateLinkRelation(link.id, e.target.value)}
                  />
                </div>
                <span className="tag shrink-0">{link.type}</span>
                <button type="button" className="btn-ghost text-red-400 shrink-0" onClick={() => removeLink(link.id)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button className="btn-ghost" onClick={() => navigate(-1)}>取消</button>
        <button className="btn-gold" onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4" /> {saving ? '保存中...' : '保存'}
        </button>
      </div>

      <AlertDialog open={!!alertMsg} onClose={() => setAlertMsg('')} title="提示" message={alertMsg} />
    </div>
  );
}

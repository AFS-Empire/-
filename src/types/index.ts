// ===================== 世界观档案库 · 数据模型 =====================
// 所有板块共享通用基础字段，保证可扩展性

/** 板块类型枚举 — 新增板块只需在这里加一项 */
export type SectionType =
  | 'timeline'    // 时间轴
  | 'character'   // 角色
  | 'geography'   // 地理与势力
  | 'tech'        // 科技与设定
  | 'milestone'   // 剧情里程碑
  | 'custom';     // 自定义扩展

/** 通用关联引用 — 跨板块挂接 */
export interface LinkRef {
  id: string;
  type: SectionType;
  title: string;
  relation?: string; // 关系描述，如"师父"、"出生地"
}

/** 通用条目基础字段 */
export interface BaseEntry {
  id: string;
  type: SectionType;
  title: string;
  summary: string;       // 一句话简介
  content: string;       // 正文（富文本/Markdown）
  coverImage?: string;   // 封面图（base64 或本地路径）
  images?: string[];     // 附加图片
  tags: string[];        // 自由标签
  links: LinkRef[];      // 关联其他条目
  customFields?: Record<string, string>; // 自定义扩展字段（预留）
  createdAt: number;
  updatedAt: number;
  order?: number;        // 排序权重
}

// ============ 时间轴 ============
export interface Era {
  id: string;
  name: string;           // 纪元名称，如"第一纪元·混沌初开"
  startYear: string;      // 时间范围起（自由文本，支持"约3000年前"）
  endYear: string;
  description: string;
  order: number;
}
// 时间轴事件本身就是 BaseEntry(type='timeline')，额外字段：
export interface TimelineEvent extends BaseEntry {
  type: 'timeline';
  eraId: string;          // 所属纪元
  year: string;           // 事件发生时间（自由文本）
  eraName?: string;       // 冗纪元名（展示用）
}

// ============ 角色 ============
export interface Character extends BaseEntry {
  type: 'character';
  identity?: string;      // 身份/职位
  organization?: string;  // 所属组织
  faction?: string;       // 阵营
  race?: string;          // 种族
  status?: string;        // 状态（在世/陨落/失踪）
  // 人物关系存在 links 里，relation 字段存关系描述
}

// ============ 地理与势力 ============
export type GeoLevel = 'galaxy' | 'planet' | 'city' | 'area'; // 星系/星球/城市/区域
export interface Geography extends BaseEntry {
  type: 'geography';
  level: GeoLevel;
  parentId?: string;      // 上级归属（四级嵌套）
  faction?: string;       // 关联势力/组织
}

// ============ 科技与设定 ============
export type TechCategory = 'weapon' | 'mecha' | 'facility' | 'system' | 'creature' | 'other';
export interface TechEntry extends BaseEntry {
  type: 'tech';
  category: TechCategory;
  firstAppearance?: string; // 首次出现时间
  organization?: string;    // 相关组织
}

// ============ 剧情里程碑 ============
export interface Milestone extends BaseEntry {
  type: 'milestone';
  year: string;           // 发生时间
  importance: 'low' | 'medium' | 'high'; // 重要程度
}

// ============ 自定义分类 ============
export interface CustomSection {
  id: string;
  name: string;
  description: string;
  icon: string;
  createdAt: number;
}
export interface CustomEntry extends BaseEntry {
  type: 'custom';
  sectionId: string;      // 所属自定义分类
}

// ============ 用户 ============
export type UserRole = 'admin' | 'guest';
export interface User {
  username: string;
  role: UserRole;
  passwordHash: string;   // 简单哈希（本地演示用）
}

// ============ 联合类型 ============
export type AnyEntry = TimelineEvent | Character | Geography | TechEntry | Milestone | CustomEntry;

// ============ 板块元信息 ============
export interface SectionMeta {
  type: SectionType;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export const SECTIONS: SectionMeta[] = [
  { type: 'timeline', name: '时间轴', description: '叙事主线 · 编年史', icon: 'scroll', color: 'gold' },
  { type: 'character', name: '角色库', description: '人物网络 · 生平关系', icon: 'users', color: 'gold' },
  { type: 'geography', name: '地理与势力', description: '空间图谱 · 四级嵌套', icon: 'map', color: 'gold' },
  { type: 'tech', name: '科技与设定', description: '统一仓库 · 可细分', icon: 'cog', color: 'gold' },
  { type: 'milestone', name: '剧情里程碑', description: '关键节点 · 自由文本', icon: 'flag', color: 'gold' },
  { type: 'custom', name: '扩展分类', description: '自定义板块 · 预留入口', icon: 'layers', color: 'gold' },
];

// ============ 编号系统 ============
export const SECTION_PREFIX: Record<string, string> = {
  timeline: 'TIME',
  character: 'CHAR',
  geography: 'GEO',
  tech: 'TECH',
  milestone: 'MILE',
  custom: 'CUST',
};

/** 根据板块类型和序号生成编号，如 TIME-001 */
export function genCode(type: string, index: number): string {
  const prefix = SECTION_PREFIX[type] || 'ITEM';
  return `${prefix}-${String(index).padStart(3, '0')}`;
}

/** 板块级编号（不带序号），如 TIME */
export function sectionCode(type: string): string {
  return SECTION_PREFIX[type] || 'ITEM';
}

// ============ 评论系统 ============
export interface Comment {
  id: string;
  author: string;          // 发布者用户名
  authorRole: UserRole;    // 发布者角色（admin/guest）
  content: string;         // 评论内容
  targetCode: string;      // 目标编号：GLOBAL / TIME / TIME-001 / CHAR-002 等
  targetId?: string;       // 关联条目ID（如果是针对某条目的评论）
  targetTitle?: string;    // 关联条目标题（冗余存储，方便总览展示）
  parentId?: string;       // 父评论ID（楼中楼回复）
  isPinned: boolean;       // 是否置顶（管理员回复自动置顶）
  createdAt: number;
}

/** 评论区的目标类型 */
export type CommentTarget =
  | { kind: 'global' }                          // 总评论区
  | { kind: 'section'; sectionType: string }    // 板块评论区
  | { kind: 'entry'; entryId: string; code: string }; // 条目评论区

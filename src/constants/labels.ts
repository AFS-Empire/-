/**
 * 标签映射集中定义 — 避免在多个页面重复定义
 */

import type { GeoLevel, TechCategory } from '../types';

export const LEVEL_LABEL: Record<GeoLevel, string> = {
  galaxy: '星系',
  planet: '星球',
  city: '城市',
  area: '区域',
};

export const CATEGORY_LABEL: Record<TechCategory, string> = {
  weapon: '武器',
  mecha: '机甲',
  facility: '设施',
  system: '制度',
  creature: '生物',
  other: '其他',
};

export const IMPORTANCE_LABEL: Record<'low' | 'medium' | 'high', string> = {
  low: '低',
  medium: '中',
  high: '高',
};

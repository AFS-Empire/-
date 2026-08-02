import type { AnyEntry, Era } from '../types';
import { genId, getUser, saveUser, getSetting, setSetting, getAllEntries, getAllEras, getAllUsers } from './db';
import { hashPassword } from '../lib/crypto';

/**
 * 初始化默认管理员账号 + 示例数据
 *
 * 一次性 seed 策略（修复"删除示例数据后刷新又恢复"bug）：
 * - 用 settings 表的 `seeded` 布尔 flag 标记是否已 seed 过，一旦置 true 永不 reseed。
 * - 老用户升级（已有数据但无 seeded 标记）：检测到 entries/eras/users 任一非空 → 只补写 seeded=true，不 reseed。
 * - 仅当 settings.seeded 不存在且全库为空时，才真正写入示例数据并置 seeded=true。
 * - 这样用户删除任何示例条目都不会被重新插入。
 */
export async function seedData(): Promise<void> {
  const { saveEra, saveEntry } = await import('./db');

  // 1. 已 seed 标记检查：已置 true 则直接返回，绝不 reseed
  const alreadySeeded = await getSetting('seeded');
  if (alreadySeeded === true) return;

  // 2. 老用户保护：库中已有任何数据（entries/eras/users）→ 只补标记，不 reseed
  //    避免老用户升级到本版本后被强行插入示例数据
  const [existingEntries, existingEras, existingUsers] = await Promise.all([
    getAllEntries(),
    getAllEras(),
    getAllUsers(),
  ]);
  if (existingEntries.length > 0 || existingEras.length > 0 || existingUsers.length > 0) {
    await setSetting('seeded', true);
    return;
  }

  // 3. 全新库：写入示例数据
  // 3.1 默认管理员：仅当不存在时才创建（不覆盖已有用户/已改密码）
  //     若存在但哈希是旧格式，也跳过（由 authStore 在登录时自动升级）
  const existingAdmin = await getUser('AFS');
  if (!existingAdmin) {
    await saveUser({
      username: 'AFS',
      role: 'admin',
      passwordHash: await hashPassword('20050318'),
    });
  }

  // 3.2 默认游客（同理，不存在才创建）
  const existingGuest = await getUser('youke');
  if (!existingGuest) {
    await saveUser({
      username: 'youke',
      role: 'guest',
      passwordHash: await hashPassword('12345678'),
    });
  }

  // 3.3 示例纪元
  const sampleEras: Era[] = [
    { id: genId(), name: '混沌纪元', startYear: '远古', endYear: '约万年前', description: '天地未开，万物初生。', order: 0 },
    { id: genId(), name: '帝国纪元', startYear: '元年', endYear: '约三千年', description: '第一帝国建立，文明鼎盛。', order: 1 },
    { id: genId(), name: '星航纪元', startYear: '三千年', endYear: '至今', description: '星际航行时代，各族文明交汇。', order: 2 },
  ];
  for (const e of sampleEras) await saveEra(e);

  // 3.4 示例条目
  const now = Date.now();
  const allEras = await getAllEras();

  const sampleEntries: AnyEntry[] = [
    {
      id: genId(), type: 'character', title: '凌霄', summary: '第一帝国开国皇帝',
      content: '凌霄，出身寒微，于乱世中崛起。凭借过人智谋与魄力，一统四境，建立第一帝国，定都玄都。在位期间推行均田制，开万世太平之基。',
      identity: '开国皇帝', organization: '第一帝国', faction: '帝国', race: '人族', status: '陨落',
      tags: ['主角', '皇帝', '第一帝国'],
      links: [], coverImage: '', images: [],
      createdAt: now, updatedAt: now,
    },
    {
      id: genId(), type: 'character', title: '苏璃', summary: '星航时代联邦首席科学家',
      content: '苏璃，被誉为"星航之母"。发明曲率引擎，使人类首次实现超光速航行。性格沉稳，寡言少语，却怀揣对未知的无尽热忱。',
      identity: '首席科学家', organization: '星际联邦', faction: '联邦', race: '人族', status: '在世',
      tags: ['关键角色', '科学家'],
      links: [], coverImage: '', images: [],
      createdAt: now, updatedAt: now,
    },
    {
      id: genId(), type: 'timeline', title: '第一帝国建立', summary: '凌霄一统四境',
      content: '历经三十年征战，凌霄于玄都称帝，国号"第一帝国"，定年号为建元。分封功臣，颁布新律，开启帝国纪元。',
      eraId: allEras[1]?.id || '', year: '建元元年', eraName: allEras[1]?.name,
      tags: ['建国', '重大事件'],
      links: [], coverImage: '', images: [],
      createdAt: now, updatedAt: now,
    },
    {
      id: genId(), type: 'geography', title: '玄都', summary: '第一帝国首都',
      content: '玄都，坐落于中州平原中央，背靠苍龙山脉，面朝天河。城墙以玄铁铸就，周长三百里。城内皇宫、太学、市坊分区而立，鼎盛时人口逾千万。',
      level: 'city', parentId: '', faction: '第一帝国',
      tags: ['首都', '中州'],
      links: [], coverImage: '', images: [],
      createdAt: now, updatedAt: now,
    },
    {
      id: genId(), type: 'tech', title: '曲率引擎', summary: '超光速航行核心装置',
      content: '苏璃于星航纪元初期发明。通过压缩前方空间、膨胀后方空间实现超光速移动。第一代引擎可使飞船达到光速的10倍，后续迭代版本不断突破。',
      category: 'system', firstAppearance: '星航纪元初', organization: '星际联邦',
      tags: ['核心科技', '航行'],
      links: [], coverImage: '', images: [],
      createdAt: now, updatedAt: now,
    },
    {
      id: genId(), type: 'milestone', title: '第一次星际战争', summary: '人类与异族首次大规模冲突',
      content: '星航纪元三百年，人类殖民船队与异族"烬族"在猎户臂遭遇。因语言不通引发误判，爆发持续十年的星际战争。最终以《猎户和约》停战，划定势力边界。',
      year: '星航三百年', importance: 'high',
      tags: ['战争', '转折点'],
      links: [], coverImage: '', images: [],
      createdAt: now, updatedAt: now,
    },
  ];

  // 建立示例关联
  const lingxiao = sampleEntries.find(e => e.title === '凌霄')!;
  const sulii = sampleEntries.find(e => e.title === '苏璃')!;
  const empire = sampleEntries.find(e => e.title === '第一帝国建立')!;
  const xuandu = sampleEntries.find(e => e.title === '玄都')!;
  const engine = sampleEntries.find(e => e.title === '曲率引擎')!;

  lingxiao.links = [
    { id: empire.id, type: 'timeline', title: empire.title, relation: '建立帝国' },
    { id: xuandu.id, type: 'geography', title: xuandu.title, relation: '定都于此' },
  ];
  empire.links = [
    { id: lingxiao.id, type: 'character', title: lingxiao.title, relation: '建立者' },
    { id: xuandu.id, type: 'geography', title: xuandu.title, relation: '发生地' },
  ];
  xuandu.links = [
    { id: lingxiao.id, type: 'character', title: lingxiao.title, relation: '建都者' },
    { id: empire.id, type: 'timeline', title: empire.title, relation: '建都事件' },
  ];
  sulii.links = [
    { id: engine.id, type: 'tech', title: engine.title, relation: '发明者' },
  ];
  engine.links = [
    { id: sulii.id, type: 'character', title: sulii.title, relation: '发明人' },
  ];

  for (const e of sampleEntries) await saveEntry(e);

  // 3.5 标记已 seed，后续启动永不 reseed
  await setSetting('seeded', true);
}

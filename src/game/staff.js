import { clamp, deepClone } from '../core/utils.js';

export const STAFF_ROLES = ['head', 'attack', 'defense', 'goalkeeping', 'fitness', 'medical', 'scout', 'youth', 'secretary'];
export const ESSENTIAL_STAFF_ROLES = ['head', 'medical', 'secretary'];

const ROLE_LABELS = {
  head: 'ヘッドコーチ', attack: '攻撃コーチ', defense: '守備コーチ', goalkeeping: 'GKコーチ',
  fitness: 'フィジカルコーチ', medical: '医療責任者', scout: 'スカウト', youth: 'ユース責任者', secretary: '秘書'
};
const PERSONALITIES = ['分析型', '情熱型', '規律重視', '育成型', '交渉上手', '慎重'];
const FAMILY = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林'];
const GIVEN = ['健太', '直樹', '亮', '大輔', '誠', '拓也', '美咲', '彩', '真由'];

function createStaff(rng, role, index, prefix = 'staff') {
  const ability = rng.int(42, 88);
  return {
    id: `${prefix}-${role}-${index}`,
    role,
    roleLabel: ROLE_LABELS[role],
    name: `${rng.pick(FAMILY)} ${rng.pick(GIVEN)}`,
    age: rng.int(31, 64),
    ability,
    reputation: clamp(ability + rng.int(-8, 8), 30, 95),
    wage: Math.round((180_000 + ability ** 2 * 260) / 10_000) * 10_000,
    signingFee: Math.round((1_000_000 + ability ** 2 * 900) / 100_000) * 100_000,
    contractWeeks: rng.int(52, 156),
    personality: rng.pick(PERSONALITIES),
    specialty: ROLE_LABELS[role],
    interim: false
  };
}

export function createStaffMarket(rng, count = 27) {
  const target = Math.max(STAFF_ROLES.length, count);
  return Array.from({ length: target }, (_, index) => createStaff(rng, STAFF_ROLES[index % STAFF_ROLES.length], index + 1, 'candidate'));
}

export function createInitialStaff(rng) {
  return STAFF_ROLES.map((role, index) => {
    const staff = createStaff(rng, role, index + 1, 'appointed');
    staff.ability = clamp(staff.ability - 8, 38, 78);
    staff.contractWeeks = 104;
    staff.signingFee = 0;
    return staff;
  });
}

export function staffEffects(staff = []) {
  const value = (role) => staff.find((item) => item.role === role)?.ability ?? 35;
  const coaching = [value('head'), value('attack'), value('defense'), value('goalkeeping'), value('youth')];
  return {
    trainingMultiplier: 0.9 + coaching.reduce((sum, item) => sum + item, 0) / coaching.length / 400,
    fitnessRecovery: Math.max(0, Math.floor((value('fitness') - 40) / 12)),
    medicalReduction: Math.max(0, Math.floor((value('medical') - 40) / 18)),
    scoutingAccuracy: Math.max(0, (value('scout') - 35) / 100),
    youthBoost: Math.max(0, (value('youth') - 40) / 160),
    secretaryPriority: Math.max(0, Math.floor((value('secretary') - 35) / 12))
  };
}

export function appointStaff(state, staffId) {
  const next = deepClone(state);
  const candidate = next.staffMarket?.find((item) => item.id === staffId);
  if (!candidate) return { ok: false, state, message: 'スタッフ候補が見つかりません。' };
  const club = next.clubs.find((item) => item.id === next.userClubId);
  if (!club || club.cash < candidate.signingFee) return { ok: false, state, message: '契約金が不足しています。' };
  club.cash -= candidate.signingFee;
  next.staff = (next.staff ?? []).filter((item) => item.role !== candidate.role);
  next.staff.push({ ...candidate, id: `appointed-${candidate.role}-${next.season ?? 1}-${next.week ?? 1}-${candidate.id}`, interim: false });
  next.staffMarket = next.staffMarket.filter((item) => item.id !== staffId);
  return { ok: true, state: next, message: `${candidate.name}を${candidate.roleLabel}に任命しました。` };
}

export function releaseStaff(state, staffId) {
  const next = deepClone(state);
  const member = next.staff?.find((item) => item.id === staffId);
  if (!member) return { ok: false, state, message: 'スタッフが見つかりません。' };
  next.staff = next.staff.filter((item) => item.id !== staffId);
  return { ok: true, state: ensureEssentialStaff(next), message: `${member.name}との契約を終了しました。` };
}

export function ensureEssentialStaff(state) {
  const next = deepClone(state);
  next.staff ??= [];
  for (const role of ESSENTIAL_STAFF_ROLES) {
    if (next.staff.some((item) => item.role === role && item.contractWeeks > 0)) continue;
    next.staff = next.staff.filter((item) => item.role !== role);
    next.staff.push({
      id: `interim-${role}-${next.season ?? 1}-${next.week ?? 1}`,
      role,
      roleLabel: ROLE_LABELS[role],
      name: `代行 ${ROLE_LABELS[role]}`,
      age: 45,
      ability: 38,
      reputation: 35,
      wage: 120_000,
      signingFee: 0,
      contractWeeks: 8,
      personality: '臨時対応',
      specialty: ROLE_LABELS[role],
      interim: true
    });
  }
  return next;
}

export function progressStaffContracts(state) {
  const next = deepClone(state);
  next.staff = (next.staff ?? []).map((item) => ({ ...item, contractWeeks: Math.max(0, (item.contractWeeks ?? 0) - 1) })).filter((item) => item.contractWeeks > 0);
  return ensureEssentialStaff(next);
}

// ============================================================================
// 数据访问层：统一接口，底层在「Supabase 云端」与「本地 localStorage」间切换
// 所有方法均返回 Promise，UI 无需关心数据存在哪里。
// ============================================================================
import { getClient, isCloudMode } from './supabaseClient.js';
import { uid } from './utils.js';

const LS = {
  student: 'ssc_student',
  study: 'ssc_study_tasks',
  exercise: 'ssc_exercise_records',
  pet: 'ssc_pet',
  rewards: 'ssc_rewards',
  chores: 'ssc_chores',
};

const lsGet = (k, d) => {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v == null ? d : v;
  } catch {
    return d;
  }
};
const lsSet = (k, v) => localStorage.setItem(k, JSON.stringify(v));

async function currentUserId() {
  const sb = getClient();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data?.user?.id || null;
}

function defaultStudent() {
  return {
    id: uid(),
    name: '同学',
    grade: '高一',
    study_goal_minutes: 120,
    exercise_goal_minutes: 30,
    streak_goal_days: 7,
  };
}

// ---------------------------------------------------------------------------
// 积分字段统一 + 变更广播
// ---------------------------------------------------------------------------
// 历史代码中 total_points(数据库列) 与 totalPoints(JS 字段) 混用，本地模式下
// saveStudent 又删掉了 total_points，导致部分页面读到 undefined 显示 0 积分。
// 这里强制两者恒等，杜绝字段名不一致造成的显示错误。
function normalizeStudent(s) {
  if (!s || typeof s !== 'object') return s;
  const v = s.total_points != null ? Number(s.total_points)
    : (s.totalPoints != null ? Number(s.totalPoints) : 0);
  s.total_points = Number.isFinite(v) ? v : 0;
  s.totalPoints = s.total_points;
  return s;
}

/** 读取积分（兼容两种字段名，永远返回数字） */
export function pointsOf(student) {
  const raw = student?.total_points ?? student?.totalPoints;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** 广播「资料/积分已变更」，界面据此局部刷新，无需整页重载 */
function emitStudentChanged(student) {
  try {
    window.dispatchEvent(new CustomEvent('ssc:student-changed', { detail: { student } }));
  } catch (_) { /* 非浏览器环境忽略 */ }
}

// ---------------------------------------------------------------------------
// 学生资料
// ---------------------------------------------------------------------------
export async function getStudent() {
  if (isCloudMode()) {
    const sb = getClient();
    const userId = await currentUserId();
    try {
      let { data } = await sb.from('profiles').select('*').eq('user_id', userId).maybeSingle();
      if (!data) {
        // 新建资料时，优先沿用本地已累计的金币，避免切换云端后清零
        const local = lsGet(LS.student, {});
        const seedPoints = Number(local?.totalPoints) || 0;
        const init = { user_id: userId, name: local?.name || '同学', grade: local?.grade || '高一', study_goal_minutes: 120, exercise_goal_minutes: 30, streak_goal_days: 7, total_points: seedPoints };
        const { data: inserted, error } = await sb.from('profiles').insert(init).select().single();
        if (error) throw new Error(error.message);
        data = inserted;
      }
      return normalizeStudent({ ...data, totalPoints: data.total_points ?? 0 });
    } catch (e) {
      // 云端读取失败：降级为本地默认值，避免整页白屏。
      console.warn('[api] getStudent 云端读取失败，使用默认资料（请检查 profiles 表结构）：', e.message);
      const local = lsGet(LS.student, {});
      return normalizeStudent({ id: 'local-fallback', user_id: userId, name: local?.name || '同学', grade: local?.grade || '高一', study_goal_minutes: 120, exercise_goal_minutes: 30, streak_goal_days: 7, totalPoints: Number(local?.totalPoints) || 0 });
    }
  }
  let s = lsGet(LS.student, null);
  if (!s) {
    s = defaultStudent();
    lsSet(LS.student, s);
  }
  return normalizeStudent(s);
}

export async function saveStudent(patch) {
  if (isCloudMode()) {
    const sb = getClient();
    const userId = await currentUserId();
    const existing = await sb.from('profiles').select('id,user_id').eq('user_id', userId).maybeSingle();
    // 统一字段名：totalPoints(JS) -> total_points(列)
    const row = { ...patch, user_id: userId };
    if (patch.totalPoints != null) row.total_points = patch.totalPoints;
    delete row.totalPoints;
    let res;
    if (existing?.data) {
      res = await sb.from('profiles').update(row).eq('user_id', userId).select().single();
    } else {
      res = await sb.from('profiles').insert(row).select().single();
    }
    if (res.error) throw new Error(res.error.message);
    const saved = normalizeStudent({ ...res.data, totalPoints: res.data.total_points ?? 0 });
    emitStudentChanged(saved);
    return saved;
  }
  const s = { ...defaultStudent(), ...lsGet(LS.student, {}), ...patch };
  if (patch.totalPoints != null) s.totalPoints = patch.totalPoints;
  if (patch.total_points != null) s.totalPoints = patch.total_points;
  const saved = normalizeStudent(s);
  lsSet(LS.student, saved);
  emitStudentChanged(saved);
  return saved;
}

// 调整金币余额（宠物/奖励/家务共用）。返回最新余额。
export async function addPoints(delta) {
  const s = await getStudent();
  const next = Math.max(0, pointsOf(s) + delta);
  const saved = await saveStudent({ total_points: next });
  return pointsOf(saved);
}

// ---------------------------------------------------------------------------
// 学习任务
// ---------------------------------------------------------------------------
export async function listStudyTasks() {
  if (isCloudMode()) {
    const sb = getClient();
    const { data, error } = await sb.from('study_tasks').select('*').order('started_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }
  return lsGet(LS.study, []);
}

export async function addStudyTask(t) {
  if (isCloudMode()) {
    const sb = getClient();
    const userId = await currentUserId();
    const row = { user_id: userId, ...t };
    const { data, error } = await sb.from('study_tasks').insert(row).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  const row = { id: uid(), created_at: new Date().toISOString(), ...t };
  const arr = lsGet(LS.study, []);
  arr.unshift(row);
  lsSet(LS.study, arr);
  return row;
}

export async function updateStudyTask(id, patch) {
  if (isCloudMode()) {
    const sb = getClient();
    const { data, error } = await sb.from('study_tasks').update(patch).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  const arr = lsGet(LS.study, []).map((x) => (x.id === id ? { ...x, ...patch } : x));
  lsSet(LS.study, arr);
  return arr.find((x) => x.id === id);
}

export async function deleteStudyTask(id) {
  if (isCloudMode()) {
    const sb = getClient();
    const { error } = await sb.from('study_tasks').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }
  lsSet(LS.study, lsGet(LS.study, []).filter((x) => x.id !== id));
}

// ---------------------------------------------------------------------------
// 运动记录
// ---------------------------------------------------------------------------
export async function listExerciseRecords() {
  if (isCloudMode()) {
    const sb = getClient();
    const { data, error } = await sb.from('exercise_records').select('*').order('recorded_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }
  return lsGet(LS.exercise, []);
}

export async function addExerciseRecord(r) {
  if (isCloudMode()) {
    const sb = getClient();
    const userId = await currentUserId();
    const row = { user_id: userId, ...r };
    const { data, error } = await sb.from('exercise_records').insert(row).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  const row = { id: uid(), created_at: new Date().toISOString(), ...r };
  const arr = lsGet(LS.exercise, []);
  arr.unshift(row);
  lsSet(LS.exercise, arr);
  return row;
}

export async function updateExerciseRecord(id, patch) {
  if (isCloudMode()) {
    const sb = getClient();
    const { data, error } = await sb.from('exercise_records').update(patch).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  const arr = lsGet(LS.exercise, []).map((x) => (x.id === id ? { ...x, ...patch } : x));
  lsSet(LS.exercise, arr);
  return arr.find((x) => x.id === id);
}

export async function deleteExerciseRecord(id) {
  if (isCloudMode()) {
    const sb = getClient();
    const { error } = await sb.from('exercise_records').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }
  lsSet(LS.exercise, lsGet(LS.exercise, []).filter((x) => x.id !== id));
}

// ---------------------------------------------------------------------------
// 宠物（虚拟宠物：领养、状态、互动、装扮）
// ---------------------------------------------------------------------------
export async function getPet() {
  if (isCloudMode()) {
    const sb = getClient();
    const userId = await currentUserId();
    const { data } = await sb.from('pets').select('*').eq('user_id', userId).maybeSingle();
    return data || null;
  }
  return lsGet(LS.pet, null);
}

export async function savePet(petData) {
  if (isCloudMode()) {
    const sb = getClient();
    const userId = await currentUserId();
    const existing = await sb.from('pets').select('id').eq('user_id', userId).maybeSingle();
    const row = { user_id: userId, ...petData };
    if (existing?.data) {
      const { data, error } = await sb.from('pets').update(row).eq('user_id', userId).select().single();
      if (error) throw new Error(error.message);
      return data;
    }
    const { data, error } = await sb.from('pets').insert(row).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  lsSet(LS.pet, petData);
  return petData;
}

export async function deletePet() {
  if (isCloudMode()) {
    const sb = getClient();
    const userId = await currentUserId();
    const { error } = await sb.from('pets').delete().eq('user_id', userId);
    if (error) throw new Error(error.message);
    return;
  }
  lsSet(LS.pet, null);
}

// ---------------------------------------------------------------------------
// 导入旧版 App 数据（legacy JSON：student / tasks / exercises / pet）
// 仅在已登录云端账号时有意义；RLS 保证写入的是当前用户的数据。
// 通过自然键去重，重复导入不会翻倍。
// ---------------------------------------------------------------------------
const STUDY_STATUS_MAP = { '已完成': 'done', '完成': 'done', '已结束': 'done' };
const EX_INTENSITY_MAP = { '低': 'low', '中': 'mid', '高': 'high' };

function mapStudyStatus(s) {
  if (!s) return 'not_started';
  if (String(s).includes('进行中')) return 'in_progress';
  if (String(s).includes('完成') || String(s).includes('结束')) return 'done';
  return 'not_started';
}
function mapIntensity(s) {
  return EX_INTENSITY_MAP[s] || 'mid';
}
const normKey = (...parts) => parts.map((p) => String(p ?? '').replace(/\s+/g, ' ')).join('|');

export async function importLegacyData(parsed) {
  const result = { student: false, study: 0, exercise: 0, pet: false, rewards: 0, chores: false, skipped: 0, petError: null };
  if (!parsed || typeof parsed !== 'object') throw new Error('文件格式不正确（不是 JSON 对象）');

  // 1) 学生资料
  const st = parsed.student || {};
  if (st.name || st.grade) {
    await saveStudent({
      name: st.name || '同学',
      grade: st.grade || '高一',
      study_goal_minutes: Number(st.dailyStudyGoalMinutes) || 120,
      exercise_goal_minutes: Number(st.dailyExerciseGoalMinutes) || 30,
      streak_goal_days: Number(st.streakGoalDays) || 7,
      total_points: Number(st.totalPoints) || 0,
    });
    result.student = true;
  }

  // 2) 学习任务
  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  if (tasks.length) {
    const existing = await listStudyTasks();
    const keys = new Set(existing.map((t) => normKey(t.started_at, t.subject, t.title)));
    for (const t of tasks) {
      const started_at = t.startDate || new Date().toISOString();
      const key = normKey(started_at, t.subject, t.title);
      if (keys.has(key)) { result.skipped++; continue; }
      const notes = [t.notes, t.content].filter((x) => x && String(x).trim()).join(' | ');
      await addStudyTask({
        subject: t.subject || '其他',
        title: t.title || '',
        duration_minutes: Number(t.durationMinutes) || 0,
        started_at,
        status: mapStudyStatus(t.status),
        notes,
      });
      result.study++;
    }
  }

  // 3) 运动记录
  const exs = Array.isArray(parsed.exercises) ? parsed.exercises : [];
  if (exs.length) {
    const existing = await listExerciseRecords();
    const keys = new Set(existing.map((e) => normKey(e.recorded_at, e.type, e.calories)));
    for (const e of exs) {
      const recorded_at = e.date || new Date().toISOString();
      const cal = Number(e.calories) || 0;
      const key = normKey(recorded_at, e.type, cal);
      if (keys.has(key)) { result.skipped++; continue; }
      await addExerciseRecord({
        type: e.type || '其他',
        duration_minutes: Number(e.durationMinutes) || 0,
        sets: Number(e.sets) || 0,
        reps: Number(e.reps) || 0,
        intensity: mapIntensity(e.intensity),
        calories: cal,
        weight_kg: 50,
        notes: e.notes || '',
        recorded_at,
      });
      result.exercise++;
    }
  }

  // 4) 宠物（仅在云端且当前无宠物时导入；失败不阻断其它数据）
  const pet = parsed.pet;
  if (pet && pet.type) {
    try {
      const cur = await getPet();
      if (!cur) {
        await savePet({
          type: pet.type,
          nickname: pet.nickname || pet.type,
          hunger: pet.hunger == null ? 100 : Number(pet.hunger),
          happiness: pet.happiness == null ? 100 : Number(pet.happiness),
          cleanliness: pet.cleanliness == null ? 100 : Number(pet.cleanliness),
          equipment: Array.isArray(pet.equipment) ? pet.equipment : [],
          food_inv: Number(pet.foodInv) || 0,
          last_fed: pet.lastFed ? new Date(Number(pet.lastFed)).toISOString() : new Date().toISOString(),
        });
        result.pet = true;
      } else {
        result.pet = 'exists';
      }
    } catch (e) {
      result.petError = e.message;
    }
  }

  // 5) 奖励兑换记录（历史）
  const rewards = Array.isArray(parsed.rewards) ? parsed.rewards : [];
  for (const rw of rewards) {
    if (!rw || !rw.name) continue;
    await addReward({
      name: rw.name,
      cost: Number(rw.cost) || 0,
      icon: rw.icon || '🎁',
      color: rw.color || '#ff9500',
      redeemed_at: rw.date || new Date().toISOString(),
    });
    result.rewards++;
  }

  // 6) 每日家务（整体对象）
  const chores = parsed.chores;
  if (chores && typeof chores === 'object') {
    try {
      await saveChores(chores);
      result.chores = true;
    } catch (e) {
      result.choresError = e.message;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// 奖励兑换记录（金币兑换商店：每兑换一次写一条历史）
// ---------------------------------------------------------------------------
export async function listRewards() {
  if (isCloudMode()) {
    const sb = getClient();
    const { data, error } = await sb.from('rewards').select('*').order('redeemed_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }
  return lsGet(LS.rewards, []);
}

export async function addReward(r) {
  const redeemedAt = r.redeemed_at || new Date().toISOString();
  if (isCloudMode()) {
    const sb = getClient();
    const userId = await currentUserId();
    const row = {
      user_id: userId,
      name: r.name,
      cost: Number(r.cost) || 0,
      icon: r.icon || '🎁',
      color: r.color || '#ff9500',
      redeemed_at: redeemedAt,
    };
    const { data, error } = await sb.from('rewards').insert(row).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  const row = { id: uid(), name: r.name, cost: Number(r.cost) || 0, icon: r.icon || '🎁', color: r.color || '#ff9500', redeemed_at: redeemedAt };
  const arr = lsGet(LS.rewards, []);
  arr.unshift(row);
  lsSet(LS.rewards, arr);
  return row;
}

// ---------------------------------------------------------------------------
// 每日家务（每个用户一行 jsonb；应用层做每日凌晨重置）
// ---------------------------------------------------------------------------
const DEFAULT_CHORE_ITEMS = [
  { key: '扫地', icon: '🧹', done: false },
  { key: '收拾玩具', icon: '🧸', done: false },
  { key: '扔垃圾', icon: '🗑', done: false },
  { key: '刷牙洗脸', icon: '🪥', done: false },
  { key: '主动洗手', icon: '🧼', done: false },
];

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function defaultChores() {
  return { date: todayStr(), items: DEFAULT_CHORE_ITEMS.map((x) => ({ ...x })), randomTask: null, customTasks: [] };
}

export async function getChores() {
  let ch;
  if (isCloudMode()) {
    const sb = getClient();
    const userId = await currentUserId();
    const { data } = await sb.from('chores').select('*').eq('user_id', userId).maybeSingle();
    ch = data?.data || null;
  } else {
    ch = lsGet(LS.chores, null);
  }
  if (!ch || ch.date !== todayStr()) ch = defaultChores();
  return ch;
}

export async function saveChores(ch) {
  if (isCloudMode()) {
    const sb = getClient();
    const userId = await currentUserId();
    const existing = await sb.from('chores').select('id').eq('user_id', userId).maybeSingle();
    const row = { user_id: userId, data: ch, updated_at: new Date().toISOString() };
    let res;
    if (existing?.data) res = await sb.from('chores').update(row).eq('user_id', userId).select().single();
    else res = await sb.from('chores').insert(row).select().single();
    if (res.error) throw new Error(res.error.message);
    return res.data;
  }
  lsSet(LS.chores, ch);
  return ch;
}

// ---------------------------------------------------------------------------
// 清空全部打卡数据（保留资料）
// ---------------------------------------------------------------------------
export async function clearAll() {
  if (isCloudMode()) {
    const sb = getClient();
    const userId = await currentUserId();
    await sb.from('study_tasks').delete().eq('user_id', userId);
    await sb.from('exercise_records').delete().eq('user_id', userId);
    return;
  }
  lsSet(LS.study, []);
  lsSet(LS.exercise, []);
}

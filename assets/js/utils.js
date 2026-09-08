// ============================================================================
// 公共常量与工具函数
// ============================================================================

// 科目定义（保留原 iOS 版 10 个科目 + 图标 + 配色）
export const SUBJECTS = [
  { key: '语文', icon: '📖', color: '#e57373' },
  { key: '数学', icon: '➗', color: '#64b5f6' },
  { key: '英语', icon: '🔤', color: '#81c784' },
  { key: '物理', icon: '🔭', color: '#ffb74d' },
  { key: '化学', icon: '🧪', color: '#ba68c8' },
  { key: '生物', icon: '🌱', color: '#4db6ac' },
  { key: '历史', icon: '🏛️', color: '#a1887f' },
  { key: '地理', icon: '🌍', color: '#4fc3f7' },
  { key: '政治', icon: '⚖️', color: '#f06292' },
  { key: '其他', icon: '📌', color: '#90a4ae' },
];

export const SUBJECT_MAP = Object.fromEntries(SUBJECTS.map((s) => [s.key, s]));

// 运动项目 + MET 值（用于卡路里估算：MET × 体重kg × 时长h）
export const EXERCISES = [
  { key: '跑步', icon: '🏃', met: 7.0 },
  { key: '跳绳', icon: '🤾', met: 11.0 },
  { key: '俯卧撑', icon: '💪', met: 3.5 },
  { key: '仰卧起坐', icon: '🧘', met: 3.0 },
  { key: '球类', icon: '🏀', met: 6.0 },
  { key: '骑行', icon: '🚴', met: 6.0 },
  { key: '游泳', icon: '🏊', met: 6.0 },
  { key: '瑜伽', icon: '🧎', met: 2.5 },
  { key: '其他', icon: '🎽', met: 4.0 },
];

export const EXERCISE_MAP = Object.fromEntries(EXERCISES.map((e) => [e.key, e]));

export const INTENSITY = {
  low: { key: 'low', label: '低', factor: 0.85 },
  mid: { key: 'mid', label: '中', factor: 1.0 },
  high: { key: 'high', label: '高', factor: 1.2 },
};

export const STATUS = {
  not_started: { key: 'not_started', label: '未开始', color: '#90a4ae' },
  in_progress: { key: 'in_progress', label: '进行中', color: '#ffb300' },
  done: { key: 'done', label: '已完成', color: '#43a047' },
};

export const ACHIEVEMENTS = [
  { key: 'first_study', icon: '🌟', title: '初次学习', desc: '完成第一条学习任务' },
  { key: 'first_exercise', icon: '🔥', title: '动起来', desc: '完成第一条运动记录' },
  { key: 'streak7', icon: '📅', title: '一周不辍', desc: '连续打卡 7 天' },
  { key: 'study10', icon: '📚', title: '学富五车', desc: '累计完成 10 条学习' },
  { key: 'exercise10', icon: '🏋️', title: '运动达人', desc: '累计完成 10 条运动' },
  { key: 'total20', icon: '🏆', title: '打卡达人', desc: '累计打卡 20 次' },
];

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------
export const uid = () =>
  (crypto.randomUUID && crypto.randomUUID()) ||
  'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 6) return '夜深了';
  if (h < 9) return '早安';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  if (h < 22) return '晚上好';
  return '夜深了';
}

export function formatDuration(min) {
  min = Math.max(0, Math.round(Number(min) || 0));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}小时${m}分`;
  if (h) return `${h}小时`;
  return `${m}分`;
}

export function fmtDateTime(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtDate(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isToday(iso) {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

// 返回某天 0 点的 Date
export function dayStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// 计算连续打卡天数：传入所有有记录的天（Date 或 ISO），返回截至今天/昨天的连续天数
export function computeStreak(dateList) {
  const days = new Set(dateList.map((x) => dayStart(new Date(x)).getTime()));
  if (days.size === 0) return 0;
  let streak = 0;
  let cursor = dayStart(new Date()); // 今天
  if (!days.has(cursor.getTime())) {
    // 今天还没打卡，从昨天起算
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursor.getTime())) return 0;
  }
  while (days.has(cursor.getTime())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// 卡路里估算
export function estimateCalories(type, durationMin, weightKg, intensityKey) {
  const ex = EXERCISE_MAP[type] || EXERCISE_MAP['其他'];
  const factor = (INTENSITY[intensityKey] || INTENSITY.mid).factor;
  const hours = (Number(durationMin) || 0) / 60;
  return Math.round(ex.met * factor * (Number(weightKg) || 50) * hours);
}

// 简易转义，防止 XSS
export function esc(s) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(s ?? '').replace(/[&<>"']/g, (c) => map[c] || c);
}

// SVG 圆环进度（运动/学习概览卡片复用）
export function ringSVG(percent, size = 80, strokeWidth = 8) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - Math.min(percent, 100) / 100);
  const color = percent >= 100 ? '#43a047' : '#ff9500';
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff3e6" stroke-width="${strokeWidth}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"
      stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
      transform="rotate(-90 ${cx} ${cy})" style="transition:stroke-dashoffset .6s ease"/>
    <text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="16" font-weight="800" fill="${color}">${Math.round(percent)}%</text>
  </svg>`;
}

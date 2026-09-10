// ============================================================================
// 首页：今日概览
// ============================================================================
import { progressRing, toast } from '../ui.js';
import {
  SUBJECT_MAP, EXERCISE_MAP, STATUS, INTENSITY, ACHIEVEMENTS,
  greeting, formatDuration, fmtDateTime, isToday, computeStreak, esc,
} from '../utils.js';
import { getStudent, pointsOf } from '../api.js';

export function renderHome(ctx) {
  const { student, studyTasks, exerciseRecords } = ctx.state;

  const todayStudy = studyTasks.filter((t) => isToday(t.started_at));
  const todayExercise = exerciseRecords.filter((t) => isToday(t.recorded_at));

  const todayStudyMin = todayStudy.reduce((s, t) => s + (Number(t.duration_minutes) || 0), 0);
  const todayExerciseMin = todayExercise.reduce((s, t) => s + (Number(t.duration_minutes) || 0), 0);

  const studyPct = student.study_goal_minutes ? (todayStudyMin / student.study_goal_minutes) * 100 : 0;
  const exPct = student.exercise_goal_minutes ? (todayExerciseMin / student.exercise_goal_minutes) * 100 : 0;

  // 打卡天数（有已完成学习或运动记录的日子）
  const doneStudyDays = studyTasks.filter((t) => t.status === 'done').map((t) => t.started_at);
  const exDays = exerciseRecords.map((t) => t.recorded_at);
  const streak = computeStreak([...doneStudyDays, ...exDays]);

  const doneStudy = studyTasks.filter((t) => t.status === 'done').length;
  const exCount = exerciseRecords.length;
  // 金币余额：统一用 pointsOf() 取值（兼容 total_points / totalPoints 两种字段名）
  // 学习完成+5、运动打卡+3、家务+2；奖励/宠物消费扣减
  const points = pointsOf(student);

  const ach = computeAchievements({ doneStudy, exCount, streak, points });

  // 圆环：儿童友好版——更粗的描边 + 糖果色轨道 + 自适应字号（"1小时30分"不错位）
  const ring = (pct, min, goal, color, label) => {
    const txt = formatDuration(min);
    const fs = txt.length <= 3 ? 26 : txt.length <= 4 ? 22 : 19;
    return progressRing(pct, {
      label: txt, sub: `/${formatDuration(goal)}`, color,
      size: 132, stroke: 14, fontSize: fs, track: '#eef3ff',
    });
  };

  const taskRow = (t) => {
    const sm = SUBJECT_MAP[t.subject] || SUBJECT_MAP['其他'];
    const st = STATUS[t.status] || STATUS.not_started;
    return `<li class="mini-row">
      <span class="mini-ico" style="background:${sm.color}1a">${sm.icon}</span>
      <span class="mini-main"><b>${esc(t.title || sm.key)}</b><small>${sm.key} · ${formatDuration(t.duration_minutes)}</small></span>
      <span class="pill" style="background:${st.color}1a;color:${st.color}">${st.label}</span>
    </li>`;
  };
  const exRow = (t) => {
    const em = EXERCISE_MAP[t.type] || EXERCISE_MAP['其他'];
    const it = (INTENSITY[t.intensity] || INTENSITY.mid).label;
    return `<li class="mini-row">
      <span class="mini-ico" style="background:#4f8cff1a">${em.icon}</span>
      <span class="mini-main"><b>${em.key}</b><small>${formatDuration(t.duration_minutes)} · ${it}强度</small></span>
      <span class="pill" style="background:#4f8cff1a;color:#4f8cff">${Math.round(t.calories)} kcal</span>
    </li>`;
  };

  ctx.viewEl.innerHTML = `
  <section class="page">
    <div class="hero">
      <div>
        <h1>${greeting()}，${esc(student.name)} 👋</h1>
        <p class="muted">${new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
      </div>
      <div class="hero-badges">
        <div class="badge"><span>🔥</span>${streak} 天连续</div>
        <div class="badge"><span>⭐</span><span data-points>${points}</span> 积分</div>
      </div>
    </div>

    <div class="ring-row">
      ${ring(studyPct, todayStudyMin, student.study_goal_minutes, '#5b8dff', '学习')}
      ${ring(exPct, todayExerciseMin, student.exercise_goal_minutes, '#3ddc84', '运动')}
    </div>

    <div class="card">
      <div class="card-head"><h2>今日学习任务</h2><span class="muted">${todayStudy.length} 条</span></div>
      ${todayStudy.length ? `<ul class="mini-list">${todayStudy.slice(0, 4).map(taskRow).join('')}</ul>` : '<p class="empty">今天还没有学习任务，去「学习」页添加吧～</p>'}
      <a class="more" href="#/study">查看全部 →</a>
    </div>

    <div class="card">
      <div class="card-head"><h2>今日运动</h2><span class="muted">${todayExercise.length} 条</span></div>
      ${todayExercise.length ? `<ul class="mini-list">${todayExercise.slice(0, 4).map(exRow).join('')}</ul>` : '<p class="empty">今天还没运动，去「运动」页打卡吧～</p>'}
      <a class="more" href="#/exercise">查看全部 →</a>
    </div>

    <div class="card">
      <div class="card-head"><h2>成就徽章</h2><span class="muted">${ach.filter(Boolean).length}/${ACHIEVEMENTS.length}</span></div>
      <div class="ach-grid">
        ${ACHIEVEMENTS.map((a, i) => `<div class="ach ${ach[i] ? 'on' : ''}" title="${a.desc}">
          <div class="ach-ico">${a.icon}</div><div class="ach-title">${a.title}</div></div>`).join('')}
      </div>
    </div>
  </section>`;
}

export function computeAchievements({ doneStudy, exCount, streak, points }) {
  return [
    doneStudy > 0,                 // first_study
    exCount > 0,                   // first_exercise
    streak >= 7,                   // streak7
    doneStudy >= 10,               // study10
    exCount >= 10,                 // exercise10
    (doneStudy + exCount) >= 20,   // total20（累计打卡 20 次，替代原来的虚拟积分 100）
  ];
}

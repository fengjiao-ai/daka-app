// ============================================================================
// 设置
// ============================================================================
import * as api from '../api.js';
import { openModal, closeModal, toast, confirmDialog } from '../ui.js';
import {
  ACHIEVEMENTS, SUBJECT_MAP, EXERCISE_MAP, STATUS, INTENSITY,
  formatDuration, fmtDateTime, computeStreak, isToday, esc,
} from '../utils.js';
import { isCloudMode, loadConfig } from '../supabaseClient.js';
import { computeAchievements } from './home.js';

export function renderSettings(ctx) {
  const { student, studyTasks, exerciseRecords } = ctx.state;
  const doneStudy = studyTasks.filter((t) => t.status === 'done').length;
  const exCount = exerciseRecords.length;
  // 统一用 pointsOf() 取金币余额，与首页/金币兑换页一致
  const points = api.pointsOf(student);
  const streak = computeStreak([...studyTasks.filter((t) => t.status === 'done').map((t) => t.started_at), ...exerciseRecords.map((t) => t.recorded_at)]);
  const ach = computeAchievements({ doneStudy, exCount, streak, points });

  const cloud = isCloudMode();
  const cfg = loadConfig();

  ctx.viewEl.innerHTML = `
  <section class="page">
    <div class="page-head"><h1>设置</h1></div>

    <div class="card conn-card ${cloud ? 'ok' : ''}">
      <div class="card-head"><h2>数据同步</h2></div>
      ${cloud
        ? `<p class="conn-status">☁️ 已连接 Supabase 云端 · 电脑/手机多端实时同步</p>
           <button class="btn ghost" id="signout">退出登录</button>`
        : `<p class="conn-status">💾 本地模式（数据仅存于本浏览器）</p>
           <button class="btn primary" id="connect-cloud">连接 Supabase 云端 →</button>`}
    </div>

    <div class="card">
      <div class="card-head"><h2>个人资料</h2></div>
      <form id="profile-form" class="form">
        <label>姓名</label>
        <input name="name" value="${esc(student.name)}"/>
        <label>年级</label>
        <input name="grade" value="${esc(student.grade)}"/>
      </form>
      <button class="btn primary" id="save-profile">保存资料</button>
    </div>

    <div class="card">
      <div class="card-head"><h2>每日目标</h2></div>
      <form id="goal-form" class="form">
        <label>学习目标（分钟/天）</label>
        <input type="number" name="study_goal_minutes" min="0" value="${esc(student.study_goal_minutes)}"/>
        <label>运动目标（分钟/天）</label>
        <input type="number" name="exercise_goal_minutes" min="0" value="${esc(student.exercise_goal_minutes)}"/>
        <label>连续打卡目标（天）</label>
        <input type="number" name="streak_goal_days" min="0" value="${esc(student.streak_goal_days)}"/>
      </form>
      <button class="btn primary" id="save-goal">保存目标</button>
    </div>

    <div class="card">
      <div class="card-head"><h2>积分与成就</h2></div>
      <div class="stat-cards"><div class="stat-card"><span>🪙</span><b data-points>${points}</b><small>金币余额</small></div>
        <div class="stat-card"><span>🔥</span><b>${streak}</b><small>连续打卡</small></div></div>
      <div class="ach-grid">
        ${ACHIEVEMENTS.map((a, i) => `<div class="ach ${ach[i] ? 'on' : ''}" title="${a.desc}">
          <div class="ach-ico">${a.icon}</div><div class="ach-title">${a.title}</div></div>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>数据与备份</h2></div>
      <button class="btn ghost" id="export">导出打卡报告</button>
      <button class="btn outline" id="import-legacy" style="margin-top:10px">📥 导入旧数据（旧版 App 备份）</button>
      <input type="file" id="import-file" accept="application/json,.json" style="display:none"/>
      <button class="btn danger" id="clear" style="margin-top:10px">清空全部打卡数据</button>
    </div>
  </section>`;

  ctx.viewEl.querySelector('#save-profile').onclick = async () => {
    const f = ctx.viewEl.querySelector('#profile-form');
    try {
      await api.saveStudent({ name: f.name.value.trim() || '同学', grade: f.grade.value.trim() || '高一' });
      await ctx.reload();
      toast('资料已保存', 'success');
    } catch (e) { toast('保存失败：' + e.message, 'error'); }
  };
  ctx.viewEl.querySelector('#save-goal').onclick = async () => {
    const f = ctx.viewEl.querySelector('#goal-form');
    try {
      await api.saveStudent({
        study_goal_minutes: Number(f.study_goal_minutes.value) || 0,
        exercise_goal_minutes: Number(f.exercise_goal_minutes.value) || 0,
        streak_goal_days: Number(f.streak_goal_days.value) || 0,
      });
      await ctx.reload();
      toast('目标已保存', 'success');
    } catch (e) { toast('保存失败：' + e.message, 'error'); }
  };
  ctx.viewEl.querySelector('#export').onclick = () => exportReport(ctx);
  const importBtn = ctx.viewEl.querySelector('#import-legacy');
  const fileInput = ctx.viewEl.querySelector('#import-file');
  if (importBtn) importBtn.onclick = () => fileInput.click();
  if (fileInput) fileInput.onchange = async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!(await confirmDialog('将把旧版数据（学习任务 / 运动记录 / 宠物等）导入到当前账号。导入后多端自动同步，确定吗？', '导入'))) {
        fileInput.value = ''; return;
      }
      const r = await api.importLegacyData(parsed);
      await ctx.reload();
      let msg = `导入完成：学习 ${r.study} 条、运动 ${r.exercise} 条`;
      if (r.student) msg += '、资料已更新';
      if (r.pet === true) msg += '、宠物已导入';
      else if (r.pet === 'exists') msg += '、宠物已存在(跳过)';
      if (r.petError) msg += `（宠物导入失败：${r.petError}）`;
      if (r.skipped) msg += `，跳过重复 ${r.skipped} 条`;
      toast(msg, r.petError ? 'error' : 'success');
    } catch (e) {
      toast('导入失败：' + e.message, 'error');
    } finally {
      fileInput.value = '';
    }
  };
  ctx.viewEl.querySelector('#clear').onclick = async () => {
    if (await confirmDialog('将删除全部学习与运动记录（不可恢复），确定吗？', '清空')) {
      await api.clearAll();
      await ctx.reload();
      toast('已清空', 'success');
    }
  };
  const connectBtn = ctx.viewEl.querySelector('#connect-cloud');
  if (connectBtn) connectBtn.onclick = () => { location.hash = '#/connect'; };
  const signoutBtn = ctx.viewEl.querySelector('#signout');
  if (signoutBtn) signoutBtn.onclick = async () => {
    if (await confirmDialog('退出后本设备将不再同步，确定退出吗？')) {
      ctx.signOut();
    }
  };
}

function exportReport(ctx) {
  const { student, studyTasks, exerciseRecords } = ctx.state;
  const L = [];
  L.push('每日学习与运动打卡报告');
  L.push('姓名：' + student.name + '　年级：' + student.grade);
  L.push('生成时间：' + new Date().toLocaleString('zh-CN'));
  L.push('');
  L.push('【学习目标】' + formatDuration(student.study_goal_minutes) + '/天　【运动目标】' + formatDuration(student.exercise_goal_minutes) + '/天');
  L.push('');
  L.push('—— 学习任务(' + studyTasks.length + ') ——');
  studyTasks.slice().reverse().forEach((t) => {
    const sm = SUBJECT_MAP[t.subject] || SUBJECT_MAP['其他'];
    const st = (STATUS[t.status] || STATUS.not_started).label;
    L.push(`[${fmtDateTime(t.started_at)}] ${sm.key} ${esc(t.title || '')} ${formatDuration(t.duration_minutes)} ${st}${t.notes ? ' | ' + t.notes : ''}`);
  });
  L.push('');
  L.push('—— 运动记录(' + exerciseRecords.length + ') ——');
  exerciseRecords.slice().reverse().forEach((t) => {
    const em = EXERCISE_MAP[t.type] || EXERCISE_MAP['其他'];
    const it = (INTENSITY[t.intensity] || INTENSITY.mid).label;
    L.push(`[${fmtDateTime(t.recorded_at)}] ${em.key} ${formatDuration(t.duration_minutes)} ${t.sets}组${t.reps}次 ${it}强度 ${Math.round(t.calories)}kcal${t.notes ? ' | ' + t.notes : ''}`);
  });
  const blob = new Blob([L.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '打卡报告_' + new Date().toISOString().slice(0, 10) + '.txt';
  a.click();
  toast('报告已导出', 'success');
}

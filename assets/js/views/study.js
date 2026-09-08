// ============================================================================
// 学习打卡
// ============================================================================
import * as api from '../api.js';
import { openModal, closeModal, toast, confirmDialog } from '../ui.js';
import {
  SUBJECTS, SUBJECT_MAP, STATUS, formatDuration, fmtDateTime, isToday, esc, ringSVG,
} from '../utils.js';

let filter = { subject: 'all', todayOnly: true };

/** 每日目标（分钟） */
const DAILY_GOAL_MIN = 120;

function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 今日统计 */
function todayStats(tasks) {
  const todayTasks = tasks.filter((t) => isToday(t.started_at));
  let totalMinutes = 0;
  let doneCount = 0;
  todayTasks.forEach((t) => {
    totalMinutes += t.duration_minutes || 0;
    if (t.status === 'done') doneCount += 1;
  });
  return { totalMinutes, doneCount, totalCount: todayTasks.length };
}

export function renderStudy(ctx) {
  const allTasks = ctx.state.studyTasks;

  // 筛选逻辑
  let tasks = allTasks.filter((t) => filter.subject === 'all' || t.subject === filter.subject);
  if (filter.todayOnly) {
    tasks = tasks.filter((t) => isToday(t.started_at));
  }

  // 今日统计
  const stats = todayStats(allTasks);
  const pct = DAILY_GOAL_MIN > 0 ? (stats.totalMinutes / DAILY_GOAL_MIN) * 100 : 0;

  // 分类标签
  const subjectChips = `<button class="chip ${filter.subject === 'all' ? 'on' : ''}" data-sub="all">全部</button>` +
    SUBJECTS.map((s) => `<button class="chip ${filter.subject === s.key ? 'on' : ''}" data-sub="${s.key}">${s.icon}${s.key}</button>`).join('');

  // 记录列表
  const rows = tasks.map((t) => {
    const sm = SUBJECT_MAP[t.subject] || SUBJECT_MAP['其他'];
    const st = STATUS[t.status] || STATUS.not_started;
    return `<li class="task-row" data-id="${t.id}">
      <span class="task-ico" style="background:${sm.color}1a">${sm.icon}</span>
      <span class="task-main">
        <b>${esc(t.title || sm.key)}</b>
        <small>${sm.key} · ${formatDuration(t.duration_minutes)} · ${fmtDateTime(t.started_at)}</small>
      </span>
      <span class="pill" style="background:${st.color}1a;color:${st.color}">${st.label}</span>
      <span class="row-actions">
        <button class="icon-btn" data-act="edit" title="编辑">✎</button>
        <button class="icon-btn danger" data-act="del" title="删除">🗑</button>
      </span>
    </li>`;
  }).join('');

  // 空状态插图
  const emptyState = !tasks.length ? `
    <div class="ex-empty">
      <div class="ex-empty-art">📚</div>
      <p class="ex-empty-title">暂无学习任务</p>
      <p class="ex-empty-hint">点击右上角 ＋ 添加学习打卡</p>
    </div>` : `<ul class="task-list">${rows}</ul>`;

  ctx.viewEl.innerHTML = `
  <section class="page">
    <!-- 页头 -->
    <div class="page-head">
      <h1>学习打卡</h1>
      <div class="head-right">
        <span class="head-time">${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
        <button class="btn btn-circle primary" id="add-study">＋</button>
      </div>
    </div>

    <!-- 今日概览卡片 -->
    <div class="card ex-summary-card">
      <div class="ex-summary-head">学习打卡</div>
      <div class="ex-summary-body">
        <div class="ex-summary-left">
          <div class="ex-label">今日学习</div>
          <div class="ex-minutes">${stats.totalMinutes}<small>分钟</small></div>
          <div class="ex-goal">目标 ${DAILY_GOAL_MIN >= 60 ? DAILY_GOAL_MIN / 60 + '小时' : DAILY_GOAL_MIN + '分钟'}</div>
          <div class="ex-progress-track"><div class="ex-progress-fill" style="width:${Math.min(pct,100)}%"></div></div>
          <div class="ex-stats-row">
            <span class="ex-stat-cal">📚 <b>${stats.totalCount}</b> 项任务</span>
            <span class="ex-stat-count">✅ <b>${stats.doneCount}</b> 已完成</span>
          </div>
        </div>
        <div class="ex-summary-right">
          ${ringSVG(pct)}
        </div>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="ex-filter-bar">
      <span class="ex-filter-label">筛选</span>
      <label class="toggle-switch ${filter.todayOnly ? 'on' : ''}">
        <input type="checkbox" id="toggle-today" ${filter.todayOnly ? 'checked' : ''}/>
        <span class="toggle-slider"></span>
      </label>
      <span class="toggle-text">仅今日</span>
    </div>

    <!-- 分类标签 -->
    <div class="chips ex-chips">${subjectChips}</div>

    <!-- 列表或空状态 -->
    ${emptyState}
  </section>`;

  // 绑定事件
  ctx.viewEl.querySelector('#add-study').onclick = () => openStudyForm(ctx, null);
  ctx.viewEl.querySelector('#toggle-today').onchange = (e) => { filter.todayOnly = e.target.checked; ctx.refresh(); };
  ctx.viewEl.querySelectorAll('.chip[data-sub]').forEach((b) => {
    b.onclick = () => { filter.subject = b.dataset.sub; ctx.refresh(); };
  });
  ctx.viewEl.querySelectorAll('.task-row').forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('[data-act="edit"]').onclick = (e) => { e.stopPropagation(); openStudyForm(ctx, ctx.state.studyTasks.find((t) => t.id === id)); };
    row.querySelector('[data-act="del"]').onclick = async (e) => {
      e.stopPropagation();
      if (await confirmDialog('确定删除这条学习任务吗？')) {
        await api.deleteStudyTask(id);
        await ctx.reload();
        toast('已删除', 'success');
      }
    };
    row.onclick = () => openStudyForm(ctx, ctx.state.studyTasks.find((t) => t.id === id));
  });
}

function openStudyForm(ctx, t) {
  const isEdit = !!t;
  const subjectOpts = SUBJECTS.map((s) => `<option value="${s.key}" ${t && t.subject === s.key ? 'selected' : ''}>${s.icon} ${s.key}</option>`).join('');
  const statusOpts = Object.values(STATUS).map((s) => `<option value="${s.key}" ${t && t.status === s.key ? 'selected' : ''}>${s.label}</option>`).join('');
  const html = `
    <form id="study-form" class="form">
      <label>科目</label>
      <select name="subject">${subjectOpts}</select>
      <label>任务标题</label>
      <input name="title" value="${esc(t?.title || '')}" placeholder="例如：数学作业 / 英语阅读"/>
      <label>开始时间</label>
      <input type="datetime-local" name="started_at" value="${toLocalInput(t?.started_at)}"/>
      <label>学习时长（分钟）</label>
      <input type="number" name="duration_minutes" min="0" value="${esc(t?.duration_minutes ?? 30)}"/>
      <label>状态</label>
      <select name="status">${statusOpts}</select>
      <label>备注</label>
      <textarea name="notes" rows="2" placeholder="可选">${esc(t?.notes || '')}</textarea>
      <div id="timer-box" style="display:${isEdit ? 'none' : 'flex'};gap:8px;align-items:center;margin-top:6px">
        <button type="button" class="btn ghost" id="timer-btn">⏱ 开始计时</button>
        <span id="timer-label" class="muted"></span>
      </div>
    </form>`;

  openModal({
    title: isEdit ? '编辑学习任务' : '添加学习任务',
    html,
    footerHtml: `<button class="btn ghost" onclick="closeModal()">取消</button>
      <button class="btn primary" id="save-study">保存</button>`,
    onMount: (body) => {
      let timerStart = null, timerInt = null, timerMin = 0;
      const tBtn = body.querySelector('#timer-btn');
      const tLabel = body.querySelector('#timer-label');
      tBtn.onclick = () => {
        if (timerStart) {
          clearInterval(timerInt);
          timerMin = Math.round((Date.now() - timerStart) / 60000);
          body.querySelector('[name=duration_minutes]').value = timerMin;
          tLabel.textContent = `已计时 ${timerMin} 分钟`;
          tBtn.textContent = '⏱ 重新计时';
          timerStart = null;
        } else {
          timerStart = Date.now();
          tBtn.textContent = '⏹ 结束';
          timerInt = setInterval(() => { tLabel.textContent = '计时中 ' + Math.floor((Date.now() - timerStart) / 1000) + 's'; }, 1000);
        }
      };
      body.closest('.modal').querySelector('#save-study').onclick = async () => {
        const f = body.querySelector('#study-form');
        const payload = {
          subject: f.subject.value,
          title: f.title.value.trim(),
          started_at: new Date(f.started_at.value).toISOString(),
          duration_minutes: Number(f.duration_minutes.value) || 0,
          status: f.status.value,
          notes: f.notes.value.trim(),
        };
        try {
          if (isEdit) await api.updateStudyTask(t.id, payload);
          else await api.addStudyTask(payload);
          // 学习任务完成时奖励金币（仅当状态变为 done 时）
          if (payload.status === 'done' && (!isEdit || t?.status !== 'done')) {
            try { await api.addPoints(5); } catch(_) {}
          }
          closeModal();
          await ctx.reload();
          toast('已保存', 'success');
        } catch (e) { toast('保存失败：' + e.message, 'error'); }
      };
    },
  });
}

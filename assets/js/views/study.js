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

/** 时长快捷选择（分钟） */
const DUR_PRESETS = [15, 30, 45, 60, 90];

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

  // 未完成在上、已完成沉底（保持各自原有相对顺序）
  const sorted = [...tasks].sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0));

  // 今日统计
  const stats = todayStats(allTasks);
  const pct = DAILY_GOAL_MIN > 0 ? (stats.totalMinutes / DAILY_GOAL_MIN) * 100 : 0;

  // 分类标签
  const subjectChips = `<button class="chip ${filter.subject === 'all' ? 'on' : ''}" data-sub="all">全部</button>` +
    SUBJECTS.map((s) => `<button class="chip ${filter.subject === s.key ? 'on' : ''}" data-sub="${s.key}">${s.icon}${s.key}</button>`).join('');

  // 记录列表：左侧一键完成按钮，状态由勾选 + 行样式表达
  const rows = sorted.map((t) => {
    const sm = SUBJECT_MAP[t.subject] || SUBJECT_MAP['其他'];
    const done = t.status === 'done';
    return `<li class="task-row ${done ? 'done' : ''}" data-id="${t.id}">
      <button class="check-toggle ${done ? 'on' : ''}" data-act="done" aria-label="标记完成">✓</button>
      <span class="task-ico" style="background:${sm.color}1a">${sm.icon}</span>
      <span class="task-main">
        <b>${esc(t.title || sm.key)}</b>
        <small>${sm.key} · ${formatDuration(t.duration_minutes)}${t.started_at ? ' · ' + fmtDateTime(t.started_at) : ''}</small>
      </span>
      <span class="row-actions">
        <button class="icon-btn" data-act="edit" title="编辑">✎</button>
        <button class="icon-btn danger" data-act="del" title="删除">🗑</button>
      </span>
    </li>`;
  }).join('');

  // 空状态 / 列表 + 底部添加入口
  const listBlock = !tasks.length ? `
    <div class="ex-empty">
      <div class="ex-empty-art">📚</div>
      <p class="ex-empty-title">今天还没有学习任务</p>
      <p class="ex-empty-hint">添加一个任务，开始今天的学习吧</p>
      <button class="btn primary" id="add-study-empty" style="margin-top:16px">＋ 添加学习任务</button>
    </div>` : `<ul class="task-list">${rows}</ul>
    <button class="btn dashed full" id="add-study-more" style="margin-top:4px">＋ 添加学习任务</button>`;

  ctx.viewEl.innerHTML = `
  <section class="page">
    <!-- 页头 -->
    <div class="page-head">
      <h1>📖 学习打卡</h1>
      <div class="head-right">
        <span class="head-time">${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
        <button class="btn btn-circle primary" id="add-study">＋</button>
      </div>
    </div>

    <!-- 今日概览卡片 -->
    <div class="card ex-summary-card">
      <div class="ex-summary-head">🎯 今日学习概览</div>
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
    ${listBlock}
  </section>`;

  // 绑定事件
  const openAdd = () => openStudyForm(ctx, null);
  const addBtn = ctx.viewEl.querySelector('#add-study');
  if (addBtn) addBtn.onclick = openAdd;
  const addEmpty = ctx.viewEl.querySelector('#add-study-empty');
  if (addEmpty) addEmpty.onclick = openAdd;
  const addMore = ctx.viewEl.querySelector('#add-study-more');
  if (addMore) addMore.onclick = openAdd;

  ctx.viewEl.querySelector('#toggle-today').onchange = (e) => { filter.todayOnly = e.target.checked; ctx.refresh(); };
  ctx.viewEl.querySelectorAll('.chip[data-sub]').forEach((b) => {
    b.onclick = () => { filter.subject = b.dataset.sub; ctx.refresh(); };
  });
  ctx.viewEl.querySelectorAll('.task-row').forEach((row) => {
    const id = row.dataset.id;
    // 一键完成 / 取消完成
    row.querySelector('[data-act="done"]').onclick = async (e) => {
      e.stopPropagation();
      const t = ctx.state.studyTasks.find((x) => x.id === id);
      if (!t) return;
      const nowDone = t.status === 'done';
      await api.updateStudyTask(id, { status: nowDone ? 'not_started' : 'done' });
      try { await api.addPoints(nowDone ? -5 : 5); } catch (_) {}
      await ctx.reload();
      toast(nowDone ? '已取消完成，-5金币' : '太棒了！完成打卡 +5金币 🎉', nowDone ? 'info' : 'success');
    };
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
  // 科目：编辑取原值，新增默认第一个科目
  const selSubject = (t && t.subject) || SUBJECTS[0].key;
  const curDur = Number(t?.duration_minutes) || 30;
  const statusOpts = Object.values(STATUS).map((s) => `<option value="${s.key}" ${t && t.status === s.key ? 'selected' : ''}>${s.label}</option>`).join('');

  const html = `
    <form id="study-form" class="form">
      <label>科目</label>
      <div class="subject-picker">
        ${SUBJECTS.map((s) => `<button type="button" class="subj ${selSubject === s.key ? 'on' : ''}" data-subj="${s.key}"><span>${s.icon}</span>${s.key}</button>`).join('')}
      </div>
      <input type="hidden" name="subject" value="${selSubject}"/>

      <label>任务标题</label>
      <input name="title" value="${esc(t?.title || '')}" placeholder="例如：数学作业 / 英语阅读"/>

      <label>学习时长（分钟）</label>
      <div class="dur-chips">
        ${DUR_PRESETS.map((d) => `<button type="button" class="chip ${curDur === d ? 'on' : ''}" data-dur="${d}">${d}分</button>`).join('')}
      </div>
      <input type="number" name="duration_minutes" min="1" value="${curDur}"/>

      <label>开始时间</label>
      <input type="datetime-local" name="started_at" value="${toLocalInput(t?.started_at)}"/>

      ${isEdit ? `<label>状态</label><select name="status">${statusOpts}</select>` : ''}

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
      const f = body.querySelector('#study-form');

      // 科目点选
      body.querySelectorAll('.subject-picker .subj').forEach((b) => {
        b.onclick = () => {
          body.querySelectorAll('.subject-picker .subj').forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
          f.subject.value = b.dataset.subj;
        };
      });

      // 时长快捷选择（点击 chip 回填数字输入框）
      body.querySelectorAll('.dur-chips .chip').forEach((b) => {
        b.onclick = () => {
          body.querySelectorAll('.dur-chips .chip').forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
          f.duration_minutes.value = b.dataset.dur;
        };
      });
      // 手动改时长时，同步高亮对应 chip
      f.duration_minutes.oninput = () => {
        const v = Number(f.duration_minutes.value);
        body.querySelectorAll('.dur-chips .chip').forEach((x) => x.classList.toggle('on', Number(x.dataset.dur) === v));
      };

      // 计时器
      let timerStart = null, timerInt = null, timerMin = 0;
      const tBtn = body.querySelector('#timer-btn');
      const tLabel = body.querySelector('#timer-label');
      tBtn.onclick = () => {
        if (timerStart) {
          clearInterval(timerInt);
          timerMin = Math.round((Date.now() - timerStart) / 60000);
          f.duration_minutes.value = timerMin;
          body.querySelectorAll('.dur-chips .chip').forEach((x) => x.classList.toggle('on', Number(x.dataset.dur) === timerMin));
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
        const payload = {
          subject: f.subject.value,
          title: f.title.value.trim(),
          started_at: new Date(f.started_at.value).toISOString(),
          duration_minutes: Number(f.duration_minutes.value) || 0,
          status: isEdit ? f.status.value : 'in_progress',
          notes: f.notes.value.trim(),
        };
        try {
          if (isEdit) await api.updateStudyTask(t.id, payload);
          else await api.addStudyTask(payload);
          // 状态变化时的金币结算：完成 +5 / 取消完成 -5（与列表一键完成保持一致）
          const prevDone = isEdit ? t?.status === 'done' : false;
          const nextDone = payload.status === 'done';
          if (nextDone && !prevDone) { try { await api.addPoints(5); } catch(_) {} }
          else if (!nextDone && prevDone) { try { await api.addPoints(-5); } catch(_) {} }
          closeModal();
          await ctx.reload();
          toast('已保存', 'success');
        } catch (e) { toast('保存失败：' + e.message, 'error'); }
      };
    },
  });
}

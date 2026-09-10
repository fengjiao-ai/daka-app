// ============================================================================
// 运动打卡
// ============================================================================
import * as api from '../api.js';
import { openModal, closeModal, toast, confirmDialog } from '../ui.js';
import {
  EXERCISES, EXERCISE_MAP, INTENSITY, formatDuration, fmtDateTime, isToday, esc, estimateCalories, ringSVG,
} from '../utils.js';

let filter = { type: 'all', todayOnly: true };

/** 每日目标（分钟） */
const DAILY_GOAL_MIN = 60;

function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 计算今日统计数据 */
function todayStats(records) {
  const todayRecs = records.filter((r) => isToday(r.recorded_at));
  let totalMinutes = 0;
  let totalCalories = 0;
  let completedCount = 0;
  todayRecs.forEach((r) => {
    totalMinutes += r.duration_minutes || 0;
    totalCalories += r.calories || 0;
    completedCount += 1;
  });
  return { totalMinutes, totalCalories, completedCount };
}

/** 组数/次数文案：无数据时不显示，避免出现 "undefined组undefined次" */
function setsRepsText(t) {
  const s = Number(t?.sets) || 0;
  const r = Number(t?.reps) || 0;
  return (s || r) ? `${s}组${r}次 · ` : '';
}

export function renderExercise(ctx) {
  const allRecs = ctx.state.exerciseRecords;

  // 筛选逻辑
  let recs = allRecs.filter((t) => filter.type === 'all' || t.type === filter.type);
  if (filter.todayOnly) {
    recs = recs.filter((t) => isToday(t.recorded_at));
  }

  // 今日统计
  const stats = todayStats(allRecs);
  const pct = DAILY_GOAL_MIN > 0 ? (stats.totalMinutes / DAILY_GOAL_MIN) * 100 : 0;

  // 分类标签
  const typeChips = `<button class="chip ${filter.type === 'all' ? 'on' : ''}" data-type="all">全部</button>` +
    EXERCISES.map((e) => `<button class="chip ${filter.type === e.key ? 'on' : ''}" data-type="${e.key}">${e.icon}${e.key}</button>`).join('');

  // 记录列表
  const rows = recs.map((t) => {
    const em = EXERCISE_MAP[t.type] || EXERCISE_MAP['其他'];
    const it = (INTENSITY[t.intensity] || INTENSITY[mid]).label;
    return `<li class="task-row" data-id="${t.id}">
      <span class="task-ico" style="background:#4f8cff1a">${em.icon}</span>
      <span class="task-main">
        <b>${em.key}</b>
        <small>${formatDuration(t.duration_minutes)} · ${setsRepsText(t)}${it}强度 · ${Math.round(t.calories)}kcal</small>
      </span>
      <span class="row-actions">
        <button class="icon-btn" data-act="edit" title="编辑">✎</button>
        <button class="icon-btn danger" data-act="del" title="删除">🗑</button>
      </span>
    </li>`;
  }).join('');

  // 空状态插图
  const emptyState = !recs.length ? `
    <div class="ex-empty">
      <div class="ex-empty-art">🏃‍♂️</div>
      <p class="ex-empty-title">暂无运动记录</p>
      <p class="ex-empty-hint">点击右上角 ＋ 添加运动打卡</p>
    </div>` : `<ul class="task-list">${rows}</ul>`;

  ctx.viewEl.innerHTML = `
  <section class="page">
    <!-- 页头 -->
    <div class="page-head">
      <h1>🏃 运动打卡</h1>
      <div class="head-right">
        <span class="head-time">${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
        <button class="btn btn-circle primary" id="add-ex">＋</button>
      </div>
    </div>

    <!-- 今日概览卡片 -->
    <div class="card ex-summary-card">
      <div class="ex-summary-head">🎯 今日运动概览</div>
      <div class="ex-summary-body">
        <div class="ex-summary-left">
          <div class="ex-label">今日运动</div>
          <div class="ex-minutes">${stats.totalMinutes}<small>分钟</small></div>
          <div class="ex-goal">目标 ${DAILY_GOAL_MIN >= 60 ? DAILY_GOAL_MIN / 60 + '小时' : DAILY_GOAL_MIN + '分钟'}</div>
          <div class="ex-progress-track"><div class="ex-progress-fill" style="width:${Math.min(pct,100)}%"></div></div>
          <div class="ex-stats-row">
            <span class="ex-stat-cal">🔥 <b>${Math.round(stats.totalCalories)}</b> 千卡</span>
            <span class="ex-stat-count">✅ <b>${stats.completedCount}</b> 项完成</span>
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
    <div class="chips ex-chips">${typeChips}</div>

    <!-- 列表或空状态 -->
    ${emptyState}
  </section>`;

  // 绑定事件
  ctx.viewEl.querySelector('#add-ex').onclick = () => openExerciseForm(ctx, null);
  ctx.viewEl.querySelector('#toggle-today').onchange = (e) => {
    filter.todayOnly = e.target.checked;
    ctx.refresh();
  };
  ctx.viewEl.querySelectorAll('.chip[data-type]').forEach((b) => {
    b.onclick = () => { filter.type = b.dataset.type; ctx.refresh(); };
  });
  ctx.viewEl.querySelectorAll('.task-row').forEach((row) => {
    const id = row.dataset.id;
    const rec = ctx.state.exerciseRecords.find((t) => t.id === id);
    row.querySelector('[data-act="edit"]').onclick = (e) => { e.stopPropagation(); openExerciseForm(ctx, rec); };
    row.querySelector('[data-act="del"]').onclick = async (e) => {
      e.stopPropagation();
      if (await confirmDialog('确定删除这条运动记录吗？')) {
        await api.deleteExerciseRecord(id);
        await ctx.reload();
        toast('已删除', 'success');
      }
    };
    row.onclick = () => openExerciseForm(ctx, rec);
  });
}

function openExerciseForm(ctx, t) {
  const isEdit = !!t;
  const typeOpts = EXERCISES.map((e) => `<option value="${e.key}" ${t && t.type === e.key ? 'selected' : ''}>${e.icon} ${e.key}</option>`).join('');
  const intOpts = Object.values(INTENSITY).map((i) => `<option value="${i.key}" ${t && t.intensity === i.key ? 'selected' : ''}>${i.label}</option>`).join('');
  const html = `
    <form id="ex-form" class="form">
      <label>运动项目</label>
      <select name="type">${typeOpts}</select>
      <label>运动时间</label>
      <input type="datetime-local" name="recorded_at" value="${toLocalInput(t?.recorded_at)}"/>
      <label>时长（分钟）</label>
      <input type="number" name="duration_minutes" min="0" value="${esc(t?.duration_minutes ?? 30)}"/>
      <div class="grid2">
        <div><label>组数</label><input type="number" name="sets" min="0" value="${esc(t?.sets ?? 0)}"/></div>
        <div><label>次数</label><input type="number" name="reps" min="0" value="${esc(t?.reps ?? 0)}"/></div>
      </div>
      <label>强度</label>
      <select name="intensity">${intOpts}</select>
      <div class="grid2">
        <div><label>体重(kg)</label><input type="number" name="weight_kg" min="1" value="${esc(t?.weight_kg ?? 50)}"/></div>
        <div><label>估算卡路里</label><input name="calories_show" value="${t ? Math.round(t.calories) : ''}" disabled placeholder="自动估算"/></div>
      </div>
      <label>备注</label>
      <textarea name="notes" rows="2" placeholder="可选">${esc(t?.notes || '')}</textarea>
    </form>`;

  openModal({
    title: isEdit ? '编辑运动记录' : '添加运动记录',
    html,
    footerHtml: `<button class="btn ghost" onclick="closeModal()">取消</button>
      <button class="btn primary" id="save-ex">保存</button>`,
    onMount: (body) => {
      const f = body.querySelector('#ex-form');
      const calInput = f.calories_show;
      const recompute = () => {
        calInput.value = estimateCalories(f.type.value, f.duration_minutes.value, f.weight_kg.value, f.intensity.value);
      };
      ['type', 'duration_minutes', 'weight_kg', 'intensity'].forEach((n) => (f[n].oninput = recompute));
      if (!isEdit) recompute();
      body.closest('.modal').querySelector('#save-ex').onclick = async () => {
        const payload = {
          type: f.type.value,
          recorded_at: new Date(f.recorded_at.value).toISOString(),
          duration_minutes: Number(f.duration_minutes.value) || 0,
          sets: Number(f.sets.value) || 0,
          reps: Number(f.reps.value) || 0,
          intensity: f.intensity.value,
          weight_kg: Number(f.weight_kg.value) || 50,
          calories: estimateCalories(f.type.value, f.duration_minutes.value, f.weight_kg.value, f.intensity.value),
          notes: f.notes.value.trim(),
        };
        try {
          if (isEdit) await api.updateExerciseRecord(t.id, payload);
          else await api.addExerciseRecord(payload);
          // 新增运动记录时奖励金币
          if (!isEdit) {
            try { await api.addPoints(3); } catch(_) {}
          }
          closeModal();
          await ctx.reload();
          toast('已保存', 'success');
        } catch (e) { toast('保存失败：' + e.message, 'error'); }
      };
    },
  });
}

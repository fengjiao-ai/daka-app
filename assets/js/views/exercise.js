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

/** 时长快捷选择（分钟） */
const DUR_PRESETS = [15, 30, 45, 60, 90];

/** 各运动项目的图标底色（让列表更活泼、更易区分） */
const TYPE_COLORS = {
  跑步: '#ff8fab', 跳绳: '#ffb700', 俯卧撑: '#5b8dff', 仰卧起坐: '#b48cff',
  球类: '#ff9f43', 骑行: '#3ddc84', 游泳: '#4fc3f7', 瑜伽: '#f06292', 其他: '#90a4ae',
};

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
    const it = (INTENSITY[t.intensity] || INTENSITY.mid).label;
    const color = TYPE_COLORS[t.type] || '#90a4ae';
    // 副文案按重要性排序，中强度为默认值不占位，保证小屏不被截断
    const bits = [formatDuration(t.duration_minutes), `${Math.round(t.calories)}千卡`];
    if (t.intensity && t.intensity !== 'mid') bits.push(`${it}强度`);
    const sr = setsRepsText(t).replace(/ · $/, '');
    if (sr) bits.push(sr);
    return `<li class="task-row" data-id="${t.id}">
      <span class="task-ico" style="background:${color}1f">${em.icon}</span>
      <span class="task-main">
        <b>${em.key}</b>
        <small>${bits.join(' · ')}</small>
      </span>
      <span class="row-actions">
        <button class="icon-btn" data-act="repeat" title="再来一次">↻</button>
        <button class="icon-btn" data-act="edit" title="编辑">✎</button>
        <button class="icon-btn danger" data-act="del" title="删除">🗑</button>
      </span>
    </li>`;
  }).join('');

  // 空状态 / 列表
  const listBlock = !recs.length ? `
    <div class="ex-empty">
      <div class="ex-empty-art">🏃‍♂️</div>
      <p class="ex-empty-title">今天还没有运动记录</p>
      <p class="ex-empty-hint">动一动身体，记录一次运动吧</p>
      <button class="btn primary" id="add-ex-empty" style="margin-top:16px">＋ 添加运动记录</button>
    </div>` : `<ul class="task-list">${rows}</ul>
    <button class="btn dashed full" id="add-ex-more" style="margin-top:4px">＋ 添加运动记录</button>`;

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
            <span class="ex-stat-count">📝 <b>${stats.completedCount}</b> 条记录</span>
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
    ${listBlock}
  </section>`;

  // 绑定事件
  const openAdd = () => openExerciseForm(ctx, null);
  const addBtn = ctx.viewEl.querySelector('#add-ex');
  if (addBtn) addBtn.onclick = openAdd;
  const addEmpty = ctx.viewEl.querySelector('#add-ex-empty');
  if (addEmpty) addEmpty.onclick = openAdd;
  const addMore = ctx.viewEl.querySelector('#add-ex-more');
  if (addMore) addMore.onclick = openAdd;

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
    // 再来一次：复制这条记录（时间改为现在），省去重复填写
    row.querySelector('[data-act="repeat"]').onclick = async (e) => {
      e.stopPropagation();
      await repeatRecord(ctx, rec);
    };
    row.querySelector('[data-act="edit"]').onclick = (e) => { e.stopPropagation(); openExerciseForm(ctx, rec); };
    row.querySelector('[data-act="del"]').onclick = async (e) => {
      e.stopPropagation();
      if (await confirmDialog('确定删除这条运动记录吗？删除后会扣回 3 金币')) {
        await api.deleteExerciseRecord(id);
        // 与新增 +3 对称，避免反复增删刷金币
        try { await api.addPoints(-3); } catch (_) {}
        await ctx.reload();
        toast('已删除，-3金币', 'success');
      }
    };
    row.onclick = () => openExerciseForm(ctx, rec);
  });
}

/** 一键复制一条运动记录到今天（时间改为现在），并结算金币 */
async function repeatRecord(ctx, rec) {
  if (!rec) return;
  const payload = {
    type: rec.type,
    recorded_at: new Date().toISOString(),
    duration_minutes: Number(rec.duration_minutes) || 0,
    sets: Number(rec.sets) || 0,
    reps: Number(rec.reps) || 0,
    intensity: rec.intensity || 'mid',
    weight_kg: Number(rec.weight_kg) || 50,
    calories: estimateCalories(rec.type, rec.duration_minutes, rec.weight_kg, rec.intensity || 'mid'),
    notes: rec.notes || '',
  };
  try {
    await api.addExerciseRecord(payload);
    try { await api.addPoints(3); } catch (_) {}
    await ctx.reload();
    toast(`已记录 ${rec.type} ${payload.duration_minutes} 分钟 +3金币 🎉`, 'success');
  } catch (e) {
    toast('记录失败：' + e.message, 'error');
  }
}

function openExerciseForm(ctx, t) {
  const isEdit = !!t;
  const selType = (t && t.type) || EXERCISES[0].key;
  const selInt = (t && t.intensity) || 'mid';
  const curDur = Number(t?.duration_minutes) || 30;

  const html = `
    <form id="ex-form" class="form">
      <label>运动项目</label>
      <div class="pick-grid">
        ${EXERCISES.map((e) => `<button type="button" class="pick ${selType === e.key ? 'on' : ''}" data-type="${e.key}"><span>${e.icon}</span>${e.key}</button>`).join('')}
      </div>
      <input type="hidden" name="type" value="${selType}"/>

      <div class="cal-preview">
        <span class="cal-ico">🔥</span><b id="cal-num">0</b><small>千卡（自动估算）</small>
      </div>

      <label>运动时长（分钟）</label>
      <div class="dur-chips">
        ${DUR_PRESETS.map((d) => `<button type="button" class="chip ${curDur === d ? 'on' : ''}" data-dur="${d}">${d}分</button>`).join('')}
      </div>
      <input type="number" name="duration_minutes" min="1" value="${curDur}"/>

      <label>运动强度</label>
      <div class="pick-row">
        ${Object.values(INTENSITY).map((i) => `<button type="button" class="pick ${selInt === i.key ? 'on' : ''}" data-int="${i.key}">${i.label}强度</button>`).join('')}
      </div>
      <input type="hidden" name="intensity" value="${selInt}"/>

      <label>运动时间</label>
      <input type="datetime-local" name="recorded_at" value="${toLocalInput(t?.recorded_at)}"/>

      <button type="button" class="btn dashed full more-toggle" id="more-btn">＋ 更多记录（组数 / 次数 / 体重）</button>
      <div class="more-box" id="more-box" style="display:none">
        <div class="grid2">
          <div><label>组数</label><input type="number" name="sets" min="0" value="${esc(t?.sets ?? 0)}"/></div>
          <div><label>次数</label><input type="number" name="reps" min="0" value="${esc(t?.reps ?? 0)}"/></div>
        </div>
        <label>体重(kg)</label>
        <input type="number" name="weight_kg" min="1" value="${esc(t?.weight_kg ?? 50)}"/>
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
      const calNum = body.querySelector('#cal-num');
      const recompute = () => {
        const v = estimateCalories(f.type.value, f.duration_minutes.value, f.weight_kg.value, f.intensity.value);
        calNum.textContent = v;
        return v;
      };

      // 运动项目点选
      body.querySelectorAll('.pick-grid .pick').forEach((b) => {
        b.onclick = () => {
          body.querySelectorAll('.pick-grid .pick').forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
          f.type.value = b.dataset.type;
          recompute();
        };
      });

      // 强度点选
      body.querySelectorAll('.pick-row .pick').forEach((b) => {
        b.onclick = () => {
          body.querySelectorAll('.pick-row .pick').forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
          f.intensity.value = b.dataset.int;
          recompute();
        };
      });

      // 时长快捷选择
      body.querySelectorAll('.dur-chips .chip').forEach((b) => {
        b.onclick = () => {
          body.querySelectorAll('.dur-chips .chip').forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
          f.duration_minutes.value = b.dataset.dur;
          recompute();
        };
      });
      f.duration_minutes.oninput = () => {
        const v = Number(f.duration_minutes.value);
        body.querySelectorAll('.dur-chips .chip').forEach((x) => x.classList.toggle('on', Number(x.dataset.dur) === v));
        recompute();
      };
      f.weight_kg.oninput = recompute;

      // 折叠进阶项
      const moreBtn = body.querySelector('#more-btn');
      const moreBox = body.querySelector('#more-box');
      moreBtn.onclick = () => {
        const open = moreBox.style.display === 'none';
        moreBox.style.display = open ? 'block' : 'none';
        moreBtn.textContent = open ? '－ 收起' : '＋ 更多记录（组数 / 次数 / 体重）';
      };

      recompute();

      body.closest('.modal').querySelector('#save-ex').onclick = async () => {
        const payload = {
          type: f.type.value,
          recorded_at: new Date(f.recorded_at.value).toISOString(),
          duration_minutes: Number(f.duration_minutes.value) || 0,
          sets: Number(f.sets.value) || 0,
          reps: Number(f.reps.value) || 0,
          intensity: f.intensity.value,
          weight_kg: Number(f.weight_kg.value) || 50,
          calories: recompute(),
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

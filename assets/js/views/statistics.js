// ============================================================================
// 统计分析
// ============================================================================
import { openModal, toast } from '../ui.js';
import {
  SUBJECTS, SUBJECT_MAP, EXERCISES, EXERCISE_MAP, INTENSITY,
  formatDuration, computeStreak, esc,
} from '../utils.js';

let range = 'week'; // week | month | all
let charts = [];
let _Chart = null; // 缓存 Chart 构造函数，只注册一次

async function ensureChart() {
  if (_Chart) return _Chart;
  const m = await import('https://esm.sh/chart.js@4.4.1');
  const { Chart, CategoryScale, LinearScale, BarController, BarElement, DoughnutController, ArcElement, Tooltip, Legend } = m;
  Chart.register(CategoryScale, LinearScale, BarController, BarElement, DoughnutController, ArcElement, Tooltip, Legend);
  _Chart = Chart;
  return Chart;
}

/** 安全销毁指定 canvas 上的图表 */
function safeDestroyChart(canvasId) {
  const c = _Chart && _Chart.getChart(document.getElementById(canvasId));
  if (c) c.destroy();
}

export async function renderStatistics(ctx) {
  // 先销毁所有已有图表
  charts.forEach((c) => { try { c.destroy(); } catch(_) {} });
  charts = [];

  const { studyTasks, exerciseRecords, student } = ctx.state;
  const now = new Date();
  const start = new Date(now);
  if (range === 'week') start.setDate(now.getDate() - 6);
  else if (range === 'month') start.setDate(now.getDate() - 29);
  else start.setFullYear(2000);

  const dayKey = (iso) => { const d = new Date(iso); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const inRange = (iso) => new Date(iso) >= start;

  const sTasks = studyTasks.filter((t) => inRange(t.started_at));
  const eRecs = exerciseRecords.filter((t) => inRange(t.recorded_at));

  // 按天聚合
  const days = [];
  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  const studyByDay = {}, exByDay = {};
  days.forEach((d) => { const k = dayKey(d); studyByDay[k] = 0; exByDay[k] = 0; });
  sTasks.forEach((t) => { const k = dayKey(t.started_at); studyByDay[k] = (studyByDay[k] || 0) + (Number(t.duration_minutes) || 0); });
  eRecs.forEach((t) => { const k = dayKey(t.recorded_at); exByDay[k] = (exByDay[k] || 0) + (Number(t.duration_minutes) || 0); });

  // 科目分布
  const subjMap = {};
  sTasks.forEach((t) => { subjMap[t.subject] = (subjMap[t.subject] || 0) + (Number(t.duration_minutes) || 0); });
  const subjData = SUBJECTS.filter((s) => subjMap[s.key]).map((s) => ({ ...s, v: subjMap[s.key] }));

  // 运动项目分布
  const exMap = {};
  eRecs.forEach((t) => { exMap[t.type] = (exMap[t.type] || 0) + (Number(t.duration_minutes) || 0); });
  const exData = EXERCISES.filter((e) => exMap[e.key]).map((e) => ({ ...e, v: exMap[e.key] }));

  const totalStudy = sTasks.reduce((s, t) => s + (Number(t.duration_minutes) || 0), 0);
  const totalEx = eRecs.reduce((s, t) => s + (Number(t.duration_minutes) || 0), 0);
  const doneStudy = studyTasks.filter((t) => t.status === 'done').length;
  const points = student?.totalPoints || 0;
  const streak = computeStreak([...studyTasks.filter((t) => t.status === 'done').map((t) => t.started_at), ...exerciseRecords.map((t) => t.recorded_at)]);

  const rangeBtns = ['week', 'month', 'all'].map((r) => `<button class="chip ${range === r ? 'on' : ''}" data-range="${r}">${{ week: '本周', month: '本月', all: '全部' }[r]}</button>`).join('');

  ctx.viewEl.innerHTML = `
  <section class="page">
    <div class="page-head"><h1>统计分析</h1></div>
    <div class="filter-bar"><div class="chips">${rangeBtns}</div></div>

    <div class="stat-cards">
      <div class="stat-card"><span>📚</span><b>${formatDuration(totalStudy)}</b><small>学习时长</small></div>
      <div class="stat-card"><span>🏃</span><b>${formatDuration(totalEx)}</b><small>运动时长</small></div>
      <div class="stat-card"><span>✅</span><b>${doneStudy}</b><small>完成学习</small></div>
      <div class="stat-card"><span>⭐</span><b>${points}</b><small>积分</small></div>
    </div>

    <div class="card">
      <div class="card-head"><h2>时长趋势</h2></div>
      <canvas id="trend-chart" height="120"></canvas>
    </div>

    <div class="card">
      <div class="card-head"><h2>科目分布</h2></div>
      ${subjData.length ? '<canvas id="subj-chart" height="120"></canvas>' : '<p class="empty">暂无数据</p>'}
    </div>

    <div class="card">
      <div class="card-head"><h2>运动项目分布</h2></div>
      ${exData.length ? '<canvas id="ex-chart" height="120"></canvas>' : '<p class="empty">暂无数据</p>'}
    </div>

    <div class="card">
      <div class="card-head"><h2>打卡热力图</h2><span class="muted">连续 ${streak} 天</span></div>
      <div id="heatmap" class="heatmap"></div>
    </div>
  </section>`;

  ctx.viewEl.querySelectorAll('.chip[data-range]').forEach((b) => {
    b.onclick = () => { range = b.dataset.range; ctx.refresh(); };
  });

  // 趋势图
  const Chart = await ensureChart();
  safeDestroyChart('trend-chart');
  const trend = ctx.viewEl.querySelector('#trend-chart');
  if (trend) {
    charts.push(new Chart(trend, {
      type: 'bar',
      data: {
        labels: days.map((d) => (d.getMonth() + 1) + '/' + d.getDate()),
        datasets: [
          { label: '学习', data: days.map((d) => studyByDay[dayKey(d)]), backgroundColor: '#4f8cff' },
          { label: '运动', data: days.map((d) => exByDay[dayKey(d)]), backgroundColor: '#43a047' },
        ],
      },
      options: { responsive: true, scales: { x: { stacked: false }, y: { beginAtZero: true } } },
    }));
  }
  safeDestroyChart('subj-chart');
  const subj = ctx.viewEl.querySelector('#subj-chart');
  if (subj) {
    charts.push(new Chart(subj, {
      type: 'doughnut',
      data: { labels: subjData.map((s) => s.key), datasets: [{ data: subjData.map((s) => s.v), backgroundColor: subjData.map((s) => s.color) }] },
      options: { responsive: true },
    }));
  }
  safeDestroyChart('ex-chart');
  const ex = ctx.viewEl.querySelector('#ex-chart');
  if (ex) {
    charts.push(new Chart(ex, {
      type: 'bar',
      data: { labels: exData.map((e) => e.key), datasets: [{ label: '分钟', data: exData.map((e) => e.v), backgroundColor: '#4f8cff' }] },
      options: { indexAxis: 'y', responsive: true, scales: { x: { beginAtZero: true } } },
    }));
  }

  renderHeatmap(ctx, studyTasks, exerciseRecords, streak);
}

function renderHeatmap(ctx, studyTasks, exerciseRecords, streak) {
  const el = ctx.viewEl.querySelector('#heatmap');
  if (!el) return;
  // 最近 112 天（16 周）
  const counts = {};
  const dayKey = (iso) => { const d = new Date(iso); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  studyTasks.filter((t) => t.status === 'done').forEach((t) => { const k = dayKey(t.started_at); counts[k] = (counts[k] || 0) + 1; });
  exerciseRecords.forEach((t) => { const k = dayKey(t.recorded_at); counts[k] = (counts[k] || 0) + 1; });

  const today = new Date();
  const cells = [];
  // 从 111 天前开始，对齐到周日为列首
  const start = new Date(today);
  start.setDate(today.getDate() - 111);
  start.setDate(start.getDate() - start.getDay()); // 回退到周日
  for (let i = 0; i < 112; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const k = dayKey(d);
    const c = counts[k] || 0;
    const lvl = c === 0 ? 0 : c === 1 ? 1 : c <= 3 ? 2 : 3;
    const future = d > today;
    cells.push(`<div class="hm-cell lvl-${lvl} ${future ? 'future' : ''}" title="${k}: ${c} 次打卡"></div>`);
  }
  const weeks = [];
  for (let w = 0; w < 16; w++) weeks.push(cells.slice(w * 7, w * 7 + 7).join(''));
  el.innerHTML = `<div class="hm-grid">${weeks.map((w) => `<div class="hm-week">${w}</div>`).join('')}</div>
    <div class="hm-legend"><span>少</span><span class="hm-cell lvl-0"></span><span class="hm-cell lvl-1"></span><span class="hm-cell lvl-2"></span><span class="hm-cell lvl-3"></span><span>多</span></div>`;
}

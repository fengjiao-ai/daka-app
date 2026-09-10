// ============================================================================
// 家务任务：今日进度 + 固定家务 + 随机任务 + 自定义任务（完成 +2 金币，每日重置）
// ============================================================================
import * as api from '../api.js';
import { toast, openModal, closeModal } from '../ui.js';
import { esc } from '../utils.js';

const RAND_TASKS = [
  { key: '帮妈妈叠衣服', icon: '👚' },
  { key: '帮爸爸拿拖鞋', icon: '🩴' },
  { key: '帮妈妈择菜洗菜', icon: '🥬' },
  { key: '帮爸爸整理报纸', icon: '📰' },
  { key: '帮妈妈擦桌子', icon: '🧽' },
  { key: '帮爸爸倒杯水', icon: '🥤' },
  { key: '帮妈妈收拾碗筷', icon: '🍽' },
  { key: '帮爸爸拿快递', icon: '📦' },
  { key: '帮妈妈浇花', icon: '🌺' },
  { key: '帮爸爸整理书架', icon: '📚' },
  { key: '帮妈妈递东西', icon: '🤲' },
  { key: '帮爸爸擦鞋', icon: '👞' },
  { key: '陪妈妈散步', icon: '🚶' },
  { key: '给爸爸捶捶背', icon: '💆' },
  { key: '帮妈妈铺床', icon: '🛏' },
  { key: '给爸爸讲个笑话', icon: '😄' },
];

export async function renderChores(ctx) {
  const ch = await api.getChores();
  const items = ch.items || [];
  const custom = ch.customTasks || [];
  const rand = ch.randomTask || null;

  const done = items.filter((i) => i.done).length + custom.filter((t) => t.done).length + (rand && rand.done ? 1 : 0);
  const total = items.length + custom.length + (rand ? 1 : 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  ctx.viewEl.innerHTML = `
  <section class="page">
    <div class="page-head"><h1>🧹 家务任务</h1></div>

    <div class="coin-banner" style="background:linear-gradient(135deg,#34c75915,#007aff22)">
      <div class="chore-top">
        <div class="chore-emoji">🧹</div>
        <div>
          <div class="chore-title">今日家务</div>
          <div class="chore-sub">完成 ${done}/${total} 项</div>
        </div>
      </div>
      <div class="progress-bar"><div class="fill" style="width:${pct}%;background:linear-gradient(90deg,#34c759,#007aff)"></div></div>
      <div class="chore-reward">每完成一项 +2 🪙</div>
    </div>

    <div class="card-head"><h2>固定家务</h2></div>
    ${items.map((i, idx) => choreRow(i, `fixed-${idx}`)).join('')}

    <div class="card-head" style="margin-top:8px"><h2>🎲 帮妈妈/爸爸随机任务</h2></div>
    ${rand
      ? choreRow(rand, 'rand')
      : `<div class="card center-card">
          <div class="empty"><div class="ei">🎲</div><div class="et">还没有随机任务哦</div></div>
          <button class="btn primary" id="gen-rand">🎲 生成随机任务</button>
        </div>`}

    <div class="card-head" style="margin-top:8px"><h2>✏️ 自定义任务 <small>（${custom.length} 项）</small></h2></div>
    ${custom.map((t, i) => choreRow(t, `custom-${i}`)).join('')}
    <button class="btn dashed full" id="add-custom">➕ 创建临时任务 (2金币)</button>

    <p class="foot-hint">⏰ 每日凌晨自动重置，帮爸爸妈妈做家务赚金币</p>
  </section>`;

  // 绑定交互
  const bind = (sel, fn) => { const el = ctx.viewEl.querySelector(sel); if (el) el.onclick = fn; };
  items.forEach((_, idx) => bind(`#fixed-${idx}`, () => toggleChore(ctx, idx)));
  if (rand) bind('#rand', () => toggleRand(ctx));
  custom.forEach((_, i) => bind(`#custom-${i}`, () => toggleCustom(ctx, i)));
  bind('#gen-rand', () => genRandTask(ctx));
  bind('#add-custom', () => addCustomChore(ctx));
}

function choreRow(item, id) {
  return `
  <div class="chore-row ${item.done ? 'done' : ''}" id="${id}">
    <div class="chore-ico">${item.icon || '📋'}</div>
    <div class="chore-info">
      <div class="chore-name">${esc(item.key)}</div>
      <div class="chore-coin">+2 🪙</div>
    </div>
    <button class="chore-toggle ${item.done ? 'on' : ''}">✓</button>
  </div>`;
}

async function toggleChore(ctx, idx) {
  const ch = await api.getChores();
  const it = ch.items[idx];
  it.done = !it.done;
  await api.addPoints(it.done ? 2 : -2);
  await api.saveChores(ch);
  toast(it.done ? '完成！+2金币 🪙' : '取消完成 -2金币');
  renderChores(ctx);
}
async function toggleRand(ctx) {
  const ch = await api.getChores();
  if (!ch.randomTask) return;
  ch.randomTask.done = !ch.randomTask.done;
  await api.addPoints(ch.randomTask.done ? 2 : -2);
  await api.saveChores(ch);
  toast(ch.randomTask.done ? '完成！+2金币 🪙' : '取消完成 -2金币');
  renderChores(ctx);
}
async function toggleCustom(ctx, i) {
  const ch = await api.getChores();
  const t = ch.customTasks[i];
  if (!t) return;
  t.done = !t.done;
  await api.addPoints(t.done ? 2 : -2);
  await api.saveChores(ch);
  toast(t.done ? '完成！+2金币 🪙' : '取消完成 -2金币');
  renderChores(ctx);
}
async function genRandTask(ctx) {
  const ch = await api.getChores();
  if (ch.randomTask) { toast('先把上一个随机任务完成吧'); return; }
  const r = RAND_TASKS[Math.floor(Math.random() * RAND_TASKS.length)];
  ch.randomTask = { key: r.key, icon: r.icon, done: false };
  await api.saveChores(ch);
  toast('新任务: ' + r.key);
  renderChores(ctx);
}
function addCustomChore(ctx) {
  openModal({
    title: '创建临时任务',
    html: `<div class="form"><label>任务名称</label>
      <input id="customChoreName" placeholder="如：整理书桌、给花浇水..."/></div>
      <div class="foot-hint">完成后可获得 +2 🪙 金币奖励</div>`,
    footerHtml: `<button class="btn ghost" onclick="closeModal()">取消</button>
      <button class="btn primary" id="m-add-chore">添加</button>`,
    onMount: (body) => {
      body.closest('.modal').querySelector('#m-add-chore').onclick = async () => {
        const input = body.querySelector('#customChoreName');
        const name = input.value.trim();
        if (!name) { toast('请输入任务名称'); return; }
        const ch = await api.getChores();
        ch.customTasks = ch.customTasks || [];
        ch.customTasks.push({ key: name, icon: '📋', done: false });
        await api.saveChores(ch);
        closeModal();
        toast('任务已创建');
        renderChores(ctx);
      };
    },
  });
}

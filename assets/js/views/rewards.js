// ============================================================================
// 金币兑换（奖励商店）：金币余额 + 可兑换奖励目录 + 兑换记录
// 金币与宠物/家务共用 students.total_points 余额
// ============================================================================
import * as api from '../api.js';
import { toast, confirmDialog } from '../ui.js';
import { esc, fmtDateTime } from '../utils.js';

const REWARD_ITEMS = [
  { key: '零食卡', icon: '🍫', cost: 10, color: '#ff9500', desc: '可选一份心仪的小零食' },
  { key: '半小时电视/平板', icon: '📺', cost: 20, color: '#007aff', desc: '可看半小时电视或玩平板' },
  { key: '心仪玩具', icon: '🧸', cost: 50, color: '#af52de', desc: '选一个自己喜欢的小玩具' },
  { key: '游乐园一次', icon: '🎠', cost: 100, color: '#ff3b30', desc: '全家一起去游乐园玩一次' },
];

export async function renderRewards(ctx) {
  const student = await api.getStudent();
  const pts = student.totalPoints || 0;
  const history = await api.listRewards();

  ctx.viewEl.innerHTML = `
  <section class="page">
    <div class="page-head"><h1>金币兑换</h1></div>

    <div class="coin-banner">
      <div class="coin-label">我的金币</div>
      <div class="coin-num">🪙 ${pts}</div>
      <div class="coin-hint">坚持打卡、完成家务，赚取更多金币</div>
    </div>

    <div class="card-head"><h2>可兑换奖励 <small>（共 ${REWARD_ITEMS.length} 项）</small></h2></div>
    <div id="reward-list">
      ${REWARD_ITEMS.map((r) => {
        const can = pts >= r.cost;
        return `<div class="reward-item ${can ? '' : 'disabled'}">
          <div class="reward-ico" style="background:${r.color}1f;color:${r.color}">${r.icon}</div>
          <div class="reward-info">
            <div class="reward-name">${esc(r.key)}</div>
            <div class="reward-desc">${esc(r.desc)}</div>
            <div class="reward-cost" style="color:${r.color}">🪙 ${r.cost} 金币</div>
          </div>
          <button class="btn ${can ? 'primary' : 'ghost'}" data-reward="${esc(r.key)}" ${can ? '' : 'disabled'}>${can ? '兑换' : '金币不足'}</button>
        </div>`;
      }).join('')}
    </div>

    <div class="card-head" style="margin-top:18px"><h2>兑换记录 <small>（${history.length} 次）</small></h2></div>
    <div class="card">
      ${history.length === 0
        ? `<div class="empty"><div class="ei">🎁</div><div class="et">还没有兑换记录</div><div class="es">攒够金币就来兑换奖励吧</div></div>`
        : history.map((h) => `
          <div class="task-row">
            <div class="task-icon" style="background:${(h.color || '#ff9500')}22;color:${h.color || '#ff9500'}">${h.icon || '🎁'}</div>
            <div class="task-info">
              <div class="tt">${esc(h.name)}</div>
              <div class="task-meta"><span class="meta-text">📅 ${fmtDateTime(h.redeemed_at)}</span></div>
            </div>
            <div class="reward-minus">−${h.cost}🪙</div>
          </div>`).join('')}
    </div>
    <p class="foot-hint">💡 兑换后请找爸爸妈妈核销哦～</p>
  </section>`;

  ctx.viewEl.querySelectorAll('[data-reward]').forEach((btn) => {
    btn.onclick = async () => {
      const item = REWARD_ITEMS.find((x) => x.key === btn.dataset.reward);
      if (!item) return;
      const s = await api.getStudent();
      if (s.totalPoints < item.cost) { toast('金币不足', 'error'); return; }
      if (!(await confirmDialog(`是否用 ${item.cost} 金币兑换「${item.key}」？`, '确认兑换'))) return;
      try {
        await api.addPoints(-item.cost);
        await api.addReward({ name: item.key, cost: item.cost, icon: item.icon, color: item.color });
        toast(`兑换成功！获得 ${item.key} 🎉`);
        renderRewards(ctx);
      } catch (e) { toast('兑换失败：' + e.message, 'error'); }
    };
  });
}

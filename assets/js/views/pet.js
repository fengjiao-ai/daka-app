// ============================================================================
// 虚拟宠物模块：领养 / 状态展示 / 互动操作 / 商店购买
// 3D 渲染委托给 pet3d.js（原版移植，含程序化模型/动画/叫声/装扮）
// 懒加载：只有用户访问宠物页时才加载 Three.js + 50MB GLB
// ============================================================================
import { toast } from '../ui.js';
import { getPet, savePet, deletePet, getStudent, saveStudent } from '../api.js';

// 懒加载标记：pet3d.js 是否已加载
let _pet3dLoaded = false;
let _pet3dLoading = null; // Promise<void>

/** 动态加载 pet3d.js（含 Three.js），只执行一次 */
async function ensurePet3D() {
  if (_pet3dLoaded) return window.Pet3DViewer;
  if (_pet3dLoading) return _pet3dLoading;
  _pet3dLoading = (async () => {
    await import('../pet3d.js'); // 副作用导入：挂到 window.Pet3DViewer
    _pet3dLoaded = true;
    return window.Pet3DViewer;
  })();
  return _pet3dLoading;
}

// ---- 宠物品种定义 ----
const PETS = [
  { key: '猫咪', icon: '🐱', anim: 'petBounce', desc: '温柔可爱的小猫咪' },
  { key: '狗狗', icon: '🐶', anim: 'petBounce', desc: '忠诚活泼的小狗狗' },
  { key: '小兔子', icon: '🐰', anim: 'petHop', desc: '软萌可爱的小兔子' },
  { key: '大熊猫', icon: '🐼', anim: 'petFloat', desc: '国宝级萌宠大熊猫' },
  { key: '小狮子', icon: '🦁', anim: 'petPulse', desc: '威风凛凛的小狮子' },
  { key: '小老虎', icon: '🐯', anim: 'petBounce', desc: '霸气侧漏的小老虎' },
  { key: '小鸡', icon: '🐤', anim: 'petHop', desc: '毛茸茸的小黄鸡' },
];

// ---- 粮食商店 ----
const FOODS = [
  { key: '宠物饼干', icon: '🍪', cost: 2, hunger: 20 },
  { key: '牛奶', icon: '🥛', cost: 3, hunger: 30 },
  { key: '小鱼干', icon: '🐟', cost: 5, hunger: 50 },
  { key: '肉骨头', icon: '🍖', cost: 8, hunger: 80 },
];

// ---- 装扮商店 ----
const EQUIPS = [
  { key: '小帽子', icon: '🎩', cost: 15, slot: '头部' },
  { key: '蝴蝶结', icon: '🎀', cost: 10, slot: '颈部' },
  { key: '小围巾', icon: '🧣', cost: 12, slot: '颈部' },
  { key: '小眼镜', icon: '👓', cost: 20, slot: '面部' },
  { key: '小书包', icon: '🎒', cost: 25, slot: '背部' },
  { key: '小铃铛', icon: '🔔', cost: 18, slot: '颈部' },
  { key: '皇冠', icon: '👑', cost: 50, slot: '头部' },
  { key: '小翅膀', icon: '🪽', cost: 40, slot: '背部' },
];

// ---- 默认新宠物数据 ----
function defaultPetData(type) {
  return {
    type,
    nickname: type,
    hunger: 100,
    happiness: 100,
    cleanliness: 100,
    equipment: [],
    food_inv: 3,
    last_fed: new Date().toISOString(),
  };
}

// ---- 状态条渲染（带颜色 + 刷新动画）----
function petStatBar(label, value, emoji) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const color = pct > 60 ? '#34c759' : pct > 30 ? '#ff9500' : '#ff3b30';
  return `
    <div class="pet-stat-row" style="margin:8px 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="font-size:13px;font-weight:600;">${label}</span>
        <span style="font-size:13px;font-weight:700;color:${color};">${pct}%</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:16px;">${emoji}</span>
        <div style="flex:1;height:8px;background:rgba(0,0,0,0.08);border-radius:4px;overflow:hidden;">
          <div class="pet-stat-fill" style="width:${pct}%;height:100%;background:${color};border-radius:4px;transition:width 0.5s ease;"></div>
        </div>
      </div>
    </div>`;
}

// ============================================================================
// 页面渲染
// ============================================================================
export async function renderPet(ctx) {
  let pet = await getPet();
  const student = await getStudent();

  // ---- 时间衰减：根据上次互动时间计算状态下降 ----
  if (pet && pet.last_fed) {
    const now = Date.now();
    const last = new Date(pet.last_fed).getTime();
    const elapsedHours = (now - last) / 1000 / 60 / 60;
    if (elapsedHours > 0) {
      pet.hunger = Math.max(0, Number(pet.hunger) - elapsedHours * 10);
      pet.happiness = Math.max(0, Number(pet.happiness) - elapsedHours * 8);
      pet.cleanliness = Math.max(0, (Number(pet.cleanliness) || 100) - elapsedHours * 5);
    }
  }

  // ---- 没有宠物：显示领养页（清理 3D）----
  if (!pet || !pet.type) {
    try { const P = await ensurePet3D(); P.disposeAll(); } catch(e) {}
    ctx.viewEl.innerHTML = `
    <section class="page">
      <div class="card" style="text-align:center;padding:24px 16px;background:linear-gradient(135deg,#ff950015,#ff3b3022);">
        <div style="font-size:48px;margin-bottom:8px;">🐾</div>
        <div style="font-size:18px;font-weight:700;">还没有宠物哦</div>
        <div style="font-size:13px;color:var(--label3);margin-top:4px;">免费领养一只属于你的小宠物吧</div>
      </div>
      <h3 class="card-title">可领养宠物</h3>
      ${PETS.map(p => `
        <div class="card" style="padding:14px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="font-size:38px;flex-shrink:0;"><span class="pet-anim pet-${p.anim}" style="display:inline-block;filter:drop-shadow(2px 3px 4px rgba(0,0,0,0.3));">${p.icon}</span></div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:15px;font-weight:700;">${p.key}</div>
              <div style="font-size:12px;color:var(--label3);margin-top:2px;">${p.desc}</div>
              <div style="font-size:13px;font-weight:600;color:var(--green);margin-top:3px;">免费领养</div>
            </div>
            <button class="btn primary" data-adopt="${p.key}">领养</button>
          </div>
        </div>
      `).join('')}
    </section>`;

    ctx.viewEl.querySelectorAll('[data-adopt]').forEach(btn => {
      btn.onclick = () => doAdopt(ctx, btn.dataset.adopt);
    });
    return;
  }

  // ---- 有宠物：显示主界面 ----
  const petInfo = PETS.find(p => p.key === pet.type) || PETS[0];
  const equips = pet.equipment || [];
  const foodInv = pet.food_inv || 0;

  ctx.viewEl.innerHTML = `
  <section class="page">
    <!-- 宠物 3D 展示区（由 pet3d.js Pet3DViewer 接管渲染） -->
    <div class="card" style="text-align:center;padding:16px 16px 12px;position:relative;">
      <div id="pet-display-area" class="pet3d-stage" style="width:220px;height:220px;margin:0 auto;position:relative;border-radius:12px;background:radial-gradient(circle at 50% 40%,rgba(100,140,255,0.08),transparent 70%);">
        <div class="pet3d-loading">${petInfo.icon}</div>
      </div>
      <div style="margin-top:10px;">
        <input class="form-input" id="pet-nickname-input"
          style="text-align:center;font-size:18px;font-weight:700;border:none;background:transparent;padding:4px;width:auto;display:inline-block;"
          value="${esc(pet.nickname || pet.type)}" placeholder="给宠物起个名字"/>
      </div>
      <div style="font-size:12px;color:var(--label3);">${pet.type} · 拖动可旋转</div>
      ${equips.length > 0 ? `<div style="margin-top:4px;font-size:16px;">${equips.map(e => e.icon).join(' ')}</div>` : ''}
      <div style="margin-top:8px;">
        <a href="javascript:void(0)" id="abandon-btn" style="font-size:11px;color:var(--label3);text-decoration:none;">放弃领养，重新选择宠物</a>
      </div>
    </div>

    <!-- 状态区 -->
    <div class="card">
      <div id="pet-stat-hunger">${petStatBar('饱食度', pet.hunger, '😋')}</div>
      <div id="pet-stat-happiness">${petStatBar('心情值', pet.happiness, '😊')}</div>
      <div id="pet-stat-cleanliness">${petStatBar('清洁度', pet.cleanliness || 100, '🧼')}</div>

      <div style="display:flex;gap:10px;margin-top:14px;">
        <button class="btn primary" id="feed-btn" style="flex:1;${foodInv <= 0 ? 'opacity:0.5;' : ''}" ${foodInv <= 0 ? 'disabled' : ''}>
          🍖 投喂 (${foodInv}份)
        </button>
        <button class="btn primary" id="play-btn" style="flex:1;background:var(--blue,#4f6ef7);">🎾 玩耍</button>
      </div>
      <button class="btn primary" id="bathe-btn" style="width:100%;margin-top:10px;background:#30b0c7;">🛁 洗澡</button>
    </div>

    <!-- 物品背包 -->
    <h3 class="card-title">🎒 我的物品</h3>
    <div class="card" style="padding:14px;">
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;">
        <div style="font-size:28px;">🍖</div>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:600;">宠物粮食</div>
          <div style="font-size:12px;color:var(--label3);">库存：<span id="food-inv-label">${foodInv}</span> 份</div>
        </div>
      </div>
    </div>

    <!-- 粮食商店 -->
    <h3 class="card-title">🏪 宠物粮食商店</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
      ${FOODS.map(f => {
        const can = student.totalPoints >= f.cost;
        return `<div class="card" style="text-align:center;padding:12px 8px;margin:0;${can ? '' : 'opacity:0.5;'}">
          <div style="font-size:32px;">${f.icon}</div>
          <div style="font-size:13px;font-weight:600;">${f.key}</div>
          <div style="font-size:11px;color:var(--label3);">+${f.hunger} 饱食度</div>
          <div style="font-size:12px;font-weight:600;color:#ff9500;margin:4px 0;">🪙 ${f.cost}</div>
          <button class="btn ${can ? 'primary' : 'ghost'}" data-buy-food='${JSON.stringify(f)}' ${can ? '' : 'disabled'}>${can ? '购买' : '不足'}</button>
        </div>`;
      }).join('')}
    </div>

    <!-- 装扮商店 -->
    <h3 class="card-title">👗 宠物装扮商店</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${EQUIPS.map(eq => {
        const owned = equips.some(e => e.key === eq.key);
        const can = student.totalPoints >= eq.cost && !owned;
        return `<div class="card" style="text-align:center;padding:12px 8px;margin:0;${owned ? 'background:rgba(52,199,89,0.06);' : (!can ? 'opacity:0.5;' : '')}">
          <div style="font-size:32px;">${eq.icon}</div>
          <div style="font-size:13px;font-weight:600;">${eq.key}</div>
          <div style="font-size:11px;color:var(--label3);">${eq.slot}</div>
          <div style="font-size:12px;font-weight:600;color:#ff9500;margin:4px 0;">🪙 ${eq.cost}</div>
          ${owned
            ? `<button class="btn ghost" data-unequip='${JSON.stringify(eq)}'>卸下</button>`
            : `<button class="btn ${can ? 'primary' : 'ghost'}" data-buy-equip='${JSON.stringify(eq)}' ${can ? '' : 'disabled'}>${can ? '购买' : '不足'}</button>`
          }
        </div>`;
      }).join('')}
    </div>

    <!-- 可领养列表（底部参考） -->
    <h3 class="card-title">可领养宠物</h3>
    ${PETS.map(p => {
      const owned = pet && pet.type === p.key;
      return `<div class="card" style="padding:12px;margin-bottom:8px;${owned ? 'background:rgba(52,199,89,0.06);' : 'opacity:0.5;'}">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-size:38px;flex-shrink:0;"><span class="pet-anim pet-${p.anim}" style="display:inline-block;filter:drop-shadow(2px 3px 4px rgba(0,0,0,0.3));">${p.icon}</span></div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:700;">${p.key}</div>
            <div style="font-size:11px;color:var(--label3);">${p.desc}</div>
            <div style="font-size:12px;font-weight:600;color:var(--green);">免费领养</div>
          </div>
          <button class="btn ${owned ? 'primary' : 'outline'}" data-adopt="${p.key}" ${owned ? 'disabled' : ''}>${owned ? '已领养' : '领养'}</button>
        </div>
      </div>`;
    }).join('')}
  </section>`;

  // ---- 启动原版 3D 宠物查看器（懒加载，不阻塞页面渲染）----
  const displayArea = ctx.viewEl.querySelector('#pet-display-area');
  if (displayArea) {
    // 立即显示占位内容（不等待 3D 加载）
    displayArea.querySelector('.pet3d-loading').innerHTML = `
      <div class="pet3d-skeleton">
        <div class="pet3d-emoji-fallback">${petInfo.icon}</div>
        <div class="pet3d-load-bar"><div class="pet3d-load-fill"></div></div>
        <div class="pet3d-load-text">加载3D模型中...</div>
      </div>`;
    // 异步加载 3D
    ensurePet3D().then((P) => {
      try { P.init('pet-display-area', pet.type, pet.equipment || []); }
      catch(e) { console.warn('Pet3DViewer init failed:', e); }
    }).catch(() => {
      // 3D 加载失败，保留 emoji 占位
      const loading = displayArea.querySelector('.pet3d-loading');
      if (loading) loading.innerHTML = `<div class="pet3d-emoji-fallback" style="font-size:80px;">${petInfo.icon}</div>`;
    });
  }

  // ---- 绑定事件 ----
  ctx.viewEl.querySelector('#pet-nickname-input').onchange = async (e) => {
    pet.nickname = e.target.value;
    await savePet(pet);
    toast('昵称已更新');
  };
  ctx.viewEl.querySelector('#abandon-btn').onclick = () => doAbandon(ctx);
  ctx.viewEl.querySelector('#feed-btn').onclick = () => doFeed(ctx);
  ctx.viewEl.querySelector('#play-btn').onclick = () => doPlay(ctx);
  ctx.viewEl.querySelector('#bathe-btn').onclick = () => doBathe(ctx);
  ctx.viewEl.querySelectorAll('[data-buy-food]').forEach(btn => {
    btn.onclick = () => buyFood(ctx, JSON.parse(btn.dataset.buyFood));
  });
  ctx.viewEl.querySelectorAll('[data-buy-equip]').forEach(btn => {
    btn.onclick = () => buyEquip(ctx, JSON.parse(btn.dataset.buyEquip));
  });
  ctx.viewEl.querySelectorAll('[data-unequip]').forEach(btn => {
    btn.onclick = () => unequipEquip(ctx, JSON.parse(btn.dataset.unequip));
  });
  ctx.viewEl.querySelectorAll('[data-adopt]:not([disabled])').forEach(btn => {
    btn.onclick = () => doAdopt(ctx, btn.dataset.adopt);
  });
}

// ---- 操作函数 ----
async function doAdopt(ctx, type) {
  const pet = await getPet();
  if (pet && pet.type) {
    if (!confirm('已有宠物，确定要放弃当前宠物并领养新的吗？装备和粮食也会消失。')) return;
    await deletePet();
  }
  const newData = defaultPetData(type);
  await savePet(newData);
  toast('领养成功! 🎉 🐾');
  renderPet(ctx);
}

async function doAbandon(ctx) {
  if (!confirm('确定要放弃当前宠物吗？装备和粮食也会一起消失，金币不退哦。')) return;
  try { const P = await ensurePet3D(); P.disposeAll(); } catch(e) {}
  await deletePet();
  toast('宠物已放生，可以领养新的了');
  renderPet(ctx);
}

async function doFeed(ctx) {
  let pet = await getPet();
  if (!pet || !pet.food_inv || pet.food_inv <= 0) { toast('没有宠物粮食了，去商店买一点吧'); return; }
  pet.food_inv = (pet.food_inv || 0) - 1;
  pet.hunger = Math.min(100, Number(pet.hunger) + 25);
  pet.last_fed = new Date().toISOString();
  await savePet(pet);
  refreshPetStats(ctx, pet, 'hunger');
  toast('投喂成功! 🍖');
}

async function doPlay(ctx) {
  let pet = await getPet();
  if (!pet) return;
  pet.happiness = Math.min(100, Number(pet.happiness) + 20);
  pet.last_fed = new Date().toISOString();
  await savePet(pet);
  refreshPetStats(ctx, pet, 'happiness');
  toast('玩得真开心! 🎾');
}

async function doBathe(ctx) {
  let pet = await getPet();
  if (!pet) return;
  pet.cleanliness = Math.min(100, (Number(pet.cleanliness) || 100) + 30);
  pet.happiness = Math.min(100, Number(pet.happiness) + 10);
  pet.last_fed = new Date().toISOString();
  await savePet(pet);
  refreshPetStats(ctx, pet, 'cleanliness');
  toast('洗得干干净净! 🛁');
}

async function buyFood(ctx, item) {
  const student = await getStudent();
  if (student.totalPoints < item.cost) { toast('金币不足'); return; }
  student.totalPoints -= item.cost;
  await saveStudent({ total_points: student.totalPoints });
  let pet = await getPet();
  pet.food_inv = (pet.food_inv || 0) + 1;
  await savePet(pet);
  refreshPetStats(ctx, pet);
  updateSidebarPoints(student.totalPoints);
  toast(`购买成功! ${item.icon} ${item.key}`);
}

async function buyEquip(ctx, item) {
  const student = await getStudent();
  if (student.totalPoints < item.cost) { toast('金币不足'); return; }
  student.totalPoints -= item.cost;
  await saveStudent({ total_points: student.totalPoints });
  let pet = await getPet();
  if (!pet.equipment) pet.equipment = [];
  pet.equipment.push(item);
  await savePet(pet);
  updateSidebarPoints(student.totalPoints);
  toast(`装扮成功! ${item.icon} ${item.key}`);
  renderPet(ctx); // 重启 3D 以显示新装扮
}

async function unequipEquip(ctx, item) {
  let pet = await getPet();
  pet.equipment = (pet.equipment || []).filter(e => e.key !== item.key);
  await savePet(pet);
  toast('已卸下');
  renderPet(ctx); // 重启 3D 更新装扮
}

// ---- 辅助：刷新状态条（不重绘整个页面，仅闪烁指定项）----
/** @param {'hunger'|'happiness'|'cleanliness'|null} changed - 哪个值变化了，null=不闪烁 */
function refreshPetStats(ctx, pet, changed = null) {
  const elH = ctx.viewEl.querySelector('#pet-stat-hunger');
  const elHp = ctx.viewEl.querySelector('#pet-stat-happiness');
  const elC = ctx.viewEl.querySelector('#pet-stat-cleanliness');
  if (elH) elH.innerHTML = petStatBar('饱食度', pet.hunger, '😋');
  if (elHp) elHp.innerHTML = petStatBar('心情值', pet.happiness, '😊');
  if (elC) elC.innerHTML = petStatBar('清洁度', pet.cleanliness || 100, '🧼');

  // 仅对变化的状态条做闪烁动画
  const targetMap = { hunger: elH, happiness: elHp, cleanliness: elC };
  const target = changed ? targetMap[changed] : null;
  if (target) {
    const row = target.querySelector('.pet-stat-row') || target.firstElementChild;
    if (row) { row.classList.add('pet-stat-flash'); setTimeout(() => row.classList.remove('pet-stat-flash'), 500); }
    const fill = target.querySelector('.pet-stat-fill');
    if (fill) { fill.style.boxShadow = '0 0 8px currentColor'; setTimeout(() => { fill.style.boxShadow = ''; }, 500); }
  }

  const fb = ctx.viewEl.querySelector('#feed-btn');
  const fi = pet.food_inv || 0;
  if (fb) { fb.textContent = `🍖 投喂 (${fi}份)`; fb.disabled = fi <= 0; fb.style.opacity = fi > 0 ? '1' : '0.5'; }
  const fil = ctx.viewEl.querySelector('#food-inv-label');
  if (fil) fil.textContent = fi;
  getStudent().then(s => updateSidebarPoints(s.totalPoints));
}

function updateSidebarPoints(points) {
  const el = document.getElementById('sidebar-points');
  if (el) el.textContent = '🪙' + points;
}

function esc(s) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(s ?? '').replace(/[&<>"']/g, c => map[c] || c);
}

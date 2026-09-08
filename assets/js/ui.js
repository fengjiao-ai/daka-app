// ============================================================================
// UI 小组件：进度环(SVG)、Toast 提示、Modal 弹窗
// ============================================================================

// 进度环：返回 SVG 字符串
export function progressRing(percent, opts = {}) {
  percent = Math.max(0, Math.min(100, Number(percent) || 0));
  const size = opts.size || 120;
  const stroke = opts.stroke || 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - percent / 100);
  const color = opts.color || '#4f8cff';
  const track = opts.track || '#e6e9f0';
  const label = opts.label || '';
  const sub = opts.sub || '';
  return `
  <div class="ring-wrap" style="width:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
        transform="rotate(-90 ${size / 2} ${size / 2})" style="transition:stroke-dashoffset .6s ease"/>
      <text x="50%" y="46%" text-anchor="middle" dominant-baseline="middle"
        font-size="${opts.fontSize || 22}" font-weight="700" fill="#1f2733">${label}</text>
      <text x="50%" y="64%" text-anchor="middle" dominant-baseline="middle"
        font-size="12" fill="#8a93a6">${sub}</text>
    </svg>
  </div>`;
}

let toastTimer = null;
export function toast(msg, type = 'info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.className = 'toast show toast-' + type;
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 2200);
}

// 弹窗：openModal({title, html, onMount(root), footerHtml})
export function openModal({ title = '', html = '', onMount, footerHtml = '' }) {
  let root = document.getElementById('modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    document.body.appendChild(root);
  }
  root.innerHTML = `
    <div class="modal-mask" onclick="if(event.target===this)closeModal()">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${title}</h3>
          <button class="modal-x" onclick="closeModal()" aria-label="关闭">×</button>
        </div>
        <div class="modal-body">${html}</div>
        ${footerHtml ? `<div class="modal-foot">${footerHtml}</div>` : ''}
      </div>
    </div>`;
  root.style.display = 'block';
  if (onMount) onMount(root.querySelector('.modal-body'));
  return root;
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) {
    root.style.display = 'none';
    root.innerHTML = '';
  }
}

// 暴露给内联 onclick="closeModal()" 使用（模块作用域的函数无法被内联处理器直接访问）
window.closeModal = closeModal;

// 确认框（Promise）
export function confirmDialog(message, okText = '确定') {
  return new Promise((resolve) => {
    const html = `<p class="confirm-msg">${message}</p>`;
    openModal({
      title: '请确认',
      html,
      footerHtml: `<button class="btn ghost" id="m-cancel">取消</button>
        <button class="btn danger" id="m-ok">${okText}</button>`,
      onMount: (body) => {
        body.closest('.modal').querySelector('#m-cancel').onclick = () => {
          closeModal();
          resolve(false);
        };
        body.closest('.modal').querySelector('#m-ok').onclick = () => {
          closeModal();
          resolve(true);
        };
      },
    });
  });
}

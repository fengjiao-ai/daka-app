// ============================================================================
// 欢迎 / 连接云端 / 登录注册（支持用户名 / 邮箱 / 手机号；用户名即「直接建号」）
// ============================================================================
import { toast } from '../ui.js';
import { saveConfig, getClient, loadConfig } from '../supabaseClient.js';

// 用户名 → Supabase 内部邮箱（中文等 Unicode 字符用 encodeURIComponent 编码，保证邮箱合法）
const toEmail = (u) => `${encodeURIComponent(u.toLowerCase())}@checkin.app`;
const USER_RE = /^[\p{L}\p{N}_.\-]{2,20}$/u;  // 支持中文、日文等任意字母/数字/下划线/点/横线，最少2位

export function renderWelcome(ctx) {
  ctx.viewEl.innerHTML = `
  <section class="page center-page">
    <div class="welcome">
      <div class="welcome-logo">📚🏃</div>
      <h1>每日学习与运动打卡</h1>
      <p class="muted">把习惯存到云端，电脑和手机随时同步</p>
      <button class="btn primary big" id="local-trial">本地试用（无需注册）</button>
      <button class="btn outline big" id="cloud">☁️ 连接 Supabase 云端</button>
      <p class="hint">云端模式可多端同步；本地模式数据只存在当前浏览器。</p>
    </div>
  </section>`;
  ctx.viewEl.querySelector('#local-trial').onclick = () => {
    saveConfig({ mode: 'local' });
    ctx.boot();
  };
  ctx.viewEl.querySelector('#cloud').onclick = () => { location.hash = '#/connect'; };
}

export function renderCloudSetup(ctx) {
  const cfg = loadConfig() || {};
  ctx.viewEl.innerHTML = `
  <section class="page center-page">
    <div class="welcome">
      <h1>连接 Supabase</h1>
      <p class="muted">在项目设置 → API 中获取 URL 与 anon public key</p>
      <form id="cloud-form" class="form">
        <label>Project URL</label>
        <input name="url" placeholder="https://xxxx.supabase.co" value="${esc(cfg.url || '')}"/>
        <label>anon public key</label>
        <input name="anonKey" placeholder="eyJhbGci..." value="${esc(cfg.anonKey || '')}"/>
      </form>
      <button class="btn primary big" id="save-cloud">保存并继续</button>
      <button class="btn ghost" id="back">返回</button>
      <p class="hint">配置只保存在本浏览器，不会上传。详见项目 README 的部署说明。</p>
    </div>
  </section>`;
  ctx.viewEl.querySelector('#back').onclick = () => { location.hash = '#/welcome'; };
  ctx.viewEl.querySelector('#save-cloud').onclick = () => {
    const f = ctx.viewEl.querySelector('#cloud-form');
    const url = f.url.value.trim();
    const anonKey = f.anonKey.value.trim();
    if (!url || !anonKey) { toast('请填写 URL 和 key', 'error'); return; }
    saveConfig({ mode: 'cloud', url, anonKey });
    location.hash = '#/login';
  };
}

// ---------------------------------------------------------------------------
// 登录/注册页
//   · 主方式：用户名 + 密码（直接建号，存在数据库，可多设备同步）
//   · 备选：邮箱 / 手机号（Tab 切换）
// ---------------------------------------------------------------------------
export function renderLogin(ctx) {
  ctx.viewEl.innerHTML = `
  <section class="page center-page">
    <div class="welcome" style="max-width:380px;width:100%">
      <h1>登录 / 注册</h1>
      <p class="muted">用同一账户在任意设备登录即可同步数据</p>

      <!-- 主方式：用户名（直接建号，无需邮箱/手机号）-->
      <form id="user-form" class="form">
        <label>用户名（2-20 位，支持中文/字母/数字）</label>
        <input name="username" placeholder="例如 灿灿 或 xiaoming" maxlength="20"/>
        <label>密码（至少 6 位）</label>
        <input type="password" name="password" placeholder="设置或输入密码"/>
      </form>
      <div class="seg">
        <button class="btn primary big" id="user-signup">直接注册</button>
        <button class="btn outline big" id="user-signin">登录</button>
      </div>
      <p class="hint">用户名账户真实存于云端数据库，电脑/手机用同一用户名登录即同步。</p>

      <div style="text-align:center;color:#999;font-size:13px;margin:14px 0">— 或用以下方式 —</div>

      <!-- 备选方式切换 Tab -->
      <div class="auth-tabs" style="display:flex;gap:0;margin-bottom:14px;border-radius:8px;overflow:hidden;border:1px solid var(--border,#e0e0e0)">
        <button class="tab-btn active" data-tab="email" style="flex:1;padding:10px;border:none;background:var(--primary,#4f6ef7);color:#fff;cursor:pointer;font-size:14px">📧 邮箱</button>
        <button class="tab-btn" data-tab="phone" style="flex:1;padding:10px;border:none;background:#f5f5f5;color:#666;cursor:pointer;font-size:14px">📱 手机号</button>
      </div>

      <!-- 邮箱表单 -->
      <form id="email-form" class="form">
        <label>邮箱</label>
        <input type="email" name="email" placeholder="you@example.com"/>
        <label>密码</label>
        <input type="password" name="password" placeholder="至少 6 位"/>
      </form>
      <div class="seg" id="email-actions">
        <button class="btn primary big" id="signin">登录</button>
        <button class="btn outline big" id="signup">注册</button>
      </div>

      <!-- 手机号表单（默认隐藏） -->
      <form id="phone-form" class="form" style="display:none">
        <label>手机号</label>
        <input type="tel" name="phone" placeholder="13800138000" maxlength="11"/>
        <label>验证码</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="text" name="otp" placeholder="6 位数字" maxlength="6" style="flex:1"/>
          <button type="button" class="btn outline" id="send-otp" style="white-space:nowrap;min-width:110px">发送验证码</button>
        </div>
      </form>
      <div class="seg" id="phone-actions" style="display:none">
        <button class="btn primary big" id="phone-login">登录 / 注册</button>
      </div>

      <button class="btn ghost" id="back" style="margin-top:12px">返回</button>
      <button class="btn ghost" id="local-fallback">改用本地试用（无需注册）</button>
      <p class="hint" id="auth-hint"></p>
    </div>
  </section>`;

  // ---- Tab 切换 ----
  const tabs = ctx.viewEl.querySelectorAll('.tab-btn');
  const emailForm = ctx.viewEl.querySelector('#email-form');
  const emailActions = ctx.viewEl.querySelector('#email-actions');
  const phoneForm = ctx.viewEl.querySelector('#phone-form');
  const phoneActions = ctx.viewEl.querySelector('#phone-actions');

  tabs.forEach((btn) => {
    btn.onclick = () => {
      tabs.forEach((b) => { b.style.background = '#f5f5f5'; b.style.color = '#666'; b.classList.remove('active'); });
      btn.style.background = 'var(--primary,#4f6ef7)'; btn.style.color = '#fff'; btn.classList.add('active');
      const isEmail = btn.dataset.tab === 'email';
      emailForm.style.display = isEmail ? '' : 'none';
      emailActions.style.display = isEmail ? '' : 'none';
      phoneForm.style.display = isEmail ? 'none' : '';
      phoneActions.style.display = isEmail ? 'none' : '';
    };
  });

  // ---- 返回 / 本地试用 ----
  ctx.viewEl.querySelector('#back').onclick = () => { location.hash = '#/welcome'; };
  ctx.viewEl.querySelector('#local-fallback').onclick = () => {
    saveConfig({ mode: 'local' });
    ctx.boot();
  };

  // ---- 主方式：用户名注册/登录（直接建号，存数据库，可多设备同步）----
  const doUserAuth = async (mode) => {
    const f = ctx.viewEl.querySelector('#user-form');
    const username = f.username.value.trim();
    const password = f.password.value;
    if (!USER_RE.test(username)) { toast('用户名需 2-20 位，支持中文、字母、数字、下划线', 'error'); return; }
    if (password.length < 6) { toast('密码至少 6 位', 'error'); return; }
    const sb = getClient();
    if (!sb) { toast('未找到云端配置', 'error'); return; }
    try {
      if (mode === 'signup') {
        const { data, error } = await sb.auth.signUp({
          email: toEmail(username),
          password,
          options: { data: { name: username } },
        });
        if (error) throw error;
        if (data.session) { await ctx.afterLogin(); }
        else { ctx.viewEl.querySelector('#auth-hint').textContent = '注册成功，请直接登录。'; toast('注册成功', 'success'); }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: toEmail(username), password });
        if (error) throw error;
        await ctx.afterLogin();
      }
    } catch (e) {
      const msg = e.message || '';
      if (mode === 'signup' && /already registered/i.test(msg)) {
        toast('该用户名已被注册，请直接登录', 'error');
      } else {
        toast('操作失败：' + msg, 'error');
      }
    }
  };
  ctx.viewEl.querySelector('#user-signup').onclick = () => doUserAuth('signup');
  ctx.viewEl.querySelector('#user-signin').onclick = () => doUserAuth('signin');

  // ---- 邮箱登录/注册 ----
  const doEmailAuth = async (mode) => {
    const f = ctx.viewEl.querySelector('#email-form');
    const email = f.email.value.trim();
    const password = f.password.value;
    if (!email || password.length < 6) { toast('请填写邮箱和密码(≥6位)', 'error'); return; }
    const sb = getClient();
    if (!sb) { toast('未找到云端配置', 'error'); return; }
    try {
      if (mode === 'signup') {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) { await ctx.afterLogin(); }
        else { ctx.viewEl.querySelector('#auth-hint').textContent = '注册成功，请查收验证邮件后登录。'; toast('请查收验证邮件', 'info'); }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await ctx.afterLogin();
      }
    } catch (e) { toast('操作失败：' + e.message, 'error'); }
  };
  ctx.viewEl.querySelector('#signin').onclick = () => doEmailAuth('signin');
  ctx.viewEl.querySelector('#signup').onclick = () => doEmailAuth('signup');

  // ---- 手机号 + 验证码登录/注册 ----
  let otpCountdown = 0;
  const sendBtn = ctx.viewEl.querySelector('#send-otp');

  sendBtn.onclick = async () => {
    const f = ctx.viewEl.querySelector('#phone-form');
    const phone = f.phone.value.trim();
    if (!phone || phone.length !== 11 || !/^1\d{10}$/.test(phone)) { toast('请输入正确的 11 位手机号', 'error'); return; }
    if (otpCountdown > 0) return;
    const sb = getClient();
    if (!sb) { toast('未找到云端配置', 'error'); return; }
    try {
      const { error } = await sb.auth.signInWithOtp({ phone: '+86' + phone });
      if (error) throw error;
      toast('验证码已发送', 'success');
      otpCountdown = 60;
      sendBtn.disabled = true;
      sendBtn.textContent = otpCountdown + 's 后重发';
      const timer = setInterval(() => {
        otpCountdown--;
        if (otpCountdown <= 0) {
          clearInterval(timer);
          sendBtn.disabled = false;
          sendBtn.textContent = '发送验证码';
        } else {
          sendBtn.textContent = otpCountdown + 's 后重发';
        }
      }, 1000);
    } catch (e) {
      toast('发送失败：' + e.message + '\n（需先在 Supabase 配置短信服务商）', 'error');
    }
  };

  ctx.viewEl.querySelector('#phone-login').onclick = async () => {
    const f = ctx.viewEl.querySelector('#phone-form');
    const phone = f.phone.value.trim();
    const otp = f.otp.value.trim();
    if (!phone || !otp) { toast('请填写手机号和验证码', 'error'); return; }
    const sb = getClient();
    if (!sb) { toast('未找到云端配置', 'error'); return; }
    try {
      const { error } = await sb.auth.verifyOtp({ phone: '+86' + phone, token: otp, type: 'sms' });
      if (error) throw error;
      await ctx.afterLogin();
    } catch (e) { toast('验证失败：' + e.message, 'error'); }
  };
}

function esc(s) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(s ?? '').replace(/[&<>"']/g, (c) => map[c] || c);
}

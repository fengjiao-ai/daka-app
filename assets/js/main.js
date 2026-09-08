// ============================================================================
// 应用控制器：路由 + 鉴权门禁 + 数据加载
// ============================================================================
import * as api from './api.js';
import { loadConfig, getClient, resetClient } from './supabaseClient.js';
import { toast, openModal, closeModal, confirmDialog, progressRing } from './ui.js';
import { renderWelcome, renderCloudSetup, renderLogin } from './views/auth.js';
import { renderHome } from './views/home.js';
import { renderStudy } from './views/study.js';
import { renderExercise } from './views/exercise.js';
import { renderStatistics } from './views/statistics.js';
import { renderSettings } from './views/settings.js';
import { renderPet } from './views/pet.js';
import { renderRewards } from './views/rewards.js';
import { renderChores } from './views/chores.js';

const viewEl = document.getElementById('view');
const GATE = { welcome: renderWelcome, connect: renderCloudSetup, login: renderLogin };
const APP = { home: renderHome, study: renderStudy, exercise: renderExercise, statistics: renderStatistics, pet: renderPet, rewards: renderRewards, chores: renderChores, settings: renderSettings };

const state = { student: null, studyTasks: [], exerciseRecords: [], user: null };

const ctx = {
  get state() { return state; },
  viewEl,
  toast, openModal, closeModal, confirmDialog, progressRing,
  reload, refresh, navigate, signOut, boot, afterLogin,
};

function navigate(hash) { location.hash = hash; }

async function reload() {
  state.student = await api.getStudent();
  state.studyTasks = await api.listStudyTasks();
  state.exerciseRecords = await api.listExerciseRecords();
  refresh();
}

function refresh() {
  const route = currentRoute();
  if (APP[route]) renderView(route);
}

function renderView(route) {
  setActiveTab(route);
  const fn = APP[route];
  const res = fn(ctx);
  if (res && res.catch) res.catch((e) => toast('渲染出错：' + e.message, 'error'));
}

function setActiveTab(route) {
  document.querySelectorAll('.tabbar [data-route]').forEach((b) => {
    b.classList.toggle('active', b.dataset.route === route);
  });
  document.body.classList.toggle('in-app', !!APP[route]);
}

function currentRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  return h || 'home';
}

// 进入应用（数据已就绪）
function boot() {
  route();
}

async function afterLogin() {
  const sb = getClient();
  const { data } = await sb.auth.getUser();
  state.user = data?.user || null;
  await reload();
  location.hash = '#/home';
}

async function ensureAppData() {
  // 确保已登录/本地就绪且数据已加载
  const cfg = loadConfig();
  if (!cfg) { location.hash = '#/welcome'; return false; }
  if (cfg.mode === 'local') {
    if (!state.student) await reload();
    return true;
  }
  const sb = getClient();
  if (!sb) { location.hash = '#/connect'; return false; }
  const { data } = await sb.auth.getUser();
  if (!data?.user) { location.hash = '#/login'; return false; }
  state.user = data.user;
  if (!state.student) await reload();
  return true;
}

async function route() {
  const r = currentRoute();
  if (GATE[r]) {
    GATE[r](ctx);
    setActiveTab(r);
    document.body.classList.remove('in-app');
    return;
  }
  // app route
  const ok = await ensureAppData();
  if (!ok) return; // ensureAppData 已重定向
  if (!APP[r]) { location.hash = '#/home'; return; }
  renderView(r);
}

async function signOut() {
  const sb = getClient();
  if (sb) await sb.auth.signOut();
  resetClient();
  state.user = null;
  state.student = null;
  state.studyTasks = [];
  state.exerciseRecords = [];
  toast('已退出', 'info');
  location.hash = '#/welcome';
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);
// 若 DOM 已就绪（脚本在 body 末尾）
if (document.readyState !== 'loading') route();

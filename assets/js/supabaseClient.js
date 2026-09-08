// ============================================================================
// Supabase 连接配置（运行时从 localStorage 读取，用户首次在「连接设置」页填入）
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const CFG_KEY = 'ssc_config';

export function loadConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem(CFG_KEY));
    if (stored) return stored;
  } catch {
    // 忽略损坏的配置
  }
  // 未显式配置时，回退到内置默认值（云端模式，开箱即连）
  return { mode: 'cloud', url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, _default: true };
}

export function saveConfig(cfg) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

export function clearConfig() {
  localStorage.removeItem(CFG_KEY);
}

// 是否处于云端模式（已配置 Supabase 且 URL/Key 合法）
export function isCloudMode() {
  const c = loadConfig();
  return !!(c && c.url && c.anonKey && c.mode === 'cloud');
}

let _client = null;

export function getClient() {
  if (_client) return _client;
  const c = loadConfig();
  if (!c || !c.url || !c.anonKey) return null;
  _client = createClient(c.url, c.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _client;
}

export function resetClient() {
  _client = null;
}

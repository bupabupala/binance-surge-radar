/**
 * 身份鉴权与安全会话管理
 */

import { KV_KEYS } from '../config/constants.js';
import { getKVBinding, jsonResponse } from '../utils/response.js';

export async function hashPassword(str, salt = 'bian_secret_salt_2026') {
  const enc = new TextEncoder();
  const data = enc.encode(str + salt);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getAuthConfig(env) {
  const kv = getKVBinding(env);
  let config = {
    adminPassword: env.ADMIN_PASSWORD || env.ADMIN || 'admin888',
    guestPassword: env.GUEST_PASSWORD || 'guest888',
    guestEnabled: true
  };
  if (kv) {
    try {
      const raw = await kv.get(KV_KEYS.AUTH_CONFIG);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.adminPassword) config.adminPassword = parsed.adminPassword;
        if (parsed.guestPassword) config.guestPassword = parsed.guestPassword;
        if (parsed.guestEnabled !== undefined) config.guestEnabled = parsed.guestEnabled;
      }
    } catch (e) {}
  }
  return config;
}

export async function checkAuth(request, env) {
  const cookies = request.headers.get('Cookie') || '';
  const authCookie = cookies.split(';').map(c => c.trim()).find(c => c.startsWith('bian_auth='));
  if (!authCookie) return null;
  const token = authCookie.split('=')[1];
  if (!token) return null;

  const authCfg = await getAuthConfig(env);
  const adminExpected = await hashPassword('admin:' + authCfg.adminPassword);
  if (token === adminExpected) return 'admin';

  if (authCfg.guestEnabled) {
    const guestExpected = await hashPassword('guest:' + authCfg.guestPassword);
    if (token === guestExpected) return 'guest';
  }

  return null;
}

export async function handleLoginAction(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const password = (body.password || '').trim();
    if (!password) {
      return jsonResponse({ success: false, message: '请输入登录密码' }, 400);
    }

    const authCfg = await getAuthConfig(env);

    // 1. 优先校验管理员密码
    if (password === authCfg.adminPassword) {
      const token = await hashPassword('admin:' + authCfg.adminPassword);
      const res = jsonResponse({
        success: true,
        role: 'admin',
        message: '管理员身份验证成功',
        redirect: '/admin'
      });
      res.headers.set('Set-Cookie', `bian_auth=${token}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax`);
      return res;
    }

    // 2. 校验访客密码
    if (authCfg.guestEnabled && password === authCfg.guestPassword) {
      const token = await hashPassword('guest:' + authCfg.guestPassword);
      const res = jsonResponse({
        success: true,
        role: 'guest',
        message: '访客身份验证成功',
        redirect: '/'
      });
      res.headers.set('Set-Cookie', `bian_auth=${token}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax`);
      return res;
    }

    return jsonResponse({ success: false, message: '密码错误，请重新输入' }, 401);
  } catch (err) {
    return jsonResponse({ success: false, message: err.message }, 500);
  }
}

export async function handleLogout(request, env) {
  const url = new URL(request.url);
  return new Response('正在退出...', {
    status: 302,
    headers: {
      'Location': `${url.origin}/login`,
      'Set-Cookie': 'bian_auth=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'
    }
  });
}

export async function savePasswordConfig(env, { newAdminPassword, newGuestPassword, guestEnabled }) {
  const kv = getKVBinding(env);
  if (!kv) return { success: false, message: '未绑定 KV 存储，无法持久化保存密码' };

  const authCfg = await getAuthConfig(env);
  if (newAdminPassword && newAdminPassword.trim().length >= 4) {
    authCfg.adminPassword = newAdminPassword.trim();
  }
  if (newGuestPassword !== undefined) {
    authCfg.guestPassword = newGuestPassword.trim();
  }
  if (guestEnabled !== undefined) {
    authCfg.guestEnabled = Boolean(guestEnabled);
  }

  await kv.put(KV_KEYS.AUTH_CONFIG, JSON.stringify(authCfg));
  const token = await hashPassword('admin:' + authCfg.adminPassword);
  return { success: true, token, message: '密码安全配置更新成功' };
}

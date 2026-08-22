/**
 * Binance Multi-Market Monitor & Volume Surge Radar
 * Cloudflare Worker ES Module Entry Point (src/index.js)
 */

import { KV_KEYS } from './config/constants.js';
import { jsonResponse, getKVBinding } from './utils/response.js';
import { checkAuth, handleLoginAction, handleLogout, getAuthConfig, savePasswordConfig } from './services/auth.js';
import { getOrFetchDashboard, aggregateAllData, fetchAlphaTokens, fetchStockTokens, fetchAnnouncements } from './services/binance.js';
import { getWatchlist, saveWatchlist } from './services/quant.js';
import { getBotConfig, saveBotConfig, sendTestNotification, processScheduledAlerts } from './services/notifier.js';
import { renderLoginPage } from './views/login.html.js';
import { renderAdminPage } from './views/admin.html.js';
import { renderDashboardPage } from './views/dashboard.html.js';
import { renderNginxPage } from './views/nginx.html.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    try {
      // 🚀 1. Cloudflare 边缘 WebSocket 反向中继 (/ws)
      if (path === '/ws') {
        const upgradeHeader = request.headers.get('Upgrade');
        if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
          return new Response('Expected Upgrade: websocket', { status: 426 });
        }

        try {
          const upstreamResp = await fetch('https://data-stream.binance.vision/ws/!ticker@arr', {
            headers: {
              Upgrade: 'websocket'
            }
          });

          const binanceWs = upstreamResp.webSocket;
          if (!binanceWs) {
            return new Response('Failed to connect to Binance WebSocket upstream', { status: 502 });
          }
          binanceWs.accept();

          const webSocketPair = new WebSocketPair();
          const [client, server] = Object.values(webSocketPair);
          server.accept();

          binanceWs.addEventListener('message', event => {
            try {
              server.send(event.data);
            } catch (e) {}
          });

          binanceWs.addEventListener('close', () => {
            try { server.close(); } catch (e) {}
          });

          binanceWs.addEventListener('error', () => {
            try { server.close(); } catch (e) {}
          });

          server.addEventListener('close', () => {
            try { binanceWs.close(); } catch (e) {}
          });

          return new Response(null, {
            status: 101,
            webSocket: client
          });
        } catch (err) {
          return new Response(`WebSocket Error: ${err.message}`, { status: 500 });
        }
      }

      const authCfg = await getAuthConfig(env);
      const loginPath = authCfg.loginPath || '/login';
      const adminPath = authCfg.adminPath || '/admin';

      // 2. 动态私密登录入口
      if (path === loginPath || path === '/login') {
        if (path === '/login' && loginPath !== '/login') {
          return renderNginxPage();
        }

        if (request.method === 'POST') {
          return handleLoginAction(request, env);
        }
        return renderLoginPage();
      } else if (path === '/logout') {
        return handleLogout(request, env);
      }

      // 3. 身份鉴权校验
      const authRole = await checkAuth(request, env);

      // 4. 动态私密管理中枢
      if (path === adminPath || path === '/admin') {
        if (path === '/admin' && adminPath !== '/admin') {
          return renderNginxPage();
        }

        if (authRole !== 'admin') {
          return renderNginxPage();
        }
        return renderAdminPage();
      }

      // 5. 管理员专属 API (/api/admin/*)
      if (path.startsWith('/api/admin/')) {
        if (authRole !== 'admin') {
          return jsonResponse({ code: 401, message: '未授权或无管理员权限' }, 401);
        }

        if (path === '/api/admin/config') {
          if (request.method === 'GET') {
            const botConfig = await getBotConfig(env);
            const watchlist = await getWatchlist(env);
            const kv = getKVBinding(env);
            return jsonResponse({
              success: true,
              kvBound: Boolean(kv),
              botConfig,
              watchlist,
              guestEnabled: authCfg.guestEnabled,
              hasAdminPassword: Boolean(authCfg.adminPassword),
              guestPassword: authCfg.guestPassword || '',
              loginPath: authCfg.loginPath || '/login',
              adminPath: authCfg.adminPath || '/admin'
            });
          } else if (request.method === 'POST') {
            const body = await request.json();
            if (body.botConfig) {
              await saveBotConfig(env, body.botConfig);
            }
            return jsonResponse({ success: true, message: '机器人及预警配置已永久保存到 KV' });
          }
        }

        if (path === '/api/admin/watchlist') {
          if (request.method === 'GET') {
            const list = await getWatchlist(env);
            return jsonResponse({ success: true, data: list });
          } else if (request.method === 'POST') {
            const body = await request.json();
            const list = await saveWatchlist(env, body.watchlist);
            return jsonResponse({ success: true, message: '自选列表已同步', data: list });
          }
        }

        if (path === '/api/admin/password') {
          if (request.method === 'POST') {
            const body = await request.json();
            const res = await savePasswordConfig(env, body);
            const resp = jsonResponse(res, res.success ? 200 : 400);
            if (res.token) {
              resp.headers.set('Set-Cookie', `bian_auth=${res.token}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax`);
            }
            return resp;
          }
        }

        if (path === '/api/admin/test-notify') {
          if (request.method === 'POST') {
            const body = await request.json().catch(() => ({}));
            let botCfg = body.botConfig || (await getBotConfig(env));
            if (body.botConfig) {
              await saveBotConfig(env, body.botConfig);
            }
            const fresh = await aggregateAllData(env).catch(() => null);
            const results = await sendTestNotification(botCfg, env, fresh);
            const errItem = Array.isArray(results) ? results.find(r => !r.success) : null;
            const allSuccess = Array.isArray(results) && results.length > 0 && !errItem;
            const message = results.length === 0 
              ? '未开启任何推送通道或凭证为空 (请确认已勾选「启用推送」并填入 Token 和 Chat ID)'
              : (errItem ? (errItem.error || errItem.message || '推送失败，请检查凭证') : '自选标的最新行情快报已成功送达 Telegram / 钉钉！');
            return jsonResponse({
              success: allSuccess,
              message,
              results
            }, allSuccess ? 200 : 400);
          }
        }
      }

      // 6. 根路径 (/)：未登录返回 Nginx 伪装；已登录展示雷达大盘
      if (path === '/' || path === '/index.html') {
        if (!authRole) {
          return renderNginxPage(); // 🛡️ Nginx 深度伪装
        }
        return renderDashboardPage(authRole, adminPath);
      }

      // 7. 行情公共数据 API
      if (path === '/api/dashboard') {
        if (!authRole) return jsonResponse({ code: 401, message: '请先登录' }, 401);
        const data = await getOrFetchDashboard(env);
        return jsonResponse(data, 200, { 'Cache-Control': 'public, max-age=5, s-maxage=10' });
      }

      if (path === '/api/alpha') {
        if (!authRole) return jsonResponse({ code: 401, message: '请先登录' }, 401);
        const list = await fetchAlphaTokens(env);
        return jsonResponse({ success: true, total: list.length, data: list }, 200, { 'Cache-Control': 'public, max-age=15, s-maxage=30' });
      }

      if (path === '/api/stocks') {
        if (!authRole) return jsonResponse({ code: 401, message: '请先登录' }, 401);
        const list = await fetchStockTokens(env);
        return jsonResponse({ success: true, total: list.length, data: list }, 200, { 'Cache-Control': 'public, max-age=60, s-maxage=120' });
      }

      if (path === '/api/announcements') {
        if (!authRole) return jsonResponse({ code: 401, message: '请先登录' }, 401);
        const data = await fetchAnnouncements(env);
        return jsonResponse({ success: true, data }, 200, { 'Cache-Control': 'public, max-age=60, s-maxage=120' });
      }

      if (path === '/api/sync') {
        if (authRole !== 'admin') return jsonResponse({ code: 403, message: '仅管理员可手动触发同步' }, 403);
        const startTime = Date.now();
        const data = await aggregateAllData(env);
        const signals = await processScheduledAlerts(env, data, true);
        const msg = signals.length > 0
          ? `捕获 ${signals.length} 支自选标的异动信号并已推送到群 (${signals.map(s => `${s.symbol} ${s.chg24h >= 0 ? '+' : ''}${s.chg24h.toFixed(1)}%`).join(', ')})`
          : '自选标的量化巡检完成，当前所有自选标的波动平稳（暂未触及 3% 异动阈值）';
        return jsonResponse({
          success: true,
          durationMs: Date.now() - startTime,
          message: msg,
          signalCount: signals.length,
          signals: signals.map(s => `${s.symbol} (${s.chg24h >= 0 ? '+' : ''}${s.chg24h.toFixed(2)}%)`),
          counts: data.counts,
          timestamp: data.timestamp
        });
      }

      if (path === '/api/health') {
        const kv = getKVBinding(env);
        return jsonResponse({
          status: 'ok',
          kvBound: Boolean(kv),
          serverTime: new Date().toISOString()
        });
      }

      // 未匹配路由默认返回 Nginx 伪装
      return renderNginxPage();
    } catch (err) {
      return jsonResponse({ code: 500, message: err.message }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      const startTime = Date.now();
      // 在 1 分钟周期内进行 2 轮轻量微巡检 (0s 与 25s 各一轮，总子请求数严格控制在 4 次以内)
      for (let i = 0; i < 2; i++) {
        try {
          const data = await aggregateAllData(env);
          await processScheduledAlerts(env, data);
        } catch (e) {}

        if (Date.now() - startTime >= 35000) break;
        if (i < 1) {
          await new Promise(resolve => setTimeout(resolve, 25000));
        }
      }
    })());
  }
};

/**
 * 消息推送通知与预警中心 (Telegram / 钉钉 / 新币上架 / 下架停牌 / 量化信号)
 */

import { KV_KEYS } from '../config/constants.js';
import { getKVBinding } from '../utils/response.js';
import { getWatchlist } from './quant.js';

export async function getBotConfig(env) {
  const kv = getKVBinding(env);
  let config = {
    telegram: {
      enabled: Boolean(env?.TELEGRAM_BOT_TOKEN && env?.TELEGRAM_CHAT_ID),
      token: env?.TELEGRAM_BOT_TOKEN || '',
      chatId: env?.TELEGRAM_CHAT_ID || ''
    },
    dingtalk: {
      enabled: Boolean(env?.DINGTALK_TOKEN),
      token: env?.DINGTALK_TOKEN || '',
      secret: env?.DINGTALK_SECRET || ''
    },
    surgeAlert: {
      enabled: true,
      minStars: 3,
      minSurgeMultiplier: 3.0
    },
    newListingAlert: {
      enabled: true
    },
    delistAlert: {
      enabled: true
    },
    priceAlertThreshold: 5.0
  };

  if (kv) {
    try {
      const raw = await kv.get(KV_KEYS.BOT_CONFIG);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.telegram) config.telegram = { ...config.telegram, ...parsed.telegram };
        if (parsed.dingtalk) config.dingtalk = { ...config.dingtalk, ...parsed.dingtalk };
        if (parsed.surgeAlert) config.surgeAlert = { ...config.surgeAlert, ...parsed.surgeAlert };
        if (parsed.newListingAlert !== undefined) config.newListingAlert = parsed.newListingAlert;
        if (parsed.delistAlert !== undefined) config.delistAlert = parsed.delistAlert;
        if (parsed.priceAlertThreshold) config.priceAlertThreshold = parsed.priceAlertThreshold;
      }
    } catch (e) {}
  }
  return config;
}

export async function saveBotConfig(env, newConfig) {
  const kv = getKVBinding(env);
  if (!kv) return false;
  await kv.put(KV_KEYS.BOT_CONFIG, JSON.stringify(newConfig));
  return true;
}

export async function sendTelegramMessage(token, chatId, text) {
  if (!token || !chatId) return { success: false, message: 'Telegram Token 或 ChatID 未配置' };
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      })
    });
    const data = await res.json();
    return { success: res.ok && data.ok, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function sendDingTalkMessage(token, secret, title, markdownContent) {
  if (!token) return { success: false, message: '钉钉 Token 未配置' };
  try {
    let url = `https://oapi.dingtalk.com/robot/send?access_token=${token}`;
    if (secret) {
      const timestamp = Date.now();
      const enc = new TextEncoder();
      const stringToSign = `${timestamp}\n${secret}`;
      const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', key, enc.encode(stringToSign));
      const signBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
      url += `&timestamp=${timestamp}&sign=${encodeURIComponent(signBase64)}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: {
          title,
          text: markdownContent
        }
      })
    });
    const data = await res.json();
    return { success: res.ok && data.errcode === 0, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function sendUnifiedBroadcast(botConfig, title, textHtml, textMarkdown) {
  const promises = [];
  if (botConfig.telegram?.enabled && botConfig.telegram?.token && botConfig.telegram?.chatId) {
    promises.push(sendTelegramMessage(botConfig.telegram.token, botConfig.telegram.chatId, textHtml));
  }
  if (botConfig.dingtalk?.enabled && botConfig.dingtalk?.token) {
    promises.push(sendDingTalkMessage(botConfig.dingtalk.token, botConfig.dingtalk.secret, title, textMarkdown));
  }
  return Promise.all(promises);
}

export async function sendTestNotification(botConfig) {
  const title = '🔔 币安 USDT 异动雷达 · 连通性测试';
  const textHtml = `<b>🔔 币安 USDT 异动雷达 · 连通性测试</b>\n\n` +
    `✅ 恭喜！机器人推送通道配置成功。\n` +
    `• 监控板块：现货全量、Alpha 链上、bStocks 美股\n` +
    `• 异动策略：市值 &lt; $100M 小盘放量 1.5x~10x+ / 5% 暴涨 / 新币上线与下架\n` +
    `• 触发时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

  const textMd = `### 🔔 币安 USDT 异动雷达 · 连通性测试\n\n` +
    `> **恭喜！机器人推送通道配置成功。**\n\n` +
    `- **监控板块**：现货全量、Alpha 链上、bStocks 美股\n` +
    `- **异动策略**：市值 < $100M 放量星级雷达 / 5% 暴涨暴跌 / 新币上架与下架停牌\n` +
    `- **触发时间**：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

  return sendUnifiedBroadcast(botConfig, title, textHtml, textMd);
}

// 🎯 新币上架 / 下架停牌 7×24h 自动差分巡检与秒级推送
export async function detectSymbolChangesAndNotify(env, botConfig, currentActiveSymbols, currentPreTradingSymbols) {
  const kv = getKVBinding(env);
  if (!kv || !Array.isArray(currentActiveSymbols) || currentActiveSymbols.length === 0) return;

  try {
    const rawPrev = await kv.get('bian:active_symbols:v2');
    const rawPrevPre = await kv.get('bian:pretrading_symbols:v2');

    const prevActiveSet = new Set(rawPrev ? JSON.parse(rawPrev) : []);
    const prevPreSet = new Set(rawPrevPre ? JSON.parse(rawPrevPre) : []);
    const currentActiveSet = new Set(currentActiveSymbols);
    const currentPreSet = new Set(currentPreTradingSymbols || []);

    // 1. 检测新币上线 / 即将开盘 (Pre-Trading 或新增交易对)
    const newPreTrading = (currentPreTradingSymbols || []).filter(s => !prevPreSet.has(s) && !prevActiveSet.has(s));
    const newlyListed = currentActiveSymbols.filter(s => !prevActiveSet.has(s) && !prevPreSet.has(s));

    const allNew = [...new Set([...newPreTrading, ...newlyListed])];
    if (allNew.length > 0 && prevActiveSet.size > 100) {
      for (const sym of allNew) {
        const clean = sym.replace(/USDT$/, '');
        const title = `🚀【币安新币上线预警】发现全新交易对 ${clean}!`;
        const textHtml = `<b>🚀【币安新币上线预警】发现新交易对！</b>\n\n` +
          `• 资产代码：<b>${clean}</b>\n` +
          `• 交易对：<code>${sym}</code>\n` +
          `• 状态：即将开盘 / 正式上线\n` +
          `• 时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
        const textMd = `### 🚀【币安新币上线预警】发现新交易对！\n\n` +
          `- **资产代码**：**${clean}**\n` +
          `- **交易对**：\`${sym}\`\n` +
          `- **状态**：即将开盘 / 正式上线\n` +
          `- **时间**：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

        await sendUnifiedBroadcast(botConfig, title, textHtml, textMd);
      }
    }

    // 2. 检测下架 / 停牌
    if (prevActiveSet.size > 100) {
      const delisted = [...prevActiveSet].filter(s => !currentActiveSet.has(s));
      if (delisted.length > 0 && delisted.length < 50) {
        for (const sym of delisted) {
          const clean = sym.replace(/USDT$/, '');
          const title = `⚠️【币安代币下架/停牌】${clean} 已停止交易`;
          const textHtml = `<b>⚠️【币安代币下架/停牌预警】</b>\n\n` +
            `• 资产代码：<b>${clean}</b>\n` +
            `• 交易对：<code>${sym}</code>\n` +
            `• 状态：已停止交易 / 停牌下架\n` +
            `• 时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
          const textMd = `### ⚠️【币安代币下架/停牌预警】\n\n` +
            `- **资产代码**：**${clean}**\n` +
            `- **交易对**：\`${sym}\`\n` +
            `- **状态**：已停止交易 / 停牌下架\n` +
            `- **时间**：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

          await sendUnifiedBroadcast(botConfig, title, textHtml, textMd);
        }
      }
    }

    // 保存当前快照
    await kv.put('bian:active_symbols:v2', JSON.stringify(currentActiveSymbols), { expirationTtl: 86400 * 7 });
    await kv.put('bian:pretrading_symbols:v2', JSON.stringify(currentPreTradingSymbols || []), { expirationTtl: 86400 * 7 });
  } catch (e) {}
}

export async function processScheduledAlerts(env, freshData) {
  const botConfig = await getBotConfig(env);
  if (!botConfig.telegram?.enabled && !botConfig.dingtalk?.enabled) return;

  const watchlist = await getWatchlist(env);
  const activeSpot = (freshData.spot || []).filter(item => item.price > 0 && item.volume24h > 0);
  const currentSymbols = activeSpot.map(item => item.symbol);
  const preTradingSymbols = (freshData.preTradingSymbols || []);

  // 1. 检测新币上线与下架
  await detectSymbolChangesAndNotify(env, botConfig, currentSymbols, preTradingSymbols);

  // 2. 检测放量星级异动 (< $100M 市值)
  const surge15m = (freshData.surge && freshData.surge['15m']) || [];
  for (const item of surge15m.slice(0, 3)) {
    if (item.stars >= (botConfig.surgeAlert?.minStars || 3) && item.surgeMultiplier >= (botConfig.surgeAlert?.minSurgeMultiplier || 3.0)) {
      const clean = item.ticker || item.symbol.replace(/USDT$/, '');
      const title = `🔥【小市值放量异动】${clean} 放量 ${item.surgeMultiplier}x (${item.starDisplay})`;
      const textHtml = `<b>🔥【小市值放量异动雷达】</b>\n\n` +
        `• 资产：<b>${clean}</b> (${item.zhName || ''})\n` +
        `• 放量星级：<b>${item.starDisplay} (${item.surgeMultiplier}x)</b>\n` +
        `• 最新价格：$${item.price} (${item.priceChange >= 0 ? '+' : ''}${item.priceChange}%)\n` +
        `• 市值：$${(item.marketCap / 1e6).toFixed(2)}M (&lt; $100M)\n` +
        `• 时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

      const textMd = `### 🔥【小市值放量异动雷达】\n\n` +
        `- **资产**：**${clean}** (${item.zhName || ''})\n` +
        `- **放量星级**：**${item.starDisplay} (${item.surgeMultiplier}x)**\n` +
        `- **最新价格**：$${item.price} (${item.priceChange >= 0 ? '+' : ''}${item.priceChange}%)\n` +
        `- **市值**：$${(item.marketCap / 1e6).toFixed(2)}M (< $100M)\n` +
        `- **时间**：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

      await sendUnifiedBroadcast(botConfig, title, textHtml, textMd);
    }
  }
}

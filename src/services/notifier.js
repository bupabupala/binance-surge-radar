/**
 * 机器人通知服务 (Telegram & 钉钉 Webhook)
 */

import { KV_KEYS } from '../config/constants.js';
import { getKVBinding, formatPrice } from '../utils/response.js';
import { getWatchlist, inspectWatchlistSignals } from './quant.js';

export async function getBotConfig(env) {
  const kv = getKVBinding(env);
  let config = {
    tg: { enabled: false, botToken: '', chatId: '' },
    ding: { enabled: false, webhookUrl: '', secret: '' },
    rules: { pct5: true, emaCross: true, volume3Star: true, cooldownMin: 30 }
  };
  if (kv) {
    try {
      const raw = await kv.get(KV_KEYS.BOT_CONFIG);
      if (raw) {
        const parsed = JSON.parse(raw);
        config = {
          tg: { ...config.tg, ...(parsed.tg || {}) },
          ding: { ...config.ding, ...(parsed.ding || {}) },
          rules: { ...config.rules, ...(parsed.rules || {}) }
        };
      }
    } catch (e) {}
  }
  return config;
}

export async function saveBotConfig(env, newConfig) {
  const kv = getKVBinding(env);
  if (kv && newConfig) {
    await kv.put(KV_KEYS.BOT_CONFIG, JSON.stringify(newConfig));
  }
  return newConfig;
}

export async function sendTelegramMessage(botToken, chatId, htmlText) {
  if (!botToken || !chatId) return { success: false, error: '缺少 BotToken 或 ChatID' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: htmlText,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      })
    });
    const json = await res.json();
    return { success: res.ok && json.ok, data: json };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function signDingTalk(secret) {
  const timestamp = Date.now();
  const stringToSign = `${timestamp}\n${secret}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(stringToSign));
  const base64Sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  return {
    timestamp,
    sign: encodeURIComponent(base64Sig)
  };
}

export async function sendDingTalkMessage(webhookUrl, secret, title, markdownText) {
  if (!webhookUrl) return { success: false, error: '缺少 Webhook URL' };
  try {
    let targetUrl = webhookUrl;
    if (secret && secret.trim().length > 0) {
      const { timestamp, sign } = await signDingTalk(secret.trim());
      const sep = targetUrl.includes('?') ? '&' : '?';
      targetUrl = `${targetUrl}${sep}timestamp=${timestamp}&sign=${sign}`;
    }

    const payload = {
      msgtype: 'markdown',
      markdown: {
        title: title || '币安雷达 · 交易信号提醒',
        text: markdownText
      }
    };

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    return { success: res.ok && json.errcode === 0, data: json };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function sendTestNotification(botConfig) {
  const results = { tg: null, ding: null };
  const timeStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });

  // 1. Telegram 测试
  if (botConfig?.tg?.botToken && botConfig?.tg?.chatId) {
    const tgText = `<b>🔔 币安雷达 · 机器人连通性测试</b>\n\n` +
      `<b>状态：</b>🟢 测试推送成功！\n` +
      `<b>系统：</b>Binance Surge Radar Multi-Market Monitor\n` +
      `<b>功能：</b>自选资产异动监控 (5% 涨跌 / EMA 均线金叉死叉 / 3星主力放量)\n` +
      `<b>时间：</b>${timeStr}`;
    results.tg = await sendTelegramMessage(botConfig.tg.botToken, botConfig.tg.chatId, tgText);
  }

  // 2. 钉钉测试
  if (botConfig?.ding?.webhookUrl) {
    const dingText = `### 🔔 币安雷达 · 机器人连通性测试\n\n` +
      `- **状态**：🟢 测试推送成功！\n` +
      `- **系统**：Binance Surge Radar Multi-Market Monitor\n` +
      `- **功能**：自选资产异动监控 (5% 暴涨暴跌 / EMA 均线做多买点 / 3星放量)\n` +
      `- **时间**：${timeStr}`;
    results.ding = await sendDingTalkMessage(botConfig.ding.webhookUrl, botConfig.ding.secret, '币安雷达: 测试通知', dingText);
  }

  return results;
}

export async function processScheduledAlerts(env, dashboardData) {
  const kv = getKVBinding(env);
  if (!kv || !dashboardData) return;

  const botConfig = await getBotConfig(env);
  const isTgActive = botConfig.tg?.enabled && botConfig.tg?.botToken && botConfig.tg?.chatId;
  const isDingActive = botConfig.ding?.enabled && botConfig.ding?.webhookUrl;
  if (!isTgActive && !isDingActive) return;

  const watchlist = await getWatchlist(env);
  if (!watchlist || watchlist.length === 0) return;

  let alertHistory = {};
  try {
    const rawHist = await kv.get(KV_KEYS.ALERT_HISTORY);
    if (rawHist) alertHistory = JSON.parse(rawHist);
  } catch (e) {}

  const alerts = inspectWatchlistSignals(dashboardData, watchlist, botConfig, alertHistory);
  if (alerts.length > 0) {
    await kv.put(KV_KEYS.ALERT_HISTORY, JSON.stringify(alertHistory), { expirationTtl: 86400 });

    for (const item of alerts.slice(0, 5)) {
      const timeStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
      const tgHtml = `<b>🔔 币安雷达 · 交易信号提醒</b>\n\n` +
        `<b>标的资产：</b><code>${item.symbol}</code> (${item.zhName})\n` +
        `<b>信号类型：</b><b>${item.type}</b>\n` +
        `<b>核心说明：</b>${item.signal}\n` +
        `<b>最新价格：</b>$${formatPrice(item.price)}\n` +
        `<b>24h 涨跌：</b>${item.chg24h >= 0 ? '+' : ''}${item.chg24h.toFixed(2)}%\n` +
        `<b>15m 量能：</b>${item.surgeMul}x (⭐ ${item.stars}星 · ${item.stars * 15}m连续)\n` +
        `<b>触发时间：</b>${timeStr}`;

      const dingMarkdown = `### 🔔 币安雷达 · 交易信号提醒\n\n` +
        `- **标的资产**：\`${item.symbol}\` (${item.zhName})\n` +
        `- **信号类型**：**${item.type}**\n` +
        `- **核心说明**：${item.signal}\n` +
        `- **最新价格**：$${formatPrice(item.price)}\n` +
        `- **24h 涨跌**：${item.chg24h >= 0 ? '+' : ''}${item.chg24h.toFixed(2)}%\n` +
        `- **15m 量能**：${item.surgeMul}x (⭐ ${item.stars}星 · ${item.stars * 15}m连续)\n` +
        `- **触发时间**：${timeStr}`;

      if (isTgActive) {
        await sendTelegramMessage(botConfig.tg.botToken, botConfig.tg.chatId, tgHtml);
      }
      if (isDingActive) {
        await sendDingTalkMessage(botConfig.ding.webhookUrl, botConfig.ding.secret, `币安雷达: ${item.symbol} ${item.type}`, dingMarkdown);
      }
    }
  }
}

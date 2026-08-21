
function extractPlainTextFromAst(node, maxLen = 300) {
  if (!node) return '';
  let result = '';
  
  function walk(n) {
    if (!n || result.length >= maxLen + 100) return;
    if (typeof n === 'string') {
      result += n + ' ';
      return;
    }
    if (n.node === 'text' && n.text) {
      result += n.text.trim() + ' ';
    }
    if (n.child) {
      if (Array.isArray(n.child)) {
        n.child.forEach(walk);
      } else if (typeof n.child === 'object') {
        Object.values(n.child).forEach(walk);
      }
    }
  }
  
  try {
    walk(node);
  } catch (e) {}
  
  result = result.replace(/\s+/g, ' ').trim();
  result = result.replace(/^这是一般性公告[，,][^。]+。适用条款和条件。[ ]*亲爱的用户[：:]/g, '').trim();
  result = result.replace(/^亲爱的用户[：:]/g, '').trim();
  if (result.length > maxLen) {
    result = result.slice(0, maxLen) + '...';
  }
  return result;
}

// 🎯 币安官方 4 大公告分类 7×24h 自动差分监听与全要素推送 (标题 + 正文核心摘要 + 原文链接)
export async function detectNewAnnouncementsAndNotify(env, botConfig, announcements) {
  const kv = getKVBinding(env);
  if (!kv || !announcements) return;

  const allItems = announcements.all || [
    ...(announcements.newListings || []),
    ...(announcements.alphaEvents || []),
    ...(announcements.airdrops || []),
    ...(announcements.delistings || [])
  ];

  if (!Array.isArray(allItems) || allItems.length === 0) return;

  try {
    const rawSeen = await kv.get('bian:seen_announcements:v2');
    let seenCodes = new Set(rawSeen ? JSON.parse(rawSeen) : []);

    // 首次运行初始化历史缓存，不爆发推送历史公告
    if (seenCodes.size === 0) {
      const initialCodes = allItems.map(a => a.code || a.id).filter(Boolean);
      await kv.put('bian:seen_announcements:v2', JSON.stringify(initialCodes), { expirationTtl: 86400 * 30 });
      return;
    }

    const newArticles = allItems.filter(a => (a.code || a.id) && !seenCodes.has(a.code || a.id));

    if (newArticles.length > 0) {
      // 一次最多推送 3 条最新，避免消息轰炸
      for (const item of newArticles.slice(0, 3)) {
        const code = item.code || item.id;
        let summaryText = '';

        // 异步拉取正文 AST 提取核心摘要
        try {
          const res = await fetch(`https://www.binance.com/bapi/composite/v1/public/cms/article/detail/query?articleCode=${code}`, {
            headers: { 'lang': 'zh-CN', 'User-Agent': 'Mozilla/5.0' }
          });
          if (res.ok) {
            const detailJson = await res.json();
            const rawBody = detailJson?.data?.body;
            if (rawBody) {
              const parsedAst = JSON.parse(rawBody);
              summaryText = extractPlainTextFromAst(parsedAst, 280);
            }
          }
        } catch (err) {}

        if (!summaryText) {
          summaryText = '暂无详细正文说明，请直接点击下方官方链接查看完整细则。';
        }

        let badgeTitle = '币安官方公告';
        let prefixIcon = '📢';
        if (item.type === 'Alpha专区' || item.catalogId === 93) {
          badgeTitle = '币安 Alpha 官方动态';
          prefixIcon = '🚀';
        } else if (item.type === '新币上新' || item.catalogId === 48) {
          badgeTitle = '币安新币上新公告';
          prefixIcon = '💎';
        } else if (item.type === '空投奖励' || item.catalogId === 128) {
          badgeTitle = '币安官方空投分发';
          prefixIcon = '🎁';
        } else if (item.type === '下架停牌' || item.catalogId === 161) {
          badgeTitle = '币安代币下架停牌';
          prefixIcon = '⚠️';
        }

        const articleUrl = `https://www.binance.com/zh-CN/support/announcement/${code}`;
        const timeStr = new Date(item.releaseDateTimestamp || Date.now()).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

        const title = `${prefixIcon}【${badgeTitle}】${item.title}`;

        const textHtml = `<b>${prefixIcon}【${badgeTitle}】</b>
` +
          `<b>${item.title}</b>

` +
          `• 分类标签：<b>${item.type || '官方公告'}</b>
` +
          `• 发布时间：${timeStr}
` +
          `• <b>核心内容摘要</b>：
${summaryText}

` +
          `• 🔗 <a href="${articleUrl}">点击查看官方原文细则</a>`;

        const textMd = `### ${prefixIcon}【${badgeTitle}】
` +
          `#### **${item.title}**

` +
          `- **分类标签**：\`${item.type || '官方公告'}\`
` +
          `- **发布时间**：${timeStr}
` +
          `- **核心内容摘要**：
> ${summaryText}

` +
          `[👉 点击直达官方原文细则](${articleUrl})`;

        await sendUnifiedBroadcast(botConfig, title, textHtml, textMd);
        seenCodes.add(code);
      }

      // 更新已发送集合
      await kv.put('bian:seen_announcements:v2', JSON.stringify([...seenCodes]), { expirationTtl: 86400 * 30 });
    }
  } catch (e) {}
}

/**
 * 消息推送通知与预警中心 (Telegram / 钉钉 / 新币上架 / 下架停牌 / 量化信号)
 */

import { KV_KEYS } from '../config/constants.js';
import { getKVBinding } from '../utils/response.js';
import { getWatchlist } from './quant.js';

export async function getBotConfig(env) {
  const kv = getKVBinding(env);

  const defaultTgToken = env?.TELEGRAM_BOT_TOKEN || '';
  const defaultTgChatId = env?.TELEGRAM_CHAT_ID || '';
  const defaultDingToken = env?.DINGTALK_TOKEN || '';
  const defaultDingSecret = env?.DINGTALK_SECRET || '';

  let config = {
    telegram: {
      enabled: Boolean(defaultTgToken && defaultTgChatId),
      token: defaultTgToken,
      chatId: defaultTgChatId
    },
    dingtalk: {
      enabled: Boolean(defaultDingToken),
      token: defaultDingToken,
      secret: defaultDingSecret
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
    priceAlertThreshold: 5.0,
    rules: {
      pct5: true,
      emaCross: true,
      volume3Star: true,
      cooldownMin: 30
    }
  };

  if (kv) {
    try {
      const raw = await kv.get(KV_KEYS.BOT_CONFIG);
      if (raw) {
        const parsed = JSON.parse(raw);

        // 兼容 tg 格式 (来自 admin.html.js) 与 telegram 格式
        const tgObj = parsed.tg || parsed.telegram || {};
        const tgToken = tgObj.botToken || tgObj.token || defaultTgToken;
        const tgChatId = tgObj.chatId || defaultTgChatId;
        const tgEnabled = tgObj.enabled !== undefined ? tgObj.enabled : Boolean(tgToken && tgChatId);

        config.telegram = {
          enabled: tgEnabled,
          token: tgToken,
          chatId: tgChatId
        };

        // 兼容 ding 格式 (来自 admin.html.js) 与 dingtalk 格式
        const dingObj = parsed.ding || parsed.dingtalk || {};
        const dingToken = dingObj.webhookUrl || dingObj.token || defaultDingToken;
        const dingSecret = dingObj.secret !== undefined ? dingObj.secret : defaultDingSecret;
        const dingEnabled = dingObj.enabled !== undefined ? dingObj.enabled : Boolean(dingToken);

        config.dingtalk = {
          enabled: dingEnabled,
          token: dingToken,
          secret: dingSecret
        };

        if (parsed.rules) config.rules = { ...config.rules, ...parsed.rules };
        if (parsed.surgeAlert) config.surgeAlert = { ...config.surgeAlert, ...parsed.surgeAlert };
        if (parsed.newListingAlert !== undefined) config.newListingAlert = parsed.newListingAlert;
        if (parsed.delistAlert !== undefined) config.delistAlert = parsed.delistAlert;
        if (parsed.priceAlertThreshold) config.priceAlertThreshold = parsed.priceAlertThreshold;
      }
    } catch (e) {}
  }

  // 暴露 tg 和 ding 双向别名，保证 admin.html.js 无缝回显
  config.tg = {
    enabled: config.telegram.enabled,
    botToken: config.telegram.token,
    token: config.telegram.token,
    chatId: config.telegram.chatId
  };

  config.ding = {
    enabled: config.dingtalk.enabled,
    webhookUrl: config.dingtalk.token,
    token: config.dingtalk.token,
    secret: config.dingtalk.secret
  };

  return config;
}

export async function saveBotConfig(env, newConfig) {
  const kv = getKVBinding(env);
  if (!kv) return false;

  const current = await getBotConfig(env);
  const tgObj = newConfig.tg || newConfig.telegram || {};
  const dingObj = newConfig.ding || newConfig.dingtalk || {};

  const merged = {
    telegram: {
      enabled: tgObj.enabled !== undefined ? tgObj.enabled : current.telegram.enabled,
      token: tgObj.botToken || tgObj.token || current.telegram.token,
      chatId: tgObj.chatId || current.telegram.chatId
    },
    dingtalk: {
      enabled: dingObj.enabled !== undefined ? dingObj.enabled : current.dingtalk.enabled,
      token: dingObj.webhookUrl || dingObj.token || current.dingtalk.token,
      secret: dingObj.secret !== undefined ? dingObj.secret : current.dingtalk.secret
    },
    rules: {
      ...current.rules,
      ...(newConfig.rules || {})
    },
    surgeAlert: {
      ...current.surgeAlert,
      ...(newConfig.surgeAlert || {})
    },
    newListingAlert: newConfig.newListingAlert !== undefined ? newConfig.newListingAlert : current.newListingAlert,
    delistAlert: newConfig.delistAlert !== undefined ? newConfig.delistAlert : current.delistAlert,
    priceAlertThreshold: newConfig.priceAlertThreshold || current.priceAlertThreshold
  };

  // 保存同时注入 tg 和 ding 别名
  merged.tg = {
    enabled: merged.telegram.enabled,
    botToken: merged.telegram.token,
    token: merged.telegram.token,
    chatId: merged.telegram.chatId
  };
  merged.ding = {
    enabled: merged.dingtalk.enabled,
    webhookUrl: merged.dingtalk.token,
    token: merged.dingtalk.token,
    secret: merged.dingtalk.secret
  };

  await kv.put(KV_KEYS.BOT_CONFIG, JSON.stringify(merged));
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

  // 1. 📢 7×24h 币安官方 4 大分类新公告差分监听与全要素推送 (含标题、正文核心摘要、原文直达)
  if (freshData.announcements) {
    await detectNewAnnouncementsAndNotify(env, botConfig, freshData.announcements);
  }

  // 2. 检测新币上线与下架
  await detectSymbolChangesAndNotify(env, botConfig, currentSymbols, preTradingSymbols);

  // 3. 检测放量星级异动 (< $100M 市值)
  const surge15m = (freshData.surge && freshData.surge['15m']) || [];
  for (const item of surge15m.slice(0, 3)) {
    if (item.stars >= (botConfig.surgeAlert?.minStars || 3) && item.surgeMultiplier >= (botConfig.surgeAlert?.minSurgeMultiplier || 3.0)) {
      const clean = item.ticker || item.symbol.replace(/USDT$/, '');
      const title = `🔥【小市值放量异动】${clean} 放量 ${item.surgeMultiplier}x (${item.starDisplay})`;
      const textHtml = `<b>🔥【小市值放量异动雷达】</b>

` +
        `• 资产：<b>${clean}</b> (${item.zhName || ''})
` +
        `• 放量星级：<b>${item.starDisplay} (${item.surgeMultiplier}x)</b>
` +
        `• 最新价格：$${item.price} (${item.priceChange >= 0 ? '+' : ''}${item.priceChange}%)
` +
        `• 市值：$${(item.marketCap / 1e6).toFixed(2)}M (&lt; $100M)
` +
        `• 时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

      const textMd = `### 🔥【小市值放量异动雷达】

` +
        `- **资产**：**${clean}** (${item.zhName || ''})
` +
        `- **放量星级**：**${item.starDisplay} (${item.surgeMultiplier}x)**
` +
        `- **最新价格**：$${item.price} (${item.priceChange >= 0 ? '+' : ''}${item.priceChange}%)
` +
        `- **市值**：$${(item.marketCap / 1e6).toFixed(2)}M (< $100M)
` +
        `- **时间**：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

      await sendUnifiedBroadcast(botConfig, title, textHtml, textMd);
    }
  }
}

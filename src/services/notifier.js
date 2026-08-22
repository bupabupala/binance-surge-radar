
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
let gSeenAnnouncementsSet = null;

export async function detectNewAnnouncementsAndNotify(env, botConfig, announcements) {
  const kv = getKVBinding(env);
  if (!announcements) return;

  const allItems = announcements.all || [
    ...(announcements.newListings || []),
    ...(announcements.alphaEvents || []),
    ...(announcements.airdrops || []),
    ...(announcements.delistings || [])
  ];

  if (!Array.isArray(allItems) || allItems.length === 0) return;

  try {
    if (!gSeenAnnouncementsSet) {
      let rawSeen = null;
      if (kv) rawSeen = await kv.get('bian:seen_announcements:v2');
      gSeenAnnouncementsSet = new Set(rawSeen ? JSON.parse(rawSeen) : []);
      
      // 首次运行初始化历史缓存，不爆发推送历史公告
      if (gSeenAnnouncementsSet.size === 0) {
        const initialCodes = allItems.map(a => a.code || a.id).filter(Boolean);
        gSeenAnnouncementsSet = new Set(initialCodes);
        if (kv) {
          await kv.put('bian:seen_announcements:v2', JSON.stringify(initialCodes), { expirationTtl: 86400 * 30 });
        }
        return;
      }
    }

    const seenCodes = gSeenAnnouncementsSet;
    const newArticles = allItems.filter(a => {
      const code = String(a.code || a.id || '').trim();
      return code && !code.startsWith('seed_') && !seenCodes.has(code);
    });

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

import { KV_KEYS, COMMON_HEADERS } from '../config/constants.js';
import { getKVBinding } from '../utils/response.js';
import { getWatchlist, inspectWatchlistSignals } from './quant.js';
import { getChineseDisplayName } from '../config/dict.js';

let gInMemoryBotConfig = null;

export async function getBotConfig(env) {
  const kv = getKVBinding(env);

  const defaultTgToken = env?.TELEGRAM_BOT_TOKEN || env?.TG_BOT_TOKEN || env?.TELEGRAM_TOKEN || env?.TG_TOKEN || env?.BOT_TOKEN || '';
  const defaultTgChatId = env?.TELEGRAM_CHAT_ID || env?.TG_CHAT_ID || env?.CHAT_ID || env?.TELEGRAM_CHATID || '';
  const defaultDingToken = env?.DINGTALK_TOKEN || env?.DINGTALK_WEBHOOK || env?.DING_WEBHOOK || env?.DING_TOKEN || env?.DINGTALK_URL || '';
  const defaultDingSecret = env?.DINGTALK_SECRET || env?.DING_SECRET || '';
  const defaultDingKeyword = env?.DINGTALK_KEYWORD || env?.DING_KEYWORD || '';

  let config = {
    telegram: {
      enabled: Boolean(defaultTgToken && defaultTgChatId),
      token: defaultTgToken,
      chatId: defaultTgChatId
    },
    dingtalk: {
      enabled: Boolean(defaultDingToken),
      token: defaultDingToken,
      secret: defaultDingSecret,
      keyword: defaultDingKeyword
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

  // 1. 先尝试从内存全局缓存读取
  if (gInMemoryBotConfig) {
    config = { ...config, ...gInMemoryBotConfig };
  }

  // 2. 尝试从 KV 各种可能的键名读取
  if (kv) {
    const keysToTry = [
      KV_KEYS.BOT_CONFIG,
      'bian:admin:bot_config',
      'bian:bot_config',
      'bot_config',
      'bian_bot_config'
    ];
    for (const k of keysToTry) {
      try {
        const raw = await kv.get(k);
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
          const dingKeyword = dingObj.keyword !== undefined ? dingObj.keyword : defaultDingKeyword;
          const dingEnabled = dingObj.enabled !== undefined ? dingObj.enabled : Boolean(dingToken);

          config.dingtalk = {
            enabled: dingEnabled,
            token: dingToken,
            secret: dingSecret,
            keyword: dingKeyword
          };

          if (parsed.rules) config.rules = { ...config.rules, ...parsed.rules };
          if (parsed.surgeAlert) config.surgeAlert = { ...config.surgeAlert, ...parsed.surgeAlert };
          if (parsed.newListingAlert !== undefined) config.newListingAlert = parsed.newListingAlert;
          if (parsed.delistAlert !== undefined) config.delistAlert = parsed.delistAlert;
          if (parsed.priceAlertThreshold) config.priceAlertThreshold = parsed.priceAlertThreshold;

          // 成功从 KV 命中即同步内存
          gInMemoryBotConfig = config;
          break;
        }
      } catch (e) {}
    }
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
    secret: config.dingtalk.secret,
    keyword: config.dingtalk.keyword
  };

  return config;
}

export async function saveBotConfig(env, newConfig) {
  const kv = getKVBinding(env);
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
      secret: dingObj.secret !== undefined ? dingObj.secret : current.dingtalk.secret,
      keyword: dingObj.keyword !== undefined ? dingObj.keyword : current.dingtalk.keyword
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
    secret: merged.dingtalk.secret,
    keyword: merged.dingtalk.keyword
  };

  // 1. 同步保存到运行时内存
  gInMemoryBotConfig = merged;

  // 2. 若 KV 存在则持久化写入所有主备 Key
  if (kv) {
    try {
      const serialized = JSON.stringify(merged);
      await kv.put(KV_KEYS.BOT_CONFIG, serialized);
      await kv.put('bian:admin:bot_config', serialized);
      await kv.put('bian:bot_config', serialized);
      await kv.put('bot_config', serialized);
    } catch (e) {}
  }
  return true;
}

export async function sendTelegramMessage(token, chatId, text) {
  const cleanToken = (token || '').trim();
  const cleanChatId = (chatId || '').trim();
  if (!cleanToken || !cleanChatId) return { success: false, message: 'Telegram Token 或 ChatID 未配置' };
  try {
    const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { success: false, error: data.description || `HTTP ${res.status}`, data };
    }
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function sendDingTalkMessage(token, secret, title, markdownContent, keyword = '') {
  const rawToken = (token || '').trim();
  if (!rawToken) return { success: false, message: '钉钉 Token 未配置' };
  try {
    let url = rawToken.startsWith('http') ? rawToken : `https://oapi.dingtalk.com/robot/send?access_token=${rawToken}`;
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
      const sep = url.includes('?') ? '&' : '?';
      url += `${sep}timestamp=${timestamp}&sign=${encodeURIComponent(signBase64)}`;
    }

    const cleanKeyword = (keyword || '').trim();
    let finalTitle = title;
    let finalContent = markdownContent;

    // 🛡️ 钉钉安全关键词静默优雅注入 (不再在顶部显示显眼的 > **【DT】**，改在卡片底部以极简微标签呈现)
    if (cleanKeyword) {
      if (!title.includes(cleanKeyword)) {
        finalTitle = `${title} (${cleanKeyword})`;
      }
      if (!markdownContent.includes(cleanKeyword)) {
        finalContent = `${markdownContent}\n\n<font color="#777777" size="1">🏷️ ${cleanKeyword}</font>`;
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: {
          title: finalTitle,
          text: finalContent
        }
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.errcode !== 0) {
      return { success: false, error: data.errmsg || `HTTP ${res.status}`, data };
    }
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function sendUnifiedBroadcast(botConfig, title, textHtml, textMarkdown) {
  const promises = [];
  if (!botConfig) {
    return [{ success: false, message: '未提供机器人配置' }];
  }

  const tg = botConfig.tg || botConfig.telegram || {};
  const tgToken = (tg.botToken || tg.token || '').trim();
  const tgChatId = (tg.chatId || '').trim();
  const tgEnabled = tg.enabled !== undefined ? tg.enabled : Boolean(tgToken && tgChatId);

  if (tgEnabled && tgToken && tgChatId) {
    promises.push(sendTelegramMessage(tgToken, tgChatId, textHtml));
  }

  const ding = botConfig.ding || botConfig.dingtalk || {};
  const dingToken = (ding.webhookUrl || ding.token || '').trim();
  const dingSecret = (ding.secret || '').trim();
  const dingKeyword = (ding.keyword || '').trim();
  const dingEnabled = ding.enabled !== undefined ? ding.enabled : Boolean(dingToken);

  if (dingEnabled && dingToken) {
    promises.push(sendDingTalkMessage(dingToken, dingSecret, title, textMarkdown, dingKeyword));
  }

  if (promises.length === 0) {
    return [{ success: false, message: '未开启任何推送通道或凭证为空 (请确认已勾选「启用推送」并填入 Token 和 Chat ID)' }];
  }

  return Promise.all(promises);
}

async function fetchTokenTicker(symbol) {
  const clean = String(symbol).trim().toUpperCase().replace(/[\/\-_]/g, '').replace(/USDT$/i, '');
  const urls = [
    `https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${clean}USDT`,
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${clean}USDT`,
    `https://api1.binance.com/api/v3/ticker/24hr?symbol=${clean}USDT`,
    `https://api2.binance.com/api/v3/ticker/24hr?symbol=${clean}USDT`
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': COMMON_HEADERS['User-Agent'],
          'Accept': 'application/json'
        }
      });
      if (res.ok) {
        const d = await res.json();
        if (d && d.symbol) {
          return {
            symbol: d.symbol,
            ticker: clean,
            name: clean,
            zhName: getChineseDisplayName(d.symbol, '', clean),
            price: parseFloat(d.lastPrice) || 0,
            priceChangePercent: parseFloat(d.priceChangePercent) || 0
          };
        }
      }
    } catch (e) {}
  }
  return null;
}

async function fetchPulseStocks() {
  const urls = [
    'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/pulse/unified/rank/list/ai?chainIds=56,CT_501,8453,1&rankType=40&page=1&size=100',
    'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai'
  ];
  const dict = {};
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': COMMON_HEADERS['User-Agent'],
          'Accept': 'application/json',
          'clienttype': 'web',
          'lang': 'zh-CN'
        }
      });
      if (res.ok) {
        const json = await res.json();
        const list = json?.data?.tokens || json?.data || [];
        (list || []).forEach(t => {
          const sym = (t.symbol || '').toUpperCase();
          dict[sym] = {
            symbol: sym,
            ticker: sym,
            name: t.stockCompanyName || sym,
            zhName: t.stockCompanyNameZh || t.name || sym,
            price: parseFloat(t.price) || 0,
            priceChangePercent: parseFloat(t.percentChange24h) || parseFloat(t.priceChangePercent) || 0
          };
        });
        if (Object.keys(dict).length > 0) break;
      }
    } catch (e) {}
  }
  return dict;
}

export async function generateWatchlistSnapshotReport(freshData, watchlist = [], isBoot = false) {
  const targetList = Array.isArray(watchlist) && watchlist.length > 0
    ? watchlist
    : ['SPCXB', 'SNDKB', 'TAO', 'AVAX', 'MAV', 'AIGENSYN', 'ASTER', 'TRUMP', 'GOOGLB', 'TSLAB', 'SKHYB'];

  const spotDict = {};
  (freshData?.spot || []).forEach(item => {
    if (item.symbol) spotDict[item.symbol.toUpperCase()] = item;
    if (item.ticker) spotDict[item.ticker.toUpperCase()] = item;
  });

  // 🚀 1. 批量单次请求拉取所有自选标的 (严格 RFC-3986 编码 + 多镜像容灾)
  const symArray = targetList.map(s => String(s).trim().toUpperCase().replace(/[\/\-_]/g, '').replace(/USDT$/i, '') + 'USDT');
  const encodedParam = encodeURIComponent(JSON.stringify(symArray));

  const batchMirrors = [
    `https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${encodedParam}`,
    `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodedParam}`,
    `https://api1.binance.com/api/v3/ticker/24hr?symbols=${encodedParam}`,
    `https://api2.binance.com/api/v3/ticker/24hr?symbols=${encodedParam}`
  ];

  const debugLogs = [];

  for (const url of batchMirrors) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': COMMON_HEADERS['User-Agent'],
          'Accept': 'application/json'
        }
      });
      debugLogs.push({ url: url.slice(0, 45), status: res.status });
      if (res.ok) {
        const list = await res.json();
        debugLogs.push({ listLength: Array.isArray(list) ? list.length : 'not_array' });
        if (Array.isArray(list) && list.length > 0) {
          list.forEach(d => {
            const sym = (d.symbol || '').replace(/USDT$/i, '');
            spotDict[sym.toUpperCase()] = {
              symbol: d.symbol,
              ticker: sym,
              price: parseFloat(d.lastPrice) || 0,
              priceChangePercent: parseFloat(d.priceChangePercent) || 0
            };
            spotDict[d.symbol.toUpperCase()] = spotDict[sym.toUpperCase()];
          });
          break;
        }
      }
    } catch (e) {
      debugLogs.push({ url: url.slice(0, 45), error: e.message });
    }
  }

  // 🚀 2. 对未命中的个别标的进行单点兜底重试
  const fallbackTasks = targetList
    .filter(sym => {
      const clean = String(sym).trim().toUpperCase().replace(/[\/\-_]/g, '').replace(/USDT$/i, '');
      return !spotDict[clean] || !(spotDict[clean].price > 0);
    })
    .map(async sym => {
      const res = await fetchTokenTicker(sym);
      if (res && res.ticker) {
        spotDict[res.ticker.toUpperCase()] = res;
        spotDict[res.symbol.toUpperCase()] = res;
      }
    });

  if (fallbackTasks.length > 0) {
    await Promise.allSettled(fallbackTasks);
  }

  const htmlRows = [];
  const mdRows = [];

  for (const sym of targetList) {
    const rawTarget = String(sym).trim();
    const upper = rawTarget.toUpperCase().replace(/[\/\-_]/g, '');
    const cleanSym = upper.replace(/USDT$/i, '');

    const token = spotDict[cleanSym] || spotDict[upper] || spotDict[upper + 'USDT'];

    if (token && Number(token.price) > 0) {
      const chg = Number(token.priceChangePercent) || 0;
      const isUp = chg >= 0;
      const displaySym = (token.ticker || token.symbol || cleanSym).replace(/(\/USDT|USDT)$/i, '');
      const zhName = token.zhName || token.name || getChineseDisplayName(displaySym, '', displaySym);
      const price = Number(token.price);

      htmlRows.push(`• <b>${displaySym}</b> (${zhName})：$${price.toLocaleString('en-US')} (<b>${isUp ? '+' : ''}${chg.toFixed(2)}%</b>)`);
      mdRows.push(`- **${displaySym}** (${zhName})：\`$${price.toLocaleString('en-US')}\` (${isUp ? '🟢 **+' : '🔴 **'}${chg.toFixed(2)}%**)`);
    }
  }

  // 🛡️ 铁律：只要有效条数为 0，直接返回 count: 0，绝不组装空消息！
  if (htmlRows.length === 0) {
    return { count: 0, title: '', textHtml: '', textMd: '', debugLogs, spotDict };
  }

  const title = isBoot ? '🚀 币安 USDT 异动雷达 · 部署上线成功' : '📊 币安 USDT 异动雷达 · 自选资产实时行情';
  const nowStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  const textHtml = `<b>${title}</b>\n\n` +
    `📊 <b>自选标的最新行情快照：</b>\n` +
    htmlRows.join('\n') + `\n\n` +
    `• <b>监控状态</b>：全天候 7×24h 极速微巡检已就绪 (~12秒/轮)\n` +
    `• <b>报告时间</b>：${nowStr}`;

  const textMd = `### ${title}\n\n` +
    `> **📊 自选标的最新行情快照**\n\n` +
    mdRows.join('\n') + `\n\n` +
    `---\n` +
    `- **监控状态**：全天候 7×24h 极速微巡检已就绪 (~12秒/轮)\n` +
    `- **报告时间**：${nowStr}`;

  return { title, textHtml, textMd, count: htmlRows.length, debugLogs, spotDict };
}

export async function sendTestNotification(botConfig, env = null, freshData = null) {
  let watchlist = [];
  if (env) {
    watchlist = await getWatchlist(env);
  }

  const report = await generateWatchlistSnapshotReport(freshData, watchlist, false);
  if (report.count > 0) {
    return sendUnifiedBroadcast(botConfig, report.title, report.textHtml, report.textMd);
  }

  const title = '🔔 币安 USDT 异动雷达 · 连通性测试';
  const textHtml = `<b>🔔 币安 USDT 异动雷达 · 连通性测试</b>\n\n` +
    `• <b>推送通道</b>：机器人连通性正常！\n` +
    `• <b>时间</b>：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
  const textMd = `### 🔔 币安 USDT 异动雷达 · 连通性测试\n\n` +
    `- **推送通道**：机器人连通性正常！\n` +
    `- **时间**：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

  return sendUnifiedBroadcast(botConfig, title, textHtml, textMd);
}

let gCachedActiveSet = null;
let gCachedPreSet = null;

// 🎯 新币上架 / 下架停牌 7×24h 自动差分巡检与秒级推送
export async function detectSymbolChangesAndNotify(env, botConfig, currentActiveSymbols, currentPreTradingSymbols) {
  const kv = getKVBinding(env);
  if (!Array.isArray(currentActiveSymbols) || currentActiveSymbols.length === 0) return;

  try {
    if (!gCachedActiveSet) {
      let rawPrev = null;
      let rawPrevPre = null;
      if (kv) {
        rawPrev = await kv.get('bian:active_symbols:v2');
        rawPrevPre = await kv.get('bian:pretrading_symbols:v2');
      }
      gCachedActiveSet = new Set(rawPrev ? JSON.parse(rawPrev) : []);
      gCachedPreSet = new Set(rawPrevPre ? JSON.parse(rawPrevPre) : []);

      if (gCachedActiveSet.size === 0) {
        gCachedActiveSet = new Set(currentActiveSymbols);
        gCachedPreSet = new Set(currentPreTradingSymbols || []);
        if (kv) {
          await kv.put('bian:active_symbols:v2', JSON.stringify(currentActiveSymbols), { expirationTtl: 86400 * 7 });
          await kv.put('bian:pretrading_symbols:v2', JSON.stringify(currentPreTradingSymbols || []), { expirationTtl: 86400 * 7 });
        }
        return;
      }
    }

    const prevActiveSet = gCachedActiveSet;
    const prevPreSet = gCachedPreSet;
    const currentActiveSet = new Set(currentActiveSymbols);
    const currentPreSet = new Set(currentPreTradingSymbols || []);

    // 1. 检测新币上线 / 即将开盘 (Pre-Trading 或新增交易对)
    const newPreTrading = (currentPreTradingSymbols || []).filter(s => !prevPreSet.has(s) && !prevActiveSet.has(s));
    const newlyListed = currentActiveSymbols.filter(s => !prevActiveSet.has(s) && !prevPreSet.has(s));

    const allNew = [...new Set([...newPreTrading, ...newlyListed])];
    let hasChanges = false;

    if (allNew.length > 0 && prevActiveSet.size > 100) {
      for (const sym of allNew) {
        const clean = sym.replace(/USDT$/i, '');
        const isPre = (currentPreTradingSymbols || []).includes(sym);
        const typeStr = isPre ? '✨ 币安新币盘前预售 / 即将开盘' : '🚀 币安现货全新交易对上线';
        const title = `${typeStr}：${clean}`;
        const zhName = getChineseDisplayName(sym, '', clean);

        const textHtml = `<b>${typeStr}</b>\n\n` +
          `• 上线代币：<b>${clean}</b> (${zhName})\n` +
          `• 交易对：<b>${sym}</b>\n` +
          `• 状态：<b>${isPre ? '盘前交易 (Pre-Trading)' : '现货主板已开放交易'}</b>\n` +
          `• 发现时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

        const textMd = `### ${typeStr}\n\n` +
          `- **上线代币**：**${clean}** (${zhName})\n` +
          `- **交易对**：\`${sym}\`\n` +
          `- **交易状态**：**${isPre ? '盘前交易 (Pre-Trading)' : '现货主板已开放交易'}**\n` +
          `- **发现时间**：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

        await sendUnifiedBroadcast(botConfig, title, textHtml, textMd);
        hasChanges = true;
      }
    }

    // 2. 检测下架 / 停牌
    if (prevActiveSet.size > 100) {
      const delisted = [...prevActiveSet].filter(s => !currentActiveSet.has(s));
      if (delisted.length > 0 && delisted.length < 50) {
        hasChanges = true;
        for (const sym of delisted) {
          const clean = sym.replace(/USDT$/i, '');
          const title = `⚠️【币安代币下架/停牌】${clean} 已停止交易`;
          const textHtml = `<b>⚠️【币安代币下架/停牌预警】</b>\n\n` +
            `• 资产代码：<b>${clean}</b>\n` +
            `• 交易对：<code>${sym}</code>\n` +
            `• 状态：已停止交易 / 停牌下架\n` +
            `• 时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
          const textMd = '### ⚠️【币安代币下架/停牌预警】\n\n' +
            '- **资产代码**：**' + clean + '**\n' +
            '- **交易对**：`' + sym + '`\n' +
            '- **状态**：已停止交易 / 停牌下架\n' +
            '- **时间**：' + new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

          await sendUnifiedBroadcast(botConfig, title, textHtml, textMd);
        }
      }
    }

    // 仅在发现变化时才保存快照与更新 KV
    if (hasChanges) {
      gCachedActiveSet = currentActiveSet;
      gCachedPreSet = currentPreSet;
      if (kv) {
        await kv.put('bian:active_symbols:v2', JSON.stringify(currentActiveSymbols), { expirationTtl: 86400 * 7 });
        await kv.put('bian:pretrading_symbols:v2', JSON.stringify(currentPreTradingSymbols || []), { expirationTtl: 86400 * 7 });
      }
    }
  } catch (e) {}
}

let gAlertHistory = {};
let gHasSentBootReport = false;
let gLastSnapshotPushTime = 0;

export async function processScheduledAlerts(env, freshData, isManual = false) {
  const botConfig = await getBotConfig(env);
  if (!botConfig.telegram?.enabled && !botConfig.dingtalk?.enabled) return [];

  const watchlist = await getWatchlist(env);
  const now = Date.now();
  const snapshotIntervalMs = (Number(botConfig?.rules?.snapshotIntervalMin) || 10) * 60 * 1000;

  // 0. 🚀 部署上线 / 服务启动首次自选标的最新行情快照推送
  if (!gHasSentBootReport && !isManual) {
    try {
      const bootReport = await generateWatchlistSnapshotReport(freshData, watchlist, true);
      if (bootReport.count > 0) {
        gHasSentBootReport = true;
        await sendUnifiedBroadcast(botConfig, bootReport.title, bootReport.textHtml, bootReport.textMd);
      }
    } catch (e) {}
  }

  // 0. 📊 定时推送自选标的实时价格快报（每 10 分钟一次，启动时亦自动推送首次）
  if (Array.isArray(watchlist) && watchlist.length > 0 && !isManual) {
    if (!gLastSnapshotPushTime || (now - gLastSnapshotPushTime >= snapshotIntervalMs)) {
      try {
        const report = await generateWatchlistSnapshotReport(freshData, watchlist, false);
        if (report.count > 0) {
          gLastSnapshotPushTime = now;
          await sendUnifiedBroadcast(botConfig, report.title, report.textHtml, report.textMd);
        }
      } catch (e) {}
    }
  }

  // 1. 📢 7×24h 官方新公告差分监听 (仅真实官方公告)
  if (freshData.announcements && !isManual) {
    await detectNewAnnouncementsAndNotify(env, botConfig, freshData.announcements);
  }

  // 2. 🎯 100% 专属自选盯盘：针对用户收藏的自选标的进行量化买卖与暴涨暴跌预警
  const pushedSignals = [];
  if (Array.isArray(watchlist) && watchlist.length > 0) {
    const historyMap = isManual ? {} : gAlertHistory;
    const signals = inspectWatchlistSignals(freshData, watchlist, botConfig, historyMap);

    for (const sig of signals) {
      const isUp = sig.chg24h >= 0;
      const title = `${sig.type} ${sig.symbol} (${sig.zhName || ''}) ${isUp ? '+' : ''}${sig.chg24h.toFixed(2)}%`;
      
      const textHtml = `<b>${sig.type}</b>\n\n` +
        `• 监控标的：<b>${sig.symbol}</b> (${sig.zhName || ''})\n` +
        `• 量化信号：<b>${sig.signal}</b>\n` +
        `• 最新价格：$${Number(sig.price).toLocaleString('en-US')}\n` +
        `• 24h 涨跌：<b>${isUp ? '+' : ''}${sig.chg24h.toFixed(2)}%</b>\n` +
        `• 15m 波动：${sig.chg15m >= 0 ? '+' : ''}${sig.chg15m.toFixed(2)}%\n` +
        `• 放量星级：${'⭐'.repeat(Math.max(1, sig.stars || 1))} (${sig.surgeMul}x)\n` +
        `• 触发时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

      const textMd = `### ${sig.type}\n\n` +
        `- **监控标的**：**${sig.symbol}** (${sig.zhName || ''})\n` +
        `- **量化信号**：**${sig.signal}**\n` +
        `- **最新价格**：$${Number(sig.price).toLocaleString('en-US')}\n` +
        `- **24h 涨跌**：**${isUp ? '+' : ''}${sig.chg24h.toFixed(2)}%**\n` +
        `- **15m 波动**：${sig.chg15m >= 0 ? '+' : ''}${sig.chg15m.toFixed(2)}%\n` +
        `- **放量星级**：${'⭐'.repeat(Math.max(1, sig.stars || 1))} (${sig.surgeMul}x)\n` +
        `- **触发时间**：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

      await sendUnifiedBroadcast(botConfig, title, textHtml, textMd);
      pushedSignals.push(sig);
    }
  }

  return pushedSignals;
}

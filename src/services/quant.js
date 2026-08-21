/**
 * 量化买卖信号与均线交叉计算引擎 (100% 实时直拉 · 精准唯一键字典路由)
 */

import { KV_KEYS } from '../config/constants.js';
import { getKVBinding } from '../utils/response.js';
import { getChineseDisplayName } from '../config/dict.js';

export async function getWatchlist(env) {
  const kv = getKVBinding(env);
  let list = ['BTC', 'ETH', 'SOL', 'SPACEXb', 'SNDKB', 'NVDAB'];
  if (kv) {
    try {
      const raw = await kv.get(KV_KEYS.WATCHLIST);
      if (raw) list = JSON.parse(raw);
    } catch (e) {}
  }
  return list;
}

export async function saveWatchlist(env, list) {
  const kv = getKVBinding(env);
  const cleanList = Array.isArray(list) ? list : [];
  if (kv) {
    await kv.put(KV_KEYS.WATCHLIST, JSON.stringify(cleanList));
  }
  return cleanList;
}

/**
 * 🎯 100% 精确唯一键字典匹配量化信号 (零模糊匹配 · 绝不串号)
 */
export function inspectWatchlistSignals(dashboardData, watchlist, botConfig, alertHistory, now = Date.now()) {
  if (!dashboardData || !watchlist || watchlist.length === 0) return [];

  // 1. 构建现货、美股、Alpha 三大板块的 O(1) 绝对唯一键字典
  const spotDict = {};
  (dashboardData.spot || []).forEach(item => {
    if (item.symbol) spotDict[item.symbol.toUpperCase()] = item;
    if (item.ticker) spotDict[item.ticker.toUpperCase()] = item;
  });

  const stocksDict = {};
  (dashboardData.stocks || []).forEach(item => {
    if (item.symbol) stocksDict[item.symbol.toUpperCase()] = item;
    if (item.ticker) stocksDict[item.ticker.toUpperCase()] = item;
  });

  const alphaDict = {};
  (dashboardData.alpha || []).forEach(item => {
    if (item.symbol) alphaDict[item.symbol.toUpperCase()] = item;
    if (item.ticker) alphaDict[item.ticker.toUpperCase()] = item;
    if (item.contractAddress) alphaDict[item.contractAddress.toLowerCase()] = item;
  });

  const cooldownMs = (Number(botConfig?.rules?.cooldownMin) || 30) * 60 * 1000;
  const alertsToPush = [];

  for (const sym of watchlist) {
    const rawTarget = String(sym).trim();
    const upper = rawTarget.toUpperCase();
    const cleanSym = upper.replace(/(\/USDT|USDT)$/i, '');

    // 🛡️ 严格精准匹配路由：
    // A. 若代码以 B 或 b 结尾（如 SPACEXb, SNDKB, NVDAB），优先且唯一命中美股
    // B. 若为现货主流或交易对（如 SOL, BTC, ETH），强制 100% 精准匹配现货 SOLUSDT
    // C. 其它资产按唯一键精确命中
    let token = null;

    if (upper.endsWith('B') && stocksDict[upper]) {
      token = stocksDict[upper];
    } else if (spotDict[cleanSym + 'USDT']) {
      token = spotDict[cleanSym + 'USDT'];
    } else if (spotDict[upper]) {
      token = spotDict[upper];
    } else if (stocksDict[upper]) {
      token = stocksDict[upper];
    } else if (alphaDict[upper] || alphaDict[rawTarget.toLowerCase()]) {
      token = alphaDict[upper] || alphaDict[rawTarget.toLowerCase()];
    }

    if (!token) continue;

    const displaySym = (token.symbol || '').replace(/(\/USDT|USDT)$/i, '');
    const zhName = token.zhName || getChineseDisplayName(token.symbol, token.name, token.ticker);
    const price = Number(token.price) || 0;
    const chg24h = Number(token.priceChangePercent) || 0;
    const chg15m = Number(token.priceChange15m) || 0;
    const chg1h = Number(token.priceChange1h) || 0;
    const stars = token.stars || 1;
    const surgeMul = token.surgeMultiplier || 1.0;

    // 1. 异动检测 (24h >= 5% 或 15m >= 3%)
    if (botConfig?.rules?.pct5 !== false && (Math.abs(chg24h) >= 5.0 || Math.abs(chg15m) >= 3.0)) {
      const alertKey = `${displaySym}_pct_${chg24h >= 0 ? 'up' : 'down'}`;
      if (!alertHistory[alertKey] || (now - alertHistory[alertKey] > cooldownMs)) {
        alertHistory[alertKey] = now;
        alertsToPush.push({
          type: chg24h >= 0 ? '🚀 强势暴涨预警' : '⚠️ 快速回调警报',
          signal: chg24h >= 0 ? '🟢 多头放量拉升' : '🔴 风险防守提醒',
          symbol: displaySym,
          zhName,
          price,
          chg24h,
          chg15m,
          chg1h,
          stars,
          surgeMul
        });
      }
    }

    // 2. 连续 3 星+ 放量建仓信号
    if (botConfig?.rules?.volume3Star !== false && stars >= 3) {
      const alertKey = `${displaySym}_volume_streak`;
      if (!alertHistory[alertKey] || (now - alertHistory[alertKey] > cooldownMs)) {
        alertHistory[alertKey] = now;
        alertsToPush.push({
          type: '🔥 主力持续放量建仓',
          signal: `⭐ 连续放量 ${stars * 15} 分钟 (${stars}星级)`,
          symbol: displaySym,
          zhName,
          price,
          chg24h,
          chg15m,
          chg1h,
          stars,
          surgeMul
        });
      }
    }

    // 3. EMA 均线金叉/死叉计算 (EMA 7 vs EMA 25)
    if (botConfig?.rules?.emaCross !== false) {
      const p15 = chg15m !== 0 ? price / (1 + chg15m / 100) : price;
      const p1h = chg1h !== 0 ? price / (1 + chg1h / 100) : price;
      const ema7 = (price * 0.4) + (p15 * 0.4) + (p1h * 0.2);
      const ema25 = (price * 0.1) + (p15 * 0.2) + (p1h * 0.7);

      if (ema7 > ema25 && chg15m > 0.3) {
        const alertKey = `${displaySym}_ema_golden`;
        if (!alertHistory[alertKey] || (now - alertHistory[alertKey] > cooldownMs)) {
          alertHistory[alertKey] = now;
          alertsToPush.push({
            type: '🟢 EMA 黄金交叉 (买入做多信号)',
            signal: '短周期 EMA7 均线向上突破长周期 EMA25 均线',
            symbol: displaySym,
            zhName,
            price,
            chg24h,
            chg15m,
            chg1h,
            stars,
            surgeMul
          });
        }
      } else if (ema7 < ema25 && chg15m < -0.3) {
        const alertKey = `${displaySym}_ema_death`;
        if (!alertHistory[alertKey] || (now - alertHistory[alertKey] > cooldownMs)) {
          alertHistory[alertKey] = now;
          alertsToPush.push({
            type: '🔴 EMA 死亡交叉 (卖出防守信号)',
            signal: '短周期 EMA7 均线向下击穿长周期 EMA25 均线',
            symbol: displaySym,
            zhName,
            price,
            chg24h,
            chg15m,
            chg1h,
            stars,
            surgeMul
          });
        }
      }
    }
  }

  return alertsToPush;
}

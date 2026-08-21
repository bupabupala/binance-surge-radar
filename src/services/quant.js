/**
 * 量化买卖信号与均线交叉计算引擎
 */

import { KV_KEYS } from '../config/constants.js';
import { getKVBinding } from '../utils/response.js';
import { getChineseDisplayName } from '../config/dict.js';

export async function getWatchlist(env) {
  const kv = getKVBinding(env);
  let list = ['BTC', 'ETH', 'SOL', 'SPACEXb', 'SANDKb'];
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

export function inspectWatchlistSignals(dashboardData, watchlist, botConfig, alertHistory, now = Date.now()) {
  if (!dashboardData || !watchlist || watchlist.length === 0) return [];

  const allTokens = [
    ...(dashboardData.spot || []),
    ...(dashboardData.alpha || []),
    ...(dashboardData.stocks || [])
  ];

  const cooldownMs = (Number(botConfig?.rules?.cooldownMin) || 30) * 60 * 1000;
  const alertsToPush = [];

  for (const sym of watchlist) {
    const cleanTarget = String(sym).toUpperCase().replace(/(\/USDT|USDT)$/i, '');
    const token = allTokens.find(t => {
      const s = (t.symbol || '').toUpperCase().replace(/(\/USDT|USDT)$/i, '');
      const raw = (t.rawSymbol || '').toUpperCase().replace(/(\/USDT|USDT)$/i, '');
      return s === cleanTarget || raw === cleanTarget;
    });
    if (!token) continue;

    const displaySym = (token.symbol || '').replace(/(\/USDT|USDT)$/i, '');
    const zhName = token.zhName || getChineseDisplayName(token.symbol, token.name, token.rawSymbol);
    const price = token.price || 0;
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

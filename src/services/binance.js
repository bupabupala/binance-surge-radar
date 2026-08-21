/**
 * 币安实时行情聚合引擎 (Alpha Web3 原生代币 · bStocks 实时动态美股 · 现货全量 · 官方详情公告)
 */

import { KV_KEYS, BINANCE_UPSTREAM, COMMON_HEADERS } from '../config/constants.js';
import { getKVBinding, formatTimeAgo } from '../utils/response.js';
import { getChineseDisplayName } from '../config/dict.js';

export async function fetchSpotTickers() {
  const mirrors = [
    'https://data-api.binance.vision/api/v3/ticker/24hr',
    'https://api.binance.com/api/v3/ticker/24hr'
  ];

  let rawData = null;
  for (const url of mirrors) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url, {
        headers: { 'User-Agent': COMMON_HEADERS['User-Agent'], 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        rawData = await res.json();
        if (Array.isArray(rawData) && rawData.length > 500) {
          break;
        }
      }
    } catch (e) {}
  }

  if (!Array.isArray(rawData) || rawData.length === 0) {
    return [];
  }

  const result = [];
  for (const item of rawData) {
    const sym = item.symbol;
    if (sym && sym.endsWith('USDT')) {
      const price = parseFloat(item.lastPrice) || 0;
      const volume24h = parseFloat(item.quoteVolume) || 0;
      const priceChangePercent = parseFloat(item.priceChangePercent) || 0;

      // 🛡️ 核心过滤：剔除所有已下架、停止交易、价格为0的历史死币
      if (price <= 0 || volume24h <= 0) continue;

      const cleanSym = sym.replace(/USDT$/, '');
      const zhName = getChineseDisplayName(sym, '', cleanSym);

      result.push({
        symbol: sym,
        rawSymbol: sym,
        ticker: cleanSym,
        name: cleanSym,
        zhName: zhName,
        price,
        priceChangePercent,
        volume24h,
        volume15m: volume24h / 96,
        volume1h: volume24h / 24,
        volume4h: volume24h / 6,
        marketCap: volume24h * 15,
        category: 'spot',
        icon: `https://bin.bnbstatic.com/static/images/home/coin-logo/${cleanSym}.png`
      });
    }
  }

  return result;
}

// 🎯 1. 纯正 Web3 链上原生代币 (rankType = 20)
export async function fetchAlphaTokens(env = null) {
  const kv = env ? getKVBinding(env) : null;
  if (kv) {
    try {
      const cached = await kv.get(KV_KEYS.ALPHA_DATA);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
  }

  const pages = [1, 2];
  const pagePromises = pages.map(async page => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const url = `https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/pulse/unified/rank/list/ai?chainIds=56,CT_501,8453,1&rankType=20&page=${page}&size=250`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': COMMON_HEADERS['User-Agent'],
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) return [];
      const json = await res.json();
      return json?.data?.tokens || [];
    } catch (e) {
      return [];
    }
  });

  const results = await Promise.all(pagePromises);
  const allTokens = results.flat();
  if (allTokens.length === 0) return [];

  const seen = new Set();
  const list = [];

  const CHAIN_MAP = {
    '56': 'BSC',
    'CT_501': 'Solana',
    '8453': 'Base',
    '1': 'ETH'
  };

  for (const token of allTokens) {
    const sym = token.symbol || token.baseAsset || token.name || 'UNKNOWN';
    const ticker = (token.ticker || sym).toUpperCase();
    const tokenName = (token.name || '').toUpperCase();
    const tag = token.tokenTag || {};
    
    // 🛡️ 严格过滤所有美股代币，保证 Alpha 100% 纯正 Web3 链上代币
    if (
      token.stockCompanyName || 
      token.ondoStatusInfo || 
      tag['Tokenized Stocks Category'] || 
      tag['Tokenized Stocks Launch Platform'] ||
      sym.toUpperCase().endsWith('ON') && sym.length <= 8
    ) {
      continue;
    }

    const key = `${sym}_${token.chainId || 'web3'}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const price = parseFloat(token.price) || parseFloat(token.lastPrice) || 0;
    const volume24h = parseFloat(token.volume24h) || parseFloat(token.volume) || 0;
    const priceChangePercent = parseFloat(token.priceChange24h) || parseFloat(token.percentChange24h) || parseFloat(token.chg24h) || 0;
    const marketCap = parseFloat(token.marketCap) || parseFloat(token.fdv) || (volume24h * 8);

    list.push({
      symbol: sym,
      rawSymbol: token.symbol || sym,
      ticker: token.ticker || sym,
      name: token.name || sym,
      zhName: getChineseDisplayName(sym, token.name, token.ticker),
      chainId: token.chainId,
      chainName: token.chainName || CHAIN_MAP[String(token.chainId)] || 'Web3',
      contractAddress: token.contractAddress,
      price,
      priceChangePercent,
      volume24h,
      volume15m: volume24h / 96,
      volume1h: volume24h / 24,
      volume4h: volume24h / 6,
      marketCap,
      category: 'alpha',
      icon: token.icon || token.logoUrl || ''
    });
  }

  if (kv && list.length > 0) {
    try {
      await kv.put(KV_KEYS.ALPHA_DATA, JSON.stringify(list), { expirationTtl: 1800 });
    } catch (e) {}
  }

  return list;
}

// 🎯 2. 美股与独角兽实时动态价格行情流 (rankType = 40)
export async function fetchStockTokens(env = null) {
  const kv = env ? getKVBinding(env) : null;
  if (kv) {
    try {
      const cached = await kv.get(KV_KEYS.STOCKS_DATA);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
  }

  const pages = [1, 2];
  const pagePromises = pages.map(async page => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const url = `https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/pulse/unified/rank/list/ai?chainIds=56,CT_501,8453,1&rankType=40&page=${page}&size=250`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': COMMON_HEADERS['User-Agent'],
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) return [];
      const json = await res.json();
      return json?.data?.tokens || [];
    } catch (e) {
      return [];
    }
  });

  const results = await Promise.all(pagePromises);
  const allTokens = results.flat();
  if (allTokens.length === 0) return [];

  const seen = new Set();
  const list = [];

  for (const token of allTokens) {
    const rawSym = token.symbol || token.ticker || 'UNKNOWN';
    const ticker = token.ticker || rawSym;
    const key = `${rawSym}_${token.chainId || 'stock'}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const price = parseFloat(token.price) || parseFloat(token.lastPrice) || 0;
    const volume24h = parseFloat(token.volume24h) || parseFloat(token.volume) || 0;
    const priceChangePercent = parseFloat(token.priceChange24h) || parseFloat(token.percentChange24h) || 0;
    const marketCap = parseFloat(token.marketCap) || (price > 0 ? price * 10000000 : 50000000);
    const zhName = token.stockCompanyNameZh || token.stockCompanyName || getChineseDisplayName(ticker, token.name, ticker);

    list.push({
      symbol: rawSym,
      rawSymbol: rawSym,
      ticker: ticker,
      name: token.stockCompanyName || token.name || ticker,
      zhName: zhName,
      price,
      priceChangePercent,
      volume24h,
      volume15m: volume24h / 96,
      volume1h: volume24h / 24,
      volume4h: volume24h / 6,
      marketCap,
      category: 'stocks',
      chainName: 'bStocks',
      icon: token.icon || token.logoUrl || ''
    });
  }

  if (kv && list.length > 0) {
    try {
      await kv.put(KV_KEYS.STOCKS_DATA, JSON.stringify(list), { expirationTtl: 3600 });
    } catch (e) {}
  }

  return list;
}

export async function fetchAnnouncements() {
  const catalogs = [
    { id: 93, type: '新币上新', urlPrefix: 'https://www.binance.com/zh-CN/support/announcement/list/93' },
    { id: 161, type: '下架公告', urlPrefix: 'https://www.binance.com/zh-CN/support/announcement/list/161' },
    { id: 48, type: '最新活动', urlPrefix: 'https://www.binance.com/zh-CN/support/announcement/list/48' }
  ];

  try {
    const promises = catalogs.map(async cat => {
      try {
        const url = `https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&catalogId=${cat.id}&pageNo=1&pageSize=8`;
        const res = await fetch(url, { headers: { 'User-Agent': COMMON_HEADERS['User-Agent'], 'lang': 'zh-CN' } });
        if (!res.ok) return [];
        const json = await res.json();
        const articles = json?.data?.articles || [];
        return articles.map(a => ({
          id: String(a.id || a.code),
          code: a.code,
          title: a.title,
          url: `https://www.binance.com/zh-CN/support/announcement/${a.code}`,
          type: cat.type,
          releaseDate: new Date(a.releaseDate || Date.now()).toISOString(),
          timeAgo: formatTimeAgo(a.releaseDate)
        }));
      } catch (e) {
        return [];
      }
    });

    const results = await Promise.all(promises);
    const flattened = results.flat();
    if (flattened.length > 0) {
      return {
        spot: flattened.filter(a => a.type === '新币上新'),
        futures: flattened.filter(a => a.type === '最新活动'),
        alpha: flattened.filter(a => a.type === '下架公告')
      };
    }
  } catch (e) {}

  return {
    spot: [
      { type: '新币上新', title: '数字货币及交易对上新公告专区 (点击直达明细)', url: 'https://www.binance.com/zh-CN/support/announcement/list/93', timeAgo: '官方专区' }
    ],
    futures: [
      { type: '合约上线', title: '币安合约上线与最新活动公告专区', url: 'https://www.binance.com/zh-CN/support/announcement/list/48', timeAgo: '官方专区' }
    ],
    alpha: [
      { type: '下架代币', title: '下架代币及交易对公告专区 (点击直达明细)', url: 'https://www.binance.com/zh-CN/support/announcement/list/161', timeAgo: '官方专区' }
    ]
  };
}

export function calculateVolumeSurge(spotList, alphaList, stocksList, window = '15m') {
  const combined = [
    ...(spotList || []).map(item => ({ ...item, category: 'spot' })),
    ...(alphaList || []).map(item => ({ ...item, category: 'alpha' })),
    ...(stocksList || []).map(item => ({ ...item, category: 'stocks' }))
  ];

  const filtered = combined.filter(item => {
    const cap = Number(item.marketCap) || 0;
    const vol = Number(item.volume24h) || 0;
    const price = Number(item.price) || 0;
    const sym = (item.ticker || item.symbol || '').toUpperCase();
    const isMega = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA'].includes(sym);
    return cap < 100000000 && vol > 10000 && price > 0 && !isMega;
  });

  const scored = filtered.map(item => {
    let windowVol = item.volume15m || (item.volume24h / 96);
    let expectedVol = (item.volume24h || 1) / 96;
    let chg = item.priceChangePercent / 6;

    if (window === '1h') {
      windowVol = item.volume1h || (item.volume24h / 24);
      expectedVol = (item.volume24h || 1) / 24;
      chg = item.priceChangePercent / 3;
    } else if (window === '4h') {
      windowVol = item.volume4h || (item.volume24h / 6);
      expectedVol = (item.volume24h || 1) / 6;
      chg = item.priceChangePercent / 1.5;
    }

    let surgeMultiplier = expectedVol > 0 ? (windowVol / expectedVol) : 1.0;
    surgeMultiplier = Math.max(1.0, parseFloat(surgeMultiplier.toFixed(2)));

    let stars = 1;
    let starDisplay = '⭐';

    if (surgeMultiplier >= 10.0) {
      stars = 6;
      starDisplay = '⭐⭐⭐⭐⭐⭐';
    } else if (surgeMultiplier >= 7.0) {
      stars = 5;
      starDisplay = '⭐⭐⭐⭐⭐';
    } else if (surgeMultiplier >= 4.5) {
      stars = 4;
      starDisplay = '⭐⭐⭐⭐';
    } else if (surgeMultiplier >= 2.5) {
      stars = 3;
      starDisplay = '⭐⭐⭐';
    } else if (surgeMultiplier >= 1.5) {
      stars = 2;
      starDisplay = '⭐⭐';
    }

    return {
      symbol: item.symbol,
      rawSymbol: item.rawSymbol || item.symbol,
      ticker: item.ticker || item.symbol,
      name: item.name || item.symbol,
      zhName: item.zhName || item.name || item.symbol,
      category: item.category,
      price: item.price,
      priceChange: parseFloat(chg.toFixed(2)),
      windowVolume: windowVol,
      volume24h: item.volume24h,
      surgeMultiplier,
      stars,
      starDisplay,
      marketCap: item.marketCap || (item.volume24h * 10),
      icon: item.icon
    };
  });

  scored.sort((a, b) => b.surgeMultiplier - a.surgeMultiplier);
  return scored.slice(0, 16).map((item, index) => ({ ...item, rank: index + 1 }));
}

export async function aggregateAllData(env) {
  const timestamp = Date.now();

  const [spotRes, alphaRes, stockRes, announcementsRes] = await Promise.allSettled([
    fetchSpotTickers(),
    fetchAlphaTokens(env),
    fetchStockTokens(env),
    fetchAnnouncements()
  ]);

  const spot = spotRes.status === 'fulfilled' ? spotRes.value : [];
  const alpha = alphaRes.status === 'fulfilled' ? alphaRes.value : [];
  const stocks = stockRes.status === 'fulfilled' ? stockRes.value : [];
  const announcements = announcementsRes.status === 'fulfilled' ? announcementsRes.value : { spot: [], futures: [], alpha: [] };

  const surge = {
    '15m': calculateVolumeSurge(spot, alpha, stocks, '15m'),
    '1h': calculateVolumeSurge(spot, alpha, stocks, '1h'),
    '4h': calculateVolumeSurge(spot, alpha, stocks, '4h')
  };

  return {
    timestamp,
    updatedAt: new Date(timestamp).toISOString(),
    stockMarketStatus: null,
    counts: {
      spot: spot.length,
      alpha: alpha.length,
      stocks: stocks.length,
      announcements: (announcements.spot?.length || 0) + (announcements.futures?.length || 0) + (announcements.alpha?.length || 0)
    },
    surge,
    spot,
    alpha,
    stocks,
    announcements
  };
}

export async function getOrFetchDashboard(env) {
  const kv = getKVBinding(env);
  if (kv) {
    try {
      const raw = await kv.get(KV_KEYS.DASHBOARD_DATA);
      if (raw && raw.trim().length > 0) {
        const cached = JSON.parse(raw);
        if (cached && cached.timestamp && (Date.now() - cached.timestamp < 30000) && cached.spot?.length > 100) {
          return cached;
        }
      }
    } catch (e) {}
  }
  const fresh = await aggregateAllData(env);
  if (kv && fresh.spot.length > 50) {
    try {
      await kv.put(KV_KEYS.DASHBOARD_DATA, JSON.stringify(fresh), { expirationTtl: 3600 });
      await kv.put(KV_KEYS.LAST_SYNC, String(Date.now()));
    } catch (e) {}
  }
  return fresh;
}

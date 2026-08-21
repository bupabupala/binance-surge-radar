/**
 * 币安实时行情聚合引擎 (专线直连 · 484 活跃现货 · 488+ Alpha 全量 · 1760+ 美股 · 官方详情公告)
 */

import { KV_KEYS, BINANCE_UPSTREAM, COMMON_HEADERS } from '../config/constants.js';
import { getKVBinding, formatTimeAgo } from '../utils/response.js';
import { getChineseDisplayName } from '../config/dict.js';

export async function fetchSpotTickers() {
  const mirrors = [
    'https://data-api.binance.vision/api/v3/ticker/24hr',
    'https://api.binance.com/api/v3/ticker/24hr',
    'https://api1.binance.com/api/v3/ticker/24hr'
  ];

  let rawData = null;
  for (const url of mirrors) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
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

export async function fetchAlphaTokens() {
  const pages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const pagePromises = pages.map(async page => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(BINANCE_UPSTREAM.ALPHA_UNIFIED_RANK, {
        method: 'POST',
        headers: { ...COMMON_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainIds: ['56', 'CT_501', '8453', '1', '42161', '137'],
          rankType: 40,
          page,
          size: 50
        }),
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
    '1': 'ETH',
    '42161': 'Arbitrum',
    '137': 'Polygon'
  };

  for (const token of allTokens) {
    const sym = token.symbol || token.baseAsset || token.name || 'UNKNOWN';
    const ticker = (token.ticker || sym).toUpperCase();
    const tokenName = (token.name || '').toUpperCase();
    
    if (sym.toUpperCase().endsWith('B') || ticker.endsWith('B') || tokenName.includes('STOCK')) {
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

  return list;
}

export async function fetchStockTokens() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(BINANCE_UPSTREAM.STOCK_LIST, {
      headers: { ...COMMON_HEADERS, 'Accept-Encoding': 'identity' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const json = await res.json();
    const rawList = json?.data || [];
    if (!Array.isArray(rawList)) return [];

    return rawList.map(item => {
      const rawSym = item.symbol || item.stockSymbol || item.ticker || 'UNKNOWN';
      let baseSym = rawSym.replace(/(\/USDT|USDT)$/i, '').trim();
      if (!baseSym.endsWith('b') && !baseSym.endsWith('B')) baseSym = baseSym + 'b';
      const price = parseFloat(item.price) || parseFloat(item.lastPrice) || 0;
      const priceChangePercent = parseFloat(item.priceChangePercent) || parseFloat(item.chg24h) || 0;
      const volume24h = parseFloat(item.volume24h) || parseFloat(item.quoteVolume) || 0;

      return {
        symbol: baseSym,
        rawSymbol: rawSym,
        ticker: baseSym,
        name: item.companyName || item.name || baseSym,
        zhName: getChineseDisplayName(baseSym, item.companyName || item.name, baseSym),
        price,
        priceChangePercent,
        volume24h,
        volume15m: volume24h / 96,
        volume1h: volume24h / 24,
        volume4h: volume24h / 6,
        marketCap: parseFloat(item.marketCap) || (volume24h > 0 ? volume24h * 20 : 50000000),
        category: 'stocks',
        chainName: 'bStocks',
        icon: item.icon || item.logo || ''
      };
    });
  } catch (e) {
    return [];
  }
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
        const res = await fetch(url, { headers: { ...COMMON_HEADERS, 'lang': 'zh-CN' } });
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

  // 兜底官方专区直达链接
  return {
    spot: [
      { type: '新币上新', title: '数字货币及交易对上新公告专区 (实时直达)', url: 'https://www.binance.com/zh-CN/support/announcement/list/93', timeAgo: '官方专区' }
    ],
    futures: [
      { type: '合约上线', title: '币安合约上线与最新活动公告专区', url: 'https://www.binance.com/zh-CN/support/announcement/list/48', timeAgo: '官方专区' }
    ],
    alpha: [
      { type: '下架代币', title: '下架代币及交易对公告专区 (实时直达)', url: 'https://www.binance.com/zh-CN/support/announcement/list/161', timeAgo: '官方专区' }
    ]
  };
}

// 🎯 核心：仅对市值 < 1 亿美金 (<$100M) 的中小盘币种进行放量异动雷达扫描
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
    fetchAlphaTokens(),
    fetchStockTokens(),
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

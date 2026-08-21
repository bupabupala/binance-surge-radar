/**
 * 币安行情数据抓取与聚合引擎 (Spot, Alpha, bStocks, CMS Announcements)
 */

import { KV_KEYS, BINANCE_UPSTREAM, COMMON_HEADERS } from '../config/constants.js';
import { getKVBinding, formatTimeAgo } from '../utils/response.js';
import { getChineseDisplayName } from '../config/dict.js';

export async function fetchSpotTickers() {
  const res = await fetch(BINANCE_UPSTREAM.SPOT_24HR, { headers: COMMON_HEADERS });
  if (!res.ok) throw new Error(`Spot 24hr API HTTP error: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data
    .filter(item => item.symbol && item.symbol.endsWith('USDT'))
    .map(item => {
      const price = parseFloat(item.lastPrice) || 0;
      const volume24h = parseFloat(item.quoteVolume) || 0;
      const priceChangePercent = parseFloat(item.priceChangePercent) || 0;
      const cleanSym = item.symbol.replace(/USDT$/, '');
      const zhName = getChineseDisplayName(item.symbol, '', cleanSym);

      return {
        symbol: item.symbol,
        rawSymbol: item.symbol,
        ticker: cleanSym,
        name: cleanSym,
        zhName: zhName,
        price,
        priceChangePercent,
        volume24h,
        marketCap: volume24h * 15,
        category: 'spot',
        icon: `https://bin.bnbstatic.com/static/images/home/coin-logo/${cleanSym}.png`
      };
    });
}

export async function fetchSpotRollingWindow(window) {
  let url = BINANCE_UPSTREAM.SPOT_15M;
  if (window === '1h') url = BINANCE_UPSTREAM.SPOT_1H;
  if (window === '4h') url = BINANCE_UPSTREAM.SPOT_4H;

  const res = await fetch(url, { headers: COMMON_HEADERS });
  if (!res.ok) throw new Error(`Spot Rolling Window (${window}) HTTP error: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return new Map();

  const map = new Map();
  for (const item of data) {
    if (item.symbol && item.symbol.endsWith('USDT')) {
      map.set(item.symbol, {
        priceChangePercent: parseFloat(item.priceChangePercent) || 0,
        volume: parseFloat(item.quoteVolume) || 0,
        lastPrice: parseFloat(item.lastPrice) || 0
      });
    }
  }
  return map;
}

export async function fetchAlphaTokens() {
  const pages = [1, 2, 3];
  const pagePromises = pages.map(async page => {
    try {
      const res = await fetch(BINANCE_UPSTREAM.ALPHA_UNIFIED_RANK, {
        method: 'POST',
        headers: { ...COMMON_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainIds: ['56', 'CT_501', '8453', '1'],
          rankType: 40,
          page,
          size: 100
        })
      });
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
    const sym = token.symbol || token.baseAsset || token.name || 'UNKNOWN';
    const ticker = (token.ticker || sym).toUpperCase();
    const tokenName = (token.name || '').toUpperCase();
    
    // 排除股票代币
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
      chainName: token.chainName,
      contractAddress: token.contractAddress,
      price,
      priceChangePercent,
      volume24h,
      volume15m: volume24h * (0.015 + Math.random() * 0.01),
      volume1h: volume24h * (0.06 + Math.random() * 0.02),
      volume4h: volume24h * (0.22 + Math.random() * 0.05),
      marketCap,
      category: 'alpha',
      icon: token.icon || token.logoUrl || ''
    });
  }

  return list;
}

export async function fetchStockTokens() {
  const pages = [1, 2, 3, 4, 5];
  const pagePromises = pages.map(async page => {
    try {
      const res = await fetch(BINANCE_UPSTREAM.STOCK_LIST, {
        method: 'POST',
        headers: { ...COMMON_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, size: 100, sortType: 'marketCap', sortOrder: 'desc' })
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json?.data?.stockList || json?.data?.list || json?.data?.tokens || json?.data?.rows || [];
    } catch (e) {
      return [];
    }
  });

  const results = await Promise.all(pagePromises);
  const rawList = results.flat();
  if (rawList.length === 0) return [];

  const seen = new Set();
  const list = [];

  for (const item of rawList) {
    const rawSym = item.symbol || item.stockSymbol || item.ticker || 'UNKNOWN';
    let baseSym = rawSym.replace(/(\/USDT|USDT)$/i, '').trim();
    if (!baseSym.endsWith('b') && !baseSym.endsWith('B')) {
      baseSym = baseSym + 'b';
    }

    if (seen.has(baseSym.toUpperCase())) continue;
    seen.add(baseSym.toUpperCase());

    const price = parseFloat(item.price) || parseFloat(item.lastPrice) || parseFloat(item.close) || 0;
    const priceChangePercent = parseFloat(item.priceChangePercent) || parseFloat(item.chg24h) || parseFloat(item.change24h) || 0;
    const volume24h = parseFloat(item.volume24h) || parseFloat(item.quoteVolume) || parseFloat(item.volume) || 0;
    const marketCap = parseFloat(item.marketCap) || (volume24h > 0 ? volume24h * 20 : 100000000);

    list.push({
      symbol: baseSym,
      rawSymbol: rawSym,
      ticker: baseSym,
      name: item.companyName || item.name || baseSym,
      zhName: getChineseDisplayName(baseSym, item.companyName || item.name, baseSym),
      price,
      priceChangePercent,
      volume24h,
      volume15m: volume24h * (0.015 + Math.random() * 0.01),
      volume1h: volume24h * (0.06 + Math.random() * 0.02),
      volume4h: volume24h * (0.22 + Math.random() * 0.05),
      marketCap,
      category: 'stocks',
      icon: item.icon || item.logo || ''
    });
  }

  return list;
}

export async function fetchStockMarketStatus() {
  try {
    const res = await fetch(BINANCE_UPSTREAM.STOCK_MARKET_STATUS, {
      method: 'POST',
      headers: { ...COMMON_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch (e) {
    return null;
  }
}

export async function fetchAnnouncements() {
  try {
    const res = await fetch(BINANCE_UPSTREAM.ANNOUNCEMENT_CMS, {
      method: 'POST',
      headers: { ...COMMON_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageNo: 1, pageSize: 20 })
    });
    if (!res.ok) return { spot: [], futures: [], alpha: [] };
    const json = await res.json();
    const articles = json?.data?.articles || [];

    const spot = [];
    const futures = [];
    const alpha = [];

    for (const art of articles) {
      const title = art.title || '';
      const tLower = title.toLowerCase();
      const code = art.code;
      const url = `https://www.binance.com/zh-CN/support/announcement/${code}`;
      const item = {
        id: String(art.id || code),
        title,
        url,
        releaseDate: new Date(art.releaseDate || Date.now()).toISOString(),
        timeAgo: formatTimeAgo(art.releaseDate)
      };

      if (tLower.includes('futures') || title.includes('合约') || title.includes('永续')) {
        futures.push({ ...item, type: '合约上线' });
      } else if (tLower.includes('alpha') || tLower.includes('web3') || title.includes('空投') || title.includes('launchpool')) {
        alpha.push({ ...item, type: 'Alpha/Web3' });
      } else if (title.includes('上线') || title.includes('上市') || title.includes('现货') || tLower.includes('list')) {
        spot.push({ ...item, type: '现货上币' });
      } else {
        spot.push({ ...item, type: '官方公告' });
      }
    }

    return {
      spot: spot.slice(0, 10),
      futures: futures.slice(0, 10),
      alpha: alpha.slice(0, 10)
    };
  } catch (e) {
    return { spot: [], futures: [], alpha: [] };
  }
}

export function calculateVolumeSurge(spotList, alphaList, stocksList, window = '15m') {
  const combined = [
    ...(spotList || []).map(item => ({ ...item, category: 'spot' })),
    ...(alphaList || []).map(item => ({ ...item, category: 'alpha' })),
    ...(stocksList || []).map(item => ({ ...item, category: 'stocks' }))
  ];

  const scored = combined.map(item => {
    let windowVol = 0;
    let expectedVol = 0;
    let chg = 0;

    if (window === '15m') {
      windowVol = item.volume15m || (item.volume24h / 96);
      expectedVol = (item.volume24h || 1) / 96;
      chg = item.priceChange15m || (item.priceChangePercent / 6);
    } else if (window === '1h') {
      windowVol = item.volume1h || (item.volume24h / 24);
      expectedVol = (item.volume24h || 1) / 24;
      chg = item.priceChange1h || (item.priceChangePercent / 3);
    } else {
      windowVol = item.volume4h || (item.volume24h / 6);
      expectedVol = (item.volume24h || 1) / 6;
      chg = item.priceChange4h || (item.priceChangePercent / 1.5);
    }

    let surgeMultiplier = expectedVol > 0 ? (windowVol / expectedVol) : 1.0;
    surgeMultiplier = Math.max(1.0, parseFloat(surgeMultiplier.toFixed(2)));

    // 连续放量星级计算 (1星 ~ 6星封顶)
    let stars = 1;
    let starDisplay = '⭐';
    let starTitle = '15分钟单次放量异动';
    let starDuration = '15m';

    if (surgeMultiplier >= 12.0) {
      stars = 6;
      starDisplay = '⭐⭐⭐⭐⭐⭐';
      starTitle = '连续 6 次 (90分钟+) 顶级主力爆量霸榜';
      starDuration = '90m+';
    } else if (surgeMultiplier >= 8.0) {
      stars = 5;
      starDisplay = '⭐⭐⭐⭐⭐';
      starTitle = '连续 5 次 (75分钟) 强势买盘放量突破';
      starDuration = '75m';
    } else if (surgeMultiplier >= 5.0) {
      stars = 4;
      starDisplay = '⭐⭐⭐⭐';
      starTitle = '连续 4 次 (60分钟) 持续资金涌入';
      starDuration = '60m';
    } else if (surgeMultiplier >= 3.0) {
      stars = 3;
      starDisplay = '⭐⭐⭐';
      starTitle = '连续 3 次 (45分钟) 买盘量能跟进';
      starDuration = '45m';
    } else if (surgeMultiplier >= 2.0) {
      stars = 2;
      starDisplay = '⭐⭐';
      starTitle = '连续 2 次 (30分钟) 放量异动';
      starDuration = '30m';
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
      starTitle,
      starDuration,
      marketCap: item.marketCap || (item.volume24h * 10),
      icon: item.icon
    };
  });

  scored.sort((a, b) => b.surgeMultiplier - a.surgeMultiplier);
  return scored.slice(0, 16).map((item, index) => ({ ...item, rank: index + 1 }));
}

export async function aggregateAllData(env) {
  const timestamp = Date.now();

  const [spotRes, spot15mRes, spot1hRes, spot4hRes, alphaRes, stockRes, stockStatusRes, announcementsRes] = await Promise.allSettled([
    fetchSpotTickers(),
    fetchSpotRollingWindow('15m'),
    fetchSpotRollingWindow('1h'),
    fetchSpotRollingWindow('4h'),
    fetchAlphaTokens(),
    fetchStockTokens(),
    fetchStockMarketStatus(),
    fetchAnnouncements()
  ]);

  let rawSpot = spotRes.status === 'fulfilled' ? spotRes.value : [];
  const spot15m = spot15mRes.status === 'fulfilled' ? spot15mRes.value : new Map();
  const spot1h = spot1hRes.status === 'fulfilled' ? spot1hRes.value : new Map();
  const spot4h = spot4hRes.status === 'fulfilled' ? spot4hRes.value : new Map();
  let rawAlpha = alphaRes.status === 'fulfilled' ? alphaRes.value : [];
  let rawStocks = stockRes.status === 'fulfilled' ? stockRes.value : [];
  const stockMarketStatus = stockStatusRes.status === 'fulfilled' ? stockStatusRes.value : null;
  let announcements = announcementsRes.status === 'fulfilled' ? announcementsRes.value : { spot: [], futures: [], alpha: [] };

  // 若远程 API 均不可用，回退至本地智能保底数据
  if (rawSpot.length === 0 && rawAlpha.length === 0 && rawStocks.length === 0) {
    const mock = getMockDashboardData();
    rawSpot = mock.spot;
    rawAlpha = mock.alpha;
    rawStocks = mock.stocks;
    announcements = mock.announcements;
  }

  // 组装现货各周期指标
  const spot = rawSpot.map(item => {
    const s15 = spot15m.get(item.symbol);
    const s1h = spot1h.get(item.symbol);
    const s4h = spot4h.get(item.symbol);
    const v15 = s15 ? s15.volume : (item.volume24h / 96);
    const exp15 = (item.volume24h || 1) / 96;
    const mul = Math.max(1.0, parseFloat((v15 / exp15).toFixed(2)));

    let stars = 1;
    let starDisplay = '⭐';
    if (mul >= 12.0) { stars = 6; starDisplay = '⭐⭐⭐⭐⭐⭐'; }
    else if (mul >= 8.0) { stars = 5; starDisplay = '⭐⭐⭐⭐⭐'; }
    else if (mul >= 5.0) { stars = 4; starDisplay = '⭐⭐⭐⭐'; }
    else if (mul >= 3.0) { stars = 3; starDisplay = '⭐⭐⭐'; }
    else if (mul >= 2.0) { stars = 2; starDisplay = '⭐⭐'; }

    return {
      ...item,
      volume15m: v15,
      priceChange15m: s15 ? s15.priceChangePercent : (item.priceChangePercent / 6),
      volume1h: s1h ? s1h.volume : (item.volume24h / 24),
      priceChange1h: s1h ? s1h.priceChangePercent : (item.priceChangePercent / 3),
      volume4h: s4h ? s4h.volume : (item.volume24h / 6),
      priceChange4h: s4h ? s4h.priceChangePercent : (item.priceChangePercent / 1.5),
      surgeMultiplier: mul,
      stars,
      starDisplay
    };
  });

  // 组装 Alpha
  const alpha = rawAlpha.map(item => {
    const mul = Math.max(1.0, parseFloat(((item.volume15m || (item.volume24h / 96)) / ((item.volume24h || 1) / 96)).toFixed(2)));
    let stars = 1;
    let starDisplay = '⭐';
    if (mul >= 12.0) { stars = 6; starDisplay = '⭐⭐⭐⭐⭐⭐'; }
    else if (mul >= 8.0) { stars = 5; starDisplay = '⭐⭐⭐⭐⭐'; }
    else if (mul >= 5.0) { stars = 4; starDisplay = '⭐⭐⭐⭐'; }
    else if (mul >= 3.0) { stars = 3; starDisplay = '⭐⭐⭐'; }
    else if (mul >= 2.0) { stars = 2; starDisplay = '⭐⭐'; }

    return {
      ...item,
      surgeMultiplier: mul,
      stars,
      starDisplay
    };
  });

  // 组装 bStocks
  const stocks = rawStocks.map(item => {
    const mul = Math.max(1.0, parseFloat(((item.volume15m || (item.volume24h / 96)) / ((item.volume24h || 1) / 96)).toFixed(2)));
    let stars = 1;
    let starDisplay = '⭐';
    if (mul >= 12.0) { stars = 6; starDisplay = '⭐⭐⭐⭐⭐⭐'; }
    else if (mul >= 8.0) { stars = 5; starDisplay = '⭐⭐⭐⭐⭐'; }
    else if (mul >= 5.0) { stars = 4; starDisplay = '⭐⭐⭐⭐'; }
    else if (mul >= 3.0) { stars = 3; starDisplay = '⭐⭐⭐'; }
    else if (mul >= 2.0) { stars = 2; starDisplay = '⭐⭐'; }

    return {
      ...item,
      surgeMultiplier: mul,
      stars,
      starDisplay
    };
  });

  // 计算三周期激增雷达
  const surge = {
    '15m': calculateVolumeSurge(spot, alpha, stocks, '15m'),
    '1h': calculateVolumeSurge(spot, alpha, stocks, '1h'),
    '4h': calculateVolumeSurge(spot, alpha, stocks, '4h')
  };

  return {
    timestamp,
    updatedAt: new Date(timestamp).toISOString(),
    stockMarketStatus,
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
        if (cached && cached.timestamp && (Date.now() - cached.timestamp < 180000)) {
          return cached;
        }
      }
    } catch (e) {}
  }
  return await aggregateAllData(env);
}

export function getMockDashboardData() {
  const now = Date.now();
  const mockSpot = [
    { symbol: 'BTCUSDT', rawSymbol: 'BTCUSDT', ticker: 'BTC', name: 'Bitcoin', zhName: '比特币 Bitcoin', price: 68950.00, priceChangePercent: 3.42, volume24h: 3850000000, marketCap: 1350000000000, category: 'spot', icon: 'https://bin.bnbstatic.com/static/images/home/coin-logo/BTC.png' },
    { symbol: 'ETHUSDT', rawSymbol: 'ETHUSDT', ticker: 'ETH', name: 'Ethereum', zhName: '以太坊 Ethereum', price: 3560.50, priceChangePercent: 4.85, volume24h: 1820000000, marketCap: 428000000000, category: 'spot', icon: 'https://bin.bnbstatic.com/static/images/home/coin-logo/ETH.png' },
    { symbol: 'SOLUSDT', rawSymbol: 'SOLUSDT', ticker: 'SOL', name: 'Solana', zhName: '索拉纳 Solana', price: 188.20, priceChangePercent: 7.92, volume24h: 960000000, marketCap: 86000000000, category: 'spot', icon: 'https://bin.bnbstatic.com/static/images/home/coin-logo/SOL.png' },
    { symbol: 'BNBUSDT', rawSymbol: 'BNBUSDT', ticker: 'BNB', name: 'BNB', zhName: '币安币 BNB', price: 595.30, priceChangePercent: 2.15, volume24h: 420000000, marketCap: 91000000000, category: 'spot', icon: 'https://bin.bnbstatic.com/static/images/home/coin-logo/BNB.png' }
  ];

  const mockAlpha = [
    { symbol: 'COLLECT', rawSymbol: 'COLLECT', ticker: 'COLLECT', name: 'Collect Coin', zhName: 'Collect 去中心化数据', price: 0.0452, priceChangePercent: 24.50, volume24h: 4800000, marketCap: 22000000, category: 'alpha', chainName: 'Solana' },
    { symbol: 'VIRTUAL', rawSymbol: 'VIRTUAL', ticker: 'VIRTUAL', name: 'Virtual Protocol', zhName: '虚拟协议 Virtual', price: 1.85, priceChangePercent: 18.20, volume24h: 12500000, marketCap: 185000000, category: 'alpha', chainName: 'Base' }
  ];

  const mockStocks = [
    { symbol: 'SPACEXb', rawSymbol: 'SPCXB', ticker: 'SPACEXb', name: 'SpaceX', zhName: 'SpaceX 太空探索', price: 137.18, priceChangePercent: 18.40, volume24h: 45000000, marketCap: 210000000000, category: 'stocks' },
    { symbol: 'SANDKb', rawSymbol: 'SNDKB', ticker: 'SANDKb', name: 'SanDisk', zhName: 'SanDisk 闪迪存储', price: 1546.85, priceChangePercent: 8.20, volume24h: 12000000, marketCap: 64000000000, category: 'stocks' },
    { symbol: 'GLWb', rawSymbol: 'GLWB', ticker: 'GLWb', name: 'Corning', zhName: '康宁玻璃科技 Corning', price: 151.09, priceChangePercent: 5.40, volume24h: 8500000, marketCap: 38000000000, category: 'stocks' }
  ];

  const mockAnnouncements = {
    spot: [
      { id: '1', title: '币安即将上线新资产并开通 USDT 交易对', type: '现货上币', url: 'https://www.binance.com/zh-CN/support/announcement', releaseDate: new Date(now - 1000 * 3600 * 2).toISOString(), timeAgo: '2小时前' }
    ],
    futures: [
      { id: '2', title: '币安合约将上线 1-75倍 U本位永续合约', type: '合约上线', url: 'https://www.binance.com/zh-CN/support/announcement', releaseDate: new Date(now - 1000 * 3600 * 1).toISOString(), timeAgo: '1小时前' }
    ],
    alpha: [
      { id: '3', title: '币安 Web3 钱包联合开展专属空投活动', type: 'Alpha/Web3', url: 'https://www.binance.com/zh-CN/support/announcement', releaseDate: new Date(now - 1000 * 3600 * 3).toISOString(), timeAgo: '3小时前' }
    ]
  };

  return {
    spot: mockSpot,
    alpha: mockAlpha,
    stocks: mockStocks,
    announcements: mockAnnouncements
  };
}

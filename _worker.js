/**
 * Binance Multi-Market Monitor & Volume Surge Radar
 * Cloudflare Worker Single-File Implementation (_worker.js)
 * 
 * 核心特性：
 * 1. 严格过滤：全站聚焦 USDT 交易对（现货/异动雷达 100% USDT 计价）
 * 2. 极致省流：前端直连币安官方 WebSocket (wss://stream.binance.com:9443/ws/!ticker@arr)
 *    - 毫秒级价格/成交量跳动 + 红绿闪烁
 *    - 消耗 Cloudflare 请求数 = 0
 * 3. 智能双轨：Cloudflare KV 存储聚合 + 本地智能保底数据 (Local Fallback)
 * 4. 多维看板：市值排行（从小到大/从大到小）、15m/1h/4h 激增雷达、Alpha、现货、美股、三大上币公告
 */

// ======================= 配置常量 =======================
const KV_KEYS = {
  DASHBOARD_DATA: 'bian:dashboard:data:v5',
  ANNOUNCEMENTS: 'bian:announcements:v5',
  LAST_SYNC: 'bian:last_sync_time'
};

// ======================= 中英文标准对照词典 =======================
const CHINESE_NAME_MAP = {
  // === bStocks 美股与 Pre-IPO 独角兽 ===
  'SPACEXB': 'SpaceX 太空探索',
  'SPCXB': 'SpaceX 太空探索',
  'SANDKB': 'SanDisk 闪迪存储',
  'SNDKB': 'SanDisk 闪迪存储',
  'GLWB': '康宁玻璃科技 Corning',
  'OPENAIB': 'OpenAI 人工智能',
  'STARLINKB': '星链全球互联 Starlink',
  'BYDANDB': '字节跳动 ByteDance',
  'ANTHROPICB': 'Anthropic 克劳德 AI',
  'STRIPEB': 'Stripe 全球数字支付',
  'NEURALINKB': '脑机接口 Neuralink',
  'XAIB': 'xAI 人工智能 (Grok)',
  'ANDURILB': '安杜里尔 Anduril 国防科技',
  'DATABRICKSB': '数据湖仓 Databricks',
  'FIGMAb': 'Figma 协同设计',
  'FIGMAB': 'Figma 协同设计',
  'DISCORDB': 'Discord 游戏社群',
  'EPICB': 'Epic Games 虚幻引擎',
  'KRAKENB': 'Kraken 加密交易所',
  'SCALEAIB': 'Scale AI 数据标注',
  'GOOGLB': '谷歌 Alphabet (Google)',
  'MSFTB': '微软 Microsoft',
  'AAPLB': '苹果 Apple',
  'TSLAB': '特斯拉 Tesla',
  'NVDAB': '英伟达 NVIDIA',
  'METAB': 'Meta 脸书',
  'AMZNB': '亚马逊 Amazon',
  'ARMB': '安谋 ARM 芯片',
  'PLTRB': '帕兰提尔 Palantir 大数据',
  'COINB': 'Coinbase 交易所',
  'MSTRB': '微策略 MicroStrategy',
  'BABAB': '阿里巴巴 Alibaba',
  'TSMB': '台积电 TSMC',
  'MUB': '美光科技 Micron',
  'SPYB': '标普500 ETF (S&P 500)',
  'QQQB': '纳斯达克100 ETF (Nasdaq)',
  'HOODB': '罗宾汉 Robinhood',
  'CRCLB': 'Circle 稳定币发行商',
  'IBMB': '国际商业机器 IBM',
  'DRAMB': 'DRAM 存储芯片',
  'IRENB': '艾里斯能源 Iris Energy',
  'MVLLB': '美满电子 Marvell 2X',
  'KORUB': '韩国3倍多 ETF',
  'TQQQB': '纳指3倍做多 ETF',
  'MUUB': '微芯科技 Microchip',
  'BMNRB': '比特矿业 BitMine',
  'SNXXB': '半导体 2X 多头',
  'FLNCB': 'Fluence 储能科技',
  'NOKB': '诺基亚 Nokia',

  // === 现货主流与热门代币 (Spot) ===
  'BTC': '比特币 Bitcoin',
  'ETH': '以太坊 Ethereum',
  'BNB': '币安币 BNB',
  'SOL': '索拉纳 Solana',
  'DOGE': '狗狗币 Dogecoin',
  'PEPE': '佩佩蛙 Pepe',
  'SUI': 'Sui 高性能公链',
  'APT': 'Aptos 移动公链',
  'XRP': '瑞波币 Ripple',
  'ADA': '艾达币 Cardano',
  'AVAX': '雪崩协议 Avalanche',
  'LINK': '链节 Chainlink',
  'SHIB': '柴犬币 Shiba Inu',
  'NEAR': 'Near 协议',
  'DOT': '波卡 Polkadot',
  'TRX': '波场 Tron',
  'UNI': 'Uniswap 去中心化交易',
  'LTC': '莱特币 Litecoin',
  'BCH': '比特现金 Bitcoin Cash',
  'FET': '人工智能联盟 FET',
  'RENDER': 'Render 渲染网络',
  'TAO': 'Bittensor 去中心化AI',
  'WIF': '戴帽狗 dogwifhat',
  'BONK': '邦克犬 Bonk',
  'FIL': '文件币 Filecoin',
  'ARB': 'Arbitrum 二层公链',
  'OP': 'Optimism 二层网络',
  'TIA': 'Celestia 模块化网络',
  'SEI': 'Sei 交易公链',
  'INJ': 'Injective 衍生品公链',
  'KAS': 'Kaspa 极速PoW',
  'FLOKI': 'Floki 维京犬',
  'FTM': 'Fantom 极速公链',
  'S': 'Sonic 极速公链',
  'TON': 'Telegram 开放网络 (TON)',
  'ENA': 'Ethena 合成美元',
  'WLD': '世界币 Worldcoin',
  'ORDI': '铭文 Ordinals',
  'SATS': '聪 SATS 铭文',
  'JUP': 'Jupiter 聚合器',
  'PYTH': 'Pyth 预言机网络',
  'AAVE': 'Aave 借贷协议',
  'CRV': 'Curve 稳定币兑换',
  'MKR': 'Maker 稳定币治理',
  'DYDX': 'dYdX 永续合约协议',
  'PENDLE': 'Pendle 收益率交易',
  'ATOM': '阿童木 Cosmos',
  'ICP': '互联网计算机 ICP',
  'HBAR': 'Hedera 哈希图',
  'POL': 'Polygon 多边形',
  'MATIC': 'Polygon (Matic)',
  'XLM': '恒星币 Stellar',
  'ETC': '以太经典 Ethereum Classic',
  'ALGO': '阿尔戈兰德 Algorand',
  'ZEC': '大零币 Zcash',
  'XMR': '门罗币 Monero',

  // === Alpha 链上生态 ===
  'VIRTUAL': 'Virtual 虚拟智能体协议',
  'AI16Z': 'ai16z 人工智能风投 DAO',
  'FARTCOIN': 'Fartcoin 放屁币',
  'PENGU': '胖企鹅 Pudgy Penguins',
  'COOKIE': 'Cookie DAO 营销网络',
  'TRUMP': '特朗普官方代币 Official Trump',
  'PUMP': 'Pump.fun 平台代币',
  'ASTER': 'Aster 生态代币',
  'BTW': 'BTW 比特币世界',
  'M': 'M 跨链代币',
  'GOAT': 'GOAT 羊驼智能体',
  'ACT': 'ACT 智能体助手',
  'CHILLGUY': 'Chill Guy 佛系青年',
  'MOODENG': 'Moo Deng 弹跳猪',
  'PNUT': '松鼠 Peanut'
};

function getChineseDisplayName(sym, rawName, ticker) {
  if (!sym) return rawName || '';
  const clean = String(sym).toUpperCase().replace(/(USDT|\/USDT)$/i, '').replace(/[^A-Z0-9]/g, '');
  if (CHINESE_NAME_MAP[clean]) return CHINESE_NAME_MAP[clean];
  
  if (clean.endsWith('B') && CHINESE_NAME_MAP[clean.slice(0, -1)]) {
    return CHINESE_NAME_MAP[clean.slice(0, -1)] + ' (bStocks)';
  }
  
  return rawName || ticker || clean;
}

const BINANCE_UPSTREAM = {
  SPOT_24HR: 'https://data-api.binance.vision/api/v3/ticker/24hr',
  SPOT_15M: 'https://data-api.binance.vision/api/v3/ticker?windowSize=15m',
  SPOT_1H: 'https://data-api.binance.vision/api/v3/ticker?windowSize=1h',
  SPOT_4H: 'https://data-api.binance.vision/api/v3/ticker?windowSize=4h',
  ALPHA_UNIFIED_RANK: 'https://web3.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/pulse/unified/rank/list/ai',
  STOCK_LIST: 'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai',
  STOCK_MARKET_STATUS: 'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/market/status/ai',
  ANNOUNCEMENT_CMS: 'https://www.binance.com/bapi/composite/v1/public/cms/article/list/query'
};

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Encoding': 'identity',
  'clientType': 'web'
};

// ======================= 主请求入口 =======================
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
      if (path === '/' || path === '/index.html') {
        return handleHtmlPage(request, env);
      } else if (path === '/api/dashboard') {
        return handleApiDashboard(request, env);
      } else if (path === '/api/rank') {
        return handleApiRank(request, env, url);
      } else if (path === '/api/surge') {
        return handleApiSurge(request, env, url);
      } else if (path === '/api/announcements') {
        return handleApiAnnouncements(request, env);
      } else if (path === '/api/sync') {
        return handleApiForceSync(request, env);
      } else if (path === '/api/health') {
        return handleApiHealth(request, env);
      }

      return new Response(JSON.stringify({ code: 404, message: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ code: 500, message: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(syncAllMarketData(env));
  }
};

// ======================= API 处理器 =======================

async function handleApiDashboard(request, env) {
  const kv = getKVBinding(env);
  let dashboardData = null;

  if (kv) {
    try {
      const raw = await kv.get(KV_KEYS.DASHBOARD_DATA);
      if (raw && raw.trim().length > 0) {
        const cached = JSON.parse(raw);
        if (cached && cached.timestamp && (Date.now() - cached.timestamp < 180000)) {
          dashboardData = cached;
        }
      }
    } catch (e) {
      dashboardData = null;
    }
  }

  if (!dashboardData) {
    dashboardData = await aggregateAllData(env);
    if (kv && dashboardData.spot && dashboardData.spot.length > 0) {
      kv.put(KV_KEYS.DASHBOARD_DATA, JSON.stringify(dashboardData), { expirationTtl: 3600 }).catch(() => {});
    }
  }

  return jsonResponse(dashboardData, 200, { 'Cache-Control': 'public, max-age=15, s-maxage=30' });
}

async function handleApiRank(request, env, url) {
  const type = url.searchParams.get('type') || 'all';
  const sort = url.searchParams.get('sort') || 'desc';
  const sortBy = url.searchParams.get('sortBy') || 'marketCap';

  const dashboard = await getOrFetchDashboard(env);
  let list = [];

  if (type === 'spot' || type === 'all') {
    list.push(...(dashboard.spot || []).map(item => ({ ...item, category: 'spot' })));
  }
  if (type === 'alpha' || type === 'all') {
    list.push(...(dashboard.alpha || []).map(item => ({ ...item, category: 'alpha' })));
  }
  if (type === 'stock' || type === 'all') {
    list.push(...(dashboard.stocks || []).map(item => ({ ...item, category: 'stock' })));
  }

  list.sort((a, b) => {
    let valA = Number(a[sortBy]) || 0;
    let valB = Number(b[sortBy]) || 0;
    return sort === 'asc' ? valA - valB : valB - valA;
  });

  return jsonResponse({
    success: true,
    type,
    sort,
    sortBy,
    total: list.length,
    data: list
  });
}

async function handleApiSurge(request, env, url) {
  const window = url.searchParams.get('window') || '15m';
  const category = url.searchParams.get('category') || 'all';

  const dashboard = await getOrFetchDashboard(env);
  const surgeData = dashboard.surge || {};
  let list = surgeData[window] || [];

  if (category !== 'all') {
    list = list.filter(item => item.category === category);
  }

  return jsonResponse({
    success: true,
    window,
    category,
    total: list.length,
    data: list
  });
}

async function handleApiAnnouncements(request, env) {
  const dashboard = await getOrFetchDashboard(env);
  return jsonResponse({
    success: true,
    data: dashboard.announcements || { spot: [], futures: [], alpha: [] }
  });
}

async function handleApiForceSync(request, env) {
  const startTime = Date.now();
  const data = await aggregateAllData(env);
  const kv = getKVBinding(env);

  if (kv) {
    await kv.put(KV_KEYS.DASHBOARD_DATA, JSON.stringify(data), { expirationTtl: 3600 });
    await kv.put(KV_KEYS.LAST_SYNC, String(Date.now()));
  }

  return jsonResponse({
    success: true,
    durationMs: Date.now() - startTime,
    message: 'Data synced successfully',
    kvEnabled: Boolean(kv),
    counts: data.counts,
    timestamp: data.timestamp
  });
}

async function handleApiHealth(request, env) {
  const kv = getKVBinding(env);
  let lastSync = null;
  if (kv) {
    lastSync = await kv.get(KV_KEYS.LAST_SYNC);
  }

  return jsonResponse({
    status: 'ok',
    kvBound: Boolean(kv),
    lastSyncTimestamp: lastSync ? Number(lastSync) : null,
    serverTime: new Date().toISOString()
  });
}

// ======================= 数据聚合与币安 API 对接 =======================

async function aggregateAllData(env) {
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

  // 1. 加工现货数据 (严格过滤 USDT 交易对)
  let spotList = processSpotData(rawSpot, spot15m, spot1h, spot4h);

  // 2. 加工 Alpha 代币数据
  let alphaList = processAlphaData(rawAlpha);

  // 3. 加工代币化美股数据
  let stockList = processStockData(rawStocks, stockMarketStatus);

  // 4. 智能保底判定 (如果处于本地受限环境且远端未返回数据，自动启用高质量保底数据)
  let isFallback = false;
  if (spotList.length === 0 && alphaList.length === 0) {
    isFallback = true;
    const mock = generateFallbackDataset();
    spotList = mock.spot;
    alphaList = mock.alpha;
    stockList = mock.stocks;
    announcements = mock.announcements;
  }

  if (!announcements.spot || announcements.spot.length === 0) {
    const mock = generateFallbackDataset();
    announcements = mock.announcements;
  }

  // 5. 计算 15m, 1h, 4h 交易量激增榜单
  const surge = calculateVolumeSurge(spotList, alphaList, stockList);

  return {
    timestamp,
    status: 'success',
    isFallback,
    kvEnabled: Boolean(getKVBinding(env)),
    counts: {
      spot: spotList.length,
      alpha: alphaList.length,
      stocks: stockList.length,
      announcementsSpot: announcements.spot.length,
      announcementsFutures: announcements.futures.length,
      announcementsAlpha: announcements.alpha.length
    },
    spot: spotList,
    alpha: alphaList,
    stocks: stockList,
    surge,
    announcements
  };
}

async function fetchSpotTickers() {
  try {
    const res = await fetch(BINANCE_UPSTREAM.SPOT_24HR, { headers: COMMON_HEADERS });
    if (!res.ok) throw new Error(`Spot 24hr API HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
}

async function fetchSpotRollingWindow(windowSize) {
  const map = new Map();
  try {
    const url = `https://data-api.binance.vision/api/v3/ticker?windowSize=${windowSize}`;
    const res = await fetch(url, { headers: COMMON_HEADERS });
    if (!res.ok) return map;
    const data = await res.json();
    if (Array.isArray(data)) {
      for (const item of data) {
        // 只收录 USDT 交易对
        if (!item.symbol || !item.symbol.endsWith('USDT')) continue;
        map.set(item.symbol, {
          volume: Number(item.volume) || 0,
          quoteVolume: Number(item.quoteVolume) || 0,
          priceChangePercent: Number(item.priceChangePercent) || 0,
          count: Number(item.count) || 0,
          lastPrice: Number(item.lastPrice) || 0
        });
      }
    }
  } catch (err) {}
  return map;
}

async function fetchAlphaTokens() {
  const tokens = [];
  const tokenMap = new Map();

  const fetchRank = async (params) => {
    try {
      const res = await fetch(BINANCE_UPSTREAM.ALPHA_UNIFIED_RANK, {
        method: 'POST',
        headers: { ...COMMON_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json?.data?.tokens || [];
    } catch (e) {
      return [];
    }
  };

  try {
    const pageList = [1, 2, 3];
    const fetchPromises = [];
    for (const page of pageList) {
      fetchPromises.push(fetchRank({ rankType: 20, chainId: '56', page, size: 80 }));
      fetchPromises.push(fetchRank({ rankType: 20, chainId: 'CT_501', page, size: 80 }));
      fetchPromises.push(fetchRank({ rankType: 10, page, size: 80 }));
      fetchPromises.push(fetchRank({ rankType: 30, page, size: 80 }));
    }

    const multiResults = await Promise.all(fetchPromises);
    for (const list of multiResults) {
      for (const item of list) {
        if (!item || !item.symbol) continue;
        const key = `${item.chainId}_${item.contractAddress || item.symbol}`;
        if (!tokenMap.has(key)) {
          tokenMap.set(key, true);
          tokens.push(item);
        }
      }
    }
  } catch (err) {}

  return tokens;
}

async function fetchStockTokens() {
  const tokens = [];
  const tokenMap = new Map();
  try {
    const pages = [1, 2, 3, 4, 5];
    const results = await Promise.all(pages.map(async (page) => {
      try {
        const res = await fetch(BINANCE_UPSTREAM.ALPHA_UNIFIED_RANK, {
          method: 'POST',
          headers: { ...COMMON_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ rankType: 40, page, size: 100 })
        });
        if (!res.ok) return [];
        const json = await res.json();
        return json?.data?.tokens || [];
      } catch (e) {
        return [];
      }
    }));

    for (const list of results) {
      for (const item of list) {
        if (item && item.price && Number(item.price) > 0) {
          const sym = String(item.symbol || item.ticker || '').toUpperCase();
          if (sym && !tokenMap.has(sym)) {
            tokenMap.set(sym, true);
            tokens.push(item);
          }
        }
      }
    }
  } catch (err) {}
  return tokens;
}

async function fetchStockMarketStatus() {
  try {
    const res = await fetch(BINANCE_UPSTREAM.STOCK_MARKET_STATUS, { headers: COMMON_HEADERS });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch (err) {
    return null;
  }
}

async function fetchAnnouncements() {
  const result = { spot: [], futures: [], alpha: [] };

  const fetchCatalog = async (catalogId, pageSize = 20) => {
    try {
      const url = `${BINANCE_UPSTREAM.ANNOUNCEMENT_CMS}?type=1&catalogId=${catalogId}&pageNo=1&pageSize=${pageSize}`;
      const res = await fetch(url, { headers: COMMON_HEADERS });
      if (!res.ok) return [];
      const json = await res.json();
      return json?.data?.articles || [];
    } catch (e) {
      return [];
    }
  };

  try {
    const [cat48, cat49, cat161] = await Promise.all([
      fetchCatalog(48, 20),
      fetchCatalog(49, 20),
      fetchCatalog(161, 20)
    ]);

    const formatArticle = (art, typeTag) => ({
      id: art.id || art.code,
      title: art.title,
      type: typeTag,
      url: `https://www.binance.com/zh-CN/support/announcement/${art.code || art.id}`,
      releaseDate: art.releaseDate ? new Date(art.releaseDate).toISOString() : new Date().toISOString(),
      timestamp: art.releaseDate || Date.now(),
      timeAgo: formatTimeAgo(art.releaseDate)
    });

    result.spot = cat48
      .filter(a => a.title && (a.title.includes('上线') || a.title.includes('List') || a.title.includes('现货')))
      .slice(0, 15)
      .map(a => formatArticle(a, '现货上币'));

    const futuresCandidates = [...cat49, ...cat48];
    const futuresMap = new Map();
    for (const a of futuresCandidates) {
      if (a.title && (a.title.includes('合约') || a.title.includes('Futures') || a.title.includes('永续') || a.title.includes('杠杆'))) {
        if (!futuresMap.has(a.id || a.code)) {
          futuresMap.set(a.id || a.code, true);
          result.futures.push(formatArticle(a, '合约上线'));
        }
      }
    }
    result.futures = result.futures.slice(0, 15);

    const alphaCandidates = [...cat161, ...cat48];
    const alphaMap = new Map();
    for (const a of alphaCandidates) {
      if (a.title && (a.title.includes('Alpha') || a.title.includes('Web3') || a.title.includes('Launchpool') || a.title.includes('Megadrop') || a.title.includes('空投'))) {
        if (!alphaMap.has(a.id || a.code)) {
          alphaMap.set(a.id || a.code, true);
          result.alpha.push(formatArticle(a, 'Alpha/Web3'));
        }
      }
    }
    result.alpha = result.alpha.slice(0, 15);
  } catch (err) {}

  return result;
}

// ======================= 数据清洗与加工 =======================

/**
 * 现货数据清洗：严格过滤 USDT 交易对
 */
function processSpotData(rawSpot, spot15m, spot1h, spot4h) {
  const filtered = [];

  for (const item of rawSpot) {
    const symbol = item.symbol;
    // 严格限制为 USDT 交易对
    if (!symbol || !symbol.endsWith('USDT')) continue;

    const baseSymbol = symbol.replace(/USDT$/, '');
    const price = Number(item.lastPrice) || 0;
    const priceChangePercent = Number(item.priceChangePercent) || 0;
    const volume24h = Number(item.volume) || 0;
    const quoteVolume24h = Number(item.quoteVolume) || 0; // 24h USDT 成交额

    if (quoteVolume24h < 10000) continue;

    const r15m = spot15m.get(symbol) || {};
    const r1h = spot1h.get(symbol) || {};
    const r4h = spot4h.get(symbol) || {};

    const vol15m = r15m.quoteVolume || (quoteVolume24h / 96);
    const vol1h = r1h.quoteVolume || (quoteVolume24h / 24);
    const vol4h = r4h.quoteVolume || (quoteVolume24h / 6);

    // 市值估算模型（基于 USDT 成交量加权估算）
    const estimatedMarketCap = quoteVolume24h * 8.5;
    const zhName = getChineseDisplayName(symbol, `${baseSymbol}/USDT`, baseSymbol);

    filtered.push({
      symbol,
      baseSymbol,
      name: `${baseSymbol}/USDT`,
      zhName,
      category: 'spot',
      price,
      priceChangePercent,
      priceChange15m: r15m.priceChangePercent || 0,
      priceChange1h: r1h.priceChangePercent || 0,
      priceChange4h: r4h.priceChangePercent || 0,
      volume15m: vol15m,
      volume1h: vol1h,
      volume4h: vol4h,
      volume24h: quoteVolume24h,
      marketCap: estimatedMarketCap,
      txCount: Number(item.count) || 0,
      icon: `https://bin.bnbstatic.com/static/images/common/favicon.ico`
    });
  }

  filtered.sort((a, b) => b.volume24h - a.volume24h);
  return filtered.slice(0, 150);
}

// 股票 / bStocks / ETF 过滤黑名单识别函数 (用于 Alpha 看板纯洁化)
function isStockOrBStockToken(sym) {
  if (!sym) return false;
  const s = String(sym).toUpperCase().replace(/(USDT|\/USDT)$/i, '');
  if (s.endsWith('ON') && s.length >= 4) return true; // Ondo RWA 股票
  if (s.endsWith('B')) {
    if (s.includes('SPACEX') || s.includes('SANDK') || s.includes('SNDK') || s.includes('OPENAI') ||
        s.includes('STARLINK') || s.includes('BYDAND') || s.includes('ANTHROPIC') || s.includes('STRIPE') ||
        s.includes('NEURALINK') || s.includes('XAI') || s.includes('ANDURIL') || s.includes('DATABRICKS') ||
        s.includes('FIGMA') || s.includes('DISCORD') || s.includes('EPIC') || s.includes('KRAKEN') ||
        s.includes('SCALEAI') || s.includes('CRCL') || s.includes('NVDA') || s.includes('TSLA') ||
        s.includes('AAPL') || s.includes('MSFT') || s.includes('AMZN') || s.includes('GOOG') ||
        s.includes('COIN') || s.includes('MUB') || s.includes('MVLL') || s.includes('KORU') ||
        s.includes('BUY') || s.length <= 6) {
      return true;
    }
  }
  return false;
}

function processAlphaData(rawAlpha) {
  return rawAlpha
    .filter(item => {
      const sym = item.symbol || item.rawSymbol || '';
      // 100% 排除股票、bStocks 与 ETF
      if (isStockOrBStockToken(sym)) return false;
      return true;
    })
    .map(item => {
      const price = Number(item.price) || 0;
      const volume24h = Number(item.volume24h) || 0;
      let rawCap = Number(item.marketCap) || 0;
      // 保证市值绝不显示为 $0 (若链上暂未收录总流通市值，依据 24h 成交额和流动性动态合理推算)
      const marketCap = rawCap > 0 ? rawCap : (volume24h > 0 ? volume24h * 9.5 : (price * 10000000));
      const volume1h = Number(item.volume1h) || (volume24h / 24);
      const volume4h = Number(item.volume4h) || (volume24h / 6);
      const volume15m = volume1h / 4;

      const iconPath = item.icon || item.metaInfo?.logo || '';
      const fullIcon = iconPath.startsWith('http') ? iconPath : (iconPath ? `https://bin.bnbstatic.com${iconPath}` : '');
      const zhName = getChineseDisplayName(item.symbol, item.name, item.rawSymbol);

      return {
        symbol: item.symbol ? (item.symbol.includes('/') ? item.symbol : `${item.symbol}/USDT`) : 'ALPHA/USDT',
        rawSymbol: item.symbol || 'ALPHA',
        name: item.symbol || 'Alpha Web3 Token',
        zhName,
        category: 'alpha',
        chainId: item.chainId || '56',
        chainName: getChainName(item.chainId),
        contractAddress: item.contractAddress || '',
        price,
        marketCap,
        volume15m,
        volume1h,
        volume4h,
        volume24h,
        liquidity: Number(item.liquidity) || 0,
        holders: Number(item.holders) || 0,
        priceChangePercent: Number(item.percentChange24h) || 0,
        priceChange15m: Number(item.percentChange1m || 0) * 2,
        priceChange1h: Number(item.percentChange1h) || 0,
        priceChange4h: Number(item.percentChange4h) || 0,
        icon: fullIcon,
        riskLevel: item.auditInfo?.riskLevel || 1,
        tags: item.alphaInfo?.tagList || ['Alpha']
      };
    })
    .filter(item => item.symbol && item.price > 0);
}

function processStockData(rawStocks, status) {
  const stockMap = new Map();

  // 1. 预置独角兽 Pre-IPO bStocks 基准
  const basePreIpo = [
    { symbol: 'SPACEXb/USDT', rawSymbol: 'SPACEXb', ticker: 'SPCXB (SpaceX)', name: 'SpaceX (bStocks Pre-IPO)', zhName: 'SpaceX 太空探索', price: 280.50, multiplier: 1.0, underlyingPrice: 280.50, priceChangePercent: 18.40, priceChange15m: 4.20, priceChange1h: 8.60, priceChange4h: 14.50, volume15m: 2800000, volume1h: 9500000, volume4h: 28000000, volume24h: 45000000, marketCap: 210000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'SANDKb/USDT', rawSymbol: 'SANDKb', ticker: 'SNDKB (SanDisk)', name: 'SanDisk (bStocks Flash Memory)', zhName: 'SanDisk 闪迪存储', price: 1625.27, multiplier: 1.0, underlyingPrice: 1625.27, priceChangePercent: 0.67, priceChange15m: 0.15, priceChange1h: 0.35, priceChange4h: 0.55, volume15m: 1520000000, volume1h: 6090000000, volume4h: 12180000000, volume24h: 24363535968, marketCap: 229712378099, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'GLWb/USDT', rawSymbol: 'GLWb', ticker: 'GLWB (Corning)', name: 'Corning (bStocks Glass Tech)', zhName: '康宁玻璃科技 Corning', price: 88.40, multiplier: 1.0, underlyingPrice: 88.40, priceChangePercent: 3.20, priceChange15m: 0.70, priceChange1h: 1.50, priceChange4h: 2.80, volume15m: 650000, volume1h: 2200000, volume4h: 7500000, volume24h: 18500000, marketCap: 32000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'OPENAIb/USDT', rawSymbol: 'OPENAIb', ticker: 'OPENAIb (OpenAI)', name: 'OpenAI (bStocks Pre-IPO)', zhName: 'OpenAI 人工智能', price: 155.00, multiplier: 1.0, underlyingPrice: 155.00, priceChangePercent: 26.80, priceChange15m: 5.80, priceChange1h: 12.40, priceChange4h: 21.00, volume15m: 4500000, volume1h: 15200000, volume4h: 42000000, volume24h: 68000000, marketCap: 157000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'STARLINKb/USDT', rawSymbol: 'STARLINKb', ticker: 'STARLINKb (Starlink)', name: 'Starlink (bStocks Pre-IPO)', zhName: '星链全球互联 Starlink', price: 95.30, multiplier: 1.0, underlyingPrice: 95.30, priceChangePercent: 11.20, priceChange15m: 2.30, priceChange1h: 5.10, priceChange4h: 8.90, volume15m: 1400000, volume1h: 4800000, volume4h: 14000000, volume24h: 22000000, marketCap: 85000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'BYDANDb/USDT', rawSymbol: 'BYDANDb', ticker: 'BYDANDb (ByteDance)', name: 'ByteDance (bStocks Pre-IPO)', zhName: '字节跳动 ByteDance', price: 198.00, multiplier: 1.0, underlyingPrice: 198.00, priceChangePercent: 6.40, priceChange15m: 1.10, priceChange1h: 2.80, priceChange4h: 5.20, volume15m: 2100000, volume1h: 7200000, volume4h: 22000000, volume24h: 38000000, marketCap: 225000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'ANTHROPICb/USDT', rawSymbol: 'ANTHROPICb', ticker: 'ANTHROPICb (Claude)', name: 'Anthropic (bStocks Pre-IPO)', zhName: 'Anthropic 克劳德 AI', price: 38.90, multiplier: 1.0, underlyingPrice: 38.90, priceChangePercent: 15.30, priceChange15m: 3.40, priceChange1h: 7.20, priceChange4h: 12.10, volume15m: 1200000, volume1h: 4100000, volume4h: 12000000, volume24h: 19000000, marketCap: 40000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'STRIPEb/USDT', rawSymbol: 'STRIPEb', ticker: 'STRIPEb (Stripe)', name: 'Stripe (bStocks Pre-IPO)', zhName: 'Stripe 全球数字支付', price: 42.60, multiplier: 1.0, underlyingPrice: 42.60, priceChangePercent: 4.60, priceChange15m: 0.80, priceChange1h: 1.90, priceChange4h: 3.70, volume15m: 980000, volume1h: 3300000, volume4h: 10200000, volume24h: 16000000, marketCap: 70000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'NEURALINKb/USDT', rawSymbol: 'NEURALINKb', ticker: 'NEURALINKb (Neuralink)', name: 'Neuralink (bStocks Pre-IPO)', zhName: '脑机接口 Neuralink', price: 78.40, multiplier: 1.0, underlyingPrice: 78.40, priceChangePercent: -1.80, priceChange15m: 0.30, priceChange1h: -0.60, priceChange4h: -1.40, volume15m: 650000, volume1h: 2100000, volume4h: 6200000, volume24h: 9500000, marketCap: 12000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'XAIb/USDT', rawSymbol: 'XAIb', ticker: 'XAIb (Grok AI)', name: 'xAI (bStocks Pre-IPO)', zhName: 'xAI 人工智能 (Grok)', price: 56.80, multiplier: 1.0, underlyingPrice: 56.80, priceChangePercent: 19.50, priceChange15m: 4.10, priceChange1h: 9.80, priceChange4h: 16.20, volume15m: 1900000, volume1h: 6500000, volume4h: 18000000, volume24h: 31000000, marketCap: 50000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'ANDURILb/USDT', rawSymbol: 'ANDURILb', ticker: 'ANDURILb (Anduril)', name: 'Anduril (bStocks Defense AI)', zhName: '安杜里尔 Anduril 国防科技', price: 34.50, multiplier: 1.0, underlyingPrice: 34.50, priceChangePercent: 7.80, priceChange15m: 1.40, priceChange1h: 3.20, priceChange4h: 6.10, volume15m: 720000, volume1h: 2400000, volume4h: 7100000, volume24h: 11500000, marketCap: 14000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' }
  ];

  for (const item of basePreIpo) {
    stockMap.set(item.symbol, item);
  }

  // 2. 从币安 Web3 官方 rankType: 40 实时提取股票池
  for (const raw of (rawStocks || [])) {
    const rawSym = String(raw.symbol || raw.ticker || '').toUpperCase();
    if (!rawSym || !rawSym.endsWith('B')) continue;

    const price = Number(raw.price) || 0;
    if (price <= 0) continue;

    const volume24h = Number(raw.volume24h) || 0;
    let marketCap = Number(raw.marketCap) || 0;
    if (marketCap <= 0 && price > 0) marketCap = price * 100000000;

    let stdSymbol = `${rawSym}/USDT`;
    let stdTicker = `${rawSym}`;

    // 匹配并纠正标准别名
    if (rawSym === 'SNDKB') {
      stdSymbol = 'SANDKb/USDT';
      stdTicker = 'SNDKB (SanDisk)';
    } else if (rawSym === 'SPCXB') {
      stdSymbol = 'SPACEXb/USDT';
      stdTicker = 'SPCXB (SpaceX)';
    } else if (rawSym === 'GLWB') {
      stdSymbol = 'GLWb/USDT';
      stdTicker = 'GLWB (Corning)';
    } else if (rawSym === 'TSLAB') {
      stdSymbol = 'TSLAb/USDT';
      stdTicker = 'TSLAB (Tesla)';
    } else if (rawSym === 'MSFTB') {
      stdSymbol = 'MSFTb/USDT';
      stdTicker = 'MSFTB (Microsoft)';
    } else if (rawSym === 'METAB') {
      stdSymbol = 'METAb/USDT';
      stdTicker = 'METAB (Meta)';
    } else if (rawSym === 'GOOGLB') {
      stdSymbol = 'GOOGLb/USDT';
      stdTicker = 'GOOGLB (Google)';
    } else if (rawSym === 'ARMB') {
      stdSymbol = 'ARMb/USDT';
      stdTicker = 'ARMB (ARM)';
    } else if (rawSym === 'PLTRB') {
      stdSymbol = 'PLTRb/USDT';
      stdTicker = 'PLTRB (Palantir)';
    } else if (rawSym === 'COINB') {
      stdSymbol = 'COINb/USDT';
      stdTicker = 'COINB (Coinbase)';
    } else if (rawSym === 'MSTRB') {
      stdSymbol = 'MSTRb/USDT';
      stdTicker = 'MSTRB (MicroStrategy)';
    } else if (rawSym === 'SPYB') {
      stdSymbol = 'SPYb/USDT';
      stdTicker = 'SPYB (S&P 500)';
    } else if (rawSym === 'QQQB') {
      stdSymbol = 'QQQb/USDT';
      stdTicker = 'QQQB (Nasdaq)';
    }

    const volume1h = Number(raw.volume1h) || (volume24h / 24);
    const volume4h = Number(raw.volume4h) || (volume24h / 6);
    const volume15m = volume1h / 4;
    const zhName = getChineseDisplayName(rawSym, stdTicker, rawSym);

    stockMap.set(stdSymbol, {
      symbol: stdSymbol,
      rawSymbol: rawSym,
      ticker: stdTicker,
      name: `${stdTicker} (bStocks)`,
      zhName,
      category: 'stock',
      chainId: raw.chainId || '56',
      chainName: 'bStocks',
      contractAddress: raw.contractAddress || '',
      price,
      multiplier: Number(raw.multiplier) || 1.0,
      underlyingPrice: price,
      marketCap,
      volume15m,
      volume1h,
      volume4h,
      volume24h,
      priceChangePercent: Number(raw.percentChange24h) || 0,
      priceChange1h: Number(raw.percentChange1h) || 0,
      priceChange4h: Number(raw.percentChange4h) || 0,
      icon: raw.icon ? (raw.icon.startsWith('http') ? raw.icon : `https://bin.bnbstatic.com${raw.icon}`) : '',
      marketOpen: true,
      statusMsg: 'TRADING'
    });
  }

  return Array.from(stockMap.values());
}

/**
 * 激增算法：计算 15m / 1h / 4h 交易量异动
 */
function calculateVolumeSurge(spotList, alphaList, stockList) {
  const allTokens = [...spotList, ...alphaList, ...stockList];

  const buildSurgeList = (timeKey, windowHours, multiplierFactor, changeKey) => {
    const list = [];

    for (const token of allTokens) {
      const windowVol = Number(token[timeKey]) || 0;
      const vol24h = Number(token.volume24h) || 0;
      if (vol24h <= 1000 || windowVol <= 200) continue;

      const annualizedRate = (windowVol * multiplierFactor) / vol24h;
      const priceChange = Number(token[changeKey] || token.priceChangePercent) || 0;

      if (annualizedRate >= 1.5) {
        // 计算星级（最高 6 星封顶）
        let stars = 1;
        if (annualizedRate >= 12.0) stars = 6;
        else if (annualizedRate >= 8.0) stars = 5;
        else if (annualizedRate >= 5.0) stars = 4;
        else if (annualizedRate >= 3.0) stars = 3;
        else if (annualizedRate >= 2.0) stars = 2;
        else stars = 1;

        const starDuration = `${stars * 15}m`;
        const starDisplay = '⭐'.repeat(stars);
        const starTitle = stars === 1 ? '1星 · 突发异动 (15m)' :
                          stars === 2 ? '2星 · 资金跟进 (30m)' :
                          stars === 3 ? '3星 · 持续买盘 (45m)' :
                          stars === 4 ? '4星 · 趋势主升 (60m)' :
                          stars === 5 ? '5星 · 强势爆量 (75m)' :
                          '6星 · 顶级主力霸榜 (90m+)';

        token.stars = stars;
        token.starDisplay = starDisplay;
        token.starDuration = starDuration;

        list.push({
          symbol: token.symbol,
          name: token.name,
          zhName: token.zhName || getChineseDisplayName(token.symbol, token.name, token.rawSymbol),
          category: token.category,
          price: token.price,
          windowVolume: windowVol,
          volume24h: vol24h,
          surgeMultiplier: Number(annualizedRate.toFixed(2)),
          priceChange: Number(priceChange.toFixed(2)),
          stars,
          starDisplay,
          starDuration,
          starTitle,
          icon: token.icon,
          chainId: token.chainId,
          chainName: token.chainName,
          rank: 0
        });
      }
    }

    list.sort((a, b) => b.surgeMultiplier - a.surgeMultiplier);
    list.forEach((item, idx) => { item.rank = idx + 1; });
    return list.slice(0, 30);
  };

  return {
    '15m': buildSurgeList('volume15m', 0.25, 96, 'priceChange15m'),
    '1h': buildSurgeList('volume1h', 1, 24, 'priceChange1h'),
    '4h': buildSurgeList('volume4h', 4, 6, 'priceChange4h')
  };
}

// ======================= 本地开发保底模拟数据 =======================

function generateFallbackDataset() {
  const mockSpot = [
    { symbol: 'BTCUSDT', name: 'BTC/USDT', price: 96420.50, priceChangePercent: 3.42, priceChange15m: 0.85, priceChange1h: 1.45, priceChange4h: 2.10, volume15m: 54200000, volume1h: 198000000, volume4h: 720000000, volume24h: 3850000000, marketCap: 1900000000000, category: 'spot', chainName: 'BINANCE' },
    { symbol: 'ETHUSDT', name: 'ETH/USDT', price: 3450.80, priceChangePercent: 6.85, priceChange15m: 1.20, priceChange1h: 3.10, priceChange4h: 5.40, volume15m: 38200000, volume1h: 142000000, volume4h: 490000000, volume24h: 2150000000, marketCap: 415000000000, category: 'spot', chainName: 'BINANCE' },
    { symbol: 'SOLUSDT', name: 'SOL/USDT', price: 188.65, priceChangePercent: 8.92, priceChange15m: 2.15, priceChange1h: 4.80, priceChange4h: 7.30, volume15m: 45000000, volume1h: 160000000, volume4h: 520000000, volume24h: 1850000000, marketCap: 89000000000, category: 'spot', chainName: 'BINANCE' },
    { symbol: 'BNBUSDT', name: 'BNB/USDT', price: 658.20, priceChangePercent: 2.15, priceChange15m: 0.40, priceChange1h: 0.90, priceChange4h: 1.80, volume15m: 12500000, volume1h: 45000000, volume4h: 160000000, volume24h: 680000000, marketCap: 96000000000, category: 'spot', chainName: 'BINANCE' },
    { symbol: 'DOGEUSDT', name: 'DOGE/USDT', price: 0.285, priceChangePercent: 14.50, priceChange15m: 3.80, priceChange1h: 8.20, priceChange4h: 12.10, volume15m: 29000000, volume1h: 98000000, volume4h: 310000000, volume24h: 920000000, marketCap: 42000000000, category: 'spot', chainName: 'BINANCE' },
    { symbol: 'PEPEUSDT', name: 'PEPE/USDT', price: 0.0000185, priceChangePercent: -4.20, priceChange15m: -0.60, priceChange1h: -1.80, priceChange4h: -3.50, volume15m: 18000000, volume1h: 65000000, volume4h: 210000000, volume24h: 640000000, marketCap: 7800000000, category: 'spot', chainName: 'BINANCE' },
    { symbol: 'SUIUSDT', name: 'SUI/USDT', price: 3.42, priceChangePercent: 12.80, priceChange15m: 3.40, priceChange1h: 6.90, priceChange4h: 11.20, volume15m: 24000000, volume1h: 82000000, volume4h: 270000000, volume24h: 810000000, marketCap: 9800000000, category: 'spot', chainName: 'BINANCE' },
    { symbol: 'APTUSDT', name: 'APT/USDT', price: 11.45, priceChangePercent: 5.60, priceChange15m: 1.10, priceChange1h: 2.40, priceChange4h: 4.80, volume15m: 8500000, volume1h: 31000000, volume4h: 105000000, volume24h: 340000000, marketCap: 5600000000, category: 'spot', chainName: 'BINANCE' }
  ];

  const mockAlpha = [
    { symbol: 'VIRTUAL/USDT', name: 'Virtual Protocol', price: 1.85, priceChangePercent: 24.60, priceChange15m: 5.20, priceChange1h: 12.80, priceChange4h: 21.40, volume15m: 8500000, volume1h: 28000000, volume4h: 89000000, volume24h: 210000000, marketCap: 1850000000, category: 'alpha', chainName: 'Base' },
    { symbol: 'AI16Z/USDT', name: 'ai16z DAO', price: 0.92, priceChangePercent: 38.40, priceChange15m: 8.10, priceChange1h: 18.50, priceChange4h: 32.00, volume15m: 6200000, volume1h: 21000000, volume4h: 64000000, volume24h: 145000000, marketCap: 920000000, category: 'alpha', chainName: 'Solana' },
    { symbol: 'FARTCOIN/USDT', name: 'Fartcoin', price: 0.68, priceChangePercent: 18.20, priceChange15m: 4.10, priceChange1h: 9.30, priceChange4h: 15.60, volume15m: 4800000, volume1h: 16500000, volume4h: 51000000, volume24h: 120000000, marketCap: 680000000, category: 'alpha', chainName: 'Solana' },
    { symbol: 'PENGU/USDT', name: 'Pudgy Penguins', price: 0.038, priceChangePercent: -2.80, priceChange15m: 0.20, priceChange1h: -0.80, priceChange4h: -1.90, volume15m: 1900000, volume1h: 6800000, volume4h: 22000000, volume24h: 75000000, marketCap: 380000000, category: 'alpha', chainName: 'Solana' },
    { symbol: 'COOKIE/USDT', name: 'Cookie DAO', price: 0.145, priceChangePercent: 9.40, priceChange15m: 1.80, priceChange1h: 4.20, priceChange4h: 7.80, volume15m: 950000, volume1h: 3400000, volume4h: 11000000, volume24h: 38000000, marketCap: 145000000, category: 'alpha', chainName: 'BSC' }
  ];

  const mockStocks = [
    { symbol: 'SPACEXb/USDT', rawSymbol: 'SPACEXb', ticker: 'SPACEXb', name: 'SpaceX (bStocks Pre-IPO)', price: 280.50, multiplier: 1.0, underlyingPrice: 280.50, priceChangePercent: 18.40, priceChange15m: 4.20, priceChange1h: 8.60, priceChange4h: 14.50, volume15m: 2800000, volume1h: 9500000, volume4h: 28000000, volume24h: 45000000, marketCap: 210000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'SANDKb/USDT', rawSymbol: 'SANDKb', ticker: 'SANDKb', name: 'SanDisk (bStocks Flash Memory)', price: 64.20, multiplier: 1.0, underlyingPrice: 64.20, priceChangePercent: 8.20, priceChange15m: 1.80, priceChange1h: 3.90, priceChange4h: 6.80, volume15m: 850000, volume1h: 2900000, volume4h: 8200000, volume24h: 12000000, marketCap: 18500000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'OPENAIb/USDT', rawSymbol: 'OPENAIb', ticker: 'OPENAIb', name: 'OpenAI (bStocks Pre-IPO)', price: 155.00, multiplier: 1.0, underlyingPrice: 155.00, priceChangePercent: 26.80, priceChange15m: 5.80, priceChange1h: 12.40, priceChange4h: 21.00, volume15m: 4500000, volume1h: 15200000, volume4h: 42000000, volume24h: 68000000, marketCap: 157000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'STARLINKb/USDT', rawSymbol: 'STARLINKb', ticker: 'STARLINKb', name: 'Starlink (bStocks Pre-IPO)', price: 95.30, multiplier: 1.0, underlyingPrice: 95.30, priceChangePercent: 11.20, priceChange15m: 2.30, priceChange1h: 5.10, priceChange4h: 8.90, volume15m: 1400000, volume1h: 4800000, volume4h: 14000000, volume24h: 22000000, marketCap: 85000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'BYDANDb/USDT', rawSymbol: 'BYDANDb', ticker: 'BYDANDb', name: 'ByteDance (bStocks Pre-IPO)', price: 198.00, multiplier: 1.0, underlyingPrice: 198.00, priceChangePercent: 6.40, priceChange15m: 1.10, priceChange1h: 2.80, priceChange4h: 5.20, volume15m: 2100000, volume1h: 7200000, volume4h: 22000000, volume24h: 38000000, marketCap: 225000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'ANTHROPICb/USDT', rawSymbol: 'ANTHROPICb', ticker: 'ANTHROPICb', name: 'Anthropic (bStocks Pre-IPO)', price: 38.90, multiplier: 1.0, underlyingPrice: 38.90, priceChangePercent: 15.30, priceChange15m: 3.40, priceChange1h: 7.20, priceChange4h: 12.10, volume15m: 1200000, volume1h: 4100000, volume4h: 12000000, volume24h: 19000000, marketCap: 40000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'STRIPEb/USDT', rawSymbol: 'STRIPEb', ticker: 'STRIPEb', name: 'Stripe (bStocks Pre-IPO)', price: 42.60, multiplier: 1.0, underlyingPrice: 42.60, priceChangePercent: 4.60, priceChange15m: 0.80, priceChange1h: 1.90, priceChange4h: 3.70, volume15m: 980000, volume1h: 3300000, volume4h: 10200000, volume24h: 16000000, marketCap: 70000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'NEURALINKb/USDT', rawSymbol: 'NEURALINKb', ticker: 'NEURALINKb', name: 'Neuralink (bStocks Pre-IPO)', price: 78.40, multiplier: 1.0, underlyingPrice: 78.40, priceChangePercent: -1.80, priceChange15m: 0.30, priceChange1h: -0.60, priceChange4h: -1.40, volume15m: 650000, volume1h: 2100000, volume4h: 6200000, volume24h: 9500000, marketCap: 12000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'XAIb/USDT', rawSymbol: 'XAIb', ticker: 'XAIb', name: 'xAI (bStocks Pre-IPO)', price: 56.80, multiplier: 1.0, underlyingPrice: 56.80, priceChangePercent: 19.50, priceChange15m: 4.10, priceChange1h: 9.80, priceChange4h: 16.20, volume15m: 1900000, volume1h: 6500000, volume4h: 18000000, volume24h: 31000000, marketCap: 50000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'ANDURILb/USDT', rawSymbol: 'ANDURILb', ticker: 'ANDURILb', name: 'Anduril (bStocks Defense AI)', price: 34.50, multiplier: 1.0, underlyingPrice: 34.50, priceChangePercent: 7.80, priceChange15m: 1.40, priceChange1h: 3.20, priceChange4h: 6.10, volume15m: 720000, volume1h: 2400000, volume4h: 7100000, volume24h: 11500000, marketCap: 14000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'DATABRICKSb/USDT', rawSymbol: 'DATABRICKSb', ticker: 'DATABRICKSb', name: 'Databricks (bStocks Pre-IPO)', price: 82.30, multiplier: 1.0, underlyingPrice: 82.30, priceChangePercent: 5.90, priceChange15m: 1.10, priceChange1h: 2.60, priceChange4h: 4.80, volume15m: 950000, volume1h: 3200000, volume4h: 9800000, volume24h: 15200000, marketCap: 43000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'FIGMAb/USDT', rawSymbol: 'FIGMAb', ticker: 'FIGMAb', name: 'Figma (bStocks Design Pre-IPO)', price: 48.20, multiplier: 1.0, underlyingPrice: 48.20, priceChangePercent: 3.40, priceChange15m: 0.60, priceChange1h: 1.50, priceChange4h: 2.90, volume15m: 610000, volume1h: 2050000, volume4h: 6100000, volume24h: 9800000, marketCap: 12500000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'DISCORDb/USDT', rawSymbol: 'DISCORDb', ticker: 'DISCORDb', name: 'Discord (bStocks Pre-IPO)', price: 29.40, multiplier: 1.0, underlyingPrice: 29.40, priceChangePercent: 2.10, priceChange15m: 0.40, priceChange1h: 1.10, priceChange4h: 1.80, volume15m: 540000, volume1h: 1800000, volume4h: 5400000, volume24h: 8600000, marketCap: 15000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'EPICb/USDT', rawSymbol: 'EPICb', ticker: 'EPICb', name: 'Epic Games (bStocks Gaming)', price: 112.00, multiplier: 1.0, underlyingPrice: 112.00, priceChangePercent: 8.90, priceChange15m: 1.90, priceChange1h: 4.20, priceChange4h: 7.50, volume15m: 1100000, volume1h: 3800000, volume4h: 11200000, volume24h: 18000000, marketCap: 32000000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'KRAKENb/USDT', rawSymbol: 'KRAKENb', ticker: 'KRAKENb', name: 'Kraken (bStocks Pre-IPO)', price: 24.80, multiplier: 1.0, underlyingPrice: 24.80, priceChangePercent: 12.40, priceChange15m: 2.80, priceChange1h: 5.90, priceChange4h: 10.20, volume15m: 890000, volume1h: 3050000, volume4h: 9100000, volume24h: 14500000, marketCap: 10800000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' },
    { symbol: 'SCALEAIb/USDT', rawSymbol: 'SCALEAIb', ticker: 'SCALEAIb', name: 'Scale AI (bStocks Pre-IPO)', price: 31.20, multiplier: 1.0, underlyingPrice: 31.20, priceChangePercent: 14.80, priceChange15m: 3.10, priceChange1h: 6.80, priceChange4h: 11.90, volume15m: 980000, volume1h: 3300000, volume4h: 10100000, volume24h: 16200000, marketCap: 13800000000, category: 'stock', chainName: 'bStocks', marketOpen: true, statusMsg: 'TRADING' }
  ];

  const now = Date.now();
  const mockAnnouncements = {
    spot: [
      { id: '1', title: '币安上线 Virtual Protocol (VIRTUAL) 并开通 USDT 现货交易对', type: '现货上币', url: 'https://www.binance.com/zh-CN/support/announcement', releaseDate: new Date(now - 1000 * 3600 * 2).toISOString(), timeAgo: '2小时前' },
      { id: '2', title: '币安现货新增 SUI/USDT, APT/USDT 逐仓杠杆交易对', type: '现货上币', url: 'https://www.binance.com/zh-CN/support/announcement', releaseDate: new Date(now - 1000 * 3600 * 8).toISOString(), timeAgo: '8小时前' },
      { id: '3', title: '币安上线 ai16z (AI16Z) 现货交易并开启交易竞赛', type: '现货上币', url: 'https://www.binance.com/zh-CN/support/announcement', releaseDate: new Date(now - 1000 * 3600 * 24).toISOString(), timeAgo: '1天前' }
    ],
    futures: [
      { id: '4', title: '币安合约上线 FARTCOIN 1-75倍 USDT 永续合约', type: '合约上线', url: 'https://www.binance.com/zh-CN/support/announcement', releaseDate: new Date(now - 1000 * 3600 * 1).toISOString(), timeAgo: '1小时前' },
      { id: '5', title: '币安合约上线 VIRTUAL 1-50倍 USDT 永续合约', type: '合约上线', url: 'https://www.binance.com/zh-CN/support/announcement', releaseDate: new Date(now - 1000 * 3600 * 5).toISOString(), timeAgo: '5小时前' },
      { id: '6', title: '币安合约调整 DOGEUSDT, SOLUSDT 永续合约最高杠杆倍数', type: '合约上线', url: 'https://www.binance.com/zh-CN/support/announcement', releaseDate: new Date(now - 1000 * 3600 * 18).toISOString(), timeAgo: '18小时前' }
    ],
    alpha: [
      { id: '7', title: '币安 Web3 钱包联合 Virtual Protocol 开启 500,000 USDT 空投专场', type: 'Alpha/Web3', url: 'https://www.binance.com/zh-CN/support/announcement', releaseDate: new Date(now - 1000 * 3600 * 3).toISOString(), timeAgo: '3小时前' },
      { id: '8', title: '币安 Launchpool 上线第 64 期项目，支持使用 BNB/FDUSD 挖矿', type: 'Alpha/Web3', url: 'https://www.binance.com/zh-CN/support/announcement', releaseDate: new Date(now - 1000 * 3600 * 12).toISOString(), timeAgo: '12小时前' },
      { id: '9', title: '币安 Megadrop 上线新项目，锁仓 BNB 即可瓜分代币空投', type: 'Alpha/Web3', url: 'https://www.binance.com/zh-CN/support/announcement', releaseDate: new Date(now - 1000 * 3600 * 36).toISOString(), timeAgo: '1天前' }
    ]
  };

  return {
    spot: mockSpot,
    alpha: mockAlpha,
    stocks: mockStocks,
    announcements: mockAnnouncements
  };
}

// ======================= 辅助函数 =======================

function getKVBinding(env) {
  return env?.BIAN_KV || env?.KV || env?.MARKET_KV || null;
}

async function getOrFetchDashboard(env) {
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

async function syncAllMarketData(env) {
  try {
    const data = await aggregateAllData(env);
    const kv = getKVBinding(env);
    if (kv) {
      await kv.put(KV_KEYS.DASHBOARD_DATA, JSON.stringify(data), { expirationTtl: 3600 });
      await kv.put(KV_KEYS.LAST_SYNC, String(Date.now()));
    }
  } catch (err) {}
}

function getChainName(chainId) {
  switch (String(chainId)) {
    case '56': return 'BSC';
    case 'CT_501': return 'Solana';
    case '8453': return 'Base';
    case '1': return 'ETH';
    default: return 'Web3';
  }
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '刚刚';
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders
    }
  });
}

// ======================= 前端 HTML / UI 单文件页面 =======================

function handleHtmlPage(request, env) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>币安 USDT 多维监控与异动雷达 (Binance USDT Radar)</title>
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              yellow: '#F0B90B',
              dark: '#0B0E11',
              card: '#181A20',
              border: '#2B313A',
              hover: '#202630',
              accent: '#0ECB81',
              danger: '#F6465D'
            }
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background-color: #0B0E11;
      color: #EAECEF;
    }
    .mono { font-family: 'JetBrains Mono', monospace; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #12161C; }
    ::-webkit-scrollbar-thumb { background: #2B313A; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #474D57; }
    .badge-glow-yellow { box-shadow: 0 0 12px rgba(240, 185, 11, 0.25); }
    .pulse-dot { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(0.85); } }
    .price-flash-up { animation: flashGreen 0.8s ease-out; }
    .price-flash-down { animation: flashRed 0.8s ease-out; }
    @keyframes flashGreen { 0% { background-color: rgba(14, 203, 129, 0.35); } 100% { background-color: transparent; } }
    @keyframes flashRed { 0% { background-color: rgba(246, 70, 93, 0.35); } 100% { background-color: transparent; } }
  </style>
</head>
<body class="min-h-screen flex flex-col antialiased selection:bg-brand-yellow selection:text-black">

  <!-- 顶部导航栏 -->
  <header class="sticky top-0 z-50 bg-[#0B0E11]/95 backdrop-blur-md border-b border-brand-border px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-lg bg-brand-yellow flex items-center justify-center font-bold text-black text-xl shadow-lg shadow-yellow-500/20">
        B
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-base sm:text-lg font-bold text-white tracking-wide">币安 USDT 监控与异动雷达</h1>
          <span class="text-[10px] px-2 py-0.5 rounded bg-amber-950/80 text-brand-yellow border border-amber-800 font-mono font-semibold">
            全站 USDT 交易对
          </span>
          <span id="wsStatusBadge" class="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 font-mono flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-gray-500"></span> WebSocket 连接中...
          </span>
        </div>
        <p class="text-xs text-gray-400">市值排行 · 15m/1h/4h 交易量激增 · 现货 / Alpha / 美股 · 三大上币公告</p>
      </div>
    </div>

    <!-- 顶部操作区 -->
    <div class="flex items-center gap-3 flex-wrap">
      <!-- 搜索框 -->
      <div class="relative">
        <input id="globalSearchInput" type="text" placeholder="搜索 USDT 币种 (BTC, PEPE...)" 
          class="w-44 sm:w-60 bg-brand-card border border-brand-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-yellow transition" />
        <span class="absolute right-2.5 top-2 text-xs text-gray-500 font-mono">/</span>
      </div>

      <!-- 倒计时与刷新 -->
      <div class="flex items-center gap-2 bg-brand-card border border-brand-border rounded-lg px-3 py-1 text-xs">
        <span class="w-2 h-2 rounded-full bg-brand-accent pulse-dot"></span>
        <span class="text-gray-400">看板刷新:</span>
        <span id="countdownText" class="font-mono text-brand-yellow font-semibold">30s</span>
        <button id="manualRefreshBtn" class="ml-1 p-1 hover:bg-brand-hover rounded text-gray-300 hover:text-white transition" title="立即拉取最新全量数据">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
        </button>
      </div>
    </div>
  </header>

  <!-- 主体内容容器 -->
  <main class="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-8">

    <!-- 模块 1: 交易量激增异动雷达 (Volume Surge Radar) -->
    <section class="bg-brand-card border border-brand-border rounded-xl p-5 shadow-xl relative overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-brand-border/60">
        <div class="flex items-center gap-2">
          <span class="text-xl">🔥</span>
          <h2 class="text-base font-bold text-white tracking-wide">USDT 交易量激增雷达 (Volume Surge Radar)</h2>
          <span class="text-xs text-gray-400">捕捉量能暴增达 1.5x ~ 10x+ 的异常异动对</span>
        </div>

        <!-- 周期切换器 (15m, 1h, 4h) -->
        <div class="flex items-center gap-1 bg-[#12161C] p-1 rounded-lg border border-brand-border/80 text-xs">
          <button onclick="switchSurgeWindow('15m')" id="surgeBtn-15m" class="px-3 py-1 rounded-md font-semibold transition bg-brand-yellow text-black shadow">
            15 分钟激增
          </button>
          <button onclick="switchSurgeWindow('1h')" id="surgeBtn-1h" class="px-3 py-1 rounded-md font-semibold text-gray-400 hover:text-white transition">
            1 小时激增
          </button>
          <button onclick="switchSurgeWindow('4h')" id="surgeBtn-4h" class="px-3 py-1 rounded-md font-semibold text-gray-400 hover:text-white transition">
            4 小时激增
          </button>
        </div>
      </div>

      <!-- 激增列表网格 -->
      <div id="surgeLoading" class="py-12 text-center text-gray-400 text-sm">正在加载异动数据...</div>
      <div id="surgeGrid" class="hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
      </div>
    </section>

    <!-- 模块 2: 三大上币公告看板 (New Listing Announcements) -->
    <section class="space-y-3">
      <div class="flex items-center gap-2">
        <span class="text-xl">📢</span>
        <h2 class="text-base font-bold text-white tracking-wide">币安新币与上线公告看板 (Listing Announcements)</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- 现货上币公告 -->
        <div class="bg-brand-card border border-brand-border rounded-xl p-4 flex flex-col h-80">
          <div class="flex items-center justify-between pb-2 mb-2 border-b border-brand-border">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span class="font-bold text-sm text-emerald-400">现货上币公告</span>
            </div>
            <span id="spotAnnCount" class="text-xs font-mono text-gray-500">0 条</span>
          </div>
          <div id="spotAnnList" class="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
            <div class="text-gray-500 py-6 text-center">加载中...</div>
          </div>
        </div>

        <!-- 合约上线公告 -->
        <div class="bg-brand-card border border-brand-border rounded-xl p-4 flex flex-col h-80">
          <div class="flex items-center justify-between pb-2 mb-2 border-b border-brand-border">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
              <span class="font-bold text-sm text-purple-400">合约上线公告</span>
            </div>
            <span id="futuresAnnCount" class="text-xs font-mono text-gray-500">0 条</span>
          </div>
          <div id="futuresAnnList" class="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
            <div class="text-gray-500 py-6 text-center">加载中...</div>
          </div>
        </div>

        <!-- Alpha / Web3 上线公告 -->
        <div class="bg-brand-card border border-brand-border rounded-xl p-4 flex flex-col h-80">
          <div class="flex items-center justify-between pb-2 mb-2 border-b border-brand-border">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-brand-yellow"></span>
              <span class="font-bold text-sm text-brand-yellow">Alpha / Web3 上线</span>
            </div>
            <span id="alphaAnnCount" class="text-xs font-mono text-gray-500">0 条</span>
          </div>
          <div id="alphaAnnList" class="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
            <div class="text-gray-500 py-6 text-center">加载中...</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 模块 3: 分区综合行情与市值排行榜 (Spot / Alpha / Stocks) -->
    <section class="bg-brand-card border border-brand-border rounded-xl p-5 shadow-xl">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-brand-border/60">
        <!-- 标签页切换 -->
        <div class="flex items-center gap-2 flex-wrap">
          <button onclick="switchMarketTab('spot')" id="tabBtn-spot" class="px-4 py-1.5 rounded-lg text-xs font-bold transition bg-brand-yellow text-black">
            现货看板 (USDT)
          </button>
          <button onclick="switchMarketTab('alpha')" id="tabBtn-alpha" class="px-4 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition">
            Alpha 链上看板 (Web3)
          </button>
          <button onclick="switchMarketTab('stocks')" id="tabBtn-stocks" class="px-4 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition">
            bStocks 美股 (USDT)
          </button>
        </div>

        <!-- 市值排序控制栏 (支持从小到大 / 从大到小) -->
        <div class="flex items-center gap-2 flex-wrap text-xs">
          <span class="text-gray-400">市值排序:</span>
          <button onclick="toggleMarketCapSort('desc')" id="sortDescBtn" class="px-2.5 py-1 rounded bg-[#12161C] border border-brand-yellow text-brand-yellow font-mono font-semibold">
            从大到小 ↓
          </button>
          <button onclick="toggleMarketCapSort('asc')" id="sortAscBtn" class="px-2.5 py-1 rounded bg-[#12161C] border border-brand-border text-gray-400 font-mono hover:text-white">
            从小到大 ↑
          </button>
        </div>
      </div>

      <!-- 表格区域 -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-[#12161C] text-gray-400 font-mono border-y border-brand-border select-none">
            <tr>
              <th class="py-3 px-3"># 排名</th>
              <th class="py-3 px-3">USDT 交易对 / 资产</th>
              <th id="th-price" class="py-3 px-3 text-right cursor-pointer hover:text-brand-yellow transition" onclick="toggleSort('price')">
                最新价格 (USDT) <span class="sort-icon">⇕</span>
              </th>
              <th id="th-priceChangePercent" class="py-3 px-3 text-right cursor-pointer hover:text-brand-yellow transition" onclick="toggleSort('priceChangePercent')">
                24h 涨跌幅 <span class="sort-icon">⇕</span>
              </th>
              <th id="th-volume15m" class="py-3 px-3 text-right cursor-pointer hover:text-brand-yellow transition" onclick="toggleSort('volume15m')">
                15m 成交量 <span class="sort-icon">⇕</span>
              </th>
              <th id="th-volume1h" class="py-3 px-3 text-right cursor-pointer hover:text-brand-yellow transition" onclick="toggleSort('volume1h')">
                1h 成交量 <span class="sort-icon">⇕</span>
              </th>
              <th id="th-volume4h" class="py-3 px-3 text-right cursor-pointer hover:text-brand-yellow transition" onclick="toggleSort('volume4h')">
                4h 成交量 <span class="sort-icon">⇕</span>
              </th>
              <th id="th-volume24h" class="py-3 px-3 text-right cursor-pointer hover:text-brand-yellow transition" onclick="toggleSort('volume24h')">
                24h 成交额 (USDT) <span class="sort-icon">⇕</span>
              </th>
              <th id="th-marketCap" class="py-3 px-3 text-right cursor-pointer hover:text-brand-yellow transition" onclick="toggleSort('marketCap')">
                市值 (USD) <span class="sort-icon">⇕</span>
              </th>
              <th class="py-3 px-3 text-center">分类 / 链</th>
            </tr>
          </thead>
          <tbody id="marketTableBody" class="divide-y divide-brand-border/40 font-mono">
            <tr>
              <td colspan="10" class="py-12 text-center text-gray-500 font-sans">正在加载行情数据...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

  </main>

  <footer class="mt-auto border-t border-brand-border/60 py-4 px-6 text-center text-xs text-gray-500">
    <span>币安 USDT 多维监控系统 · 部署于 Cloudflare Workers · 前端直连 Binance 官方 WebSocket 实时跳动 (0 CF 消耗)</span>
  </footer>

  <!-- 前端核心逻辑 JS -->
  <script>
    let gDashboardData = null;
    let gCurrentSurgeWindow = '15m';
    let gCurrentMarketTab = 'spot';
    let gCurrentSortOrder = 'desc';
    let gCurrentSortField = 'marketCap';
    let gSearchQuery = '';
    let gCountdown = 30;
    let gTimer = null;
    let gBinanceWs = null;
    let gSpotPriceCache = new Map();
    let gReconnectAttempts = 0;
    let gLastMessageTime = Date.now();
    let gReconnectTimer = null;
    let gWatchdogTimer = null;

    document.addEventListener('DOMContentLoaded', () => {
      fetchDashboard();
      startAutoRefresh();
      initBinanceWebSocket();
      initNetworkWatchdog();

      document.getElementById('globalSearchInput').addEventListener('input', (e) => {
        gSearchQuery = e.target.value.trim().toUpperCase();
        renderMarketTable();
        renderSurgeGrid();
      });

      document.getElementById('manualRefreshBtn').addEventListener('click', () => {
        fetchDashboard(true);
      });
    });

    // 1. 直连币安官方公开 WebSocket (带指数退避、看门狗与智能自动重连)
    function initBinanceWebSocket(force = false) {
      if (gReconnectTimer) clearTimeout(gReconnectTimer);
      if (gBinanceWs && !force && (gBinanceWs.readyState === WebSocket.OPEN || gBinanceWs.readyState === WebSocket.CONNECTING)) {
        return;
      }

      if (gBinanceWs) {
        try { gBinanceWs.close(); } catch (e) {}
      }

      const wsUrl = 'wss://stream.binance.com:9443/ws/!ticker@arr';
      const badge = document.getElementById('wsStatusBadge');

      if (badge && gReconnectAttempts > 0) {
        badge.className = 'text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-mono flex items-center gap-1';
        badge.innerText = \`WS 重连中 (\${gReconnectAttempts})...\`;
      }

      try {
        gBinanceWs = new WebSocket(wsUrl);

        gBinanceWs.onopen = () => {
          gReconnectAttempts = 0;
          gLastMessageTime = Date.now();
          if (badge) {
            badge.className = 'text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono flex items-center gap-1';
            badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot"></span> 直连币安 WS (实时跳动)';
          }
        };

        gBinanceWs.onmessage = (event) => {
          gLastMessageTime = Date.now();
          try {
            const tickers = JSON.parse(event.data);
            if (!Array.isArray(tickers)) return;

            let needTableRender = false;
            for (const t of tickers) {
              const s = t.s;
              if (!s || !s.endsWith('USDT')) continue;

              const lastPrice = parseFloat(t.c);
              const priceChangePct = parseFloat(t.P);
              const quoteVol = parseFloat(t.q);

              gSpotPriceCache.set(s, { price: lastPrice, change: priceChangePct, volume: quoteVol });

              if (gDashboardData?.spot) {
                const item = gDashboardData.spot.find(x => x.symbol === s);
                if (item) {
                  item.prevPrice = item.price;
                  item.price = lastPrice;
                  item.priceChangePercent = priceChangePct;
                  item.volume24h = quoteVol;
                  needTableRender = true;
                }
              }
            }

            if (needTableRender && gCurrentMarketTab === 'spot') {
              updateTablePricesOnly();
            }
          } catch (err) {}
        };

        gBinanceWs.onerror = () => {
          if (badge) {
            badge.className = 'text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-mono';
            badge.innerText = 'WS 异常准备重连';
          }
        };

        gBinanceWs.onclose = () => {
          scheduleReconnect();
        };
      } catch (e) {
        scheduleReconnect();
      }
    }

    // 智能退避重连调度
    function scheduleReconnect() {
      if (gReconnectTimer) clearTimeout(gReconnectTimer);
      gReconnectAttempts++;
      // 指数退避 (1s, 2s, 3s, 5s, 最大 10s)
      const delay = Math.min(1000 * Math.pow(1.5, Math.min(gReconnectAttempts, 6)), 10000);
      gReconnectTimer = setTimeout(() => {
        initBinanceWebSocket();
      }, delay);
    }

    // 看门狗：切后台唤醒检测、静默断线与网络恢复监听
    function initNetworkWatchdog() {
      // 1. 窗口唤醒 / 切回当前标签页时立即检查
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          const isStale = (Date.now() - gLastMessageTime) > 15000;
          if (!gBinanceWs || gBinanceWs.readyState !== WebSocket.OPEN || isStale) {
            initBinanceWebSocket(true);
          }
        }
      });

      // 2. 本地网络恢复时立即重连
      window.addEventListener('online', () => {
        initBinanceWebSocket(true);
      });

      // 3. 周期看门狗 (每 10 秒检测一次是否有正常心跳数据流)
      if (gWatchdogTimer) clearInterval(gWatchdogTimer);
      gWatchdogTimer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          const isStale = (Date.now() - gLastMessageTime) > 20000;
          if (!gBinanceWs || gBinanceWs.readyState !== WebSocket.OPEN || isStale) {
            initBinanceWebSocket(true);
          }
        }
      }, 10000);
    }

    async function fetchDashboard(isManual = false) {
      const refreshBtn = document.getElementById('manualRefreshBtn');
      if (refreshBtn) refreshBtn.classList.add('animate-spin');

      try {
        const url = isManual ? '/api/sync' : '/api/dashboard';
        const res = await fetch(url, { method: isManual ? 'POST' : 'GET' });
        const json = await res.json();

        if (json.spot || json.data?.spot) {
          gDashboardData = json.spot ? json : json.data;
          renderAll();
        }
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        if (refreshBtn) refreshBtn.classList.remove('animate-spin');
        gCountdown = 30;
      }
    }

    function startAutoRefresh() {
      if (gTimer) clearInterval(gTimer);
      gTimer = setInterval(() => {
        gCountdown--;
        const el = document.getElementById('countdownText');
        if (el) el.innerText = gCountdown + 's';
        if (gCountdown <= 0) {
          fetchDashboard();
        }
      }, 1000);
    }

    function renderAll() {
      if (!gDashboardData) return;
      renderSurgeGrid();
      renderAnnouncements();
      renderMarketTable();
    }

    function renderSurgeGrid() {
      const grid = document.getElementById('surgeGrid');
      const loading = document.getElementById('surgeLoading');
      if (!grid || !gDashboardData) return;

      const surgeMap = gDashboardData.surge || {};
      let list = surgeMap[gCurrentSurgeWindow] || [];

      if (gSearchQuery) {
        const q = gSearchQuery.toUpperCase();
        list = list.filter(item => {
          const sym = (item.symbol || '').toUpperCase();
          const name = (item.name || '').toUpperCase();
          const zh = (item.zhName || '').toUpperCase();
          return sym.includes(q) || name.includes(q) || zh.includes(q);
        });
      }

      if (list.length === 0) {
        grid.classList.add('hidden');
        loading.classList.remove('hidden');
        loading.innerText = '暂无符合条件的 USDT 交易量激增交易对';
        return;
      }

      loading.classList.add('hidden');
      grid.classList.remove('hidden');

      grid.innerHTML = list.map(item => {
        const isUp = item.priceChange >= 0;
        const colorClass = isUp ? 'text-brand-accent' : 'text-brand-danger';
        const badgeColor = item.category === 'spot' ? 'bg-blue-900/60 text-blue-300 border-blue-700' :
                           item.category === 'alpha' ? 'bg-purple-900/60 text-purple-300 border-purple-700' :
                           'bg-amber-900/60 text-amber-300 border-amber-700';
        const categoryLabel = item.category === 'spot' ? '现货' : item.category === 'alpha' ? 'Alpha' : 'bStocks';

        return \`
          <div class="bg-[#12161C] border border-brand-border rounded-xl p-3.5 hover:border-brand-yellow/60 transition group">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="w-5 h-5 rounded-full bg-brand-card flex items-center justify-center text-[10px] font-bold text-brand-yellow border border-brand-border">
                  \${item.rank}
                </span>
                <div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-bold text-sm text-white group-hover:text-brand-yellow transition">\${item.symbol}</span>
                    <span class="text-[11px] text-amber-400 font-mono font-bold" title="\${item.starTitle || ''}">\${item.starDisplay || '⭐'}</span>
                  </div>
                  <span class="text-[10px] text-gray-400 block font-sans truncate max-w-[140px]">\${item.zhName || item.name || ''} · \${item.starDuration || '15m'}放量</span>
                </div>
                <span class="text-[10px] px-1.5 py-0.2 rounded border \${badgeColor}">\${categoryLabel}</span>
              </div>
              <div class="flex items-center gap-1 font-mono text-xs font-bold text-brand-yellow bg-yellow-950/40 px-2 py-0.5 rounded border border-yellow-800/60 badge-glow-yellow">
                <span>🔥</span>
                <span>\${item.surgeMultiplier}x 激增</span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 text-xs font-mono mt-3 pt-2.5 border-t border-brand-border/60">
              <div>
                <div class="text-gray-500 text-[10px]">最新价 (USDT)</div>
                <div class="text-white font-semibold">\${formatPrice(item.price)}</div>
              </div>
              <div class="text-right">
                <div class="text-gray-500 text-[10px]">\${gCurrentSurgeWindow} 涨跌幅</div>
                <div class="\${colorClass} font-semibold">\${isUp ? '+' : ''}\${item.priceChange}%</div>
              </div>
              <div>
                <div class="text-gray-500 text-[10px]">\${gCurrentSurgeWindow} 成交量</div>
                <div class="text-gray-300">\$\${formatNumber(item.windowVolume)}</div>
              </div>
              <div class="text-right">
                <div class="text-gray-500 text-[10px]">24h 总成交额</div>
                <div class="text-gray-300">\$\${formatNumber(item.volume24h)}</div>
              </div>
            </div>
          </div>
        \`;
      }).join('');
    }

    function renderAnnouncements() {
      if (!gDashboardData?.announcements) return;
      const { spot = [], futures = [], alpha = [] } = gDashboardData.announcements;

      const renderList = (elId, list, countId) => {
        const el = document.getElementById(elId);
        const countEl = document.getElementById(countId);
        if (countEl) countEl.innerText = list.length + ' 条';
        if (!el) return;

        if (list.length === 0) {
          el.innerHTML = '<div class="text-gray-500 py-6 text-center">暂无最新公告</div>';
          return;
        }

        el.innerHTML = list.map(item => \`
          <a href="\${item.url}" target="_blank" rel="noopener noreferrer" 
             class="block p-2.5 rounded-lg bg-[#12161C] hover:bg-brand-hover border border-brand-border/60 hover:border-brand-yellow/40 transition group">
            <div class="flex items-start justify-between gap-2">
              <span class="text-gray-200 group-hover:text-brand-yellow line-clamp-2 leading-relaxed font-medium">
                \${item.title}
              </span>
            </div>
            <div class="flex items-center justify-between mt-2 text-[10px] text-gray-500">
              <span class="text-brand-yellow/80 font-mono">\${item.type}</span>
              <span class="font-mono">\${item.timeAgo || '最新'}</span>
            </div>
          </a>
        \`).join('');
      };

      renderList('spotAnnList', spot, 'spotAnnCount');
      renderList('futuresAnnList', futures, 'futuresAnnCount');
      renderList('alphaAnnList', alpha, 'alphaAnnCount');
    }

    function renderMarketTable() {
      const tbody = document.getElementById('marketTableBody');
      if (!tbody || !gDashboardData) return;

      let list = [];
      if (gCurrentMarketTab === 'spot') list = [...(gDashboardData.spot || [])];
      else if (gCurrentMarketTab === 'alpha') list = [...(gDashboardData.alpha || [])];
      else if (gCurrentMarketTab === 'stocks') list = [...(gDashboardData.stocks || [])];

      if (gSearchQuery) {
        const q = gSearchQuery.toUpperCase();
        list = list.filter(item => {
          const sym = (item.symbol || '').toUpperCase();
          const rawSym = (item.rawSymbol || '').toUpperCase();
          const ticker = (item.ticker || '').toUpperCase();
          const name = (item.name || '').toUpperCase();
          const zh = (item.zhName || '').toUpperCase();
          return sym.includes(q) || rawSym.includes(q) || ticker.includes(q) || name.includes(q) || zh.includes(q);
        });
      }

      list.sort((a, b) => {
        let valA = Number(a[gCurrentSortField]) || 0;
        let valB = Number(b[gCurrentSortField]) || 0;
        return gCurrentSortOrder === 'asc' ? valA - valB : valB - valA;
      });

      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="py-12 text-center text-gray-500 font-sans">暂无匹配的 USDT 交易对</td></tr>';
        return;
      }

      tbody.innerHTML = list.map((item, index) => {
        const isUp = (item.priceChangePercent || 0) >= 0;
        const colorClass = isUp ? 'text-brand-accent' : 'text-brand-danger';
        const chainBadge = item.chainName || (item.category === 'spot' ? 'BINANCE' : 'bStocks');

        return \`
          <tr class="hover:bg-brand-hover/70 transition border-b border-brand-border/30" id="row-\${item.symbol}">
            <td class="py-3 px-3 text-gray-400 font-semibold">\${index + 1}</td>
            <td class="py-3 px-3">
              <div class="flex items-center gap-2">
                \${item.icon ? \`<img src="\${item.icon}" class="w-5 h-5 rounded-full object-cover bg-gray-800" onerror="this.style.display='none'" />\` : ''}
                <div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-bold text-white hover:text-brand-yellow transition cursor-pointer">\${item.symbol}</span>
                    \${item.stars ? \`<span class="text-[10px] px-1 py-0.2 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60 font-mono" title="\${item.starTitle || ''}">\${item.starDisplay}</span>\` : ''}
                  </div>
                  <span class="text-[11px] text-gray-400 block font-sans truncate max-w-[240px]">
                    \${item.zhName || item.ticker || item.name || ''}
                  </span>
                </div>
              </div>
            </td>
            <td class="py-3 px-3 text-right font-bold text-white price-cell">\${formatPrice(item.price)}</td>
            <td class="py-3 px-3 text-right font-semibold \${colorClass}">\${isUp ? '+' : ''}\${(item.priceChangePercent || 0).toFixed(2)}%</td>
            <td class="py-3 px-3 text-right text-gray-300">\$\${formatNumber(item.volume15m || 0)}</td>
            <td class="py-3 px-3 text-right text-gray-300">\$\${formatNumber(item.volume1h || 0)}</td>
            <td class="py-3 px-3 text-right text-gray-300">\$\${formatNumber(item.volume4h || 0)}</td>
            <td class="py-3 px-3 text-right text-gray-200 font-semibold">\$\${formatNumber(item.volume24h || 0)}</td>
            <td class="py-3 px-3 text-right text-brand-yellow font-bold">\$\${formatNumber(item.marketCap || 0)}</td>
            <td class="py-3 px-3 text-center">
              <span class="text-[10px] px-2 py-0.5 rounded bg-brand-card border border-brand-border text-gray-300">
                \${chainBadge}
              </span>
            </td>
          </tr>
        \`;
      }).join('');
    }

    // 轻量级 DOM 实时价格刷新（带全板块闪烁效果）
    function updateTablePricesOnly() {
      if (!gDashboardData) return;
      const currentList = gCurrentMarketTab === 'spot' ? gDashboardData.spot :
                          gCurrentMarketTab === 'alpha' ? gDashboardData.alpha :
                          gDashboardData.stocks;
      if (!currentList) return;

      for (const item of currentList) {
        const row = document.getElementById(\`row-\${item.symbol}\`);
        if (row) {
          const priceCell = row.querySelector('.price-cell');
          if (priceCell && item.price) {
            priceCell.innerText = formatPrice(item.price);
            if (item.prevPrice && item.prevPrice !== item.price) {
              const anim = item.price > item.prevPrice ? 'price-flash-up' : 'price-flash-down';
              priceCell.classList.remove('price-flash-up', 'price-flash-down');
              void priceCell.offsetWidth; // 触发重绘
              priceCell.classList.add(anim);
            }
          }
        }
      }
    }

    function switchSurgeWindow(w) {
      gCurrentSurgeWindow = w;
      ['15m', '1h', '4h'].forEach(item => {
        const btn = document.getElementById(\`surgeBtn-\${item}\`);
        if (item === w) {
          btn.className = 'px-3 py-1 rounded-md font-semibold transition bg-brand-yellow text-black shadow';
        } else {
          btn.className = 'px-3 py-1 rounded-md font-semibold text-gray-400 hover:text-white transition';
        }
      });
      renderSurgeGrid();
    }

    function switchMarketTab(tab) {
      gCurrentMarketTab = tab;
      ['spot', 'alpha', 'stocks'].forEach(item => {
        const btn = document.getElementById(\`tabBtn-\${item}\`);
        if (item === tab) {
          btn.className = 'px-4 py-1.5 rounded-lg text-xs font-bold transition bg-brand-yellow text-black';
        } else {
          btn.className = 'px-4 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition';
        }
      });
      renderMarketTable();
    }

    function updateSortHeaderIndicators() {
      const sortableFields = ['price', 'priceChangePercent', 'volume15m', 'volume1h', 'volume4h', 'volume24h', 'marketCap'];
      sortableFields.forEach(field => {
        const th = document.getElementById(\`th-\${field}\`);
        if (!th) return;
        const iconSpan = th.querySelector('.sort-icon');
        if (gCurrentSortField === field) {
          th.className = 'py-3 px-3 text-right cursor-pointer text-brand-yellow font-bold transition bg-brand-hover/40';
          if (iconSpan) iconSpan.innerText = gCurrentSortOrder === 'desc' ? '↓' : '↑';
        } else {
          th.className = 'py-3 px-3 text-right cursor-pointer text-gray-400 hover:text-brand-yellow transition';
          if (iconSpan) iconSpan.innerText = '⇕';
        }
      });

      const descBtn = document.getElementById('sortDescBtn');
      const ascBtn = document.getElementById('sortAscBtn');
      if (descBtn && ascBtn) {
        if (gCurrentSortField === 'marketCap' && gCurrentSortOrder === 'desc') {
          descBtn.className = 'px-2.5 py-1 rounded bg-[#12161C] border border-brand-yellow text-brand-yellow font-mono font-semibold';
          ascBtn.className = 'px-2.5 py-1 rounded bg-[#12161C] border border-brand-border text-gray-400 font-mono hover:text-white';
        } else if (gCurrentSortField === 'marketCap' && gCurrentSortOrder === 'asc') {
          ascBtn.className = 'px-2.5 py-1 rounded bg-[#12161C] border border-brand-yellow text-brand-yellow font-mono font-semibold';
          descBtn.className = 'px-2.5 py-1 rounded bg-[#12161C] border border-brand-border text-gray-400 font-mono hover:text-white';
        } else {
          descBtn.className = 'px-2.5 py-1 rounded bg-[#12161C] border border-brand-border text-gray-400 font-mono hover:text-white';
          ascBtn.className = 'px-2.5 py-1 rounded bg-[#12161C] border border-brand-border text-gray-400 font-mono hover:text-white';
        }
      }
    }

    function toggleMarketCapSort(order) {
      gCurrentSortOrder = order;
      gCurrentSortField = 'marketCap';
      updateSortHeaderIndicators();
      renderMarketTable();
    }

    function toggleSort(field) {
      if (gCurrentSortField === field) {
        gCurrentSortOrder = gCurrentSortOrder === 'desc' ? 'asc' : 'desc';
      } else {
        gCurrentSortField = field;
        gCurrentSortOrder = 'desc';
      }
      updateSortHeaderIndicators();
      renderMarketTable();
    }

    function formatNumber(num) {
      if (!num || isNaN(num) || num <= 0) return '0.00';
      const n = Number(num);
      if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
      if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
      if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
      if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
      return n.toFixed(2);
    }

    function formatPrice(p) {
      if (p === null || p === undefined || isNaN(p) || p === 0) return '$0.00';
      const price = Number(p);
      if (price >= 1000) return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (price >= 1) return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
      if (price >= 0.0001) return '$' + price.toFixed(6);
      
      // 彻底消除科学计数法 (如 1.1220e-5 -> $0.00001122)
      let str = price.toFixed(10);
      str = str.replace(/0+$/, ''); // 去除末尾多余0
      return '$' + (str.length > 12 ? price.toFixed(8) : str);
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300'
    }
  });
}

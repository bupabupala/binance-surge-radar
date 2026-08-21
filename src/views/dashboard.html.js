/**
 * 币安行情与异动雷达主看板视图 (/)
 */

import { htmlResponse } from '../utils/response.js';

export function renderDashboardPage(authRole = 'guest') {
  const isAdmin = authRole === 'admin';
  const adminEntranceHtml = isAdmin 
    ? `<a href="/admin" class="px-2.5 py-1.5 rounded-lg bg-[#12161C] border border-brand-yellow/60 text-brand-yellow hover:bg-brand-yellow hover:text-black font-semibold text-xs transition flex items-center gap-1 shadow-sm">
        <span>⚙️</span>
        <span>管理后台</span>
      </a>`
    : '';

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
        <input id="globalSearchInput" type="text" placeholder="搜索资产 / 币种 (BTC, SpaceX, 比特币...)" 
          class="w-48 sm:w-64 bg-brand-card border border-brand-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-yellow transition" />
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

      <!-- 管理后台入口 (仅管理员可见) -->
      ${adminEntranceHtml}

      <!-- 退出登录按钮 -->
      <a href="/logout" class="px-2.5 py-1.5 rounded-lg bg-[#12161C] border border-brand-border text-gray-400 hover:text-white hover:border-gray-500 text-xs transition flex items-center gap-1" title="退出登录">
        <span>🚪</span>
        <span>退出</span>
      </a>
    </div>
  </header>

  <!-- 主体内容容器 -->
  <main class="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-8">

    <!-- 模块 1: 交易量激增异动雷达 (Volume Surge Radar) -->
    <section class="bg-brand-card border border-brand-border rounded-xl p-5 shadow-xl relative overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-brand-border/60">
        <div class="flex items-center gap-2">
          <span class="text-xl">🔥</span>
          <h2 class="text-base font-bold text-white tracking-wide">交易量激增雷达 (Volume Surge Radar)</h2>
          <span class="text-xs text-gray-400">捕捉量能暴增达 1.5x ~ 10x+ 的异常放量资产</span>
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

    <!-- 模块 3: 分区综合行情与市值排行榜 (Spot / Alpha / Stocks / Watchlist) -->
    <section class="bg-brand-card border border-brand-border rounded-xl p-5 shadow-xl">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-brand-border/60">
        <!-- 标签页切换 -->
        <div class="flex items-center gap-2 flex-wrap">
          <button onclick="switchMarketTab('spot')" id="tabBtn-spot" class="px-4 py-1.5 rounded-lg text-xs font-bold transition bg-brand-yellow text-black">
            现货看板
          </button>
          <button onclick="switchMarketTab('alpha')" id="tabBtn-alpha" class="px-4 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition">
            Alpha 链上看板 (Web3)
          </button>
          <button onclick="switchMarketTab('stocks')" id="tabBtn-stocks" class="px-4 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition">
            bStocks 美股
          </button>
          <button onclick="switchMarketTab('watchlist')" id="tabBtn-watchlist" class="px-4 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition flex items-center gap-1.5">
            <span>⭐</span>
            <span>我的自选</span>
            <span id="watchlistCountBadge" class="px-1.5 py-0.2 rounded-full text-[10px] bg-brand-border text-gray-300">0</span>
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
              <th class="py-3 px-3">资产 / 代币</th>
              <th id="th-price" class="py-3 px-3 text-right cursor-pointer hover:text-brand-yellow transition" onclick="toggleSort('price')">
                最新价格 <span class="sort-icon">⇕</span>
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
                24h 成交额 <span class="sort-icon">⇕</span>
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

  <!-- 底部状态栏 -->
  <footer class="border-t border-brand-border/80 bg-[#0B0E11] px-4 lg:px-8 py-3 text-xs text-gray-500 flex flex-wrap items-center justify-between gap-4 mt-auto">
    <div class="flex items-center gap-4">
      <span class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
        <span class="text-gray-400">Edge 聚合引擎: 正常运行</span>
      </span>
      <span>数据源: Binance CEX WebSocket + Web3 Pulse Index</span>
    </div>
    <div class="flex items-center gap-3 font-mono">
      <span id="lastUpdatedText">数据同步中...</span>
    </div>
  </footer>

  <!-- 前端逻辑脚本 -->
  <script>
    const IS_ADMIN = ${isAdmin ? 'true' : 'false'};
    let gDashboardData = null;
    let gCurrentSurgeWindow = '15m';
    let gCurrentMarketTab = 'spot';
    let gMarketCapSort = 'desc';
    let gCurrentSortField = 'marketCap';
    let gCurrentSortOrder = 'desc';
    let gSearchQuery = '';
    let gCountdown = 30;
    let gCountdownTimer = null;
    let gWs = null;
    let gWsReconnectAttempts = 0;
    let gWsWatchdogTimer = null;
    let gLastWsMessageTime = Date.now();
    let gWatchlist = [];

    function formatPrice(val) {
      const p = Number(val);
      if (isNaN(p) || p === 0) return '0.00';
      if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (p >= 1) return p.toFixed(2);
      if (p >= 0.0001) return p.toFixed(4);
      return p.toFixed(8);
    }

    function formatNumber(num) {
      const n = Number(num);
      if (isNaN(n) || n === 0) return '0.00';
      if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
      if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
      if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
      return n.toFixed(2);
    }

    async function loadWatchlist() {
      try {
        const saved = localStorage.getItem('bian_watchlist');
        if (saved) {
          gWatchlist = JSON.parse(saved);
        } else {
          gWatchlist = ['BTC', 'ETH', 'SOL', 'SPACEXb', 'SANDKb'];
        }
      } catch (e) {
        gWatchlist = ['BTC', 'ETH', 'SOL'];
      }
      updateWatchlistBadge();
    }

    function updateWatchlistBadge() {
      const badge = document.getElementById('watchlistCountBadge');
      if (badge) badge.innerText = (gWatchlist || []).length;
    }

    async function toggleWatchlist(sym) {
      const cleanSym = String(sym).toUpperCase().replace(/(\/USDT|USDT)$/i, '');
      if (!cleanSym) return;

      const idx = gWatchlist.indexOf(cleanSym);
      if (idx >= 0) {
        gWatchlist.splice(idx, 1);
      } else {
        gWatchlist.push(cleanSym);
      }

      localStorage.setItem('bian_watchlist', JSON.stringify(gWatchlist));
      updateWatchlistBadge();

      if (IS_ADMIN) {
        fetch('/api/admin/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ watchlist: gWatchlist })
        }).catch(() => {});
      }

      renderMarketTable();
    }

    async function fetchDashboardData(silent = false) {
      try {
        if (!silent) {
          document.getElementById('countdownText').innerText = '拉取中...';
        }
        const res = await fetch('/api/dashboard');
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        const data = await res.json();
        gDashboardData = data;
        renderAll();
        resetCountdown();
      } catch (err) {
        console.error('Fetch dashboard failed:', err);
      }
    }

    function renderAll() {
      if (!gDashboardData) return;
      renderSurgeGrid();
      renderAnnouncements();
      renderMarketTable();
      updateSortHeaderIndicators();

      const el = document.getElementById('lastUpdatedText');
      if (el && gDashboardData.timestamp) {
        const date = new Date(gDashboardData.timestamp);
        el.innerText = '最后同步: ' + date.toLocaleTimeString('zh-CN', { hour12: false });
      }
    }

    function renderSurgeGrid() {
      const grid = document.getElementById('surgeGrid');
      const loading = document.getElementById('surgeLoading');
      if (!grid || !loading || !gDashboardData?.surge) return;

      const list = gDashboardData.surge[gCurrentSurgeWindow] || [];

      if (list.length === 0) {
        grid.classList.add('hidden');
        loading.classList.remove('hidden');
        loading.innerText = '暂无符合条件的交易量激增标的';
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
        const cleanSymbol = (item.symbol || '').replace(/(\/USDT|USDT)$/i, '');
        const cleanName = (item.zhName || item.name || '').replace(/(\/USDT|USDT)/gi, '').trim();

        return `
          <div class="bg-[#12161C] border border-brand-border rounded-xl p-3.5 hover:border-brand-yellow/60 transition group">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="w-5 h-5 rounded-full bg-brand-card flex items-center justify-center text-[10px] font-bold text-brand-yellow border border-brand-border">
                  ${item.rank}
                </span>
                <div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-bold text-sm text-white group-hover:text-brand-yellow transition">${cleanSymbol}</span>
                    <span class="text-[11px] text-amber-400 font-mono font-bold" title="${item.starTitle || ''}">${item.starDisplay || '⭐'}</span>
                  </div>
                  <span class="text-[10px] text-gray-400 block font-sans truncate max-w-[140px]">${cleanName} · ${item.starDuration || '15m'}放量</span>
                </div>
                <span class="text-[10px] px-1.5 py-0.2 rounded border ${badgeColor}">${categoryLabel}</span>
              </div>
              <div class="flex items-center gap-1 font-mono text-xs font-bold text-brand-yellow bg-yellow-950/40 px-2 py-0.5 rounded border border-yellow-800/60 badge-glow-yellow">
                <span>🔥</span>
                <span>${item.surgeMultiplier}x 激增</span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 text-xs font-mono mt-3 pt-2.5 border-t border-brand-border/60">
              <div>
                <div class="text-gray-500 text-[10px]">最新价格</div>
                <div class="text-white font-semibold">${formatPrice(item.price)}</div>
              </div>
              <div class="text-right">
                <div class="text-gray-500 text-[10px]">${gCurrentSurgeWindow} 涨跌幅</div>
                <div class="${colorClass} font-semibold">${isUp ? '+' : ''}${item.priceChange}%</div>
              </div>
              <div>
                <div class="text-gray-500 text-[10px]">${gCurrentSurgeWindow} 成交量</div>
                <div class="text-gray-300">$${formatNumber(item.windowVolume)}</div>
              </div>
              <div class="text-right">
                <div class="text-gray-500 text-[10px]">24h 总成交额</div>
                <div class="text-gray-300">$${formatNumber(item.volume24h)}</div>
              </div>
            </div>
          </div>
        `;
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

        el.innerHTML = list.map(item => `
          <a href="${item.url}" target="_blank" rel="noopener noreferrer" 
             class="block p-2.5 rounded-lg bg-[#12161C] hover:bg-brand-hover border border-brand-border/60 hover:border-brand-yellow/40 transition group">
            <div class="flex items-start justify-between gap-2">
              <span class="text-gray-200 group-hover:text-brand-yellow line-clamp-2 leading-relaxed font-medium">
                ${item.title}
              </span>
            </div>
            <div class="flex items-center justify-between mt-2 text-[10px] text-gray-500">
              <span class="text-brand-yellow/80 font-mono">${item.type}</span>
              <span class="font-mono">${item.timeAgo || '最新'}</span>
            </div>
          </a>
        `).join('');
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
      else if (gCurrentMarketTab === 'watchlist') {
        const all = [...(gDashboardData.spot || []), ...(gDashboardData.alpha || []), ...(gDashboardData.stocks || [])];
        list = all.filter(item => {
          const sym = (item.symbol || '').replace(/(\/USDT|USDT)$/i, '').toUpperCase();
          return (gWatchlist || []).some(w => w.toUpperCase() === sym);
        });
      }

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
        tbody.innerHTML = '<tr><td colspan="10" class="py-12 text-center text-gray-500 font-sans">暂无匹配的资产</td></tr>';
        return;
      }

      tbody.innerHTML = list.map((item, index) => {
        const isUp = (item.priceChangePercent || 0) >= 0;
        const colorClass = isUp ? 'text-brand-accent' : 'text-brand-danger';
        const chainBadge = item.chainName || (item.category === 'spot' ? 'BINANCE' : 'bStocks');
        const cleanSymbol = (item.symbol || '').replace(/(\/USDT|USDT)$/i, '');
        let cleanName = item.zhName || item.ticker || item.name || '';
        cleanName = cleanName.replace(/(\/USDT|USDT)/gi, '').trim();
        const isFav = (gWatchlist || []).some(w => w.toUpperCase() === cleanSymbol.toUpperCase());

        return `
          <tr class="hover:bg-brand-hover/70 transition border-b border-brand-border/30" id="row-${item.symbol}">
            <td class="py-3 px-3 text-gray-400 font-semibold flex items-center gap-1.5">
              <button onclick="toggleWatchlist('${cleanSymbol}')" class="text-xs transition p-0.5 ${isFav ? 'text-brand-yellow font-bold' : 'text-gray-600 hover:text-gray-300'}" title="${isFav ? '已在自选，点击取消' : '点击加入自选'}">
                ${isFav ? '⭐' : '☆'}
              </button>
              <span>${index + 1}</span>
            </td>
            <td class="py-3 px-3">
              <div class="flex items-center gap-2">
                ${item.icon ? `<img src="${item.icon}" class="w-5 h-5 rounded-full object-cover bg-gray-800" onerror="this.style.display='none'" />` : ''}
                <div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-bold text-white hover:text-brand-yellow transition cursor-pointer" onclick="toggleWatchlist('${cleanSymbol}')">${cleanSymbol}</span>
                    ${item.stars ? `<span class="text-[10px] px-1 py-0.2 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60 font-mono" title="${item.starTitle || ''}">${item.starDisplay}</span>` : ''}
                  </div>
                  <span class="text-[11px] text-gray-400 block font-sans truncate max-w-[240px]">
                    ${cleanName}
                  </span>
                </div>
              </div>
            </td>
            <td class="py-3 px-3 text-right font-bold text-white price-cell">${formatPrice(item.price)}</td>
            <td class="py-3 px-3 text-right font-semibold ${colorClass}">${isUp ? '+' : ''}${(item.priceChangePercent || 0).toFixed(2)}%</td>
            <td class="py-3 px-3 text-right text-gray-300">$${formatNumber(item.volume15m || 0)}</td>
            <td class="py-3 px-3 text-right text-gray-300">$${formatNumber(item.volume1h || 0)}</td>
            <td class="py-3 px-3 text-right text-gray-300">$${formatNumber(item.volume4h || 0)}</td>
            <td class="py-3 px-3 text-right text-gray-200 font-semibold">$${formatNumber(item.volume24h || 0)}</td>
            <td class="py-3 px-3 text-right text-brand-yellow font-bold">$${formatNumber(item.marketCap || 0)}</td>
            <td class="py-3 px-3 text-center">
              <span class="text-[10px] px-2 py-0.5 rounded bg-brand-card border border-brand-border text-gray-300">
                ${chainBadge}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    }

    function updateTablePricesOnly() {
      if (!gDashboardData) return;
      let currentList = [];
      if (gCurrentMarketTab === 'spot') currentList = gDashboardData.spot;
      else if (gCurrentMarketTab === 'alpha') currentList = gDashboardData.alpha;
      else if (gCurrentMarketTab === 'stocks') currentList = gDashboardData.stocks;
      else if (gCurrentMarketTab === 'watchlist') {
        const all = [...(gDashboardData.spot || []), ...(gDashboardData.alpha || []), ...(gDashboardData.stocks || [])];
        currentList = all.filter(item => {
          const sym = (item.symbol || '').replace(/(\/USDT|USDT)$/i, '').toUpperCase();
          return (gWatchlist || []).some(w => w.toUpperCase() === sym);
        });
      }

      if (!currentList) return;

      currentList.forEach(item => {
        const row = document.getElementById('row-' + item.symbol);
        if (row) {
          const priceCell = row.querySelector('.price-cell');
          if (priceCell) {
            const formatted = formatPrice(item.price);
            if (priceCell.innerText !== formatted) {
              const oldPrice = parseFloat(priceCell.innerText.replace(/,/g, '')) || 0;
              const newPrice = item.price;
              priceCell.innerText = formatted;
              priceCell.classList.remove('price-flash-up', 'price-flash-down');
              void priceCell.offsetWidth;
              if (newPrice > oldPrice) priceCell.classList.add('price-flash-up');
              else if (newPrice < oldPrice) priceCell.classList.add('price-flash-down');
            }
          }
        }
      });
    }

    function toggleSort(field) {
      if (gCurrentSortField === field) {
        gCurrentSortOrder = gCurrentSortOrder === 'desc' ? 'asc' : 'desc';
      } else {
        gCurrentSortField = field;
        gCurrentSortOrder = 'desc';
      }

      if (field === 'marketCap') {
        gMarketCapSort = gCurrentSortOrder;
        updateMarketCapSortButtons();
      }

      renderMarketTable();
      updateSortHeaderIndicators();
    }

    function toggleMarketCapSort(order) {
      gMarketCapSort = order;
      gCurrentSortField = 'marketCap';
      gCurrentSortOrder = order;
      updateMarketCapSortButtons();
      renderMarketTable();
      updateSortHeaderIndicators();
    }

    function updateMarketCapSortButtons() {
      const descBtn = document.getElementById('sortDescBtn');
      const ascBtn = document.getElementById('sortAscBtn');
      if (descBtn && ascBtn) {
        if (gMarketCapSort === 'desc') {
          descBtn.className = 'px-2.5 py-1 rounded bg-[#12161C] border border-brand-yellow text-brand-yellow font-mono font-semibold';
          ascBtn.className = 'px-2.5 py-1 rounded bg-[#12161C] border border-brand-border text-gray-400 font-mono hover:text-white';
        } else {
          ascBtn.className = 'px-2.5 py-1 rounded bg-[#12161C] border border-brand-yellow text-brand-yellow font-mono font-semibold';
          descBtn.className = 'px-2.5 py-1 rounded bg-[#12161C] border border-brand-border text-gray-400 font-mono hover:text-white';
        }
      }
    }

    function updateSortHeaderIndicators() {
      const sortableFields = ['price', 'priceChangePercent', 'volume15m', 'volume1h', 'volume4h', 'volume24h', 'marketCap'];
      sortableFields.forEach(field => {
        const th = document.getElementById('th-' + field);
        if (!th) return;
        const iconSpan = th.querySelector('.sort-icon');
        if (gCurrentSortField === field) {
          th.classList.add('text-brand-yellow', 'font-bold');
          if (iconSpan) iconSpan.innerText = gCurrentSortOrder === 'desc' ? ' ↓' : ' ↑';
        } else {
          th.classList.remove('text-brand-yellow', 'font-bold');
          if (iconSpan) iconSpan.innerText = ' ⇕';
        }
      });
    }

    function switchSurgeWindow(w) {
      gCurrentSurgeWindow = w;
      ['15m', '1h', '4h'].forEach(item => {
        const btn = document.getElementById('surgeBtn-' + item);
        if (item === w) {
          btn.className = 'px-3 py-1 rounded-md font-semibold transition bg-brand-yellow text-black shadow';
        } else {
          btn.className = 'px-3 py-1 rounded-md font-semibold text-gray-400 hover:text-white transition';
        }
      });
      renderSurgeGrid();
    }

    function switchMarketTab(t) {
      gCurrentMarketTab = t;
      ['spot', 'alpha', 'stocks', 'watchlist'].forEach(item => {
        const btn = document.getElementById('tabBtn-' + item);
        if (!btn) return;
        if (item === t) {
          btn.className = 'px-4 py-1.5 rounded-lg text-xs font-bold transition bg-brand-yellow text-black flex items-center gap-1.5';
        } else {
          btn.className = 'px-4 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition flex items-center gap-1.5';
        }
      });
      renderMarketTable();
    }

    function resetCountdown() {
      clearInterval(gCountdownTimer);
      gCountdown = 30;
      updateCountdownDisplay();
      gCountdownTimer = setInterval(() => {
        gCountdown--;
        updateCountdownDisplay();
        if (gCountdown <= 0) {
          fetchDashboardData(true);
        }
      }, 1000);
    }

    function updateCountdownDisplay() {
      const el = document.getElementById('countdownText');
      if (el) el.innerText = gCountdown + 's';
    }

    function initWebSocket() {
      if (gWs && (gWs.readyState === WebSocket.OPEN || gWs.readyState === WebSocket.CONNECTING)) return;

      const wsUrl = 'wss://stream.binance.com:9443/ws/!ticker@arr';
      const badge = document.getElementById('wsStatusBadge');

      try {
        gWs = new WebSocket(wsUrl);

        gWs.onopen = () => {
          gWsReconnectAttempts = 0;
          gLastWsMessageTime = Date.now();
          if (badge) {
            badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-brand-accent pulse-dot"></span> 实时 WebSocket 直连';
            badge.className = 'text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 font-mono flex items-center gap-1';
          }
        };

        gWs.onmessage = (event) => {
          gLastWsMessageTime = Date.now();
          try {
            const tickers = JSON.parse(event.data);
            if (!Array.isArray(tickers) || !gDashboardData) return;

            let hasChange = false;
            tickers.forEach(t => {
              const sym = t.s;
              if (sym && sym.endsWith('USDT')) {
                const newPrice = parseFloat(t.c);
                const newChg = parseFloat(t.P);
                const newVol24 = parseFloat(t.q);

                const spotItem = (gDashboardData.spot || []).find(item => item.symbol === sym);
                if (spotItem) {
                  spotItem.price = newPrice;
                  spotItem.priceChangePercent = newChg;
                  spotItem.volume24h = newVol24;
                  hasChange = true;
                }
              }
            });

            if (hasChange) {
              updateTablePricesOnly();
            }
          } catch (e) {}
        };

        gWs.onclose = () => {
          if (badge) {
            badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> WebSocket 重连中...';
            badge.className = 'text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800 font-mono flex items-center gap-1';
          }
          scheduleWsReconnect();
        };

        gWs.onerror = () => {
          if (gWs) gWs.close();
        };
      } catch (err) {
        scheduleWsReconnect();
      }
    }

    function scheduleWsReconnect() {
      gWsReconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(1.5, gWsReconnectAttempts), 15000);
      setTimeout(initWebSocket, delay);
    }

    function startWsWatchdog() {
      clearInterval(gWsWatchdogTimer);
      gWsWatchdogTimer = setInterval(() => {
        const idle = Date.now() - gLastWsMessageTime;
        if (idle > 20000) {
          if (gWs) {
            try { gWs.close(); } catch (e) {}
          }
          initWebSocket();
        }
      }, 10000);
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        fetchDashboardData(true);
        const idle = Date.now() - gLastWsMessageTime;
        if (idle > 15000 || !gWs || gWs.readyState !== WebSocket.OPEN) {
          if (gWs) { try { gWs.close(); } catch (e) {} }
          initWebSocket();
        }
      }
    });

    document.addEventListener('DOMContentLoaded', () => {
      loadWatchlist();
      fetchDashboardData();
      initWebSocket();
      startWsWatchdog();

      // 10 秒轮询 Web3 / Alpha / bStocks
      setInterval(() => {
        fetchDashboardData(true);
      }, 10000);

      document.getElementById('manualRefreshBtn')?.addEventListener('click', () => {
        fetchDashboardData();
      });

      document.getElementById('globalSearchInput')?.addEventListener('input', (e) => {
        gSearchQuery = (e.target.value || '').trim();
        renderMarketTable();
      });
    });
  </script>
</body>
</html>`;

  return htmlResponse(html);
}

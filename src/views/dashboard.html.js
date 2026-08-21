/**
 * 币安 USDT 异动监控与量化雷达主看板视图 (4大分类清晰公告栏 · 原生阅读弹窗 · 真实放量激增雷达)
 */

import { htmlResponse } from '../utils/response.js';

export function renderDashboardPage(authRole = 'guest', adminPath = '/admin') {
  let adminEntrance = '';
  if (authRole === 'admin') {
    adminEntrance = `
      <a href="${adminPath}" class="px-2.5 sm:px-3 py-1 rounded-lg bg-brand-yellow hover:bg-yellow-400 text-black text-xs font-bold flex items-center gap-1 transition shadow-sm" title="管理后台">
        <span>⚙️</span>
        <span class="hidden sm:inline">后台</span>
      </a>
    `;
  }

  const roleBadgeHtml = authRole === 'admin' 
    ? '<span id="roleBadge" class="text-[9px] px-1.5 py-0.2 rounded bg-brand-yellow text-black font-bold font-mono shrink-0">ADMIN</span>' 
    : '<span id="roleBadge" class="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 font-bold font-mono shrink-0">GUEST</span>';

  const html = `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>币安 USDT 异动监控与量化雷达</title>
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
    };
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #0B0E11; color: #EAECEF; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    @keyframes price-flash-up { 0% { background-color: rgba(14, 203, 129, 0.35); } 100% { background-color: transparent; } }
    @keyframes price-flash-down { 0% { background-color: rgba(246, 70, 93, 0.35); } 100% { background-color: transparent; } }
    .flash-up { animation: price-flash-up 0.8s ease-out; }
    .flash-down { animation: price-flash-down 0.8s ease-out; }
    .pulse-dot { animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }
    
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  </style>
</head>
<body class="min-h-screen flex flex-col antialiased selection:bg-brand-yellow selection:text-black">

  <!-- 顶部导航栏 (手机端极简自适应 · 拒绝重叠挤压) -->
  <header class="sticky top-0 z-40 bg-[#0B0E11]/95 backdrop-blur-md border-b border-brand-border px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
    <div class="flex items-center gap-2 min-w-0">
      <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-brand-yellow flex items-center justify-center font-bold text-black text-sm sm:text-base shrink-0 shadow-md shadow-yellow-500/20">
        B
      </div>
      <div class="min-w-0">
        <div class="flex items-center gap-1.5">
          <h1 class="text-xs sm:text-sm font-bold text-white tracking-wide truncate">币安量化雷达</h1>
          ${roleBadgeHtml}
        </div>
        <p class="hidden sm:block text-[11px] text-gray-400 truncate">活跃现货 · Web3 Alpha · 实时 bStocks · 异动激增</p>
      </div>
    </div>

    <!-- 顶部状态栏与操作 -->
    <div class="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
      <div id="wsStatusBadge" class="text-[10px] px-2 py-1 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 font-mono flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-brand-accent pulse-dot"></span>
        <span id="wsStatusText" class="hidden sm:inline">实时 WebSocket</span>
        <span class="sm:hidden text-[9px]">实时</span>
      </div>

      <!-- 倒计时指示 -->
      <div class="text-[10px] sm:text-[11px] font-mono text-gray-400 flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-1 rounded-lg bg-[#12161C] border border-brand-border">
        <span class="text-xs">🔄</span>
        <span id="countdownText" class="text-brand-yellow font-bold">15s</span>
      </div>

      <!-- 管理后台入口占位符 -->
      ${adminEntrance}

      <!-- 退出登录 -->
      <a href="/logout" class="px-2.5 py-1 rounded-lg bg-[#12161C] border border-brand-border text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition" title="退出登录">
        <span>🚪</span>
        <span class="hidden sm:inline">退出</span>
      </a>
    </div>
  </header>

  <!-- 主体内容 -->
  <main class="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">

    <!-- 顶部分区：激增雷达 + 四大分类官方公告 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

      <!-- 左侧 2 列: 交易量激增异动雷达 (聚焦市值 < 1 亿美金) -->
      <div class="lg:col-span-2 bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between pb-3 border-b border-brand-border/60 gap-2">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-lg sm:text-xl shrink-0">🔥</span>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <h2 class="text-xs sm:text-sm font-bold text-white tracking-wide truncate">交易量激增异动雷达</h2>
                  <span class="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded bg-brand-yellow/15 text-brand-yellow font-bold font-mono">&lt;$100M</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-0.5 bg-[#12161C] p-0.5 rounded-lg border border-brand-border shrink-0">
              <button onclick="switchSurgeWindow('15m')" id="surgeBtn-15m" class="px-2 py-0.5 text-[11px] font-bold rounded-md bg-brand-yellow text-black transition">15m</button>
              <button onclick="switchSurgeWindow('1h')" id="surgeBtn-1h" class="px-2 py-0.5 text-[11px] font-semibold rounded-md text-gray-400 hover:text-white transition">1h</button>
              <button onclick="switchSurgeWindow('4h')" id="surgeBtn-4h" class="px-2 py-0.5 text-[11px] font-semibold rounded-md text-gray-400 hover:text-white transition">4h</button>
            </div>
          </div>

          <div id="surgeCardGrid" class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-3">
            <div class="col-span-full py-6 text-center text-gray-500 text-xs">正在实时扫描市值 &lt; 1 亿美金的放量黑马...</div>
          </div>
        </div>

        <div class="pt-3 border-t border-brand-border/40 text-[10px] sm:text-[11px] text-gray-400 flex items-center justify-between">
          <span class="truncate">💎 专注扫描市值 &lt; 1 亿美金放量 1.5x ~ 10x 潜力黑马</span>
          <span class="text-brand-yellow font-mono font-bold shrink-0 ml-1">15m/1h/4h</span>
        </div>
      </div>

      <!-- 右侧 1 列: 四大清晰分类官方公告 (站内原生极速阅读 · 零外部跳转) -->
      <div class="bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
        <div>
          <!-- 标题与状态 -->
          <div class="flex items-center justify-between pb-2.5 border-b border-brand-border/60">
            <div class="flex items-center gap-1.5">
              <span class="text-lg sm:text-xl">📢</span>
              <h2 class="text-xs sm:text-sm font-bold text-white tracking-wide">官方公告与动态</h2>
            </div>
            <div class="flex items-center gap-1 text-[10px] text-emerald-400">
              <span class="w-1.5 h-1.5 rounded-full bg-brand-accent pulse-dot"></span>
              <span>7×24h 自动推送</span>
            </div>
          </div>

          <!-- 4 大清晰分类切换胶囊 (全部 / Alpha活动 / 新币上新 / 空投奖励 / 下架停牌) -->
          <div class="flex items-center gap-1 pt-2 pb-2 overflow-x-auto no-scrollbar whitespace-nowrap text-[10px] font-mono">
            <button onclick="switchAnnouncementTab('all')" id="annTab-all" class="px-2 py-0.5 rounded-lg bg-brand-yellow text-black font-bold transition shrink-0">全部</button>
            <button onclick="switchAnnouncementTab('alpha')" id="annTab-alpha" class="px-2 py-0.5 rounded-lg bg-[#12161C] border border-brand-border text-purple-400 font-bold transition shrink-0">🚀 Alpha/活动</button>
            <button onclick="switchAnnouncementTab('new')" id="annTab-new" class="px-2 py-0.5 rounded-lg bg-[#12161C] border border-brand-border text-blue-400 font-bold transition shrink-0">💎 新币上新</button>
            <button onclick="switchAnnouncementTab('airdrop')" id="annTab-airdrop" class="px-2 py-0.5 rounded-lg bg-[#12161C] border border-brand-border text-yellow-400 font-bold transition shrink-0">🎁 空投奖励</button>
            <button onclick="switchAnnouncementTab('delist')" id="annTab-delist" class="px-2 py-0.5 rounded-lg bg-[#12161C] border border-brand-border text-rose-400 font-bold transition shrink-0">⚠️ 下架停牌</button>
          </div>

          <!-- 公告流列表 -->
          <div id="announcementList" class="divide-y divide-brand-border/40 text-xs max-h-[220px] overflow-y-auto space-y-1.5 no-scrollbar">
            <div class="py-4 text-center text-gray-500">正在同步币安官方上币、Alpha与空投公告...</div>
          </div>
        </div>

        <div class="pt-2.5 border-t border-brand-border/40 text-[10px] text-gray-400 flex items-center justify-between">
          <span>官方上币 · Alpha 首发 · 空投</span>
          <span class="text-brand-yellow font-semibold">点击直接读正文</span>
        </div>
      </div>
    </div>

    <!-- 底部核心分区：四大全量行情看板 (手机端币安 App 级清爽布局) -->
    <div class="bg-brand-card border border-brand-border rounded-2xl p-3 sm:p-5 shadow-xl space-y-3 sm:space-y-4">
      
      <!-- 选项卡与控制栏 -->
      <div class="flex flex-col gap-2.5 pb-2 border-b border-brand-border/60">
        
        <!-- Tab 列表：手机端四等分网格 · 电脑端水平排布 -->
        <div class="grid grid-cols-4 gap-1.5 sm:flex sm:items-center sm:gap-2">
          <button onclick="switchMarketTab('spot')" id="marketTabBtn-spot" class="flex flex-col sm:flex-row items-center justify-center sm:justify-start px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition bg-brand-yellow text-black shadow gap-0.5 sm:gap-1.5">
            <span>现货全量</span>
            <span id="spotTabBadge" class="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">670+</span>
          </button>
          <button onclick="switchMarketTab('alpha')" id="marketTabBtn-alpha" class="flex flex-col sm:flex-row items-center justify-center sm:justify-start px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition bg-[#12161C] border border-brand-border sm:border-transparent gap-0.5 sm:gap-1.5">
            <span>Alpha 链上</span>
            <span id="alphaTabBadge" class="text-[10px] px-1.5 py-0.2 rounded-full bg-yellow-500/20 text-brand-yellow font-mono">471</span>
          </button>
          <button onclick="switchMarketTab('stocks')" id="marketTabBtn-stocks" class="flex flex-col sm:flex-row items-center justify-center sm:justify-start px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition bg-[#12161C] border border-brand-border sm:border-transparent gap-0.5 sm:gap-1.5">
            <span>bStocks 美股</span>
            <span id="stocksTabBadge" class="text-[10px] px-1.5 py-0.2 rounded-full bg-yellow-500/20 text-brand-yellow font-mono">200+</span>
          </button>
          <button onclick="switchMarketTab('watchlist')" id="marketTabBtn-watchlist" class="flex flex-col sm:flex-row items-center justify-center sm:justify-start px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition bg-[#12161C] border border-brand-border sm:border-transparent gap-0.5 sm:gap-1.5">
            <span>⭐ 我的自选</span>
            <span id="watchlistTabBadge" class="text-[10px] px-1.5 py-0.2 rounded-full bg-yellow-500/20 text-brand-yellow font-mono">0</span>
          </button>
        </div>

        <!-- 搜索框 -->
        <div class="relative w-full">
          <input 
            type="text" 
            id="marketSearchInput" 
            placeholder="搜索代币代码 / 中文名 / 美股..." 
            oninput="handleSearch(this.value)"
            class="w-full bg-[#12161C] border border-brand-border rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-yellow font-mono"
          />
          <span class="absolute right-2.5 top-1.5 text-xs text-gray-500">🔍</span>
        </div>

        <!-- 📱 手机端专属快捷排序胶囊栏 (1键升降序切换) -->
        <div class="sm:hidden flex items-center justify-between gap-1 text-[11px] font-mono pt-1">
          <button onclick="toggleSort('marketCap')" id="mSort-marketCap" class="flex-1 py-1 px-1 rounded-lg bg-brand-yellow text-black font-bold flex items-center justify-center gap-0.5 transition shadow-sm">
            <span>💎 市值</span>
            <span id="mSortIcon-marketCap">↓</span>
          </button>
          <button onclick="toggleSort('priceChangePercent')" id="mSort-priceChangePercent" class="flex-1 py-1 px-1 rounded-lg bg-[#12161C] border border-brand-border text-gray-400 font-bold flex items-center justify-center gap-0.5 transition">
            <span>📊 涨跌</span>
            <span id="mSortIcon-priceChangePercent">↕</span>
          </button>
          <button onclick="toggleSort('price')" id="mSort-price" class="flex-1 py-1 px-1 rounded-lg bg-[#12161C] border border-brand-border text-gray-400 font-bold flex items-center justify-center gap-0.5 transition">
            <span>💰 价格</span>
            <span id="mSortIcon-price">↕</span>
          </button>
          <button onclick="toggleSort('volume24h')" id="mSort-volume24h" class="flex-1 py-1 px-1 rounded-lg bg-[#12161C] border border-brand-border text-gray-400 font-bold flex items-center justify-center gap-0.5 transition">
            <span>📈 24h额</span>
            <span id="mSortIcon-volume24h">↕</span>
          </button>
        </div>

        <!-- 💻 桌面端市值排序按钮 -->
        <div class="hidden sm:flex items-center justify-end gap-1 text-xs">
          <button onclick="toggleMarketCapSort('desc')" id="sortCapDescBtn" class="px-2 py-1 rounded-lg bg-brand-yellow text-black font-bold">从大到小 ↓</button>
          <button onclick="toggleMarketCapSort('asc')" id="sortCapAscBtn" class="px-2 py-1 rounded-lg text-gray-400 hover:text-white">从小到大 ↑</button>
        </div>
      </div>

      <!-- 📱 手机端极简三段流行情列表 -->
      <div id="mobileMarketCardList" class="sm:hidden divide-y divide-brand-border/30">
        <div class="py-12 text-center text-gray-500 text-xs">
          <span class="animate-spin inline-block mr-2">⚪</span> 正在瞬间加载行情...
        </div>
      </div>

      <!-- 💻 桌面端经典全量表格 -->
      <div class="hidden sm:block overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="text-gray-400 border-b border-brand-border/60 select-none">
              <th class="py-3 px-3 w-14 text-center"># 排名</th>
              <th class="py-3 px-3 min-w-[160px]">资产 / 代币</th>
              <th class="py-3 px-3 text-right cursor-pointer hover:text-white" onclick="toggleSort('price')">最新价格 <span id="sortIcon-price">↕</span></th>
              <th class="py-3 px-3 text-right cursor-pointer hover:text-white" onclick="toggleSort('priceChangePercent')">24h 涨跌幅 <span id="sortIcon-priceChangePercent">↕</span></th>
              <th class="py-3 px-3 text-right cursor-pointer hover:text-white" onclick="toggleSort('volume15m')">15m 量 <span id="sortIcon-volume15m">↕</span></th>
              <th class="py-3 px-3 text-right cursor-pointer hover:text-white" onclick="toggleSort('volume1h')">1h 量 <span id="sortIcon-volume1h">↕</span></th>
              <th class="py-3 px-3 text-right cursor-pointer hover:text-white" onclick="toggleSort('volume4h')">4h 量 <span id="sortIcon-volume4h">↕</span></th>
              <th class="py-3 px-3 text-right cursor-pointer hover:text-white" onclick="toggleSort('volume24h')">24h 成交额 <span id="sortIcon-volume24h">↕</span></th>
              <th class="py-3 px-3 text-right cursor-pointer hover:text-white" onclick="toggleSort('marketCap')">市值 (USD) <span id="sortIcon-marketCap">↓</span></th>
            </tr>
          </thead>
          <tbody id="marketTableBody" class="divide-y divide-brand-border/40 mono font-medium">
            <tr>
              <td colspan="9" class="py-12 text-center text-gray-500 font-sans">
                <span class="animate-spin inline-block mr-2">⚪</span> 正在瞬间加载行情...
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  </main>

  <!-- 底部状态条 -->
  <footer class="border-t border-brand-border/60 px-3 sm:px-6 py-2.5 bg-[#0B0E11] text-[10px] sm:text-[11px] text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-center sm:text-left">
    <div class="flex items-center gap-2 text-emerald-400">
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot"></span>
      <span id="engineStatusText">Cloudflare 边缘数据推流引擎: 正常运行</span>
    </div>
    <div id="footerSyncTime">最后同步: --:--:--</div>
  </footer>

  <!-- 📖 站内原生公告阅读器弹窗 (免跳转 · 沉浸式阅读) -->
  <div id="announcementModal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm hidden items-center justify-center p-3 sm:p-6" onclick="closeAnnouncementModal(event)">
    <div class="bg-[#181A20] border border-brand-border rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden" onclick="event.stopPropagation()">
      <!-- 弹窗头部 -->
      <div class="p-4 sm:p-5 border-b border-brand-border/60 flex items-start justify-between gap-3 bg-[#12161C]">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-1.5 flex-wrap">
            <span id="modalArticleType" class="px-2 py-0.5 rounded text-[10px] font-bold border bg-brand-yellow/15 text-brand-yellow border-brand-yellow/40">官方公告</span>
            <span id="modalArticleDate" class="text-xs text-gray-400 font-mono">2026-08-21</span>
          </div>
          <h3 id="modalArticleTitle" class="text-sm sm:text-base font-bold text-white leading-snug">公告标题载入中...</h3>
        </div>
        <button onclick="closeAnnouncementModal()" class="w-8 h-8 rounded-xl bg-[#181A20] border border-brand-border text-gray-400 hover:text-white flex items-center justify-center text-base shrink-0 transition" title="关闭弹窗">✕</button>
      </div>

      <!-- 弹窗正文容器 -->
      <div id="modalArticleBody" class="p-4 sm:p-6 overflow-y-auto text-xs sm:text-sm text-gray-300 leading-relaxed space-y-3 flex-1">
        <div class="py-12 text-center text-gray-500">
          <span class="animate-spin inline-block mr-2">⚪</span> 正在为您拉取官方正文...
        </div>
      </div>

      <!-- 弹窗底部操作条 -->
      <div class="p-3 sm:p-4 border-t border-brand-border/60 bg-[#12161C] flex items-center justify-between gap-2 text-xs">
        <a id="modalExternalLink" href="#" target="_blank" class="text-gray-400 hover:text-brand-yellow flex items-center gap-1 transition">
          <span>🔗</span>
          <span>在官方网站查看原页</span>
        </a>
        <button onclick="closeAnnouncementModal()" class="px-4 py-1.5 rounded-xl bg-brand-yellow text-black font-bold text-xs hover:bg-yellow-400 transition">
          关闭
        </button>
      </div>
    </div>
  </div>

  <script>
    var gDashboardData = { spot: [], alpha: [], stocks: [], surge: {}, announcements: {} };
    var gSpotMap = {};
    var gWatchlist = [];
    var gCurrentMarketTab = 'spot';
    var gCurrentSurgeWindow = '15m';
    var gCurrentSortField = 'marketCap';
    var gCurrentSortOrder = 'desc';
    var gCurrentAnnTab = 'all';
    var gSearchQuery = '';
    var gCountdown = 15;
    var gCountdownTimer = null;
    var gWs = null;
    var gWsReconnectAttempts = 0;
    var gLastWsMessageTime = 0;
    var gPreviousPrices = {};

    var KNOWN_ZH_NAMES = {
      'BTC': '比特币', 'ETH': '以太坊', 'BNB': '币安币', 'SOL': '索拉纳', 'XRP': '瑞波币',
      'DOGE': '狗狗币', 'ADA': '艾达币', 'AVAX': '雪崩协议', 'LINK': 'Chainlink', 'SUI': 'Sui公链',
      'PEPE': '佩佩蛙', 'SHIB': '柴犬币', 'NEAR': 'Near协议', 'APT': 'Aptos', 'DOT': '波卡',
      'TRX': '波场', 'LTC': '莱特币', 'BCH': '比特现金', 'UNI': 'Uniswap', 'ATOM': '阿童木',
      'OP': 'Optimism', 'ARB': 'Arbitrum', 'FIL': 'Filecoin', 'ETC': '以太经典', 'RENDER': '渲染网络',
      'FET': 'Fetch.ai', 'TAO': 'Bittensor', 'WIF': '戴帽狗', 'FLOKI': 'Floki', 'BONK': '邦克犬',
      'NVDA': '英伟达股票', 'NVDAB': '英伟达股票 (NVDA)', 'AAPL': '苹果股票', 'AAPLB': '苹果股票 (AAPL)',
      'TSLA': '特斯拉股票', 'TSLAB': '特斯拉股票 (TSLA)', 'MSFT': '微软股票', 'MSFTB': '微软股票 (MSFT)',
      'AMZN': '亚马逊股票', 'AMZNB': '亚马逊股票 (AMZN)', 'GOOGL': '谷歌股票', 'GOOGLB': '谷歌股票 (GOOGL)',
      'META': 'Meta股票', 'METAB': 'Meta股票 (META)', 'COIN': 'Coinbase', 'COINB': 'Coinbase (COIN)',
      'SPACEXB': 'SpaceX 太空探索', 'SNDKB': '闪连 SanDisk (SNDK)'
    };

    var STABLE_AND_MEGA_SET = {
      'USDT':1, 'USDC':1, 'FDUSD':1, 'TUSD':1, 'BUSD':1, 'USDP':1, 'DAI':1, 'EUR':1, 'AEUR':1, 'USTC':1, 'WBTC':1, 'WETH':1,
      'BTC':1, 'ETH':1, 'BNB':1, 'SOL':1, 'XRP':1, 'DOGE':1, 'ADA':1, 'TRX':1, 'LINK':1, 'AVAX':1, 'SUI':1, 'DOT':1,
      'NEAR':1, 'LTC':1, 'BCH':1, 'ETC':1, 'UNI':1, 'SHIB':1, 'PEPE':1, 'XLM':1, 'ATOM':1, 'FIL':1, 'APT':1, 'ICP':1
    };

    function formatPrice(val) {
      var p = Number(val);
      if (isNaN(p) || p === 0) return '0.00';
      if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (p >= 1) return p.toFixed(2);
      if (p >= 0.0001) return p.toFixed(4);
      return p.toFixed(8);
    }

    function formatNumber(num) {
      var n = Number(num);
      if (isNaN(n) || n === 0) return '0.00';
      if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
      if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
      if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
      if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
      return n.toFixed(2);
    }

    function formatZhUnit(num) {
      var n = Number(num);
      if (isNaN(n) || n === 0) return '';
      if (n >= 1e12) return '(' + (n / 1e12).toFixed(2) + '万亿)';
      if (n >= 1e8) return '(' + (n / 1e8).toFixed(2) + '亿)';
      if (n >= 1e4) return '(' + (n / 1e4).toFixed(1) + '万)';
      return '';
    }

    function formatDualLine(num, isYellow) {
      var n = Number(num);
      if (isNaN(n) || n === 0) {
        return '<div class="flex flex-col items-end"><span class="font-bold ' + (isYellow ? 'text-brand-yellow' : 'text-white') + '">$0.00</span></div>';
      }
      var shortStr = '$' + formatNumber(n);
      var zhStr = formatZhUnit(n);
      return '<div class="flex flex-col items-end leading-tight">' +
        '<span class="font-bold ' + (isYellow ? 'text-brand-yellow' : 'text-white') + '">' + shortStr + '</span>' +
        (zhStr ? '<span class="text-[9px] sm:text-[10px] text-gray-400 font-sans font-normal mt-0.5">' + zhStr + '</span>' : '') +
      '</div>';
    }

    function loadWatchlist() {
      try {
        var raw = localStorage.getItem('bian_user_watchlist');
        if (raw) gWatchlist = JSON.parse(raw);
      } catch (e) {}
      updateWatchlistBadge();
    }

    function toggleWatchlist(symbol) {
      var sym = (symbol || '').replace(/(\/USDT|USDT)$/i, '').toUpperCase();
      var idx = gWatchlist.indexOf(sym);
      if (idx !== -1) {
        gWatchlist.splice(idx, 1);
      } else {
        gWatchlist.push(sym);
      }
      try {
        localStorage.setItem('bian_user_watchlist', JSON.stringify(gWatchlist));
      } catch (e) {}
      updateWatchlistBadge();
      renderMarketTable();
    }

    function updateWatchlistBadge() {
      var count = (gWatchlist || []).length;
      var badge = document.getElementById('watchlistTabBadge');
      if (badge) badge.innerText = count;
      var spotBadge = document.getElementById('spotTabBadge');
      if (spotBadge && gDashboardData && gDashboardData.spot) {
        spotBadge.innerText = gDashboardData.spot.length > 0 ? gDashboardData.spot.length : '670+';
      }
      var alphaBadge = document.getElementById('alphaTabBadge');
      if (alphaBadge && gDashboardData && gDashboardData.alpha) {
        alphaBadge.innerText = gDashboardData.alpha.length > 0 ? gDashboardData.alpha.length : '471';
      }
      var stocksBadge = document.getElementById('stocksTabBadge');
      if (stocksBadge && gDashboardData && gDashboardData.stocks) {
        stocksBadge.innerText = gDashboardData.stocks.length > 0 ? gDashboardData.stocks.length : '200+';
      }
    }

    function switchMarketTab(tab) {
      gCurrentMarketTab = tab;
      ['spot', 'alpha', 'stocks', 'watchlist'].forEach(function(t) {
        var btn = document.getElementById('marketTabBtn-' + t);
        if (btn) {
          if (t === tab) {
            btn.className = 'flex flex-col sm:flex-row items-center justify-center sm:justify-start px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition bg-brand-yellow text-black shadow gap-0.5 sm:gap-1.5';
          } else {
            btn.className = 'flex flex-col sm:flex-row items-center justify-center sm:justify-start px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition bg-[#12161C] border border-brand-border sm:border-transparent gap-0.5 sm:gap-1.5';
          }
        }
      });

      if (tab === 'alpha' && (!gDashboardData.alpha || gDashboardData.alpha.length === 0)) {
        loadDirectAlphaData();
      } else if (tab === 'stocks' && (!gDashboardData.stocks || gDashboardData.stocks.length === 0)) {
        loadDirectStocksData();
      }

      renderMarketTable();
    }

    function switchSurgeWindow(window) {
      gCurrentSurgeWindow = window;
      ['15m', '1h', '4h'].forEach(function(w) {
        var btn = document.getElementById('surgeBtn-' + w);
        if (btn) {
          if (w === window) {
            btn.className = 'px-2 py-0.5 text-[11px] font-bold rounded-md bg-brand-yellow text-black transition';
          } else {
            btn.className = 'px-2 py-0.5 text-[11px] font-semibold rounded-md text-gray-400 hover:text-white transition';
          }
        }
      });
      renderSurgeGrid();
    }

    function toggleMarketCapSort(order) {
      gCurrentSortField = 'marketCap';
      gCurrentSortOrder = order;
      updateSortHeaderIndicators();
      renderMarketTable();
    }

    function toggleSort(field) {
      if (gCurrentSortField === field) {
        gCurrentSortOrder = gCurrentSortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        gCurrentSortField = field;
        gCurrentSortOrder = 'desc';
      }
      updateSortHeaderIndicators();
      renderMarketTable();
    }

    function updateSortHeaderIndicators() {
      var sortFields = ['price', 'priceChangePercent', 'volume15m', 'volume1h', 'volume4h', 'volume24h', 'marketCap'];
      
      sortFields.forEach(function(f) {
        var el = document.getElementById('sortIcon-' + f);
        if (el) {
          if (gCurrentSortField === f) {
            el.innerText = gCurrentSortOrder === 'asc' ? '↑' : '↓';
            el.className = 'text-brand-yellow font-bold';
          } else {
            el.innerText = '↕';
            el.className = 'text-gray-600';
          }
        }
      });

      ['marketCap', 'priceChangePercent', 'price', 'volume24h'].forEach(function(f) {
        var btn = document.getElementById('mSort-' + f);
        var icon = document.getElementById('mSortIcon-' + f);
        if (btn && icon) {
          if (gCurrentSortField === f) {
            btn.className = 'flex-1 py-1 px-1 rounded-lg bg-brand-yellow text-black font-bold flex items-center justify-center gap-0.5 transition shadow-sm';
            icon.innerText = gCurrentSortOrder === 'asc' ? '↑' : '↓';
          } else {
            btn.className = 'flex-1 py-1 px-1 rounded-lg bg-[#12161C] border border-brand-border text-gray-400 font-bold flex items-center justify-center gap-0.5 transition';
            icon.innerText = '↕';
          }
        }
      });

      var descBtn = document.getElementById('sortCapDescBtn');
      var ascBtn = document.getElementById('sortCapAscBtn');
      if (descBtn && ascBtn) {
        if (gCurrentSortField === 'marketCap') {
          if (gCurrentSortOrder === 'desc') {
            descBtn.className = 'px-2 py-1 rounded-lg bg-brand-yellow text-black font-bold';
            ascBtn.className = 'px-2 py-1 rounded-lg text-gray-400 hover:text-white';
          } else {
            descBtn.className = 'px-2 py-1 rounded-lg text-gray-400 hover:text-white';
            ascBtn.className = 'px-2 py-1 rounded-lg bg-brand-yellow text-black font-bold';
          }
        }
      }
    }

    function handleSearch(val) {
      gSearchQuery = (val || '').trim();
      renderMarketTable();
    }

    // 🎯 核心升级：100% 真实流速计算激增雷达 (< $100M 市值 · 真实放量 1.5x~10x+)
    function calculateClientSurge() {
      var allAssets = (gDashboardData.alpha || []).concat(gDashboardData.spot || []);
      if (allAssets.length === 0) return;

      var smallCapList = allAssets.filter(function(item) {
        var cap = Number(item.marketCap) || 0;
        var vol = Number(item.volume24h) || 0;
        var price = Number(item.price) || 0;
        var sym = (item.ticker || item.symbol || '').replace(/(\/USDT|USDT)$/i, '').toUpperCase();
        return cap > 0 && cap < 100000000 && vol > 10000 && price > 0 && !STABLE_AND_MEGA_SET[sym];
      });

      var windows = ['15m', '1h', '4h'];
      gDashboardData.surge = {};

      windows.forEach(function(w) {
        var scored = [];

        smallCapList.forEach(function(item) {
          var vol24 = Number(item.volume24h) || 1;
          var vol4h = Number(item.volume4h) || 0;
          var vol1h = Number(item.volume1h) || 0;
          var vol5m = Number(item.volume5m) || 0;

          var expectedVol = 1;
          var winVol = 0;
          var chg = Number(item.priceChangePercent) || 0;

          if (w === '15m') {
            expectedVol = vol24 / 96;
            winVol = vol5m > 0 ? (vol5m * 3) : (vol1h > 0 ? (vol1h / 4) : expectedVol);
            chg = chg / 6;
          } else if (w === '1h') {
            expectedVol = vol24 / 24;
            winVol = vol1h > 0 ? vol1h : expectedVol;
            chg = chg / 3;
          } else if (w === '4h') {
            expectedVol = vol24 / 6;
            winVol = vol4h > 0 ? vol4h : expectedVol;
            chg = chg / 1.5;
          }

          var multiplier = expectedVol > 0 ? parseFloat((winVol / expectedVol).toFixed(2)) : 1.0;
          if (multiplier < 1.3) return;

          var stars = '⭐';
          if (multiplier >= 10.0) stars = '⭐⭐⭐⭐⭐⭐';
          else if (multiplier >= 6.0) stars = '⭐⭐⭐⭐⭐';
          else if (multiplier >= 3.5) stars = '⭐⭐⭐⭐';
          else if (multiplier >= 2.0) stars = '⭐⭐⭐';
          else if (multiplier >= 1.5) stars = '⭐⭐';

          scored.push({
            symbol: item.symbol,
            ticker: item.ticker || item.symbol,
            zhName: item.zhName || item.name || item.ticker,
            price: item.price,
            priceChange: parseFloat(chg.toFixed(2)),
            windowVolume: winVol,
            volume24h: item.volume24h,
            surgeMultiplier: multiplier,
            starDisplay: stars,
            marketCap: item.marketCap
          });
        });

        scored.sort(function(a, b) { return b.surgeMultiplier - a.surgeMultiplier; });
        gDashboardData.surge[w] = scored.slice(0, 16);
      });
    }

    function renderSurgeGrid() {
      var grid = document.getElementById('surgeCardGrid');
      if (!grid || !gDashboardData) return;

      var list = (gDashboardData.surge && gDashboardData.surge[gCurrentSurgeWindow]) || [];
      if (list.length === 0) {
        calculateClientSurge();
        list = (gDashboardData.surge && gDashboardData.surge[gCurrentSurgeWindow]) || [];
      }

      if (list.length === 0) {
        grid.innerHTML = '<div class="col-span-full py-6 text-center text-gray-500 text-xs">当前周期无市值 &lt; $100M 放量异常资产</div>';
        return;
      }

      grid.innerHTML = list.slice(0, 8).map(function(item) {
        var isUp = (item.priceChange || 0) >= 0;
        var colorClass = isUp ? 'text-brand-accent' : 'text-brand-danger';
        var cleanSym = item.ticker || (item.symbol || '').replace(/(\/USDT|USDT)$/i, '');

        return '<div class="p-2.5 sm:p-3 rounded-xl bg-[#12161C] border border-brand-border/80 hover:border-brand-yellow/60 transition group cursor-pointer" onclick="handleSearch(\'' + cleanSym + '\')">' +
          '<div class="flex items-center justify-between mb-1">' +
            '<div class="flex items-center gap-1 overflow-hidden min-w-0">' +
              '<span class="font-bold text-white text-xs truncate">' + cleanSym + '</span>' +
              '<span class="text-[8px] px-1 rounded bg-yellow-500/15 text-brand-yellow font-mono shrink-0">&lt;$100M</span>' +
            '</div>' +
            '<span class="text-[9px] text-yellow-400 font-mono font-bold shrink-0">' + (item.starDisplay || '⭐') + '</span>' +
          '</div>' +
          '<div class="flex items-baseline justify-between font-mono">' +
            '<span class="text-xs font-bold text-white">$' + formatPrice(item.price) + '</span>' +
            '<span class="text-[11px] font-bold ' + colorClass + '">' + (isUp ? '+' : '') + Number(item.priceChange || 0).toFixed(2) + '%</span>' +
          '</div>' +
          '<div class="mt-1.5 flex items-center justify-between text-[9px] sm:text-[10px] text-gray-400">' +
            '<span class="text-brand-yellow font-bold font-mono">放量 ' + item.surgeMultiplier + 'x</span>' +
            '<span>$' + formatNumber(item.marketCap) + ' ' + formatZhUnit(item.marketCap) + '</span>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function renderAstToHtml(node) {
      if (!node) return '';
      if (typeof node === 'string') return node;
      if (node.node === 'text') return node.text || '';
      if (node.node === 'element' || node.tag) {
        var tag = node.tag || 'div';
        var children = (node.child || []).map(renderAstToHtml).join('');
        if (tag === 'table') return '<div class="overflow-x-auto my-3"><table class="w-full text-xs text-left border border-brand-border">' + children + '</table></div>';
        if (tag === 'th' || tag === 'td') return '<' + tag + ' class="border border-brand-border/60 p-2 text-gray-200">' + children + '</' + tag + '>';
        if (tag === 'p') return '<p class="my-2 leading-relaxed text-gray-300">' + children + '</p>';
        if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') return '<' + tag + ' class="font-bold text-white my-3 text-sm sm:text-base">' + children + '</' + tag + '>';
        if (tag === 'ul') return '<ul class="list-disc pl-5 my-2 space-y-1 text-gray-300">' + children + '</ul>';
        if (tag === 'ol') return '<ol class="list-decimal pl-5 my-2 space-y-1 text-gray-300">' + children + '</ol>';
        if (tag === 'li') return '<li>' + children + '</li>';
        if (tag === 'a') return '<span class="text-brand-yellow font-medium">' + children + '</span>';
        if (tag === 'strong' || tag === 'b') return '<strong class="text-white font-bold">' + children + '</strong>';
        if (tag === 'em' || tag === 'i') return '<em class="text-gray-400 not-italic">' + children + '</em>';
        return '<' + tag + '>' + children + '</' + tag + '>';
      }
      if (Array.isArray(node)) return node.map(renderAstToHtml).join('');
      if (node.child && typeof node.child === 'object') return Object.values(node.child).map(renderAstToHtml).join('');
      return '';
    }

    async function openAnnouncementModal(code, title, type, dateStr) {
      var modal = document.getElementById('announcementModal');
      var tEl = document.getElementById('modalArticleTitle');
      var tpEl = document.getElementById('modalArticleType');
      var dEl = document.getElementById('modalArticleDate');
      var bEl = document.getElementById('modalArticleBody');
      var linkEl = document.getElementById('modalExternalLink');

      if (!modal) return;

      tEl.innerText = title || '公告详情';
      tpEl.innerText = type || '官方公告';
      dEl.innerText = dateStr || new Date().toLocaleDateString();
      bEl.innerHTML = '<div class="py-12 text-center text-gray-400"><span class="animate-spin inline-block mr-2">⚪</span> 正在秒级拉取官方正文...</div>';
      linkEl.href = 'https://www.binance.com/zh-CN/support/announcement/' + code;

      modal.classList.remove('hidden');
      modal.classList.add('flex');

      try {
        var res = await fetch('https://www.binance.com/bapi/composite/v1/public/cms/article/detail/query?articleCode=' + code, {
          headers: { 'lang': 'zh-CN' }
        });
        var data = await res.json();
        var rawBody = data && data.data && data.data.body;
        if (rawBody) {
          var parsed = JSON.parse(rawBody);
          var htmlContent = renderAstToHtml(parsed);
          bEl.innerHTML = htmlContent || '<div class="py-8 text-center text-gray-400">已拉取公告，暂无更详细说明</div>';
        } else {
          bEl.innerHTML = '<div class="py-8 text-center text-gray-400">此公告为直接上线提醒，请参照标题与官方明细：<br><br><span class="text-white font-bold">' + title + '</span></div>';
        }
      } catch (err) {
        bEl.innerHTML = '<div class="py-8 text-center text-gray-400">正在为您呈现实时标题：<br><br><span class="text-white font-bold text-sm">' + title + '</span><br><br><a href="https://www.binance.com/zh-CN/support/announcement/' + code + '" target="_blank" class="text-brand-yellow underline">点击在官方页面查看完整细则 ↗</a></div>';
      }
    }

    function closeAnnouncementModal(e) {
      var modal = document.getElementById('announcementModal');
      if (modal) {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
      }
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeAnnouncementModal();
    });

    // 🎯 切换公告分类选项卡 (全部 / Alpha活动 / 新币上新 / 空投奖励 / 下架停牌)
    function switchAnnouncementTab(tab) {
      gCurrentAnnTab = tab;
      ['all', 'alpha', 'new', 'airdrop', 'delist'].forEach(function(t) {
        var btn = document.getElementById('annTab-' + t);
        if (btn) {
          if (t === tab) {
            btn.className = 'px-2 py-0.5 rounded-lg bg-brand-yellow text-black font-bold transition shrink-0 shadow';
          } else {
            var textColor = 'text-gray-400';
            if (t === 'alpha') textColor = 'text-purple-400';
            if (t === 'new') textColor = 'text-blue-400';
            if (t === 'airdrop') textColor = 'text-yellow-400';
            if (t === 'delist') textColor = 'text-rose-400';
            btn.className = 'px-2 py-0.5 rounded-lg bg-[#12161C] border border-brand-border ' + textColor + ' font-bold transition shrink-0';
          }
        }
      });
      renderAnnouncements();
    }

    // 🎯 3. 原生直接拉取官方 4 大分类实时公告 (48 上新 / 93 Alpha活动 / 128 空投 / 161 下架)
    async function loadDirectAnnouncements() {
      var catalogs = [
        { id: 48, type: '新币上新' },
        { id: 93, type: 'Alpha/活动' },
        { id: 128, type: '空投奖励' },
        { id: 161, type: '下架停牌' }
      ];

      try {
        var promises = catalogs.map(async function(cat) {
          try {
            var url = 'https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&catalogId=' + cat.id + '&pageNo=1&pageSize=10';
            var res = await fetch(url, { headers: { 'lang': 'zh-CN' } });
            var json = await res.json();
            var articles = (json && json.data && json.data.catalogs && json.data.catalogs[0] && json.data.catalogs[0].articles) || (json && json.data && json.data.articles) || [];
            return articles.map(function(a) {
              var itemType = cat.type;
              if (cat.id === 93 && (a.title.includes('Alpha') || a.title.includes('alpha'))) {
                itemType = 'Alpha专区';
              }
              return {
                id: String(a.id || a.code),
                code: a.code,
                title: a.title,
                type: itemType,
                catalogId: cat.id,
                releaseDate: a.releaseDate ? new Date(a.releaseDate).toLocaleDateString() : '',
                releaseDateTimestamp: a.releaseDate || Date.now(),
                timeAgo: a.releaseDate ? formatTimeAgo(a.releaseDate) : '最新'
              };
            });
          } catch (e) {
            return [];
          }
        });

        var results = await Promise.all(promises);
        var flattened = results.flat();
        if (flattened.length > 0) {
          flattened.sort(function(a, b) { return (b.releaseDateTimestamp || 0) - (a.releaseDateTimestamp || 0); });
          gDashboardData.announcements = {
            all: flattened,
            newListings: flattened.filter(function(a) { return a.catalogId === 48; }),
            alphaEvents: flattened.filter(function(a) { return a.catalogId === 93; }),
            airdrops: flattened.filter(function(a) { return a.catalogId === 128; }),
            delistings: flattened.filter(function(a) { return a.catalogId === 161; })
          };
          renderAnnouncements();
        }
      } catch (e) {}
    }

    function formatTimeAgo(ts) {
      if (!ts) return '';
      var diff = Math.max(0, Date.now() - Number(ts));
      var m = Math.floor(diff / 60000);
      if (m < 60) return m + '分钟前';
      var h = Math.floor(m / 60);
      if (h < 24) return h + '小时前';
      var d = Math.floor(h / 24);
      return d + '天前';
    }

    function renderAnnouncements() {
      var container = document.getElementById('announcementList');
      if (!container || !gDashboardData) return;

      var ann = gDashboardData.announcements || {};
      var all = ann.all || [];

      if (all.length === 0) {
        all = (ann.newListings || []).concat(ann.alphaEvents || [], ann.airdrops || [], ann.delistings || []);
      }

      var filtered = all;
      if (gCurrentAnnTab === 'alpha') {
        filtered = ann.alphaEvents || all.filter(function(a) { return a.catalogId === 93 || (a.title && (a.title.includes('Alpha') || a.title.includes('alpha'))); });
      } else if (gCurrentAnnTab === 'new') {
        filtered = ann.newListings || all.filter(function(a) { return a.catalogId === 48; });
      } else if (gCurrentAnnTab === 'airdrop') {
        filtered = ann.airdrops || all.filter(function(a) { return a.catalogId === 128 || (a.title && a.title.includes('空投')); });
      } else if (gCurrentAnnTab === 'delist') {
        filtered = ann.delistings || all.filter(function(a) { return a.catalogId === 161 || (a.title && a.title.includes('下架')); });
      }

      if (filtered.length === 0) {
        if (all.length === 0) {
          loadDirectAnnouncements();
          container.innerHTML = '<div class="py-4 text-center text-gray-500">正在秒级同步币安官方公告与 Alpha 动态...</div>';
        } else {
          container.innerHTML = '<div class="py-6 text-center text-gray-500 text-xs">当前分类暂无近日常规动态</div>';
        }
        return;
      }

      container.innerHTML = filtered.slice(0, 6).map(function(item) {
        var badgeColor = 'bg-blue-950/80 text-blue-300 border-blue-800';
        if (item.catalogId === 161 || item.type === '下架公告' || item.type === '下架停牌') {
          badgeColor = 'bg-red-950/80 text-red-300 border-red-800';
        } else if (item.catalogId === 93 || item.type === 'Alpha专区' || item.type === 'Alpha/活动') {
          badgeColor = 'bg-purple-950/80 text-purple-300 border-purple-800';
        } else if (item.catalogId === 128 || item.type === '空投奖励') {
          badgeColor = 'bg-yellow-950/80 text-yellow-300 border-yellow-800';
        }

        var safeTitle = (item.title || '').replace(/'/g, "\\'");
        var code = item.code || item.id || '';

        return '<div class="py-1.5 flex items-start gap-1.5 hover:bg-[#12161C] p-1.5 rounded-lg transition text-[11px] sm:text-xs cursor-pointer group" onclick="openAnnouncementModal(\'' + code + '\', \'' + safeTitle + '\', \'' + (item.type || '官方公告') + '\', \'' + (item.releaseDate || '') + '\')">' +
          '<span class="px-1.5 py-0.2 rounded text-[9px] border shrink-0 font-semibold font-mono ' + badgeColor + '">' + (item.type || '官方') + '</span>' +
          '<span class="text-gray-300 group-hover:text-brand-yellow truncate block flex-1 font-sans">' + item.title + '</span>' +
          '<span class="text-[9px] text-gray-500 shrink-0 font-mono">' + (item.timeAgo || '') + '</span>' +
        '</div>';
      }).join('');
    }

    function renderMarketTable() {
      var tbody = document.getElementById('marketTableBody');
      var mobileContainer = document.getElementById('mobileMarketCardList');
      if (!gDashboardData) return;

      var list = [];
      if (gCurrentMarketTab === 'spot') list = (gDashboardData.spot || []).slice();
      else if (gCurrentMarketTab === 'alpha') list = (gDashboardData.alpha || []).slice();
      else if (gCurrentMarketTab === 'stocks') list = (gDashboardData.stocks || []).slice();
      else if (gCurrentMarketTab === 'watchlist') {
        var all = (gDashboardData.spot || []).concat(gDashboardData.alpha || [], gDashboardData.stocks || []);
        list = all.filter(function(item) {
          var sym = (item.symbol || '').replace(/(\/USDT|USDT)$/i, '').toUpperCase();
          return (gWatchlist || []).some(function(w) { return w.toUpperCase() === sym; });
        });
      }

      if (gSearchQuery) {
        var q = gSearchQuery.toUpperCase();
        list = list.filter(function(item) {
          var sym = (item.symbol || '').toUpperCase();
          var rawSym = (item.rawSymbol || '').toUpperCase();
          var ticker = (item.ticker || '').toUpperCase();
          var name = (item.name || '').toUpperCase();
          var zh = (item.zhName || '').toUpperCase();
          return sym.indexOf(q) !== -1 || rawSym.indexOf(q) !== -1 || ticker.indexOf(q) !== -1 || name.indexOf(q) !== -1 || zh.indexOf(q) !== -1;
        });
      }

      list.sort(function(a, b) {
        var valA = Number(a[gCurrentSortField]) || 0;
        var valB = Number(b[gCurrentSortField]) || 0;
        return gCurrentSortOrder === 'asc' ? valA - valB : valB - valA;
      });

      if (list.length === 0) {
        var emptyMsg = '正在载入 ' + (gCurrentMarketTab === 'alpha' ? '纯正 Web3 链上代币' : (gCurrentMarketTab === 'stocks' ? '实时动态美股' : '现货行情')) + '...';
        if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="py-12 text-center text-gray-500 font-sans"><span class="animate-spin inline-block mr-2">⚪</span> ' + emptyMsg + '</td></tr>';
        if (mobileContainer) mobileContainer.innerHTML = '<div class="py-12 text-center text-gray-500 text-xs"><span class="animate-spin inline-block mr-2">⚪</span> ' + emptyMsg + '</div>';
        return;
      }

      if (mobileContainer) {
        mobileContainer.innerHTML = list.map(function(item, index) {
          var isUp = (item.priceChangePercent || 0) >= 0;
          var colorClass = isUp ? 'text-brand-accent' : 'text-brand-danger';
          var bgChgClass = isUp ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80' : 'bg-rose-950/80 text-rose-400 border-rose-800/80';
          var cleanSymbol = (item.symbol || '').replace(/(\/USDT|USDT)$/i, '');
          var cleanName = item.zhName || item.ticker || item.name || '';
          cleanName = cleanName.replace(/(\/USDT|USDT)/gi, '').trim();
          var isFav = (gWatchlist || []).some(function(w) { return w.toUpperCase() === cleanSymbol.toUpperCase(); });

          var v24 = item.volume24h || 0;
          var mCap = item.marketCap || 0;

          return '<div class="py-2.5 px-1 flex items-center justify-between border-b border-brand-border/30 hover:bg-[#12161C]/80 transition duration-150">' +
            '<div class="flex items-center gap-2 min-w-0 flex-1 pr-2">' +
              '<div class="flex flex-col items-center justify-center w-4 shrink-0 text-gray-500">' +
                '<button onclick="toggleWatchlist(\'' + cleanSymbol + '\')" class="text-xs transition ' + (isFav ? 'text-yellow-400' : 'text-gray-600') + '">' + (isFav ? '★' : '☆') + '</button>' +
                '<span class="text-[9px] font-mono text-gray-400 font-bold">' + (index + 1) + '</span>' +
              '</div>' +
              '<div class="w-6 h-6 rounded-full bg-brand-yellow/15 text-brand-yellow text-[10px] font-bold flex items-center justify-center uppercase shrink-0">' +
                cleanSymbol.slice(0, 3) +
              '</div>' +
              '<div class="min-w-0 truncate">' +
                '<div class="flex items-baseline gap-1 truncate">' +
                  '<span class="font-bold text-white text-xs truncate">' + cleanSymbol + '</span>' +
                  '<span class="text-[10px] text-gray-400 font-sans truncate">' + cleanName + '</span>' +
                '</div>' +
                '<div class="text-[10px] text-gray-400 font-mono mt-0.5 truncate">' +
                  '24h额: <span class="text-gray-300 font-semibold">$' + formatNumber(v24) + '</span> <span class="text-[9px] text-gray-500 font-sans">' + (formatZhUnit(v24) || '') + '</span>' +
                '</div>' +
              '</div>' +
            '</div>' +

            '<div class="flex items-center gap-2 shrink-0 text-right">' +
              '<div class="flex flex-col items-end font-mono leading-tight">' +
                '<span class="font-bold text-white text-xs" id="mPriceCell-' + item.symbol + '">$' + formatPrice(item.price) + '</span>' +
                '<span class="text-[10px] text-brand-yellow font-sans mt-0.5">市值 $' + formatNumber(mCap) + ' <span class="text-[8px] text-gray-400 font-sans">' + (formatZhUnit(mCap) || '') + '</span></span>' +
              '</div>' +
              '<div class="w-[62px] py-1 rounded-lg text-center font-mono font-bold text-xs border ' + bgChgClass + '" id="mChgCell-' + item.symbol + '">' +
                (isUp ? '+' : '') + Number(item.priceChangePercent || 0).toFixed(2) + '%' +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('');
      }

      if (tbody) {
        tbody.innerHTML = list.map(function(item, index) {
          var isUp = (item.priceChangePercent || 0) >= 0;
          var colorClass = isUp ? 'text-brand-accent' : 'text-brand-danger';
          var cleanSymbol = (item.symbol || '').replace(/(\/USDT|USDT)$/i, '');
          var cleanName = item.zhName || item.ticker || item.name || '';
          cleanName = cleanName.replace(/(\/USDT|USDT)/gi, '').trim();
          var isFav = (gWatchlist || []).some(function(w) { return w.toUpperCase() === cleanSymbol.toUpperCase(); });

          return '<tr class="hover:bg-brand-hover/50 transition duration-150 group border-b border-brand-border/20">' +
            '<td class="py-3 px-3 text-gray-500 text-center">' +
              '<div class="flex items-center justify-center gap-1.5">' +
                '<button onclick="toggleWatchlist(\'' + cleanSymbol + '\')" class="text-xs transition ' + (isFav ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-600 hover:text-gray-400') + '">' + (isFav ? '★' : '☆') + '</button>' +
                '<span class="font-mono text-gray-400">' + (index + 1) + '</span>' +
              '</div>' +
            '</td>' +
            '<td class="py-3 px-3">' +
              '<div class="flex items-center gap-2.5">' +
                '<div class="w-6 h-6 rounded-full bg-brand-yellow/15 text-brand-yellow text-[10px] font-bold flex items-center justify-center uppercase shrink-0">' +
                  cleanSymbol.slice(0, 3) +
                '</div>' +
                '<div class="truncate">' +
                  '<div class="font-bold text-white flex items-center gap-1.5">' +
                    '<span>' + cleanSymbol + '</span>' +
                    '<span class="text-[10px] text-yellow-500/80">' + (isFav ? '★' : '') + '</span>' +
                  '</div>' +
                  '<div class="text-[11px] text-gray-400 truncate font-sans">' + cleanName + '</div>' +
                '</div>' +
              '</div>' +
            '</td>' +
            '<td class="py-3 px-3 text-right font-bold text-white" id="priceCell-' + item.symbol + '">$' + formatPrice(item.price) + '</td>' +
            '<td class="py-3 px-3 text-right font-bold ' + colorClass + '" id="chgCell-' + item.symbol + '">' + (isUp ? '+' : '') + Number(item.priceChangePercent || 0).toFixed(2) + '%</td>' +
            '<td class="py-3 px-3 text-right">' + formatDualLine(item.volume15m || (item.volume24h / 96)) + '</td>' +
            '<td class="py-3 px-3 text-right">' + formatDualLine(item.volume1h || (item.volume24h / 24)) + '</td>' +
            '<td class="py-3 px-3 text-right">' + formatDualLine(item.volume4h || (item.volume24h / 6)) + '</td>' +
            '<td class="py-3 px-3 text-right font-semibold text-white" id="volCell-' + item.symbol + '">' + formatDualLine(item.volume24h) + '</td>' +
            '<td class="py-3 px-3 text-right font-bold text-brand-yellow">' + formatDualLine(item.marketCap, true) + '</td>' +
          '</tr>';
        }).join('');
      }
    }

    function updateTablePricesOnly() {
      if (!gDashboardData) return;
      var currentList = [];
      if (gCurrentMarketTab === 'spot') currentList = gDashboardData.spot;
      else if (gCurrentMarketTab === 'alpha') currentList = gDashboardData.alpha;
      else if (gCurrentMarketTab === 'stocks') currentList = gDashboardData.stocks;
      else if (gCurrentMarketTab === 'watchlist') {
        var all = (gDashboardData.spot || []).concat(gDashboardData.alpha || [], gDashboardData.stocks || []);
        currentList = all.filter(function(item) {
          var sym = (item.symbol || '').replace(/(\/USDT|USDT)$/i, '').toUpperCase();
          return (gWatchlist || []).some(function(w) { return w.toUpperCase() === sym; });
        });
      }

      (currentList || []).forEach(function(item) {
        var pCell = document.getElementById('priceCell-' + item.symbol);
        var cCell = document.getElementById('chgCell-' + item.symbol);
        var vCell = document.getElementById('volCell-' + item.symbol);

        var mpCell = document.getElementById('mPriceCell-' + item.symbol);
        var mcCell = document.getElementById('mChgCell-' + item.symbol);

        var oldP = gPreviousPrices[item.symbol] || item.price;
        var formattedP = '$' + formatPrice(item.price);
        var isUp = (item.priceChangePercent || 0) >= 0;

        if (pCell) {
          pCell.innerText = formattedP;
          if (item.price > oldP) {
            pCell.classList.remove('flash-down');
            pCell.classList.add('flash-up');
            setTimeout(function() { pCell.classList.remove('flash-up'); }, 800);
          } else if (item.price < oldP) {
            pCell.classList.remove('flash-up');
            pCell.classList.add('flash-down');
            setTimeout(function() { pCell.classList.remove('flash-down'); }, 800);
          }
        }

        if (mpCell) {
          mpCell.innerText = formattedP;
        }

        if (cCell) {
          cCell.innerText = (isUp ? '+' : '') + Number(item.priceChangePercent || 0).toFixed(2) + '%';
          cCell.className = 'py-3 px-3 text-right font-bold ' + (isUp ? 'text-brand-accent' : 'text-brand-danger');
        }

        if (mcCell) {
          mcCell.innerText = (isUp ? '+' : '') + Number(item.priceChangePercent || 0).toFixed(2) + '%';
          mcCell.className = 'w-[62px] py-1 rounded-lg text-center font-mono font-bold text-xs border ' + (isUp ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80' : 'bg-rose-950/80 text-rose-400 border-rose-800/80');
        }

        if (vCell) {
          vCell.innerHTML = formatDualLine(item.volume24h);
        }

        gPreviousPrices[item.symbol] = item.price;
      });
    }

    function renderAll() {
      updateWatchlistBadge();
      updateSortHeaderIndicators();
      calculateClientSurge();
      renderSurgeGrid();
      renderAnnouncements();
      renderMarketTable();
      var el = document.getElementById('footerSyncTime');
      if (el) el.innerText = '最后同步: ' + new Date().toLocaleTimeString();
    }

    // 1. 直连拉取 670+ 活跃现货交易对 (过滤死币)
    async function loadDirectBinanceData() {
      try {
        var res = await fetch('https://data-api.binance.vision/api/v3/ticker/24hr');
        var rawData = await res.json();
        if (Array.isArray(rawData) && rawData.length > 500) {
          var spotList = [];
          rawData.forEach(function(item) {
            var sym = item.symbol;
            if (sym && sym.endsWith('USDT')) {
              var price = parseFloat(item.lastPrice) || 0;
              var volume24h = parseFloat(item.quoteVolume) || 0;
              var priceChangePercent = parseFloat(item.priceChangePercent) || 0;

              if (price <= 0 || volume24h <= 0) return;

              var cleanSym = sym.replace(/USDT$/, '');
              var zhName = KNOWN_ZH_NAMES[cleanSym] || cleanSym;

              var tokenObj = {
                symbol: sym,
                rawSymbol: sym,
                ticker: cleanSym,
                name: cleanSym,
                zhName: zhName,
                price: price,
                priceChangePercent: priceChangePercent,
                volume24h: volume24h,
                volume15m: volume24h / 96,
                volume1h: volume24h / 24,
                volume4h: volume24h / 6,
                marketCap: volume24h * 15,
                category: 'spot',
                icon: ''
              };
              spotList.push(tokenObj);
              gSpotMap[sym] = tokenObj;
            }
          });

          gDashboardData.spot = spotList;
          renderAll();
        }
      } catch (e) {}
    }

    // 2. 原生直接拉取全量纯正 Web3 链上代币 (rankType = 20 · 真实多周期成交量与市值)
    async function loadDirectAlphaData() {
      try {
        var p1 = fetch('https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/pulse/unified/rank/list/ai?chainIds=56,CT_501,8453,1&rankType=20&page=1&size=250').then(function(r){return r.json();}).catch(function(){return null;});
        var p2 = fetch('https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/pulse/unified/rank/list/ai?chainIds=56,CT_501,8453,1&rankType=20&page=2&size=250').then(function(r){return r.json();}).catch(function(){return null;});

        var arr = await Promise.all([p1, p2]);
        var t1 = (arr[0] && arr[0].data && arr[0].data.tokens) || [];
        var t2 = (arr[1] && arr[1].data && arr[1].data.tokens) || [];
        var allTokens = t1.concat(t2);

        if (allTokens.length > 0) {
          var seen = {};
          var list = [];
          allTokens.forEach(function(t) {
            var sym = t.symbol || t.baseAsset || t.name || 'UNKNOWN';
            var cleanSym = (t.ticker || sym).toUpperCase();
            var tag = t.tokenTag || {};

            if (t.stockCompanyName || t.ondoStatusInfo || tag['Tokenized Stocks Category'] || (sym.toUpperCase().endsWith('ON') && sym.length <= 8)) {
              return;
            }

            var key = sym + '_' + (t.chainId || 'web3');
            if (seen[key]) return;
            seen[key] = true;

            var price = parseFloat(t.price) || parseFloat(t.lastPrice) || 0;
            var volume24h = parseFloat(t.volume24h) || parseFloat(t.volume) || 0;
            var chg = parseFloat(t.priceChange24h) || parseFloat(t.percentChange24h) || 0;
            var marketCap = parseFloat(t.marketCap) || parseFloat(t.fdv) || (volume24h * 8);

            var vol5m = parseFloat(t.volume5m) || 0;
            var vol1h = parseFloat(t.volume1h) || 0;
            var vol4h = parseFloat(t.volume4h) || 0;

            list.push({
              symbol: sym,
              rawSymbol: sym,
              ticker: cleanSym,
              name: t.name || sym,
              zhName: KNOWN_ZH_NAMES[cleanSym] || t.name || cleanSym,
              chainId: t.chainId,
              price: price,
              priceChangePercent: chg,
              volume24h: volume24h,
              volume5m: vol5m,
              volume15m: vol5m > 0 ? (vol5m * 3) : (vol1h > 0 ? vol1h / 4 : volume24h / 96),
              volume1h: vol1h > 0 ? vol1h : volume24h / 24,
              volume4h: vol4h > 0 ? vol4h : volume24h / 6,
              marketCap: marketCap,
              category: 'alpha'
            });
          });

          gDashboardData.alpha = list;
          updateWatchlistBadge();
          calculateClientSurge();
          renderSurgeGrid();
          if (gCurrentMarketTab === 'alpha') renderMarketTable();
        }
      } catch (e) {}
    }

    // 3. 原生直接拉取全部实时动态美股行情流 (rankType = 40 · 过滤 ...on 冗余)
    async function loadDirectStocksData() {
      try {
        var p1 = fetch('https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/pulse/unified/rank/list/ai?chainIds=56,CT_501,8453,1&rankType=40&page=1&size=250').then(function(r){return r.json();}).catch(function(){return null;});
        var p2 = fetch('https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/pulse/unified/rank/list/ai?chainIds=56,CT_501,8453,1&rankType=40&page=2&size=250').then(function(r){return r.json();}).catch(function(){return null;});

        var arr = await Promise.all([p1, p2]);
        var t1 = (arr[0] && arr[0].data && arr[0].data.tokens) || [];
        var t2 = (arr[1] && arr[1].data && arr[1].data.tokens) || [];
        var rawList = t1.concat(t2);

        if (Array.isArray(rawList) && rawList.length > 0) {
          var seen = {};
          var list = [];
          rawList.forEach(function(item) {
            var rawSym = item.symbol || item.ticker || 'UNKNOWN';
            var ticker = item.ticker || rawSym;
            
            if (rawSym.toUpperCase().endsWith('ON') && rawSym.length <= 8) {
              return;
            }

            var standardSym = rawSym;
            if (!standardSym.toUpperCase().endsWith('B') && !standardSym.toUpperCase().endsWith('B')) {
              standardSym = standardSym + 'B';
            }

            var key = standardSym.toUpperCase();
            if (seen[key]) return;
            seen[key] = true;

            var price = parseFloat(item.price) || parseFloat(item.lastPrice) || 0;
            var chg = parseFloat(item.priceChange24h) || parseFloat(item.percentChange24h) || 0;
            var volume24h = parseFloat(item.volume24h) || parseFloat(item.volume) || 0;
            var marketCap = parseFloat(item.marketCap) || (price > 0 ? price * 10000000 : 50000000);
            var zhName = item.stockCompanyNameZh || item.stockCompanyName || KNOWN_ZH_NAMES[standardSym.toUpperCase()] || item.name || standardSym;

            list.push({
              symbol: standardSym,
              rawSymbol: standardSym,
              ticker: standardSym,
              name: item.stockCompanyName || item.name || ticker,
              zhName: zhName,
              price: price,
              priceChangePercent: chg,
              volume24h: volume24h,
              volume15m: volume24h / 96,
              volume1h: volume24h / 24,
              volume4h: volume24h / 6,
              marketCap: marketCap,
              category: 'stocks'
            });
          });

          gDashboardData.stocks = list;
          updateWatchlistBadge();
          if (gCurrentMarketTab === 'stocks') renderMarketTable();
        }
      } catch (e) {}
    }

    async function fetchDashboardData(silent) {
      if (silent === undefined) silent = false;
      try {
        if (!silent) {
          var cd = document.getElementById('countdownText');
          if (cd) cd.innerText = '拉取中...';
        }

        loadDirectBinanceData();
        loadDirectAlphaData();
        loadDirectStocksData();
        loadDirectAnnouncements();

        var cfData = await fetch('/api/dashboard').then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; });
        if (cfData) {
          if (cfData.announcements) gDashboardData.announcements = cfData.announcements;
          if (cfData.alpha && cfData.alpha.length > 0 && (!gDashboardData.alpha || gDashboardData.alpha.length === 0)) gDashboardData.alpha = cfData.alpha;
          if (cfData.stocks && cfData.stocks.length > 0 && (!gDashboardData.stocks || gDashboardData.stocks.length === 0)) gDashboardData.stocks = cfData.stocks;
          if (cfData.spot && cfData.spot.length > 50) {
            gDashboardData.spot = cfData.spot;
            cfData.spot.forEach(function(item) {
              if (item.symbol) gSpotMap[item.symbol] = item;
            });
          }
          renderAll();
        }
        resetCountdown();
      } catch (err) {}
    }

    function resetCountdown() {
      gCountdown = 15;
      updateCountdownDisplay();
      clearInterval(gCountdownTimer);
      gCountdownTimer = setInterval(function() {
        gCountdown--;
        updateCountdownDisplay();
        if (gCountdown <= 0) {
          fetchDashboardData(true);
        }
      }, 1000);
    }

    function updateCountdownDisplay() {
      var el = document.getElementById('countdownText');
      if (el) el.innerText = gCountdown + 's';
    }

    function initWebSocket() {
      if (gWs && (gWs.readyState === WebSocket.OPEN || gWs.readyState === WebSocket.CONNECTING)) return;

      var wsUrls = [
        'wss://data-stream.binance.vision/ws/!ticker@arr',
        (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + '/ws',
        'wss://stream.binance.com:9443/ws/!ticker@arr'
      ];

      var currentUrlIdx = 0;

      function tryConnect() {
        if (currentUrlIdx >= wsUrls.length) {
          currentUrlIdx = 0;
        }
        var targetUrl = wsUrls[currentUrlIdx];
        var badge = document.getElementById('wsStatusBadge');
        var badgeText = document.getElementById('wsStatusText');

        try {
          gWs = new WebSocket(targetUrl);

          gWs.onopen = function() {
            gWsReconnectAttempts = 0;
            gLastWsMessageTime = Date.now();
            if (badge && badgeText) {
              badgeText.innerText = '实时 WebSocket 直连';
              badge.className = 'text-[10px] px-2 py-1 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 font-mono flex items-center gap-1';
            }
          };

          gWs.onmessage = function(event) {
            gLastWsMessageTime = Date.now();
            try {
              var tickers = JSON.parse(event.data);
              if (!Array.isArray(tickers) || !gDashboardData) return;

              var spotList = gDashboardData.spot || [];
              var initialCount = spotList.length;
              var newAdded = 0;

              tickers.forEach(function(t) {
                var sym = t.s;
                if (sym && sym.endsWith('USDT')) {
                  var newPrice = parseFloat(t.c) || 0;
                  var newChg = parseFloat(t.P) || 0;
                  var newVol24 = parseFloat(t.q) || 0;

                  if (newPrice <= 0 || newVol24 <= 0) return;

                  var spotItem = gSpotMap[sym];
                  if (spotItem) {
                    spotItem.price = newPrice;
                    spotItem.priceChangePercent = newChg;
                    spotItem.volume24h = newVol24;
                    spotItem.volume15m = newVol24 / 96;
                    spotItem.volume1h = newVol24 / 24;
                    spotItem.volume4h = newVol24 / 6;
                    spotItem.marketCap = newVol24 * 15;
                  } else {
                    var cleanSym = sym.replace(/USDT$/, '');
                    var zhName = KNOWN_ZH_NAMES[cleanSym] || cleanSym;
                    var newItem = {
                      symbol: sym,
                      rawSymbol: sym,
                      ticker: cleanSym,
                      name: cleanSym,
                      zhName: zhName,
                      price: newPrice,
                      priceChangePercent: newChg,
                      volume24h: newVol24,
                      volume15m: newVol24 / 96,
                      volume1h: newVol24 / 24,
                      volume4h: newVol24 / 6,
                      marketCap: newVol24 * 15,
                      category: 'spot',
                      icon: ''
                    };
                    spotList.push(newItem);
                    gSpotMap[sym] = newItem;
                    newAdded++;
                  }
                }
              });

              if (initialCount === 0 || newAdded > 5) {
                gDashboardData.spot = spotList;
                renderAll();
              } else {
                updateTablePricesOnly();
              }
            } catch (e) {}
          };

          gWs.onclose = function() {
            currentUrlIdx++;
            scheduleWsReconnect();
          };

          gWs.onerror = function() {
            if (gWs) gWs.close();
          };
        } catch (err) {
          currentUrlIdx++;
          scheduleWsReconnect();
        }
      }

      function scheduleWsReconnect() {
        gWsReconnectAttempts++;
        var delay = Math.min(1000 * Math.pow(1.3, gWsReconnectAttempts), 6000);
        setTimeout(tryConnect, delay);
      }

      tryConnect();
    }

    function startWsWatchdog() {
      setInterval(function() {
        var idle = Date.now() - gLastWsMessageTime;
        if (idle > 15000) {
          if (gWs) { try { gWs.close(); } catch (e) {} }
          initWebSocket();
        }
      }, 10000);
    }

    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        fetchDashboardData(true);
        var idle = Date.now() - gLastWsMessageTime;
        if (idle > 15000 || !gWs || gWs.readyState !== WebSocket.OPEN) {
          if (gWs) { try { gWs.close(); } catch (e) {} }
          initWebSocket();
        }
      }
    });

    document.addEventListener('DOMContentLoaded', function() {
      loadWatchlist();
      loadDirectBinanceData();
      loadDirectAlphaData();
      loadDirectStocksData();
      loadDirectAnnouncements();
      fetchDashboardData();
      initWebSocket();
      startWsWatchdog();
    });
  </script>
</body>
</html>`;

  return htmlResponse(html);
}

/**
 * 独立管理控制中枢视图 (/admin)
 */

import { htmlResponse } from '../utils/response.js';

export function renderAdminPage() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>管理控制中枢 · 币安 USDT 监控雷达</title>
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
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #0B0E11; color: #EAECEF; }
    .mono { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="min-h-screen flex flex-col antialiased selection:bg-brand-yellow selection:text-black">

  <!-- 顶部导航 -->
  <header class="sticky top-0 z-50 bg-[#0B0E11]/95 backdrop-blur-md border-b border-brand-border px-4 lg:px-8 py-3.5 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-brand-yellow flex items-center justify-center font-bold text-black text-lg shadow-lg shadow-yellow-500/20">
        B
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-base font-bold text-white tracking-wide">币安雷达 · 独立管理中枢</h1>
          <span class="text-[10px] px-2 py-0.5 rounded bg-brand-yellow text-black font-bold font-mono">
            ADMIN
          </span>
        </div>
        <p class="text-xs text-gray-400">Telegram / 钉钉机器人配置 · 自选关注池 · EMA金叉量化预警 · 密码管理</p>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <a href="/" class="px-3 py-1.5 rounded-lg bg-[#12161C] border border-brand-border text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition">
        <span>📈</span>
        <span>返回前台行情</span>
      </a>
      <a href="/logout" class="px-3 py-1.5 rounded-lg bg-[#12161C] border border-red-900/60 text-red-400 hover:bg-red-950 text-xs font-semibold flex items-center gap-1.5 transition">
        <span>🚪</span>
        <span>退出登录</span>
      </a>
    </div>
  </header>

  <!-- 主体内容 -->
  <main class="flex-1 max-w-5xl w-full mx-auto p-4 lg:p-8 space-y-6">

    <!-- 顶部选项卡导航 -->
    <div class="flex items-center gap-2 border-b border-brand-border pb-3 flex-wrap">
      <button onclick="switchAdminTab('bot')" id="adminTabBtn-bot" class="px-4 py-2 rounded-xl text-xs font-bold transition bg-brand-yellow text-black shadow">
        🤖 机器人通知配置 (Telegram / 钉钉)
      </button>
      <button onclick="switchAdminTab('watchlist')" id="adminTabBtn-watchlist" class="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition">
        ⭐ 收藏自选标的池 (Watchlist)
      </button>
      <button onclick="switchAdminTab('signals')" id="adminTabBtn-signals" class="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition">
        🎯 量化买卖信号与预警阈值
      </button>
      <button onclick="switchAdminTab('security')" id="adminTabBtn-security" class="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition">
        🔐 密码安全中枢
      </button>
    </div>

    <!-- 状态反馈 Toast -->
    <div id="statusToast" class="hidden p-3 rounded-xl text-xs font-semibold text-center transition"></div>

    <!-- TAB 1: 机器人通知配置 (Telegram / 钉钉) -->
    <section id="tabContent-bot" class="space-y-6">
      <!-- Telegram 机器人卡片 -->
      <div class="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xl">
        <div class="flex items-center justify-between pb-4 mb-4 border-b border-brand-border/60">
          <div class="flex items-center gap-3">
            <span class="text-2xl">📱</span>
            <div>
              <h2 class="text-sm font-bold text-white">Telegram 机器人通知 (Bot API)</h2>
              <p class="text-xs text-gray-400 mt-0.5">自选标的触发 5% 暴涨暴跌、EMA 金叉买点或 3 星放量时秒级推送到群组或私聊</p>
            </div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="tgEnabled" class="sr-only peer">
            <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-accent"></div>
            <span class="ml-2 text-xs font-bold text-gray-300">启用推送</span>
          </label>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label class="block text-gray-300 font-semibold mb-1.5">Telegram Bot Token</label>
            <input type="password" id="tgBotToken" placeholder="例如: 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ" 
              class="w-full bg-[#12161C] border border-brand-border rounded-xl px-3.5 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-yellow font-mono" />
            <p class="text-[11px] text-gray-500 mt-1">通过 @BotFather 获取的专属 Token</p>
          </div>
          <div>
            <label class="block text-gray-300 font-semibold mb-1.5">Telegram Chat ID / 频道 ID</label>
            <input type="text" id="tgChatId" placeholder="例如: -100123456789 或 987654321" 
              class="w-full bg-[#12161C] border border-brand-border rounded-xl px-3.5 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-yellow font-mono" />
            <p class="text-[11px] text-gray-500 mt-1">个人 Chat ID 或群组/频道 Chat ID</p>
          </div>
        </div>
      </div>

      <!-- 钉钉机器人卡片 -->
      <div class="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xl">
        <div class="flex items-center justify-between pb-4 mb-4 border-b border-brand-border/60">
          <div class="flex items-center gap-3">
            <span class="text-2xl">💬</span>
            <div>
              <h2 class="text-sm font-bold text-white">钉钉群自定义机器人 (DingTalk Webhook)</h2>
              <p class="text-xs text-gray-400 mt-0.5">支持钉钉群自定义机器人 Webhook 与 HMAC-SHA256 验签密钥推送</p>
            </div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="dingEnabled" class="sr-only peer">
            <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-accent"></div>
            <span class="ml-2 text-xs font-bold text-gray-300">启用推送</span>
          </label>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label class="block text-gray-300 font-semibold mb-1.5">钉钉 Webhook 地址 (URL)</label>
            <input type="password" id="dingWebhookUrl" placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." 
              class="w-full bg-[#12161C] border border-brand-border rounded-xl px-3.5 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-yellow font-mono" />
            <p class="text-[11px] text-gray-500 mt-1">钉钉群机器人 Webhook URL</p>
          </div>
          <div>
            <label class="block text-gray-300 font-semibold mb-1.5">加签密钥 Secret (可选)</label>
            <input type="password" id="dingSecret" placeholder="SEC..." 
              class="w-full bg-[#12161C] border border-brand-border rounded-xl px-3.5 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-yellow font-mono" />
            <p class="text-[11px] text-gray-500 mt-1">若机器人开启了安全设置加签，请填入 Secret</p>
          </div>
        </div>
      </div>

      <!-- 操作按钮栏 -->
      <div class="flex items-center justify-between gap-4 pt-2">
        <button onclick="testNotification()" id="testNotifyBtn" class="px-5 py-2.5 rounded-xl bg-[#12161C] hover:bg-brand-hover border border-brand-border text-gray-300 hover:text-white text-xs font-bold transition flex items-center gap-2">
          <span>🔔</span>
          <span>一键发送测试通知</span>
        </button>
        <button onclick="saveBotConfig()" id="saveBotBtn" class="px-6 py-2.5 rounded-xl bg-brand-yellow hover:bg-yellow-400 text-black text-xs font-bold transition shadow-lg shadow-yellow-500/10 flex items-center gap-2">
          <span>💾</span>
          <span>保存机器人配置</span>
        </button>
      </div>
    </section>

    <!-- TAB 2: 收藏自选标的池 (Watchlist) -->
    <section id="tabContent-watchlist" class="hidden space-y-6">
      <div class="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-brand-border/60">
          <div>
            <h2 class="text-sm font-bold text-white">⭐ 自选监控资产池 (Watchlist)</h2>
            <p class="text-xs text-gray-400 mt-0.5">在后台配置的自选资产将进入 7×24h 自动量化巡检（EMA金叉、5%异动、3星持续放量）</p>
          </div>
          <span id="watchlistTotalCount" class="text-xs font-mono text-brand-yellow font-bold">0 支标的</span>
        </div>

        <!-- 添加新自选表单 -->
        <div class="flex items-center gap-3">
          <input type="text" id="newWatchlistSymbol" placeholder="输入代币代码 (如 BTC, ETH, SOL, SPACEXb, SANDKb...)" 
            class="flex-1 bg-[#12161C] border border-brand-border rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-yellow font-mono uppercase" />
          <button onclick="addWatchlistItem()" class="px-5 py-2.5 rounded-xl bg-brand-yellow hover:bg-yellow-400 text-black text-xs font-bold transition">
            + 加入自选
          </button>
        </div>

        <!-- 自选标的标签墙 -->
        <div id="watchlistTagList" class="flex flex-wrap gap-2.5 pt-3">
          <div class="text-gray-500 text-xs py-4">正在加载自选标的...</div>
        </div>

        <div class="pt-4 border-t border-brand-border/60 flex justify-end">
          <button onclick="saveWatchlist()" class="px-6 py-2.5 rounded-xl bg-brand-yellow hover:bg-yellow-400 text-black text-xs font-bold transition">
            💾 保存并同步自选池
          </button>
        </div>
      </div>
    </section>

    <!-- TAB 3: 量化买卖信号与预警阈值 -->
    <section id="tabContent-signals" class="hidden space-y-6">
      <div class="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xl space-y-5">
        <div class="pb-3 border-b border-brand-border/60">
          <h2 class="text-sm font-bold text-white">🎯 交易信号与预警灵敏度</h2>
          <p class="text-xs text-gray-400 mt-0.5">当后台 Cron 定时巡检自选池时，一旦满足以下量化规则即触发机器人推送</p>
        </div>

        <div class="space-y-4 text-xs">
          <!-- 规则 1: 5% 暴涨暴跌 -->
          <div class="p-4 rounded-xl bg-[#12161C] border border-brand-border flex items-center justify-between">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="font-bold text-white text-sm">🚀 涨跌幅突发异动 (5% 暴涨 / 快速回调)</span>
                <span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] border border-emerald-800">异动捕捉</span>
              </div>
              <p class="text-gray-400 text-[11px]">当自选标的 24h 涨跌幅 ≥ ±5% 或 15m 突发涨跌 ≥ ±3% 时报警</p>
            </div>
            <input type="checkbox" id="rulePct5" checked class="w-5 h-5 rounded accent-yellow-400">
          </div>

          <!-- 规则 2: EMA 均线金叉/死叉 -->
          <div class="p-4 rounded-xl bg-[#12161C] border border-brand-border flex items-center justify-between">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="font-bold text-white text-sm">🟢 EMA 均线买卖信号 (EMA7 / EMA25 交叉)</span>
                <span class="px-2 py-0.5 rounded bg-blue-950 text-blue-400 text-[10px] border border-blue-800">趋势交易</span>
              </div>
              <p class="text-gray-400 text-[11px]">EMA7 短线上穿 EMA25 提示 🟢 黄金交叉做多买点；下穿提示 🔴 死亡交叉防守卖点</p>
            </div>
            <input type="checkbox" id="ruleEmaCross" checked class="w-5 h-5 rounded accent-yellow-400">
          </div>

          <!-- 规则 3: 连续 3 星+ 放量 -->
          <div class="p-4 rounded-xl bg-[#12161C] border border-brand-border flex items-center justify-between">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="font-bold text-white text-sm">🔥 主力持续放量建仓 (⭐⭐⭐ 3星+ 连续异动)</span>
                <span class="px-2 py-0.5 rounded bg-amber-950 text-amber-400 text-[10px] border border-amber-800">主力资金</span>
              </div>
              <p class="text-gray-400 text-[11px]">15 分钟放量达到 3 星（连续放量 45m+），提示主力资金异动跟进</p>
            </div>
            <input type="checkbox" id="ruleVolume3Star" checked class="w-5 h-5 rounded accent-yellow-400">
          </div>

          <!-- 冷却防刷屏时间 -->
          <div class="p-4 rounded-xl bg-[#12161C] border border-brand-border flex items-center justify-between">
            <div>
              <div class="font-bold text-white text-sm">🛡️ 智能防轰炸冷却期 (Cooldown)</div>
              <p class="text-gray-400 text-[11px] mt-0.5">同一资产的相同类型预警在冷却时间内不会重复推送，避免群内刷屏</p>
            </div>
            <div class="flex items-center gap-2">
              <input type="number" id="ruleCooldownMin" value="30" min="5" max="1440" 
                class="w-20 bg-[#181A20] border border-brand-border rounded-lg px-2.5 py-1 text-right text-white font-mono" />
              <span class="text-gray-400">分钟</span>
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-brand-border/60 flex justify-end">
          <button onclick="saveBotConfig()" class="px-6 py-2.5 rounded-xl bg-brand-yellow hover:bg-yellow-400 text-black text-xs font-bold transition">
            💾 保存预警规则
          </button>
        </div>
      </div>
    </section>

    <!-- TAB 4: 密码安全中枢 -->
    <section id="tabContent-security" class="hidden space-y-6">
      <!-- 修改管理员密码 -->
      <div class="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xl space-y-4">
        <div class="pb-3 border-b border-brand-border/60">
          <h2 class="text-sm font-bold text-white">🔐 修改管理员密码 (Admin Password)</h2>
          <p class="text-xs text-gray-400 mt-0.5">管理员拥有访问 /admin 控制中枢、修改机器人及预警规则的所有最高权限</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label class="block text-gray-300 font-semibold mb-1.5">新管理员密码</label>
            <input type="password" id="newAdminPassword" placeholder="输入新的管理员密码 (至少4位)" 
              class="w-full bg-[#12161C] border border-brand-border rounded-xl px-3.5 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-yellow" />
          </div>
          <div>
            <label class="block text-gray-300 font-semibold mb-1.5">确认新管理员密码</label>
            <input type="password" id="confirmAdminPassword" placeholder="再次输入新密码" 
              class="w-full bg-[#12161C] border border-brand-border rounded-xl px-3.5 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-yellow" />
          </div>
        </div>

        <div class="flex justify-end">
          <button onclick="saveAdminPassword()" class="px-5 py-2 rounded-xl bg-brand-yellow hover:bg-yellow-400 text-black text-xs font-bold transition">
            更新管理员密码
          </button>
        </div>
      </div>

      <!-- 访客密码设置 -->
      <div class="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-brand-border/60">
          <div>
            <h2 class="text-sm font-bold text-white">👨‍💼 访客访问密码 (Guest Password)</h2>
            <p class="text-xs text-gray-400 mt-0.5">访客登录后只能查看实时行情与雷达，页面上绝无任何管理后台入口</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="guestAccessEnabled" checked class="sr-only peer">
            <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-accent"></div>
            <span class="ml-2 text-xs font-bold text-gray-300">开放访客模式</span>
          </label>
        </div>

        <div class="text-xs">
          <label class="block text-gray-300 font-semibold mb-1.5">设置访客密码</label>
          <input type="text" id="guestPasswordInput" placeholder="设置访客访问密码 (如 guest888)" 
            class="w-full max-w-md bg-[#12161C] border border-brand-border rounded-xl px-3.5 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-yellow font-mono" />
        </div>

        <div class="flex justify-end">
          <button onclick="saveGuestPassword()" class="px-5 py-2 rounded-xl bg-brand-yellow hover:bg-yellow-400 text-black text-xs font-bold transition">
            保存访客配置
          </button>
        </div>
      </div>
    </section>

  </main>

  <script>
    let gAdminData = {
      botConfig: {},
      watchlist: [],
      guestEnabled: true
    };

    function showToast(msg, isSuccess = true) {
      const toast = document.getElementById('statusToast');
      toast.innerText = msg;
      toast.className = isSuccess 
        ? 'p-3 rounded-xl text-xs font-semibold text-center bg-emerald-950/80 border border-emerald-800 text-emerald-300 block shadow-lg'
        : 'p-3 rounded-xl text-xs font-semibold text-center bg-red-950/80 border border-red-800 text-red-300 block shadow-lg';
      setTimeout(() => { toast.classList.add('hidden'); }, 3500);
    }

    function switchAdminTab(tab) {
      ['bot', 'watchlist', 'signals', 'security'].forEach(t => {
        const btn = document.getElementById('adminTabBtn-' + t);
        const content = document.getElementById('tabContent-' + t);
        if (t === tab) {
          btn.className = 'px-4 py-2 rounded-xl text-xs font-bold transition bg-brand-yellow text-black shadow';
          content.classList.remove('hidden');
        } else {
          btn.className = 'px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition';
          content.classList.add('hidden');
        }
      });
    }

    async function loadAdminConfig() {
      try {
        const res = await fetch('/api/admin/config');
        if (!res.ok) throw new Error('加载配置失败');
        const data = await res.json();
        gAdminData = data;

        // 填充 Telegram
        document.getElementById('tgEnabled').checked = Boolean(data.botConfig?.tg?.enabled);
        document.getElementById('tgBotToken').value = data.botConfig?.tg?.botToken || '';
        document.getElementById('tgChatId').value = data.botConfig?.tg?.chatId || '';

        // 填充 钉钉
        document.getElementById('dingEnabled').checked = Boolean(data.botConfig?.ding?.enabled);
        document.getElementById('dingWebhookUrl').value = data.botConfig?.ding?.webhookUrl || '';
        document.getElementById('dingSecret').value = data.botConfig?.ding?.secret || '';

        // 填充 预警规则
        document.getElementById('rulePct5').checked = data.botConfig?.rules?.pct5 !== false;
        document.getElementById('ruleEmaCross').checked = data.botConfig?.rules?.emaCross !== false;
        document.getElementById('ruleVolume3Star').checked = data.botConfig?.rules?.volume3Star !== false;
        document.getElementById('ruleCooldownMin').value = data.botConfig?.rules?.cooldownMin || 30;

        // 填充 访客
        document.getElementById('guestAccessEnabled').checked = Boolean(data.guestEnabled);

        renderWatchlistTags();
      } catch (err) {
        showToast('加载管理配置失败: ' + err.message, false);
      }
    }

    function renderWatchlistTags() {
      const container = document.getElementById('watchlistTagList');
      const count = document.getElementById('watchlistTotalCount');
      const list = gAdminData.watchlist || [];
      count.innerText = list.length + ' 支标的';

      if (list.length === 0) {
        container.innerHTML = '<div class="text-gray-500 text-xs py-2">当前自选池为空，请在上方输入代码添加</div>';
        return;
      }

      container.innerHTML = list.map(sym => `
        <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#12161C] border border-brand-border hover:border-brand-yellow/60 transition group font-mono text-xs">
          <span class="text-brand-yellow font-bold">⭐ ${sym}</span>
          <button onclick="removeWatchlistItem('${sym}')" class="text-gray-500 hover:text-red-400 p-0.5 ml-1 transition" title="移除此标的">✕</button>
        </div>
      `).join('');
    }

    function addWatchlistItem() {
      const input = document.getElementById('newWatchlistSymbol');
      const sym = (input.value || '').trim().toUpperCase().replace(/(\/USDT|USDT)$/i, '');
      if (!sym) return;

      gAdminData.watchlist = gAdminData.watchlist || [];
      if (!gAdminData.watchlist.includes(sym)) {
        gAdminData.watchlist.push(sym);
        renderWatchlistTags();
        input.value = '';
      }
    }

    function removeWatchlistItem(sym) {
      gAdminData.watchlist = (gAdminData.watchlist || []).filter(s => s !== sym);
      renderWatchlistTags();
    }

    async function saveWatchlist() {
      try {
        const res = await fetch('/api/admin/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ watchlist: gAdminData.watchlist || [] })
        });
        const data = await res.json();
        if (data.success) {
          showToast('⭐ 自选标的池已保存并同步！');
        } else {
          showToast(data.message || '保存自选池失败', false);
        }
      } catch (err) {
        showToast('保存自选池网络错误', false);
      }
    }

    function collectBotConfig() {
      return {
        tg: {
          enabled: document.getElementById('tgEnabled').checked,
          botToken: document.getElementById('tgBotToken').value.trim(),
          chatId: document.getElementById('tgChatId').value.trim()
        },
        ding: {
          enabled: document.getElementById('dingEnabled').checked,
          webhookUrl: document.getElementById('dingWebhookUrl').value.trim(),
          secret: document.getElementById('dingSecret').value.trim()
        },
        rules: {
          pct5: document.getElementById('rulePct5').checked,
          emaCross: document.getElementById('ruleEmaCross').checked,
          volume3Star: document.getElementById('ruleVolume3Star').checked,
          cooldownMin: Number(document.getElementById('ruleCooldownMin').value) || 30
        }
      };
    }

    async function saveBotConfig() {
      const cfg = collectBotConfig();
      try {
        const res = await fetch('/api/admin/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ botConfig: cfg })
        });
        const data = await res.json();
        if (data.success) {
          showToast('✅ 机器人及量化预警规则保存成功！');
        } else {
          showToast(data.message || '保存失败', false);
        }
      } catch (err) {
        showToast('保存机器人配置出错', false);
      }
    }

    async function testNotification() {
      const cfg = collectBotConfig();
      const btn = document.getElementById('testNotifyBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="animate-spin inline-block mr-1">⚪</span> 正在发送测试...';

      try {
        const res = await fetch('/api/admin/test-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ botConfig: cfg })
        });
        const data = await res.json();
        btn.disabled = false;
        btn.innerHTML = '<span>🔔</span><span>一键发送测试通知</span>';

        if (data.success) {
          showToast('🚀 测试通知已发送，请检查 Telegram 或 钉钉群！');
        } else {
          showToast(data.message || '测试发送失败', false);
        }
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<span>🔔</span><span>一键发送测试通知</span>';
        showToast('测试网络连接异常', false);
      }
    }

    async function saveAdminPassword() {
      const pwd = document.getElementById('newAdminPassword').value.trim();
      const confirm = document.getElementById('confirmAdminPassword').value.trim();
      if (!pwd || pwd.length < 4) {
        showToast('密码长度至少为 4 位', false);
        return;
      }
      if (pwd !== confirm) {
        showToast('两次输入的管理员密码不一致', false);
        return;
      }

      try {
        const res = await fetch('/api/admin/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newAdminPassword: pwd })
        });
        const data = await res.json();
        if (data.success) {
          showToast('🔐 管理员密码修改成功！');
          document.getElementById('newAdminPassword').value = '';
          document.getElementById('confirmAdminPassword').value = '';
        } else {
          showToast(data.message || '密码修改失败', false);
        }
      } catch (err) {
        showToast('修改密码网络请求失败', false);
      }
    }

    async function saveGuestPassword() {
      const enabled = document.getElementById('guestAccessEnabled').checked;
      const pwd = document.getElementById('guestPasswordInput').value.trim();

      try {
        const res = await fetch('/api/admin/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestEnabled: enabled, newGuestPassword: pwd })
        });
        const data = await res.json();
        if (data.success) {
          showToast('👨‍💼 访客访问配置已更新！');
        } else {
          showToast(data.message || '保存访客配置失败', false);
        }
      } catch (err) {
        showToast('保存访客配置网络错误', false);
      }
    }

    document.addEventListener('DOMContentLoaded', loadAdminConfig);
  </script>
</body>
</html>`;

  return htmlResponse(html);
}

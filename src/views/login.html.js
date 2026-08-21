/**
 * 独立登录认证视图 (/login)
 */

import { htmlResponse } from '../utils/response.js';

export function renderLoginPage() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>安全访问认证 · 币安 USDT 监控与异动雷达</title>
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
</head>
<body class="min-h-screen bg-[#0B0E11] text-gray-200 flex flex-col items-center justify-center p-4 selection:bg-brand-yellow selection:text-black">
  <div class="w-full max-w-md bg-brand-card border border-brand-border rounded-2xl p-8 shadow-2xl relative overflow-hidden">
    <div class="absolute -top-24 -right-24 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

    <div class="text-center mb-8">
      <div class="w-14 h-14 rounded-2xl bg-brand-yellow flex items-center justify-center font-bold text-black text-2xl mx-auto shadow-lg shadow-yellow-500/20 mb-4">
        B
      </div>
      <h1 class="text-xl font-bold text-white tracking-wide">币安 USDT 监控与异动雷达</h1>
      <p class="text-xs text-gray-400 mt-1.5">私有安全终端 · 请输入访问密码</p>
    </div>

    <form id="loginForm" onsubmit="handleLogin(event)" class="space-y-5">
      <div>
        <label class="block text-xs font-semibold text-gray-300 mb-2">访问密码 (Password)</label>
        <input 
          type="password" 
          id="passwordInput" 
          placeholder="请输入管理员密码或访客密码" 
          required
          autocomplete="current-password"
          class="w-full bg-[#12161C] border border-brand-border rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow transition"
        />
        <p class="text-[11px] text-gray-500 mt-2">
          💡 系统自动识别角色：输入管理员密码开放管理中枢，输入访客密码仅浏览实时行情。
        </p>
      </div>

      <div id="errorAlert" class="hidden p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-xs text-center"></div>

      <button 
        type="submit" 
        id="submitBtn"
        class="w-full py-3 px-4 rounded-xl bg-brand-yellow hover:bg-yellow-400 text-black font-bold text-sm tracking-wide transition transform active:scale-[0.99] shadow-lg shadow-yellow-500/10 flex items-center justify-center gap-2"
      >
        <span>🔓 立即验证进入</span>
      </button>
    </form>

    <div class="mt-8 pt-6 border-t border-brand-border/60 text-center text-[11px] text-gray-500">
      <span>Binance Surge Radar · 边缘安全隔离系统</span>
    </div>
  </div>

  <script>
    async function handleLogin(e) {
      e.preventDefault();
      const pwdInput = document.getElementById('passwordInput');
      const errBox = document.getElementById('errorAlert');
      const btn = document.getElementById('submitBtn');
      const pwd = (pwdInput.value || '').trim();

      if (!pwd) return;

      errBox.classList.add('hidden');
      btn.disabled = true;
      btn.innerHTML = '<span class="animate-spin inline-block mr-2">⚪</span> 正在安全鉴权...';

      try {
        const res = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd })
        });
        const data = await res.json();
        if (data.success) {
          btn.innerHTML = '✅ 验证成功，正在跳转...';
          window.location.href = data.redirect || '/';
        } else {
          errBox.innerText = data.message || '密码错误，请重新输入';
          errBox.classList.remove('hidden');
          btn.disabled = false;
          btn.innerHTML = '<span>🔓 立即验证进入</span>';
          pwdInput.focus();
        }
      } catch (err) {
        errBox.innerText = '网络连接失败，请稍后重试';
        errBox.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = '<span>🔓 立即验证进入</span>';
      }
    }
  </script>
</body>
</html>`;

  return htmlResponse(html);
}

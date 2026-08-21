/**
 * 独立登录认证与首次初始化向导视图
 */

import { htmlResponse } from '../utils/response.js';

const TEMPLATE_HTML = '<!DOCTYPE html>\n<html lang="zh-CN" class="dark">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title><!--PAGE_TITLE--></title>\n  <script src="https://cdn.tailwindcss.com"></script>\n  <script>\n    tailwind.config = {\n      darkMode: \'class\',\n      theme: {\n        extend: {\n          colors: {\n            brand: {\n              yellow: \'#F0B90B\',\n              dark: \'#0B0E11\',\n              card: \'#181A20\',\n              border: \'#2B313A\',\n              hover: \'#202630\',\n              accent: \'#0ECB81\',\n              danger: \'#F6465D\'\n            }\n          }\n        }\n      }\n    };\n  </script>\n</head>\n<body class="min-h-screen bg-[#0B0E11] text-gray-200 flex flex-col items-center justify-center p-4 selection:bg-brand-yellow selection:text-black">\n  <div class="w-full max-w-md bg-brand-card border border-brand-border rounded-2xl p-8 shadow-2xl relative overflow-hidden">\n    <div class="absolute -top-24 -right-24 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>\n    <div class="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>\n\n    <div class="text-center mb-8">\n      <div class="w-14 h-14 rounded-2xl bg-brand-yellow flex items-center justify-center font-bold text-black text-2xl mx-auto shadow-lg shadow-yellow-500/20 mb-4">\n        B\n      </div>\n      <h1 class="text-xl font-bold text-white tracking-wide"><!--HEADER_TITLE--></h1>\n      <p class="text-xs text-gray-400 mt-1.5"><!--HEADER_DESC--></p>\n    </div>\n\n    <!--FORM_BODY-->\n\n    <div class="mt-8 pt-6 border-t border-brand-border/60 text-center text-[11px] text-gray-500">\n      <span>Binance Surge Radar · 零硬编码安全隔离系统</span>\n    </div>\n  </div>\n\n  <script>\n    var IS_SETUP_MODE = <!--IS_SETUP_MODE_FLAG-->;\n\n    async function handleSubmit(e) {\n      e.preventDefault();\n      var errBox = document.getElementById(\'errorAlert\');\n      var btn = document.getElementById(\'submitBtn\');\n\n      errBox.classList.add(\'hidden\');\n\n      if (IS_SETUP_MODE) {\n        var pwd = (document.getElementById(\'setupPassword\').value || \'\').trim();\n        var confirm = (document.getElementById(\'setupConfirmPassword\').value || \'\').trim();\n\n        if (!pwd || pwd.length < 4) {\n          errBox.innerText = \'管理员密码长度至少为 4 位\';\n          errBox.classList.remove(\'hidden\');\n          return;\n        }\n        if (pwd !== confirm) {\n          errBox.innerText = \'两次输入的密码不一致\';\n          errBox.classList.remove(\'hidden\');\n          return;\n        }\n\n        btn.disabled = true;\n        btn.innerHTML = \'<span class="animate-spin inline-block mr-2">⚪</span> 正在初始化写入 KV 存储...\';\n\n        try {\n          var res = await fetch(\'/api/setup\', {\n            method: \'POST\',\n            headers: { \'Content-Type\': \'application/json\' },\n            body: JSON.stringify({ password: pwd, confirmPassword: confirm })\n          });\n          var data = await res.json();\n          if (data.success) {\n            btn.innerHTML = \'✅ 初始化完成，正在跳转...\';\n            window.location.href = data.redirect || \'/\';\n          } else {\n            errBox.innerText = data.message || \'初始化失败\';\n            errBox.classList.remove(\'hidden\');\n            btn.disabled = false;\n            btn.innerHTML = \'<span>🔒 确认创建并初始化系统</span>\';\n          }\n        } catch (err) {\n          errBox.innerText = \'网络连接失败，请稍后重试\';\n          errBox.classList.remove(\'hidden\');\n          btn.disabled = false;\n          btn.innerHTML = \'<span>🔒 确认创建并初始化系统</span>\';\n        }\n\n      } else {\n        var pwd = (document.getElementById(\'passwordInput\').value || \'\').trim();\n        if (!pwd) return;\n\n        btn.disabled = true;\n        btn.innerHTML = \'<span class="animate-spin inline-block mr-2">⚪</span> 正在安全鉴权...\';\n\n        try {\n          var res = await fetch(window.location.pathname, {\n            method: \'POST\',\n            headers: { \'Content-Type\': \'application/json\' },\n            body: JSON.stringify({ password: pwd })\n          });\n          var data = await res.json();\n          if (data.success) {\n            btn.innerHTML = \'✅ 验证成功，正在跳转...\';\n            window.location.href = data.redirect || \'/\';\n          } else {\n            if (data.needSetup) {\n              window.location.reload();\n              return;\n            }\n            errBox.innerText = data.message || \'密码错误，请重新输入\';\n            errBox.classList.remove(\'hidden\');\n            btn.disabled = false;\n            btn.innerHTML = \'<span>🔓 立即验证进入</span>\';\n            document.getElementById(\'passwordInput\').focus();\n          }\n        } catch (err) {\n          errBox.innerText = \'网络连接失败，请稍后重试\';\n          errBox.classList.remove(\'hidden\');\n          btn.disabled = false;\n          btn.innerHTML = \'<span>🔓 立即验证进入</span>\';\n        }\n      }\n    }\n  </script>\n</body>\n</html>';

export function renderLoginPage(isSetupMode = false) {
  let pageTitle = isSetupMode 
    ? '首次部署 · 设置管理员主密码'
    : '安全访问认证 · 币安 USDT 监控与异动雷达';

  let headerTitle = isSetupMode 
    ? '首次部署 · 初始化管理员密码'
    : '币安 USDT 监控与异动雷达';

  let headerDesc = isSetupMode 
    ? '系统未检测到初始口令，请设定你的专属管理员主密码并存入私有 KV'
    : '私有安全终端 · 请输入访问密码';

  let formBody = isSetupMode ? `
    <form id="setupForm" onsubmit="handleSubmit(event)" class="space-y-4">
      <div>
        <label class="block text-xs font-semibold text-gray-300 mb-1.5">创建管理员密码 (至少4位)</label>
        <input 
          type="password" 
          id="setupPassword" 
          placeholder="请输入你的专属管理员主密码" 
          required
          autocomplete="new-password"
          class="w-full bg-[#12161C] border border-brand-border rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow transition font-mono"
        />
      </div>

      <div>
        <label class="block text-xs font-semibold text-gray-300 mb-1.5">确认管理员密码</label>
        <input 
          type="password" 
          id="setupConfirmPassword" 
          placeholder="请再次输入新密码" 
          required
          autocomplete="new-password"
          class="w-full bg-[#12161C] border border-brand-border rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow transition font-mono"
        />
        <p class="text-[11px] text-gray-500 mt-1.5">
          🔒 设定后密码将加密写入私有 KV 存储，初始化通道将永久关闭。
        </p>
      </div>

      <div id="errorAlert" class="hidden p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-xs text-center"></div>

      <button 
        type="submit" 
        id="submitBtn"
        class="w-full py-3 px-4 rounded-xl bg-brand-yellow hover:bg-yellow-400 text-black font-bold text-sm tracking-wide transition transform active:scale-[0.99] shadow-lg shadow-yellow-500/10 flex items-center justify-center gap-2 mt-2"
      >
        <span>🔒 确认创建并初始化系统</span>
      </button>
    </form>
  ` : `
    <form id="loginForm" onsubmit="handleSubmit(event)" class="space-y-5">
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
  `;

  let html = TEMPLATE_HTML
    .replace('<!--PAGE_TITLE-->', pageTitle)
    .replace('<!--HEADER_TITLE-->', headerTitle)
    .replace('<!--HEADER_DESC-->', headerDesc)
    .replace('<!--FORM_BODY-->', formBody)
    .replace('<!--IS_SETUP_MODE_FLAG-->', isSetupMode ? 'true' : 'false');

  return htmlResponse(html);
}

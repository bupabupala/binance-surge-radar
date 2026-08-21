/**
 * 统一响应封装与格式化辅助工具
 */

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders
    }
  });
}

export function htmlResponse(html, status = 200, extraHeaders = {}) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...extraHeaders
    }
  });
}

export function getKVBinding(env) {
  if (!env) return null;
  return env.BIAN_KV || 
         env.KV || 
         env.MARKET_KV || 
         env.binance_surge_radar_kv || 
         env['binance-surge-radar-kv'] || 
         env.RADAR_KV || 
         null;
}

export function formatPrice(val) {
  const p = Number(val);
  if (isNaN(p) || p === 0) return '0.00';
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.0001) return p.toFixed(4);
  return p.toFixed(8);
}

export function formatNumber(num) {
  const n = Number(num);
  if (isNaN(n) || n === 0) return '0.00';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(2);
}

export function formatTimeAgo(timestamp) {
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

export function getChainName(chainId) {
  switch (String(chainId)) {
    case '56': return 'BSC';
    case 'CT_501': return 'Solana';
    case '8453': return 'Base';
    case '1': return 'ETH';
    default: return 'Web3';
  }
}

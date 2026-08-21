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

/**
 * 基于 Cloudflare 官方 REST API 的 KV 适配器
 * 支持在未声明 wrangler.toml [[kv_namespaces]] 时通过 CF_API_TOKEN + BIAN_KV_ID 直接读写
 */
export class RestKVAdapter {
  constructor(apiToken, namespaceId, accountId = null) {
    this.apiToken = (apiToken || '').trim();
    this.namespaceId = (namespaceId || '').trim();
    this.accountId = (accountId || '').trim();
    this._cachedAccountId = this.accountId || null;
  }

  async getAccountId() {
    if (this._cachedAccountId) return this._cachedAccountId;
    try {
      const res = await fetch('https://api.cloudflare.com/client/v4/accounts', {
        headers: { 'Authorization': `Bearer ${this.apiToken}` }
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.result && data.result.length > 0) {
        this._cachedAccountId = data.result[0].id;
        return this._cachedAccountId;
      }
    } catch (e) {
      console.error('自动发现 Cloudflare 账户 ID 失败:', e);
    }
    return null;
  }

  async get(key) {
    try {
      const accId = await this.getAccountId();
      if (!accId) return null;
      const url = `https://api.cloudflare.com/client/v4/accounts/${accId}/storage/kv/namespaces/${this.namespaceId}/values/${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${this.apiToken}` }
      });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return await res.text();
    } catch (e) {
      return null;
    }
  }

  async put(key, value, options = {}) {
    try {
      const accId = await this.getAccountId();
      if (!accId) return false;
      let url = `https://api.cloudflare.com/client/v4/accounts/${accId}/storage/kv/namespaces/${this.namespaceId}/values/${encodeURIComponent(key)}`;
      if (options && options.expirationTtl) {
        url += `?expiration_ttl=${options.expirationTtl}`;
      }
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'text/plain'
        },
        body: typeof value === 'string' ? value : JSON.stringify(value)
      });
      const data = await res.json().catch(() => ({}));
      return res.ok && data.success !== false;
    } catch (e) {
      return false;
    }
  }

  async delete(key) {
    try {
      const accId = await this.getAccountId();
      if (!accId) return false;
      const url = `https://api.cloudflare.com/client/v4/accounts/${accId}/storage/kv/namespaces/${this.namespaceId}/values/${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.apiToken}` }
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }
}

let gCachedKV = null;

export function getKVBinding(env) {
  if (!env || typeof env !== 'object') return null;

  // 1. 优先常规与原生 KV 命名空间绑定
  const priorityKeys = [
    'BIAN_KV', 'KV', 'MARKET_KV', 'RADAR_KV', 'SURGE_KV', 'BINANCE_KV',
    'binance_surge_radar_kv', 'binance-surge-radar-kv', 'KV_BINDING', 'DATA_KV',
    'STORAGE_KV', 'CONFIG_KV'
  ];
  for (const k of priorityKeys) {
    if (env[k] && typeof env[k].get === 'function' && typeof env[k].put === 'function') {
      return env[k];
    }
  }
  for (const key of Object.keys(env)) {
    const val = env[key];
    if (val && typeof val === 'object' && typeof val.get === 'function' && typeof val.put === 'function') {
      return val;
    }
  }

  // 2. 自动降级为基于 Cloudflare REST API 的 KV 适配器 (根据 CF_API_TOKEN + BIAN_KV_ID 自动路由)
  const apiToken = env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN || env.API_TOKEN || '';
  const kvId = env.BIAN_KV_ID || env.KV_ID || env.KV_NAMESPACE_ID || '';
  const accountId = env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || env.ACCOUNT_ID || '';

  if (apiToken && kvId) {
    if (!gCachedKV || gCachedKV.apiToken !== apiToken || gCachedKV.namespaceId !== kvId) {
      gCachedKV = new RestKVAdapter(apiToken, kvId, accountId);
    }
    return gCachedKV;
  }

  return null;
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

/**
 * 全局常量与 API 端点配置
 */

export const KV_KEYS = {
  DASHBOARD_DATA: 'bian:dashboard:data:v5',
  ALPHA_DATA: 'bian:alpha:data:v5',
  STOCKS_DATA: 'bian:stocks:data:v5',
  ANNOUNCEMENTS: 'bian:announcements:v5',
  LAST_SYNC: 'bian:last_sync_time',
  AUTH_CONFIG: 'bian:auth:config',
  BOT_CONFIG: 'bian:admin:bot_config',
  WATCHLIST: 'bian:admin:watchlist',
  ALERT_HISTORY: 'bian:admin:alert_history'
};

export const BINANCE_UPSTREAM = {
  SPOT_24HR: 'https://data-api.binance.vision/api/v3/ticker/24hr',
  ALPHA_UNIFIED_RANK: 'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/pulse/unified/rank/list/ai',
  STOCK_LIST: 'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai',
  ANNOUNCEMENT_CMS: 'https://www.binance.com/bapi/composite/v1/public/cms/article/list/query'
};

export const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'clientType': 'web'
};

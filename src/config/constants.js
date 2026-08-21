/**
 * 全局常量与 API 端点配置
 */

export const KV_KEYS = {
  DASHBOARD_DATA: 'bian:dashboard:data:v5',
  ANNOUNCEMENTS: 'bian:announcements:v5',
  LAST_SYNC: 'bian:last_sync_time',
  AUTH_CONFIG: 'bian:auth:config',
  BOT_CONFIG: 'bian:admin:bot_config',
  WATCHLIST: 'bian:admin:watchlist',
  ALERT_HISTORY: 'bian:admin:alert_history'
};

export const BINANCE_UPSTREAM = {
  SPOT_24HR: 'https://data-api.binance.vision/api/v3/ticker/24hr',
  SPOT_15M: 'https://data-api.binance.vision/api/v3/ticker?windowSize=15m',
  SPOT_1H: 'https://data-api.binance.vision/api/v3/ticker?windowSize=1h',
  SPOT_4H: 'https://data-api.binance.vision/api/v3/ticker?windowSize=4h',
  ALPHA_UNIFIED_RANK: 'https://web3.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/pulse/unified/rank/list/ai',
  STOCK_LIST: 'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai',
  STOCK_MARKET_STATUS: 'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/market/status/ai',
  ANNOUNCEMENT_CMS: 'https://www.binance.com/bapi/composite/v1/public/cms/article/list/query'
};

export const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Encoding': 'identity',
  'clientType': 'web'
};

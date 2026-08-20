# 币安多维行情监控与异动雷达 (Binance Multi-Market Radar)

专为 **Cloudflare Workers** 单文件部署打造的币安多看板聚合平台，支持 **Cloudflare KV 持久化与定时 Cron 自动刷新**，亦支持像 `edgetunnel` 一样的 **零配置单文件直接复制粘贴部署**。

---

## 🌟 核心功能一览

1. **多看板独立分区 (每个各占一块)**：
   - **🔥 交易量激增异动雷达 (Volume Surge Radar)**：实时扫描 `15m`、`1h`、`4h` 周期内交易量激增达平时 1.8x ~ 10x+ 的异常暴涨/暴跌交易对。
   - **📢 三大上币公告看板 (Announcements)**：
     - 现货上币公告 (New Spot Listings)
     - 合约上线公告 (Binance Futures Listings)
     - Alpha / Web3 / Launchpool 上线公告
   - **💎 现货行情看板 (Spot)**：支持按 24h 成交额、市值、价格排序与搜索。
   - **🚀 Alpha 链上代币看板 (Web3 Pulse)**：聚合 BSC、Solana、Base、ETH 热门 Alpha 代币与量价。
   - **🏛️ 代币化美股看板 (Ondo RWA)**：展示美股代币（如 AAPLon, TSLAon, NVDAon）最新价、标的美股价、折溢价与市场开市状态。
2. **市值排行榜多维排序**：
   - 支持 **从小到大 (Ascending ↑)** 挖掘低市值潜力币。
   - 支持 **从大到小 (Descending ↓)** 追踪主流头部资产。
3. **KV 边缘存储与 Edge Cache 降级**：
   - 绑定 KV 后后台 Cron 自动静默拉取并计算，前端访问耗时 `< 10ms`，彻底绕过币安 API 频控。
   - 未绑定 KV 时自动无缝降级为 Cloudflare 边缘 Cache API 模式，开箱即用。

---

## 🚀 部署指南

### 方式一：Cloudflare Dashboard 网页端一键粘贴部署 (最简单，类似 edgetunnel)

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 进入 **Compute (Workers & Pages)** -> **Create application** -> **Create Worker**。
3. 命名为 `binance-radar` 并点击 **Deploy**。
4. 进入 Worker 详情页，点击右上角 **Edit code (快速编辑)**。
5. 将本项目中的 [`_worker.js`](./_worker.js) 的全部内容复制并覆盖粘贴进去。
6. 点击右上角 **Deploy (部署)**，即可立即访问生成的 `https://binance-radar.<your-subdomain>.workers.dev` 域名！

> **可选：开启 KV 存储 (推荐)**
> 1. 在 Cloudflare 控制台侧边栏进入 **Storage & Databases** -> **KV** -> **Create a namespace**，命名为 `BIAN_KV`。
> 2. 回到你的 Worker -> **Settings** -> **Variables & Secrets** -> **KV Namespace Bindings**。
> 3. 添加绑定：变量名设为 `BIAN_KV`，选中刚刚创建的 KV 命名空间即可。

---

### 方式二：使用 Wrangler CLI 命令行部署

1. 安装依赖：
   ```bash
   npm install
   ```
2. 创建 Cloudflare KV 命名空间（可选）：
   ```bash
   npx wrangler kv namespace create BIAN_KV
   ```
   复制终端输出的 `id`，替换到 [`wrangler.toml`](./wrangler.toml) 中的 `id = "..."`。
3. 本地调试预览：
   ```bash
   npm run dev
   ```
4. 一键发布上线：
   ```bash
   npm run deploy
   ```

---

## 📡 API 路由规范

| HTTP 路由 | 方法 | 说明 |
| :--- | :--- | :--- |
| `/` | `GET` | 访问 Web UI 响应式仪表盘 |
| `/api/dashboard` | `GET` | 获取完整全看板 JSON 数据（现货、Alpha、美股、激增榜、公告） |
| `/api/rank` | `GET` | 市值排行 API，参数：`?type=spot\|alpha\|stock&sort=asc\|desc` |
| `/api/surge` | `GET` | 交易量激增 API，参数：`?window=15m\|1h\|4h` |
| `/api/announcements`| `GET` | 最新三大上币公告合集 |
| `/api/sync` | `POST` | 手动强制触发后台聚合与 KV 缓存更新 |
| `/api/health` | `GET` | 健康检查与 KV 绑定状态检测 |

---

## 🛠️ 激增倍率计算算法

$$\text{15m 激增倍率} = \frac{\text{15m 成交额} \times 96}{\text{24h 总成交额}}$$

$$\text{1h 激增倍率} = \frac{\text{1h 成交额} \times 24}{\text{24h 总成交额}}$$

$$\text{4h 激增倍率} = \frac{\text{4h 成交额} \times 6}{\text{24h 总成交额}}$$

当周期折算成交额达 24h 日均成交水平的 **1.6倍及以上** 且满足最小成交门槛时，系统自动判定为异动激增并送入激增雷达。

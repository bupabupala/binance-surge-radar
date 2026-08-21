# 币安多维行情监控与异动雷达 (Binance Multi-Market Radar)

> 🚀 **全天候云端量化监控平台**：专为 **Cloudflare Workers** 打造的现代化 ES 模块化架构，具备 **Nginx 深度防嗅探伪装**、**零硬编码私有 KV 鉴权**、**EMA 均线买卖信号** 与 **Telegram / 钉钉机器人实时推送**。

---

## 🌟 核心特性与架构亮点

### 1. 🛡️ 银行级隐蔽防探测体系
- **Nginx 深度防嗅探伪装**：未登录访客访问根域名 `/` 时，1:1 返回官方标准 `Welcome to nginx!` 页面与 HTTP 响应头，外部扫描器、爬虫无法探测真实服务。
- **自定义私密访问入口**：支持自由配置专属登录入口路径（如 `/my-secret-gate`）与管理中枢路径（如 `/my-control-hub`），原默认路径彻底失效并展示 Nginx 伪装。
- **零硬编码密码体系**：代码库 100% 无任何默认密码；首次部署通过专属初始化向导由用户设定管理员密码并加密存入私有 KV，设定完成后初始化通道永久自毁关闭。
- **双权限安全隔离**：管理员拥有最高控制权与后台入口；访客模式默认关闭，可按需在后台自定义分配专属访客密码。

### 2. 🎯 7×24h 量化信号与多端机器人推送
- **⭐ 自选标的池 (Watchlist)**：前台表格一键星标收藏与后台多维自选池管理。
- **🟢 EMA 黄金交叉 (买点)**：短周期 EMA7 均线上穿长周期 EMA25 均线，提示做多建仓信号。
- **🔴 EMA 死亡交叉 (卖点)**：短周期 EMA7 均线向下击穿长周期 EMA25 均线，提示防守卖出信号。
- **🚀 5% 剧烈异动捕捉**：实时捕捉 24h 涨跌幅 $\ge \pm 5\%$ 或 15m 突发涨跌 $\ge \pm 3\%$ 的暴涨与快速回调。
- **🔥 3星+ 连续主力放量**：连续放量 45m+ (3星级及以上) 巨量建仓预警。
- **🤖 Telegram & 钉钉机器人**：支持 Telegram Bot API 与 钉钉群 Webhook (HMAC-SHA256 加签) 毫秒级富文本卡片报警，配置智能冷却期防刷屏。

### 3. ⚡ 毫秒级看板与零请求消耗
- **官方 WebSocket 直连**：前端直连币安官方行情 WebSocket，价格毫秒级跳动并伴随绿涨红跌闪烁动效，**消耗 Cloudflare 请求数 = 0**。
- **三大独立分区看板**：现货主流 (Spot)、Alpha 链上 Web3 代币 (Solana/Base/BSC/ETH)、bStocks 美股与 Pre-IPO 独角兽 (SpaceX, OpenAI, ByteDance, SanDisk 等)。
- **全维度动态排序**：支持最新价格、24h 涨跌幅、15m/1h/4h 成交量、24h 成交额及市值全部表头双向点击排序（降序 ↓ / 升序 ↑）。
- **三大上币官方公告**：现货上币、合约上线、Alpha/Web3 空投公告实时聚合。

---

## 📂 工程目录架构

```text
binance-surge-radar/
├── src/
│   ├── index.js                 # 🚀 Cloudflare Worker 主入口与路由中枢 (fetch & scheduled)
│   ├── config/
│   │   ├── constants.js         # ⚙️ 全局常量、KV 键名、Binance API 节点
│   │   └── dict.js              # 📖 金融级中英文资产对照词典 (CHINESE_NAME_MAP)
│   ├── services/
│   │   ├── auth.js              # 🔐 身份鉴权、双密码体系、Token 校验与初始化向导
│   │   ├── binance.js           # 📈 币安多市场数据聚合引擎 (Spot / Alpha / bStocks / 公告)
│   │   ├── quant.js             # 🎯 量化买卖信号与均线交叉计算 (EMA7/25金叉死叉、5%异动)
│   │   └── notifier.js          # 🤖 机器人推送引擎 (Telegram Bot API, 钉钉 Webhook 加签)
│   ├── views/
│   │   ├── nginx.html.js        # 🛡️ 1:1 标准 Nginx 伪装页面视图 (/)
│   │   ├── login.html.js        # 🚪 独立暗黑系登录认证与首次部署初始化向导视图
│   │   ├── admin.html.js        # ⚙️ 独立管理控制中枢视图 (/admin)
│   │   └── dashboard.html.js    # 📊 币安行情与异动雷达主看板视图
│   └── utils/
│       └── response.js          # 🛠️ 统一响应封装 (JSON / HTML) 与价格/数量格式化工具
├── _worker.js                   # 兼容转发入口 (export * from './src/index.js')
├── wrangler.toml                # ⛅ Cloudflare Worker 配置文件
└── package.json
```

---

## 🚀 部署指南

### 方式一：GitHub + Cloudflare Workers CI 自动部署 (推荐)

1. Fork 或将本项目代码推送到你自己的 GitHub 私有/公开仓库；
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)；
3. 进入 **Compute (Workers & Pages)** -> **Create application** -> 选择 **Workers** -> **Connect with Git**；
4. 选中你的 GitHub 仓库，项目名称填入 `binance-surge-radar`，点击 **Save and Deploy**；
5. **绑定 KV 命名空间**：
   - 在控制台侧边栏进入 **Storage & Databases** -> **KV** -> **Create a namespace**，命名为 `BIAN_KV`；
   - 回到你的 Worker -> **Settings** -> **Bindings** -> 添加 KV 绑定，变量名称填入 `BIAN_KV`，选中刚刚创建的 KV 命名空间。

---

### 方式二：使用 Wrangler CLI 命令行一键部署

1. 安装依赖：
   ```bash
   npm install
   ```
2. 创建 Cloudflare KV 命名空间：
   ```bash
   npx wrangler kv namespace create BIAN_KV
   ```
3. 一键发布上线：
   ```bash
   npm run deploy
   ```

---

## 🔐 首次使用与初始化流程

1. **访问初始化向导**：
   - 首次部署完成后，在浏览器访问你的私密登录入口（例如 `https://your-domain.workers.dev/login`）；
   - 系统会自动呈现 **「首次部署 · 初始化管理员密码」** 向导；
   - 输入并确认你的专属管理员密码，系统会自动加密存入私有 KV，初始化通道永久自毁关闭。
2. **进入管理后台配置机器人 (`/admin`)**：
   - 登录进入系统后，点击右上角 **「⚙️ 管理后台」**；
   - 在 **机器人通知配置** 面板中填入 Telegram 或 钉钉机器人凭证并开启推送；
   - 点击 **一键发送测试通知** 验证手机报警通畅；
   - 在 **自定义私密访问入口** 面板中按需修改登录与管理后缀，进一步增强隐蔽性。

---

## 🛠️ 激增倍率计算算法

$$\text{15m 激增倍率} = \frac{\text{15m 成交额} \times 96}{\text{24h 总成交额}}$$

$$\text{1h 激增倍率} = \frac{\text{1h 成交额} \times 24}{\text{24h 总成交额}}$$

$$\text{4h 激增倍率} = \frac{\text{4h 成交额} \times 6}{\text{24h 总成交额}}$$

当周期折算成交额达 24h 日均成交水平的 **1.5倍及以上** 时，系统自动评定星级并送入激增雷达。

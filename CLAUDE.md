# 空罐王的商店 — 專案說明

給日後維護這個網站的人（或 AI）看的說明書。

## 部署鏈

```
本機 C:\Users\a1271\cankingstore-site
  → git push → GitHub: cankingsketch/store (main)
  → Cloudflare Pages 自動部署（約 1～2 分鐘）
  → https://cankingstore.com
```

改網頁 = 改本機檔案後 push。Cloudflare 後台**不能**直接改內容。

網站原本是 Weebly（cankingstore.weebly.com）匯出的靜態 HTML，該站已於 2026-07 下架。
`raw-source/` 是匯出時的原始備份，不會部署。

## 頁面對照

檔名多半是 Weebly 匯出時的數字流水號：

| 檔案 | 頁面 |
|---|---|
| `index.html` | 首頁 |
| `goods.html` | 周邊一覽 |
| `lessons.html` | 課程 |
| `illusts.html` | 數位賣場 |
| `3005920874.html` | 畫冊 |
| `t24676.html` | T恤 |
| `2550940845t24676.html` | 接龍T恤 |
| `3287921517251632723127580.html` | 聯名手機殼 |
| `penker-3287921517.html` | PENKER 聯名 |
| `2345835069212702183021697.html` | 客製化商品 |
| `events.html` | 活動（自建）|
| `events-883299.html` | 實體店寄售 |

## 活動系統

- `events-data.js` — 手動維護的活動清單（歷史活動放這裡）
- `events-live.js` — **自動產生，勿手改**。一罐指揮部按「🌐 推送到官網」時寫入
- 顯示邏輯在 `events-data.js` 末端：合併兩份清單、依日期自動分「預定／過往」、自動排序
- 合併規則：同年且名稱互相包含視為同一筆；靜態版有攤位而 live 版沒有時保留靜態版

推送流程（2026-08 改成這樣，先前文件寫的「每天凌晨 3 點自動寫入」從未實作，
`events-live.js` 一直是空陣列）：

```
一罐指揮部（planner.cankingstore.com）按「🌐 推送到官網」
  → POST /api/events（functions/api/events.js，帶 X-Push-Key）
  → 用 GITHUB_TOKEN 把 events-live.js 寫回 GitHub
  → Pages 自動部署，約 1～2 分鐘後生效
```

推的是**全部展覽**，每筆只有日期、名稱、攤位號三欄；攤位號還沒下來就送空字串，
官網會只印日期＋名稱（報名上了但攤位未定也該讓客人看得到）。
指揮部刪掉的場次，下次推送就會從官網消失——所以**未來的場次不要寫進 `events-data.js`**，
否則刪不掉（靜態那份會一直把它撐在畫面上）。

環境變數：`EVENTS_PUSH_KEY`（指揮部與這支端點的共用金鑰）、`GITHUB_TOKEN`（既有）。

## 商品結構（goods.html）

商品 = 一個 `<h2 class="wsite-content-title">` 加上到下一個 h2 之前的所有內容。

兩種結構：

**新結構**（後台建立，`data-ck="1"` 標記）— 乾淨、可程式化編輯：
```html
<h2 class="wsite-content-title" data-ck="1"><strong><font size="7">商品名</font></strong></h2>

<div class="ck-prod" data-ck="1">
<div class="ck-prod-imgs">
<figure class="ck-img ck-lg"><img src="images/xxx.jpg" alt="商品名" /></figure>
<figure class="ck-img ck-md"><img src="images/yyy.jpg" alt="商品名" loading="lazy" /></figure>
</div>
<div class="ck-prod-desc">說明文字</div>
</div>
```
版型 class：`ck-lg` 獨佔一行、`ck-md` 兩張並排、`ck-sm` 三張並排；手機（≤700px）一律單欄。
第一張圖不加 `loading="lazy"`（主圖要立即顯示），其餘才加。

**舊結構**（Weebly 匯出）— 巢狀 table，內部**不要**用程式修改。
安全操作只有三種：改 h2 文字、整塊搬移、整塊刪除。
若要改圖或改版，把整塊換成新結構（整塊替換比局部修補安全）。

其他注意事項：
- 舊商品標題在 HTML 裡是數字實體（`&#30332;…`），解析時要解碼
- 快速選單和回頂按鈕會**自動**掃描 h2 產生，新增商品不用另外維護
- 頁面上方那排購買按鈕（711／蝦皮／海外／實體店）是全站共用，不屬於個別商品

## 商品後台

`/admin` → `admin.html` + `functions/api/products.js`（Cloudflare Pages Function）

- 功能：新增商品（多圖、版型、即時預覽）、改標題、排序、下架、編輯新結構商品
- 所有編輯只在瀏覽器暫存，按「儲存變更」才寫入 GitHub
- 圖片在瀏覽器端壓縮（最大寬 1400、JPEG 85%）後上傳
- 安全：必須通過 Cloudflare Access（API 會檢查 `Cf-Access-Authenticated-User-Email`）
- 金鑰：Cloudflare 環境變數 `GITHUB_TOKEN`（fine-grained PAT，只給 cankingsketch/store 的 Contents 讀寫）
- 併發保護：GET 時取得檔案 sha，POST 時比對，不符會擋下並要求重新整理

實作上踩過的坑（改動前先看）：
- **Access 身分傳遞**：Cloudflare Access 保護 Pages Functions 時，不一定會帶
  `Cf-Access-Authenticated-User-Email`，可能只有 `Cf-Access-Jwt-Assertion` 或
  `CF_Authorization` cookie。三者接受其一即可（能到達 Function 就代表已通過 Access）。
- **BOM**：`goods.html` 開頭有 UTF-8 BOM。TextDecoder 預設會吃掉它，導致存檔時
  無關內容被改動，故指定 `ignoreBOM: true`。
- **HTML 實體**：舊商品標題含 `&#nnnn;` 與 `&nbsp;`，解析時都要解碼。
- **預覽部署網址**（`<hash>.cankingstore.pages.dev`）不在 Access 規則涵蓋範圍內，
  後台頁面打得開，但 API 仍會擋下（403）——這是保留 Function 內身分檢查的理由。

說明文字對齊：後台每個商品可以明講「置中／靠左」。沒明講時走自動規則
（有並排圖→靠左、單張大圖→置中）。`buildBlock` 與 admin 的 `autoAlign()`
必須保持一致，改了其中一個就要改另一個。舊 Weebly 商品的對齊是寫在
外層 `text-align:`，不歸這套管。

修改後端解析邏輯時，務必先跑無損測試（切開再合併必須與原檔一字不差）。

**存檔＝單一 commit（2026-08-30 改）**：所有圖片與 `goods.html` 用 GitHub 的
Git Data API（blob → tree → commit → 更新 ref）打包成一個 commit。
原本用 Contents API 每個檔案一次 PUT，**每次 PUT 就是一個 commit，
而 Cloudflare Pages 是每個 commit 部署一次**——上傳 3 張圖會排 4 次部署、
還會互相取消，使用者就要等 1～2 分鐘。實測：11 個圖片 commit + 4 個存檔 commit
＝ 15 次部署。改完之後不管幾張圖都只推一次。
`base_tree` 讓其餘檔案完全不動；`parents: [讀取時的 head]` + `force: false`
順便成為真正的併發保護（別人插隊推送 → GitHub 回 422 → 我們回 409）。

## 流量統計

分兩塊，資料來源不同：

**1. 造訪人數 → Cloudflare Web Analytics**（2026-06 起自動收集，已接進後台）
免費、不放 cookie、Automatic setup（Cloudflare 自動注入腳本，網頁不必改）。
提供造訪次數、頁面瀏覽、來源網站、國家、裝置、Core Web Vitals。
**沒有「不重複訪客」**——它不追蹤個人，Visits 已是最接近的指標。
後台「流量統計」分頁有直達連結（需 Cloudflare 帳號登入）。

`functions/api/traffic.js` 用 Cloudflare GraphQL Analytics API 把數字接進後台。
**查詢語法與欄位名稱是照儀表板自己送出的請求抄的，不是猜的**——要改的話，
最可靠的做法是到 Web Analytics 頁面攔截 `fetch` 看 `/api/v4/graphql` 送什麼。
重點：資料集 `rumPageloadEventsAdaptiveGroups`、篩選 `{bot:0}` `{siteTag_in:[...]}`
`{requestHost:...}`、排序 `sum_visits_DESC`、時間維度 `datetimeHour`（回傳帶 Z）。
`refererHost` 的直接流量是**空字串**；`countryName` 回的是**代碼**（TW/US），
中文對照在 admin.html 的 `COUNTRY`。金鑰：環境變數 `CF_ANALYTICS_TOKEN`
（權限只需 Account > Account Analytics > Read）。帳號／網站 ID 寫在程式裡——
它們是識別碼不是憑證，沒有 token 什麼也做不了（repo 是公開的，**真正的金鑰絕不能進 repo**）。
後端有 5 分鐘快取。

「只看商店 / 含所有子網域」很重要：planner、pos、ar 掛在同一個網站標籤下，
7 天 238 次造訪裡商店本站只有 184 次，算轉換率時要排除掉。

**2. 購買連結點擊 → 自建（D1）**

| 檔案 | 作用 |
|---|---|
| `track.js` | 全站腳本，攔截所有「連到站外」的點擊 |
| `functions/api/track.js` | 公開端點，寫入 D1 |
| `functions/api/stats.js` | 後台查詢用，需 Access |
| `admin.html` 的「流量統計」分頁 | 顯示 |

- D1 綁定名稱 **`STATS`**，資料表 `clicks`（第一次點擊時自動建立，不必手動跑 SQL）
- **不用逐一標記連結**：`track.js` 依網址主機名稱自動歸類通路，
  所以之後在後台新增商品貼上新的購買連結會自動被追蹤，不需要改程式
- 通路清單在 `track.js` 的 `CHANNELS`；`SHOP` 陣列決定哪些算「購買」、哪些算「社群」
- 自家子網域（`*.cankingstore.com`）不列入，否則 pos/ar/planner 會被當成導流出去
- 保留 400 天，超過的資料在寫入時隨機清理

踩過的坑：
- **絕不能擋住跳轉**：用 `sendBeacon`（頁面卸載後仍會送達），整段包在 try/catch，
  端點一律回 204。D1 沒綁定時也安靜略過，不會讓網站壞掉。
- **不要用模組層級變數快取「表已建立」**：Worker isolate 會重用，
  資料庫若被重建，暖著的 isolate 會一直寫失敗。改成「插入失敗才建表再重試」。
- **免費額度**：D1 每天 10 萬次寫入。單日流量破萬時點擊約數百到一千次，差很遠。

## 測試

```
node tests/products.test.mjs    # 37 項
node tests/save.test.mjs        # 33 項（存檔只推一次）
node tests/track.test.mjs       # 41 項
node tests/traffic.test.mjs     # 35 項
```
不必安裝套件（用 Node 內建 `node:sqlite` 模擬 D1）。改 `functions/api/*` 前後都要跑。

## Weebly 殘留

匯出的 HTML 帶著整套 Weebly 商店程式，但本站沒有購物車（所有購買都是外連）。
2026-08-29 已清掉：`initCustomerAccountsModels` / `initCommerceModels` 的 RPC 設定、
`commerce-core.js`、`main-commerce-browse.js`、`main-customer-accounts-site.js`
與 `<div id="customer-accounts-app">`。每頁因此少 53KB，console 也不再噴
`/ajax/api/JsonRPC/` 的 405。函式名稱與 `customerAccountsModelsInitialized`
事件刻意保留為空殼，避免 Weebly 其他腳本找不到而報新的錯。

**指向舊 Weebly 站的腳本（2026-08-29 一併處理）**：舊站取消發佈後這些全部 404。
逐一查過用途才決定去留，不是整批砍掉：

| 檔案 | 是什麼 | 處置 |
|---|---|---|
| `files/theme/plugins.js` | 純 Hammer.JS 2.0.4（手勢函式庫） | **改自行存放 `css/hammer.js`** |
| `files/templateArtifacts.js` | Weebly 站內搜尋結果的 Mustache 樣板 | 移除（本站沒有搜尋） |
| `files/theme/mobile.js` | `Weebly.mobile_navigation` | 移除（本佈景的手機選單是自己做的） |
| `gdpr/gdprscript.js` | Weebly 的 cookie 同意橫幅 | 移除（本站不放 cookie） |
| `cdn-cgi/.../email-decode.min.js` | Cloudflare 的 email 反混淆 | 改指向自己網域的同一支 |

**Hammer 是真的有人在用**：`css/custom.js` 的 `Theme.swipeGallery()` 會 `new Hammer(...)`，
提供燈箱裡左右滑動換圖。它 404 時手機使用者一點圖就會噴
`ReferenceError: Hammer is not defined`，滑動換圖失效（點箭頭還可以）。
`css/hammer.js` 與官方 hammerjs@2.0.4 逐行比對過，只差 Weebly 移除了 AMD 分支
（正好確保一定掛上 `window.Hammer`）。**驗證方法**：手機尺寸開燈箱後，
`.fancybox-wrap` 的 `touch-action` 應為 `pan-y`（Hammer 掛上 pan 手勢的指紋）。

**Weebly 的兩個追蹤器也已移除（2026-08-29）**：
- Snowplow（`snowday262.js` → `ec.editmysite.com`），會種 `_snow_` cookie
- Google Analytics `UA-7870337-1`（**Weebly 公司的**，不是我們的；UA 型 Google 已於
  2024-07 停止收資料，且用的是 2019 就退役的 `ga.js`），會種 GA cookie

兩者都只是把訪客資料送去我們看不到的地方，移除後全站不再種任何 cookie。
`_W.Analytics` 只被這兩個區塊自己用（main.js 完全沒引用），移除安全。

**指向舊站的連結也修好了（2026-08-29）**：舊站是 404，這些點下去都會掉出去。
- **9 個頁面的網站 logo** 連到 `cankingstore.weebly.com/` → 改回 `index.html`
  （index/goods 本來就是對的，其餘頁面漏改）
- 首頁「**貼圖**」泡泡按鈕 → 改成 `goods.html#line-stickers`
  （在 goods.html 的 LINE 區塊 h2 加了 `id`，並用 `scroll-margin-top:80px`
  避開 65px 的固定頁首。id 加在 `class` 之後，`splitDoc` 的前綴比對不受影響）
- 畫冊頁「寄賣實體店」按鈕 → 改成本機就有的 `events-883299.html`

**仍會連的外部主機**：`cdn11/cdn2.editmysite.com`（jQuery、main.js、佈景 CSS、字型
——這些是佈景真正的執行環境，不能拿掉）、`cdn-promote.weebly.com/js/dist/messenger.js`。

## SEO / 其他

- 全站 `og:image` 指向 `images/og_share.png`（1200×630 分享卡）
- `robots.txt`、`sitemap.xml`、`404.html` 都在根目錄
- `_headers` 讓 `events-data.js` / `events-live.js` 不被瀏覽器快取，活動更新才會即時反映
- 主題 CSS（`css/main_style.css`）把 `body`／`#wrapper` 底色設為灰色 `#b9b9b9`；
  內容較短的頁面會在頁尾下方露出灰底，需針對該頁覆蓋為紅色（聯名手機殼頁已處理）

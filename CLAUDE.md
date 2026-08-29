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

- `events-data.js` — 手動維護的活動清單（含全部歷史活動）
- `events-live.js` — **自動產生，勿手改**。由展覽規劃器每天凌晨 3 點寫入
- 顯示邏輯在 `events-data.js` 末端：合併兩份清單、依日期自動分「預定／過往」、自動排序
- 合併規則：同年且名稱互相包含視為同一筆；靜態版有攤位而 live 版沒有時保留靜態版

規劃器（Apps Script）只同步**填了攤位號**的展覽。規劃器裡刪掉的活動，網站仍保留（歷史）。

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

修改後端解析邏輯時，務必先跑無損測試（切開再合併必須與原檔一字不差）。

## 流量統計

分兩塊，資料來源不同：

**1. 造訪人數 → Cloudflare Web Analytics**（2026-06 起自動收集）
免費、不放 cookie、Automatic setup（Cloudflare 自動注入腳本，網頁不必改）。
提供造訪次數、頁面瀏覽、來源網站、國家、裝置、Core Web Vitals。
**沒有「不重複訪客」**——它不追蹤個人，Visits 已是最接近的指標。
後台「流量統計」分頁有直達連結（需 Cloudflare 帳號登入）。

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
node tests/products.test.mjs    # 28 項
node tests/track.test.mjs       # 41 項
```
不必安裝套件（用 Node 內建 `node:sqlite` 模擬 D1）。改 `functions/api/*` 前後都要跑。

## SEO / 其他

- 全站 `og:image` 指向 `images/og_share.png`（1200×630 分享卡）
- `robots.txt`、`sitemap.xml`、`404.html` 都在根目錄
- `_headers` 讓 `events-data.js` / `events-live.js` 不被瀏覽器快取，活動更新才會即時反映
- 主題 CSS（`css/main_style.css`）把 `body`／`#wrapper` 底色設為灰色 `#b9b9b9`；
  內容較短的頁面會在頁尾下方露出灰底，需針對該頁覆蓋為紅色（聯名手機殼頁已處理）

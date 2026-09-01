/* Gumroad 會員獎勵清單（Cloudflare Pages Function）
 * GET /api/gumroad  <- 公開，數位賣場頁面自己抓
 *
 * 想手動重抓請打 /api/gumroad-refresh（那支才受 Access 保護）。
 * 這支不能有 refresh 參數：Access 是綁在路徑上的，同一個路徑沒辦法
 * 既公開又要求登入。
 *
 * 走官方 API（api.gumroad.com/v2/products），不是爬商店頁面。
 * 爬頁面在條款上是灰色地帶，而且商店首頁每個分區只塞前 9 個商品，
 * 實測 108 個商品只看得到 61 個。官方 API 一次給完整份，也有版號。
 *
 * 抓取頻率：一個月一次（台北時區的月份換了才重抓），獎勵一個月更新一次。
 * 結果存進 D1；Gumroad 掛掉時仍然送得出上一份好資料——賣場頁面開天窗
 * 比資料舊一個月嚴重得多。
 *
 * ★ 安全：/v2/products 會回傳 sales_count 與 sales_usd_cents。
 *   這支是公開端點，只能送出名稱／縮圖／連結，絕不能把營收帶出去。
 */

const API = 'https://api.gumroad.com/v2/products';
const WANT = /會員獎勵/;     // 使用者要的只有會員獎勵，電子畫冊等不列入
// 回傳格式改版時把這個加一，舊格式的快取會自動失效重抓
const VERSION = 4;
const MAX_PAGES = 30;   // 防呆：真有這麼多頁就先停

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status === 200 ? 'public, max-age=3600' : 'no-store',
    },
  });
}

/* 台北時間的 YYYY-MM，用來判斷「這個月抓過了沒」 */
function taipeiMonth(ms) {
  return new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 7);
}

/* 商品名稱長這樣：「2026年1月份會員獎勵-1  蛇年賀圖」
 * 抓出年月當排序鍵；抓不到就回 0，排在最後面。 */
function ymOf(name) {
  const m = /(\d{4})\s*年\s*(\d{1,2})\s*月/.exec(name || '');
  return m ? Number(m[1]) * 100 + Number(m[2]) : 0;
}

/* 文件上的範例用 query string 帶 token，但那會讓金鑰出現在網址裡
 * （代理、記錄檔都可能留下）。先試標準的 Authorization 標頭，
 * 真的不吃再退回 query string。 */
async function callPage(token, params) {
  const qs = params.toString();
  let res = await fetch(API + (qs ? '?' + qs : ''), {
    headers: { authorization: 'Bearer ' + token, accept: 'application/json' },
  });
  if (res.status === 401 || res.status === 403) {
    const p2 = new URLSearchParams(params);
    p2.set('access_token', token);
    res = await fetch(API + '?' + p2.toString(), { headers: { accept: 'application/json' } });
  }
  if (!res.ok) throw new Error('Gumroad API 回應 ' + res.status);
  const data = await res.json();
  if (!data || data.success === false) {
    throw new Error(data && data.message ? data.message : 'Gumroad API 回報失敗');
  }
  return data;
}

/* 文件說 /products 會給「所有」商品，實際上只給最新的 10 個——
 * 分頁沒有寫在文件上。所以這裡翻到「沒有新的 id 出現」為止：
 * 萬一哪天 page 參數真的不被支援，第二頁會拿到跟第一頁一樣的東西，
 * 靠 id 去重就會立刻停下來，不會變成無限迴圈。 */
async function callApi(token) {
  const seen = new Set();
  const all = [];
  let pages = 0, pageKey = null, page = 1;
  let keys = null;   // 第一頁回應有哪些欄位，用來查分頁到底叫什麼名字

  for (; pages < MAX_PAGES; page++) {
    const params = new URLSearchParams();
    // 兩種分頁寫法都送：/sales 用 page_key 游標，page 則是常見的頁碼。
    // 送了不支援的參數會被忽略，不會出錯。
    if (pageKey) params.set('page_key', pageKey);
    else if (page > 1) params.set('page', String(page));

    const data = await callPage(token, params);
    if (!keys) keys = Object.keys(data);
    pages++;

    const batch = data.products || [];
    let added = 0;
    for (const p of batch) {
      const key = p && (p.id || p.short_url || p.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      all.push(p);
      added++;
    }

    pageKey = data.next_page_key || null;
    // 空頁、整頁都看過、而且也沒有游標可以往下走 → 到底了
    if ((!batch.length || !added) && !pageKey) break;
    if (!pageKey && !added) break;
  }
  return { products: all, pages, keys };
}

async function fetchProducts(token) {
  const { products: raw, pages } = await callApi(token);

  // 診斷用計數：只有數量，不含任何商品內容或營收
  const diag = {
    pages,
    raw: raw.length,
    unpublished: raw.filter((p) => p && !p.published).length,
    notWanted: raw.filter((p) => p && p.published && !WANT.test(p.name || '')).length,
    noThumb: raw.filter((p) => p && p.published && WANT.test(p.name || '')
      && !(p.thumbnail_url || p.preview_url)).length,
    noUrl: raw.filter((p) => p && p.published && WANT.test(p.name || '') && !p.short_url).length,
  };

  const items = raw
    .filter((p) => p && p.published && WANT.test(p.name || ''))
    // ★ 只挑這三個欄位出來，銷售數字不會經過這裡
    .map((p) => ({
      name: String(p.name || '').trim(),
      url: String(p.short_url || ''),
      thumb: p.thumbnail_url || p.preview_url || '',
      ym: ymOf(p.name),
    }))
    .filter((p) => p.name && p.url && p.thumb);

  // 依年份分組，年份新的在前；同一年裡月份新的在前
  const byYear = new Map();
  for (const it of items) {
    const year = it.ym ? Math.floor(it.ym / 100) : 0;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(it);
  }
  const groups = [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, products]) => ({
      year,
      header: year ? year + '會員獎勵' : '其他',
      products: products.sort((a, b) => b.ym - a.ym).map(({ ym, ...rest }) => rest),
    }));

  return { v: VERSION, groups, count: items.length, diag, fetchedAt: new Date().toISOString() };
}

/* ---------- 快取（D1，綁定名 STATS） ---------- */

async function createTable(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS gumroad_cache (
       id    INTEGER PRIMARY KEY,
       month TEXT NOT NULL,
       ts    INTEGER NOT NULL,
       data  TEXT NOT NULL
     )`
  ).run();
}

async function readCache(db) {
  try {
    return await db.prepare('SELECT month, ts, data FROM gumroad_cache WHERE id = 1').first();
  } catch (e) {
    await createTable(db).catch(() => {});
    return null;
  }
}

async function writeCache(db, month, data) {
  const save = () =>
    db.prepare('INSERT OR REPLACE INTO gumroad_cache (id, month, ts, data) VALUES (1, ?, ?, ?)')
      .bind(month, Date.now(), JSON.stringify(data))
      .run();
  try {
    await save();
  } catch (e) {
    await createTable(db);
    await save();
  }
}

export async function onRequestGet({ request, env }) {
  const db = env.STATS;
  const month = taipeiMonth(Date.now());

  const cached = db ? await readCache(db) : null;
  if (cached && cached.month === month) {
    const data = JSON.parse(cached.data);
    // 程式改版過就不要再用舊格式的快取
    if (data.v === VERSION) return json(Object.assign(data, { cached: true }));
  }

  if (!env.GUMROAD_TOKEN) {
    if (cached) return json(Object.assign(JSON.parse(cached.data), { cached: true, stale: true }));
    return json({ error: '尚未設定 GUMROAD_TOKEN', groups: [], count: 0 }, 500);
  }

  try {
    const fresh = await fetchProducts(env.GUMROAD_TOKEN);
    if (db) await writeCache(db, month, fresh).catch(() => {});
    return json(Object.assign({}, fresh, { cached: false }));
  } catch (err) {
    // 抓失敗就送上一份好資料，頁面不要開天窗
    if (cached) {
      return json(Object.assign(JSON.parse(cached.data), {
        cached: true, stale: true, error: String(err.message || err),
      }));
    }
    return json({ error: String(err.message || err), groups: [], count: 0 }, 502);
  }
}

/* Gumroad 會員獎勵清單（Cloudflare Pages Function）
 * GET /api/gumroad           <- 公開，數位賣場頁面自己抓
 * GET /api/gumroad?refresh=1 <- 需通過 Cloudflare Access，強制重抓
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
async function callApi(token) {
  let res = await fetch(API, {
    headers: { authorization: 'Bearer ' + token, accept: 'application/json' },
  });
  if (res.status === 401 || res.status === 403) {
    res = await fetch(API + '?access_token=' + encodeURIComponent(token), {
      headers: { accept: 'application/json' },
    });
  }
  if (!res.ok) throw new Error('Gumroad API 回應 ' + res.status);
  const data = await res.json();
  if (!data || data.success === false) {
    throw new Error(data && data.message ? data.message : 'Gumroad API 回報失敗');
  }
  return data.products || [];
}

async function fetchProducts(token) {
  const raw = await callApi(token);

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

  return { groups, count: items.length, fetchedAt: new Date().toISOString() };
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
  const url = new URL(request.url);
  const force = url.searchParams.get('refresh') === '1';
  const db = env.STATS;
  const month = taipeiMonth(Date.now());

  // 強制重抓要先登入後台，免得被人拿來一直打 Gumroad
  if (force && !request.headers.get('Cf-Access-Authenticated-User-Email')) {
    return json({ error: '需要登入後台才能強制更新' }, 403);
  }

  const cached = db ? await readCache(db) : null;
  if (cached && !force && cached.month === month) {
    return json(Object.assign(JSON.parse(cached.data), { cached: true }));
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

/* Gumroad 銷售統計（Cloudflare Pages Function）
 * GET /api/gumroad-sales?months=6   <- 只有通過 Cloudflare Access 才看得到
 *
 * 為什麼跟 /api/gumroad 分開兩支：
 * 那支是公開的（數位賣場頁面要抓商品清單），這支讀的是營收。
 * 同一支端點同時服務兩種對象，遲早會有人把銷售數字漏出去。
 *
 * 資料來源：官方 GET /v2/sales，需要 token 有 view_sales scope。
 * 回傳的是每月彙總與每個商品的排名，不含買家個資（姓名、email 一律不取）。
 */

const API = 'https://api.gumroad.com/v2/sales';
const MAX_PAGES = 40;        // 防呆：真的有這麼多頁就先停，不要無限打
const DEFAULT_MONTHS = 6;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',   // 營收數字不進任何快取
    },
  });
}

/* 台北時區的日期字串。Gumroad 的 after/before 收 YYYY-MM-DD。 */
function taipeiDate(ms) {
  return new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/* 一筆銷售落在哪個月（台北時間） */
function monthOf(iso) {
  const t = Date.parse(iso);
  if (!isFinite(t)) return '';
  return new Date(t + 8 * 3600 * 1000).toISOString().slice(0, 7);
}

async function fetchPage(token, params) {
  const qs = new URLSearchParams(params).toString();
  let res = await fetch(API + '?' + qs, {
    headers: { authorization: 'Bearer ' + token, accept: 'application/json' },
  });
  if (res.status === 401 || res.status === 403) {
    res = await fetch(API + '?' + qs + '&access_token=' + encodeURIComponent(token), {
      headers: { accept: 'application/json' },
    });
  }
  if (!res.ok) throw new Error('Gumroad API 回應 ' + res.status);
  const data = await res.json();
  if (!data || data.success === false) {
    throw new Error(data && data.message ? data.message : 'Gumroad API 回報失敗');
  }
  return data;
}

export async function onRequestGet({ request, env }) {
  // 沒有設 Access 就一律擋掉——寧可看不到，也不要把營收攤在網路上
  if (!request.headers.get('Cf-Access-Authenticated-User-Email')) {
    return json({ error: '需要登入後台' }, 403);
  }
  if (!env.GUMROAD_TOKEN) return json({ error: '尚未設定 GUMROAD_TOKEN' }, 500);

  const url = new URL(request.url);
  const months = Math.min(24, Math.max(1, Number(url.searchParams.get('months')) || DEFAULT_MONTHS));
  const since = Date.now() - months * 31 * 86400 * 1000;

  try {
    const byMonth = new Map();
    const byProduct = new Map();
    let total = 0, cents = 0, pages = 0, pageKey = null;

    do {
      const params = { after: taipeiDate(since) };
      if (pageKey) params.page_key = pageKey;
      const data = await fetchPage(env.GUMROAD_TOKEN, params);

      for (const s of data.sales || []) {
        // 只取彙總需要的欄位；買家姓名與 email 完全不碰
        const m = monthOf(s.created_at);
        const name = String(s.product_name || '(未命名)').trim();
        const amt = Number(s.price) || 0;   // 分為單位

        total++; cents += amt;
        if (m) {
          const g = byMonth.get(m) || { month: m, count: 0, cents: 0 };
          g.count++; g.cents += amt;
          byMonth.set(m, g);
        }
        const p = byProduct.get(name) || { name, count: 0, cents: 0 };
        p.count++; p.cents += amt;
        byProduct.set(name, p);
      }

      pageKey = data.next_page_key || null;
      pages++;
    } while (pageKey && pages < MAX_PAGES);

    return json({
      months,
      total,
      usd: +(cents / 100).toFixed(2),
      byMonth: [...byMonth.values()].sort((a, b) => (a.month < b.month ? 1 : -1))
        .map((g) => ({ month: g.month, count: g.count, usd: +(g.cents / 100).toFixed(2) })),
      byProduct: [...byProduct.values()].sort((a, b) => b.count - a.count).slice(0, 20)
        .map((p) => ({ name: p.name, count: p.count, usd: +(p.cents / 100).toFixed(2) })),
      truncated: pages >= MAX_PAGES && !!pageKey,
    });
  } catch (err) {
    return json({ error: String(err.message || err) }, 502);
  }
}

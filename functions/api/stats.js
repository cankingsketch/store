/* 點擊統計查詢（Cloudflare Pages Function）
 * GET /api/stats?days=7  -> 後台「流量統計」分頁用的彙總數字
 *
 * 安全：與 /api/products 同一套 Cloudflare Access 判斷。
 */

const DEFAULT_DAYS = 7;
const MAX_DAYS = 365;
const TOP_N = 10;

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function requireAuth(request) {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email');
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  const cookie = request.headers.get('Cookie') || '';
  if (!email && !jwt && cookie.indexOf('CF_Authorization=') < 0) {
    return { error: json({ error: '未通過 Cloudflare Access 驗證。' }, 403) };
  }
  return { email: email || 'Access 使用者' };
}

function taipeiDay(ms) {
  return new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function onRequestGet({ request, env }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  const db = env.STATS;
  if (!db) {
    return json({ ready: false, message: '尚未接上 D1 資料庫（Pages 設定裡的 STATS 綁定）。' });
  }

  const url = new URL(request.url);
  let days = parseInt(url.searchParams.get('days'), 10);
  if (!Number.isFinite(days) || days < 1) days = DEFAULT_DAYS;
  if (days > MAX_DAYS) days = MAX_DAYS;

  const now = Date.now();
  const from = taipeiDay(now - (days - 1) * 86400000);

  try {
    const rows = (q, ...b) => db.prepare(q).bind(...b).all().then((r) => r.results || []);

    const [total, byChannel, byLabel, byDay, byPage, byDevice, byCountry] = await Promise.all([
      rows(`SELECT COUNT(*) AS n, SUM(kind = 'shop') AS shop FROM clicks WHERE day >= ?`, from),
      rows(
        `SELECT channel, kind, COUNT(*) AS n FROM clicks WHERE day >= ?
         GROUP BY channel, kind ORDER BY n DESC LIMIT ?`,
        from, TOP_N
      ),
      rows(
        `SELECT label, COUNT(*) AS n FROM clicks
         WHERE day >= ? AND kind = 'shop' AND label <> ''
         GROUP BY label ORDER BY n DESC LIMIT ?`,
        from, TOP_N
      ),
      rows(
        `SELECT day, COUNT(*) AS n, SUM(kind = 'shop') AS shop FROM clicks
         WHERE day >= ? GROUP BY day ORDER BY day`,
        from
      ),
      rows(
        `SELECT page, COUNT(*) AS n FROM clicks WHERE day >= ?
         GROUP BY page ORDER BY n DESC LIMIT ?`,
        from, TOP_N
      ),
      rows(`SELECT device, COUNT(*) AS n FROM clicks WHERE day >= ? GROUP BY device`, from),
      rows(
        `SELECT country, COUNT(*) AS n FROM clicks WHERE day >= ? AND country <> ''
         GROUP BY country ORDER BY n DESC LIMIT ?`,
        from, TOP_N
      ),
    ]);

    const t = total[0] || {};
    return json({
      ready: true,
      days,
      from,
      to: taipeiDay(now),
      total: t.n || 0,
      shop: t.shop || 0,
      byChannel,
      byLabel,
      byDay,
      byPage,
      byDevice,
      byCountry,
      user: auth.email,
    });
  } catch (e) {
    // 一次點擊都還沒有時 clicks 表尚未建立，這不是錯誤
    if (/no such table/i.test(String(e && e.message))) {
      return json({ ready: true, empty: true, days, total: 0, shop: 0 });
    }
    return json({ error: String((e && e.message) || e) }, 500);
  }
}

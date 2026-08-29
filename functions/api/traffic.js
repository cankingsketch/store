/* 網站流量查詢（Cloudflare Pages Function）
 * GET /api/traffic?days=7[&host=cankingstore.com]
 *
 * 把 Cloudflare Web Analytics 的數字接進後台，省得再開一個分頁登入。
 * 查詢語法與欄位名稱是照 Cloudflare 儀表板自己送出的 GraphQL 抄的，不是猜的。
 *
 * 安全：與 /api/products、/api/stats 同一套 Cloudflare Access 判斷。
 * 金鑰：Cloudflare 環境變數 CF_ANALYTICS_TOKEN
 *       （API token，權限只需 Account > Account Analytics > Read）
 */

// 這兩個是識別碼不是憑證——沒有上面那把 token，知道它們也做不了任何事，
// 而且本來就出現在儀表板網址裡。放這裡是為了讓設定只需要貼一個值。
// 需要的話可用環境變數 CF_ACCOUNT_TAG / CF_SITE_TAG 覆蓋。
const ACCOUNT_TAG = 'e07fc9ba319a1f88a7c2288f0aa28933';
const SITE_TAG = 'd60a99edbafd4caeaf79f96ee9499898';

const GQL = 'https://api.cloudflare.com/client/v4/graphql';
const DEFAULT_DAYS = 7;
const MAX_DAYS = 180;
const TOP_N = 10;
const CACHE_MS = 5 * 60 * 1000; // 後台自己看的頁面，5 分鐘新鮮度夠了

/* 同一個 isolate 內的短期快取，避免每次切分頁都打一次 API */
const memo = new Map();

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

/* 每個排行區塊的形狀都一樣，用同一段產生 */
function topBlock(alias, dimension, limit) {
  return `${alias}: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: ${limit}, orderBy: [$order]) {
      count
      sum { visits }
      dimensions { metric: ${dimension} }
    }`;
}

const QUERY = `query AdminTraffic(
  $accountTag: string
  $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject
  $order: string
) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      total: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 1) {
        count
        sum { visits }
      }
      series: rumPageloadEventsAdaptiveGroups(
        filter: $filter, limit: 5000, orderBy: [datetimeHour_ASC]
      ) {
        count
        sum { visits }
        dimensions { ts: datetimeHour }
      }
      ${topBlock('referers', 'refererHost', 20)}
      ${topBlock('countries', 'countryName', 30)}
      ${topBlock('paths', 'requestPath', 20)}
      ${topBlock('hosts', 'requestHost', 20)}
      ${topBlock('devices', 'deviceType', 10)}
    }
  }
}`;

/* GraphQL 回傳的每一列都是 { count, sum: { visits }, dimensions: { metric } } */
function rows(list, label) {
  return (list || [])
    .map(function (r) {
      return {
        name: (r.dimensions && r.dimensions.metric) || label,
        visits: (r.sum && r.sum.visits) || 0,
        views: r.count || 0,
      };
    })
    .filter(function (r) { return r.visits > 0; })
    .sort(function (a, b) { return b.visits - a.visits; });
}

export async function onRequestGet({ request, env }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  const token = env.CF_ANALYTICS_TOKEN;
  if (!token) {
    return json({
      ready: false,
      message: '尚未設定 CF_ANALYTICS_TOKEN（Cloudflare Pages 的環境變數）。',
    });
  }

  const url = new URL(request.url);
  let days = parseInt(url.searchParams.get('days'), 10);
  if (!Number.isFinite(days) || days < 1) days = DEFAULT_DAYS;
  if (days > MAX_DAYS) days = MAX_DAYS;
  const host = url.searchParams.get('host') || '';

  const key = days + '|' + host;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return json(Object.assign({}, hit.data, { cached: true }));
  }

  // 從「今天台北時間的 days 天前 00:00」算起，才不會出現只有半天的頭尾
  const now = Date.now();
  const fromDay = taipeiDay(now - (days - 1) * 86400000);
  const start = new Date(fromDay + 'T00:00:00Z').getTime() - 8 * 3600 * 1000;

  const and = [
    { datetime_geq: new Date(start).toISOString(), datetime_leq: new Date(now).toISOString() },
    { bot: 0 },
    { siteTag_in: [env.CF_SITE_TAG || SITE_TAG] },
  ];
  if (host) and.push({ requestHost: host });

  try {
    const r = await fetch(GQL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: QUERY,
        variables: {
          accountTag: env.CF_ACCOUNT_TAG || ACCOUNT_TAG,
          filter: { AND: and },
          order: 'sum_visits_DESC',
        },
      }),
    });

    const body = await r.json();
    if (!r.ok || (body.errors && body.errors.length)) {
      const msg = (body.errors && body.errors[0] && body.errors[0].message) || ('HTTP ' + r.status);
      // 把 Cloudflare 原本的訊息透出來，設定有問題時才看得出是哪裡不對
      return json({ error: 'Cloudflare 查詢失敗：' + msg }, 502);
    }

    const acc = ((body.data || {}).viewer || {}).accounts || [];
    if (!acc.length) return json({ error: '查不到這個帳號的資料，請確認 token 權限。' }, 502);
    const a = acc[0];

    // 每小時一列，合併成台北時間的每一天；沒有流量的日子補 0
    const perDay = {};
    (a.series || []).forEach(function (row) {
      // datetimeHour 可能帶 Z 也可能不帶，一律補成 UTC 再轉台北日期
      const raw = String((row.dimensions && row.dimensions.ts) || '');
      const ms = Date.parse(/[Zz]$|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : raw + 'Z');
      if (!Number.isFinite(ms)) return;
      const d = taipeiDay(ms);
      if (!perDay[d]) perDay[d] = { day: d, visits: 0, views: 0 };
      perDay[d].visits += (row.sum && row.sum.visits) || 0;
      perDay[d].views += row.count || 0;
    });
    const byDay = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = taipeiDay(now - i * 86400000);
      byDay.push(perDay[d] || { day: d, visits: 0, views: 0 });
    }

    const t = (a.total && a.total[0]) || {};
    const data = {
      ready: true,
      days,
      host,
      from: fromDay,
      to: taipeiDay(now),
      visits: (t.sum && t.sum.visits) || 0,
      views: t.count || 0,
      byDay,
      referers: rows(a.referers, '（直接進入）').slice(0, TOP_N),
      countries: rows(a.countries).slice(0, TOP_N),
      paths: rows(a.paths).slice(0, TOP_N),
      hosts: rows(a.hosts),
      devices: rows(a.devices),
    };
    memo.set(key, { at: Date.now(), data });
    return json(data);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}

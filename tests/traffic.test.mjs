/* /api/traffic 測試：用從真實 Cloudflare 儀表板抄回來的回應格式，
 * 驗證驗證、參數、日期分桶與各欄位解析。不需要真的 API token。 */

const REPO = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
import { loadFunction } from './_load.mjs';
const mod = await loadFunction(REPO, 'functions/api/traffic.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { console.log('  ✅ ' + name); pass++; }
  else { console.log('  ❌ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); fail++; }
};

// 用真正的身分標頭。原本寫 Cookie: CF_Authorization=abc——那是漏洞本身，
// 舊的驗證只看 cookie 名字存不存在，等於把破掉的行為寫成預期行為。
const AUTH = { 'Cf-Access-Authenticated-User-Email': 'test@example.com' };
const TOKEN = { CF_ANALYTICS_TOKEN: 'test-token' };

/* 依 Cloudflare 實際回傳的形狀造資料 */
const grp = (metric, visits, count) => ({ count, sum: { visits }, dimensions: { metric } });
function payload(series) {
  return { data: { viewer: { accounts: [{
    total: [{ count: 455, sum: { visits: 238 } }],
    series: series || [],
    // 直接進入的 refererHost 是空字串，不是 null
    referers: [grp('', 87, 87), grp('www.youtube.com', 61, 61)],
    countries: [grp('TW', 194, 380), grp('US', 14, 20)],
    paths: [grp('/', 181, 300)],
    hosts: [grp('cankingstore.com', 184, 380), grp('planner.cankingstore.com', 32, 40)],
    devices: [grp('mobile', 137, 260), grp('desktop', 95, 180), grp('tablet', 6, 9)],
  }] } } };
}

/* 攔截 Function 內部對 Cloudflare 的呼叫 */
let sentBody = null;
function withGraphQL(response, status = 200) {
  globalThis.fetch = async (_url, init) => {
    sentBody = JSON.parse(init.body);
    return new Response(JSON.stringify(response), {
      status, headers: { 'content-type': 'application/json' },
    });
  };
}
const call = (qs = '', env = TOKEN, headers = AUTH) =>
  mod.onRequestGet({
    request: new Request('https://cankingstore.com/api/traffic' + qs, { headers }),
    env,
  });

const taipeiDay = (ms) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 10);

/* ---------------------------------------------------------------- */
console.log('\n[1] 驗證與設定狀態');
{
  const r = await call('', TOKEN, {});
  ok('沒有 Access 憑證 -> 403', r.status === 403, r.status);

  const r2 = await call('', {}, AUTH);
  const d2 = await r2.json();
  ok('沒設 token -> 友善提示而非錯誤', r2.status === 200 && d2.ready === false, d2);
  ok('提示有講到環境變數名稱', /CF_ANALYTICS_TOKEN/.test(d2.message || ''), d2.message);
}

console.log('\n[2] 送給 Cloudflare 的查詢內容');
{
  withGraphQL(payload());
  await call('?days=7');
  const f = sentBody.variables.filter.AND;
  ok('有帶 accountTag', !!sentBody.variables.accountTag);
  ok('排除機器人 bot:0', f.some(x => x.bot === 0), f);
  ok('限定本站 siteTag', f.some(x => Array.isArray(x.siteTag_in)), f);
  ok('沒指定 host 時不加 requestHost', !f.some(x => x.requestHost), f);
  ok('排序用 sum_visits_DESC', sentBody.variables.order === 'sum_visits_DESC');
  ok('排除後台自己的造訪', f.some(x => x.requestPath_neq === '/admin'), f);

  await call('?days=7&host=cankingstore.com');
  const f2 = sentBody.variables.filter.AND;
  ok('指定 host 時會加 requestHost',
    f2.some(x => x.requestHost === 'cankingstore.com'), f2);
}

console.log('\n[3] 天數參數');
{
  withGraphQL(payload());
  const days = async (qs) => (await (await call(qs)).json()).days;
  ok('預設 7 天', (await days('')) === 7);
  ok('days=30 生效', (await days('?days=30')) === 30);
  ok('days=abc -> 退回 7', (await days('?days=abc')) === 7);
  ok('days=0 -> 退回 7', (await days('?days=0')) === 7);
  ok('days=9999 -> 上限 180', (await days('?days=9999')) === 180);
}

console.log('\n[4] 每小時資料合併成台北時間的每一天');
{
  const now = Date.now();
  // 直接指定「台北的第幾天、第幾點」，不要用「幾小時前」——
  // 那樣半夜跑測試時 1 小時前是今天、2 小時前變昨天，結果會飄。
  const at = (daysAgo, taipeiHour, visits) => {
    const day = taipeiDay(now - daysAgo * 86400e3);
    const utcHour = String(taipeiHour - 8).padStart(2, '0');   // 台北 12:00 = UTC 04:00
    return { count: visits * 2, sum: { visits }, dimensions: { ts: day + 'T' + utcHour + ':00:00Z' } };
  };
  withGraphQL(payload([at(0, 12, 5), at(0, 14, 3), at(1, 12, 7)]));
  // 帶一個獨有的 host，避開前面測試留下的 5 分鐘快取
  const d = await (await call('?days=7&host=daytest')).json();

  ok('回傳剛好 7 天', d.byDay.length === 7, d.byDay.length);
  ok('日期由舊到新', d.byDay[0].day < d.byDay[6].day, [d.byDay[0].day, d.byDay[6].day]);
  ok('最後一天是今天(台北)', d.byDay[6].day === taipeiDay(now), d.byDay[6].day);
  ok('同一天的小時會相加', d.byDay[6].visits === 8, d.byDay[6]);
  // 資料只落在今天(5+3)與昨天(7)，其餘 5 天要補 0
  ok('沒有資料的日子補 0，不是漏掉',
    d.byDay.filter(x => x.visits === 0).length === 5, d.byDay.map(x => x.visits));
  ok('昨天的 7 有算到', d.byDay[5].visits === 7, d.byDay[5]);

  // 帶不帶 Z 都要能解析（Cloudflare 目前給的是帶 Z 的）
  const noZ = { count: 4, sum: { visits: 2 }, dimensions: { ts: taipeiDay(now) + 'T04:00:00' } };
  withGraphQL(payload([noZ]));
  const d2 = await (await call('?days=1&host=daytest2')).json();
  ok('ts 沒有 Z 也算得進去', d2.byDay[0].visits === 2, d2.byDay);
}

console.log('\n[5] 各區塊解析');
{
  withGraphQL(payload());
  const d = await (await call('?days=7&host=parsetest')).json();
  ok('總造訪 238', d.visits === 238, d.visits);
  ok('總瀏覽 455', d.views === 455, d.views);
  ok('空字串來源顯示為「直接進入」',
    d.referers[0].name === '（直接進入）', d.referers[0]);
  ok('來源依造訪數排序', d.referers[0].visits >= d.referers[1].visits, d.referers);
  ok('國家保留代碼給前端翻譯', d.countries[0].name === 'TW', d.countries[0]);
  ok('子網域拆得出來',
    d.hosts.length === 2 && d.hosts[0].name === 'cankingstore.com', d.hosts);
  ok('裝置三類都在', d.devices.length === 3, d.devices);
  ok('回應有標示排除了什麼（別讓行為藏起來）', d.excludes === '/admin', d.excludes);
}

console.log('\n[6] 失敗處理');
{
  withGraphQL({ errors: [{ message: 'authentication error' }] }, 200);
  const r = await call('?days=7&host=x1');
  const d = await r.json();
  ok('GraphQL 錯誤 -> 502', r.status === 502, r.status);
  ok('把 Cloudflare 原訊息透出來，才查得出問題',
    /authentication error/.test(d.error || ''), d.error);

  withGraphQL({ data: { viewer: { accounts: [] } } });
  const r2 = await call('?days=7&host=x2');
  ok('查不到帳號 -> 502 而非當成 0', r2.status === 502, r2.status);

  globalThis.fetch = async () => { throw new Error('network down'); };
  const r3 = await call('?days=7&host=x3');
  ok('網路爆掉 -> 500 且不丟出例外', r3.status === 500, r3.status);
}

console.log('\n[7] 快取');
{
  let calls = 0;
  globalThis.fetch = async (_u, init) => {
    calls++;
    sentBody = JSON.parse(init.body);
    return new Response(JSON.stringify(payload()), { status: 200 });
  };
  await call('?days=7&host=cachetest');
  await call('?days=7&host=cachetest');
  ok('同樣的查詢只打一次 API', calls === 1, calls);
  const d = await (await call('?days=7&host=cachetest')).json();
  ok('快取回應會標示 cached', d.cached === true, d.cached);
  await call('?days=30&host=cachetest');
  ok('換天數就重新查', calls === 2, calls);
}

console.log('\n=== ' + pass + ' 通過 / ' + fail + ' 失敗 ===');
process.exit(fail ? 1 : 0);

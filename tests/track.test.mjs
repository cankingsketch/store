/* /api/track 與 /api/stats 的測試：真的 SQLite、真的 Function 程式碼 */
import { makeD1 } from './d1shim.mjs';

const REPO = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const track = await import('file://' + REPO + '/functions/api/track.js?v=' + Date.now());
const stats = await import('file://' + REPO + '/functions/api/stats.js?v=' + Date.now());

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { console.log('  ✅ ' + name); pass++; }
  else { console.log('  ❌ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); fail++; }
};

const AUTH = { Cookie: 'CF_Authorization=abc' };
const req = (url, opts = {}) => new Request(url, opts);

function post(body, headers = {}) {
  return req('https://cankingstore.com/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'User-Agent': 'Mozilla/5.0', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const hit = (env, body, headers) => track.onRequestPost({ request: post(body, headers), env });
const ask = (env, qs = '', headers = AUTH) =>
  stats.onRequestGet({ request: req('https://cankingstore.com/api/stats' + qs, { headers }), env });

/* ---------------------------------------------------------------- */
console.log('\n[1] 沒接 D1 時要安靜略過（不能讓網站壞掉）');
{
  const r = await hit({}, { channel: '蝦皮', url: 'https://shopee.tw/x' });
  ok('回 204', r.status === 204, r.status);
  const s = await ask({});
  const d = await s.json();
  ok('/api/stats 回報尚未啟用', d.ready === false, d);
}

console.log('\n[2] 驗證');
{
  const env = { STATS: makeD1() };
  const r = await ask(env, '', {});
  ok('沒有 Access 憑證 -> 403', r.status === 403, r.status);
  const r2 = await ask(env, '', { 'Cf-Access-Authenticated-User-Email': 'a@b.c' });
  ok('有 Access email -> 通過', r2.status === 200, r2.status);
  const r3 = await ask(env, '', { 'Cf-Access-Jwt-Assertion': 'jwt' });
  ok('有 Access JWT -> 通過', r3.status === 200, r3.status);
}

console.log('\n[3] 第一次點擊：自動建表');
const env = { STATS: makeD1() };
{
  const before = await ask(env);
  const d = await before.json();
  ok('還沒有表時不算錯誤', d.ready === true && d.total === 0, d);

  const r = await hit(env, {
    channel: '賣貨便', kind: 'shop', label: '下雨天杯墊',
    url: 'https://myship.7-11.com.tw/general/detail/GM2308212736960', page: '/goods',
  }, { 'CF-IPCountry': 'TW' });
  ok('回 204', r.status === 204, r.status);

  const rows = env.STATS._raw.prepare('SELECT * FROM clicks').all();
  ok('寫進 1 筆', rows.length === 1, rows.length);
  ok('通路正確', rows[0].channel === '賣貨便', rows[0].channel);
  ok('商品名正確', rows[0].label === '下雨天杯墊', rows[0].label);
  ok('國家正確', rows[0].country === 'TW', rows[0].country);
  ok('裝置判為桌機', rows[0].device === 'desktop', rows[0].device);
  ok('日期是台北時區', rows[0].day === new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10), rows[0].day);
}

console.log('\n[4] 壞資料不能讓端點爆掉');
{
  const n = () => env.STATS._raw.prepare('SELECT COUNT(*) c FROM clicks').get().c;
  const before = n();
  ok('不是 JSON -> 204 且不寫入', (await hit(env, 'not json')).status === 204 && n() === before);
  ok('沒有 url -> 不寫入', (await hit(env, { channel: '蝦皮' })).status === 204 && n() === before);
  ok('沒有 channel -> 不寫入', (await hit(env, { url: 'https://x.com' })).status === 204 && n() === before);
  ok('欄位型別亂給 -> 不寫入', (await hit(env, { channel: 5, url: {} })).status === 204 && n() === before);

  await hit(env, { channel: '蝦皮', url: 'https://shopee.tw/' + 'a'.repeat(500), label: 'b'.repeat(300) });
  const row = env.STATS._raw.prepare('SELECT * FROM clicks ORDER BY id DESC LIMIT 1').get();
  ok('過長網址被截到 300', row.url.length === 300, row.url.length);
  ok('過長標題被截到 80', row.label.length === 80, row.label.length);

  await hit(env, { channel: '蝦皮', url: 'https://shopee.tw/y', label: 'A\u0000B\u001fC\tD' });
  const row2 = env.STATS._raw.prepare('SELECT * FROM clicks ORDER BY id DESC LIMIT 1').get();
  ok('控制字元被清掉', !/[\u0000-\u001f]/.test(row2.label), row2.label);

  await hit(env, { channel: "x'; DROP TABLE clicks; --", url: 'https://evil.example/' });
  ok('SQL 注入無效（表還在）', env.STATS._raw.prepare('SELECT COUNT(*) c FROM clicks').get().c > 0);
}

console.log('\n[5] 手機判定');
{
  await hit(env, { channel: '蝦皮', url: 'https://shopee.tw/m' },
    { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148' });
  const row = env.STATS._raw.prepare('SELECT * FROM clicks ORDER BY id DESC LIMIT 1').get();
  ok('iPhone -> mobile', row.device === 'mobile', row.device);
}

console.log('\n[6] 彙總統計');
{
  const e2 = { STATS: makeD1() };
  const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  const mk = (ch, kind, label, page, country, device, day) =>
    ({ ch, kind, label, page, country, device, day });
  // 先讓表建起來
  await hit(e2, { channel: '賣貨便', kind: 'shop', label: '下雨天杯墊', url: 'https://myship.7-11.com.tw/a', page: '/goods' },
    { 'CF-IPCountry': 'TW' });
  const ins = e2.STATS._raw.prepare(
    `INSERT INTO clicks (ts,day,channel,kind,url,label,page,country,device) VALUES (?,?,?,?,?,?,?,?,?)`);
  const rows = [
    mk('賣貨便', 'shop', '下雨天杯墊', '/goods', 'TW', 'mobile', today),
    mk('賣貨便', 'shop', '下雨天杯墊', '/goods', 'TW', 'mobile', today),
    mk('蝦皮', 'shop', '發條食物抉擇動畫機', '/goods', 'TW', 'desktop', today),
    mk('Instagram', 'other', 'IG', '/', 'US', 'desktop', today),
  ];
  rows.forEach((r, i) => ins.run(Math.floor(Date.now() / 1000), r.day, r.ch, r.kind,
    'https://x/' + i, r.label, r.page, r.country, r.device));

  const d = await (await ask(e2, '?days=7')).json();
  ok('總點擊 5', d.total === 5, d.total);
  ok('購買點擊 4', d.shop === 4, d.shop);
  ok('通路第一名是賣貨便(3)', d.byChannel[0].channel === '賣貨便' && d.byChannel[0].n === 3, d.byChannel);
  ok('社群被標成 other', d.byChannel.some(c => c.channel === 'Instagram' && c.kind === 'other'), d.byChannel);
  ok('熱門商品第一名是下雨天杯墊(3)',
    d.byLabel[0].label === '下雨天杯墊' && d.byLabel[0].n === 3, d.byLabel);
  ok('熱門商品不含社群連結', !d.byLabel.some(x => x.label === 'IG'), d.byLabel);
  ok('頁面排名 /goods 最高', d.byPage[0].page === '/goods' && d.byPage[0].n === 4, d.byPage);
  ok('國家有 TW 與 US', d.byCountry.length === 2, d.byCountry);
  ok('裝置分類有兩種', d.byDevice.length === 2, d.byDevice);
  ok('日期區間 to = 今天(台北)', d.to === today, d.to);
  ok('每日序列有今天', d.byDay.some(x => x.day === today && x.n === 5), d.byDay);
}

console.log('\n[7] 天數參數');
{
  const e3 = { STATS: makeD1() };
  await hit(e3, { channel: '蝦皮', url: 'https://shopee.tw/a' });
  const g = async (qs) => (await (await ask(e3, qs)).json()).days;
  ok('預設 7 天', (await g('')) === 7);
  ok('days=30 生效', (await g('?days=30')) === 30);
  ok('days=abc -> 退回 7', (await g('?days=abc')) === 7);
  ok('days=0 -> 退回 7', (await g('?days=0')) === 7);
  ok('days=9999 -> 上限 365', (await g('?days=9999')) === 365);

  const d = await (await ask(e3, '?days=1')).json();
  ok('days=1 時 from = to', d.from === d.to, [d.from, d.to]);
}

console.log('\n[8] 舊資料不會被算進來');
{
  const e4 = { STATS: makeD1() };
  await hit(e4, { channel: '蝦皮', url: 'https://shopee.tw/new' });
  e4.STATS._raw.prepare(
    `INSERT INTO clicks (ts,day,channel,kind,url,label,page,country,device)
     VALUES (0,'2020-01-01','蝦皮','shop','https://old','舊','/','TW','desktop')`).run();
  const d = await (await ask(e4, '?days=7')).json();
  ok('7 天內只算得到 1 筆', d.total === 1, d.total);
  const d2 = await (await ask(e4, '?days=365')).json();
  ok('365 天也還是算不到 2020 的', d2.total === 1, d2.total);
}

console.log('\n=== ' + pass + ' 通過 / ' + fail + ' 失敗 ===');
process.exit(fail ? 1 : 0);

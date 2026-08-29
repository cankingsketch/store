/* 外連點擊記錄端點（Cloudflare Pages Function）
 * POST /api/track  <- track.js 用 sendBeacon 送來，公開、不需驗證
 *
 * 一律回 204：這支端點的任何失敗都不該讓瀏覽器 console 噴錯，
 * 更不該影響使用者跳去購買頁。資料寫進 D1 綁定 STATS。
 */

const MAX_URL = 300;
const MAX_LABEL = 80;
const KEEP_DAYS = 400;      // 保留約 13 個月，之後可以比較去年同期
const PRUNE_ODDS = 0.002;   // 約每 500 次寫入清一次過期資料

const NO_CONTENT = { status: 204, headers: { 'cache-control': 'no-store' } };

/* 建表。正常情況下不會被呼叫到——只有插入失敗（表不存在）時才建，
 * 所以第一次點擊、或資料庫被重建時都能自己長回來。 */
async function createTable(db) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS clicks (
         id      INTEGER PRIMARY KEY AUTOINCREMENT,
         ts      INTEGER NOT NULL,
         day     TEXT    NOT NULL,
         channel TEXT    NOT NULL,
         kind    TEXT    NOT NULL,
         url     TEXT    NOT NULL,
         label   TEXT,
         page    TEXT,
         country TEXT,
         device  TEXT
       )`
    ),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_clicks_day ON clicks(day)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_clicks_channel ON clicks(channel)'),
  ]);
}

/* 清掉控制字元並截長度（逐字元處理，避免在原始碼裡放控制字元） */
function str(v, max) {
  if (typeof v !== 'string') return '';
  let out = '';
  for (let i = 0; i < v.length && out.length < max; i++) {
    const c = v.charCodeAt(i);
    out += c < 32 || c === 127 ? ' ' : v[i];
  }
  return out.trim();
}

/* 台北時間的日期（GMT+8，台灣不用日光節約，固定加 8 小時即可） */
function taipeiDay(ms) {
  return new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function onRequestPost({ request, env }) {
  try {
    const db = env.STATS;
    if (!db) return new Response(null, NO_CONTENT); // 還沒接上 D1：安靜略過

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(null, NO_CONTENT);
    }

    const url = str(body && body.url, MAX_URL);
    const channel = str(body && body.channel, 60);
    if (!url || !channel) return new Response(null, NO_CONTENT);

    const kind = body && body.kind === 'shop' ? 'shop' : 'other';
    const ua = request.headers.get('User-Agent') || '';
    const device = /Mobile|Android|iPhone|iPad|iPod/i.test(ua) ? 'mobile' : 'desktop';
    const country =
      (request.cf && request.cf.country) || request.headers.get('CF-IPCountry') || '';

    const now = Date.now();
    const insert = () =>
      db
        .prepare(
          `INSERT INTO clicks (ts, day, channel, kind, url, label, page, country, device)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          Math.floor(now / 1000),
          taipeiDay(now),
          channel,
          kind,
          url,
          str(body && body.label, MAX_LABEL),
          str(body && body.page, 200),
          str(country, 8),
          device
        )
        .run();

    try {
      await insert();
    } catch (e) {
      if (!/no such table/i.test(String(e && e.message))) throw e;
      await createTable(db); // 第一次點擊，或資料庫被重建過
      await insert();
    }

    if (Math.random() < PRUNE_ODDS) {
      await db
        .prepare('DELETE FROM clicks WHERE day < ?')
        .bind(taipeiDay(now - KEEP_DAYS * 86400000))
        .run();
    }
  } catch (e) {
    /* 記錄失敗就算了，使用者體驗優先 */
  }
  return new Response(null, NO_CONTENT);
}

/* sendBeacon 不會發預檢，但保險起見讓 OPTIONS/GET 也安靜回應 */
export const onRequestOptions = () => new Response(null, NO_CONTENT);
export const onRequestGet = () => new Response(null, NO_CONTENT);

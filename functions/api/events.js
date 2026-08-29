/* 活動推送端點（Cloudflare Pages Function）
 * POST /api/events  <- 一罐指揮部按「🌐 推送到官網」時送來，重寫 events-live.js
 * GET  /api/events  -> 回目前 events-live.js 裡的內容（給指揮部顯示「上次推送了什麼」）
 *
 * 安全：指揮部在另一個網域（planner.cankingstore.com），拿不到這裡的 Access cookie，
 *      所以改用共用金鑰 EVENTS_PUSH_KEY（Cloudflare 環境變數，跟 GITHUB_TOKEN 同一頁設定）。
 *      內容只有活動名稱、日期、攤位號——本來就要公開的東西，沒有個資。
 * 金鑰：EVENTS_PUSH_KEY（驗證用）、GITHUB_TOKEN（Contents: Read and write）
 *
 * 寫進 GitHub 之後 Cloudflare Pages 會自動部署，約 1～2 分鐘後官網才會看到新內容。
 */

const REPO = 'cankingsketch/store';
const BRANCH = 'main';
const FILE = 'events-live.js';
const ORIGIN = 'https://planner.cankingstore.com'; // 只開放指揮部跨網域呼叫

const HEAD = `/* 此檔由「一罐指揮部」按下「推送到官網」時自動產生，請勿手動編輯（會被覆蓋）。
   手動維護的活動請編輯 events-data.js。 */
`;

/* ---------- 小工具 ---------- */
const enc = new TextEncoder();

function b64FromText(str) {
  const bytes = enc.encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function textFromB64(b64) {
  const bin = atob(String(b64 || '').replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function cors() {
  return {
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Push-Key', // 少了 X-Push-Key 預檢就會擋下整個請求
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    }, cors()),
  });
}

/* 逐一檢查，不合格的整筆丟掉：官網寧可少一場，也不要印出半筆壞資料 */
function cleanEvents(raw) {
  const out = [];
  const seen = {};
  (Array.isArray(raw) ? raw : []).forEach(function (e) {
    if (!e || typeof e !== 'object') return;
    const name = String(e.name || '').trim().slice(0, 60);
    const end = String(e.end || '').trim();
    const date = String(e.date || '').trim().slice(0, 40);
    const booth = String(e.booth || '').trim().slice(0, 60);
    if (!name || !date) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return; // end 是拿來分「預定/過往」的，格式錯就沒意義
    const key = name + '|' + end;
    if (seen[key]) return;
    seen[key] = 1;
    out.push({ date: date, end: end, name: name, booth: booth });
  });
  return out.sort(function (a, b) { return b.end.localeCompare(a.end); }); // 新的排前面，人看檔案時比較好找
}

function fileBody(events) {
  const lines = events.map(function (e) {
    return '  ' + JSON.stringify(e) + ',';
  }).join('\n');
  return HEAD + 'window.CANKING_EVENTS_LIVE = [\n' + lines + '\n];\n';
}

/* ---------- GitHub ---------- */
async function gh(env, path, init) {
  return fetch(`https://api.github.com/repos/${REPO}/${path}`, Object.assign({}, init, {
    headers: Object.assign({
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'cankingstore-events',
    }, (init && init.headers) || {}),
  }));
}

async function ghJson(env, path, init, what) {
  const r = await gh(env, path, init);
  if (!r.ok) throw new Error(`GitHub ${what}失敗 (${r.status}): ${await r.text()}`);
  return r.json();
}

/* ---------- 端點 ---------- */
export function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() });
}

export async function onRequestGet({ env }) {
  if (!env.GITHUB_TOKEN) return json({ error: '伺服器尚未設定 GITHUB_TOKEN。' }, 500);
  const r = await gh(env, `contents/${FILE}?ref=${BRANCH}`);
  if (r.status === 404) return json({ ok: true, events: [], 檔案: null });
  if (!r.ok) return json({ error: `GitHub 讀取失敗 (${r.status})` }, 502);
  const meta = await r.json();
  const text = textFromB64(meta.content);
  const m = text.match(/window\.CANKING_EVENTS_LIVE\s*=\s*(\[[\s\S]*?\]);/);
  let events = [];
  if (m) { try { events = JSON.parse(m[1]); } catch (_) { events = []; } }
  return json({ ok: true, events: events, sha: meta.sha });
}

export async function onRequestPost({ request, env }) {
  // 兩邊都 trim：金鑰用管線設進去時很容易多一個換行，那種錯很難查
  const sent = String(request.headers.get('X-Push-Key') || '').trim();
  const want = String(env.EVENTS_PUSH_KEY || '').trim();
  if (!want || sent !== want) {
    return json({ error: '金鑰不正確。' }, 403);
  }
  if (!env.GITHUB_TOKEN) return json({ error: '伺服器尚未設定 GITHUB_TOKEN。' }, 500);

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: '送來的不是合法 JSON。' }, 400); }

  const events = cleanEvents(body && body.events);
  // 防呆：本來有一串、這次卻推 0 筆，多半是前端讀取出問題，不是真的要清空官網
  if (!events.length && !(body && body['強制'])) {
    return json({ error: '這次推送是 0 筆活動，已中止（怕是誤按或讀取失敗）。真的要清空請帶 強制:true。' }, 400);
  }

  const next = fileBody(events);
  const cur = await gh(env, `contents/${FILE}?ref=${BRANCH}`);
  let sha = null;
  if (cur.ok) {
    const meta = await cur.json();
    sha = meta.sha;
    if (textFromB64(meta.content) === next) {
      return json({ ok: true, 已是最新: true, 筆數: events.length });
    }
  } else if (cur.status !== 404) {
    return json({ error: `GitHub 讀取失敗 (${cur.status})` }, 502);
  }

  // 單一檔案就用 Contents API 一次搞定＝一個 commit＝一次部署
  const payload = {
    message: `活動：從指揮部推送 ${events.length} 場`,
    content: b64FromText(next),
    branch: BRANCH,
  };
  if (sha) payload.sha = sha;

  try {
    const res = await ghJson(env, `contents/${FILE}`, { method: 'PUT', body: JSON.stringify(payload) }, '寫入');
    return json({ ok: true, 筆數: events.length, commit: res.commit && res.commit.sha });
  } catch (err) {
    return json({ error: String(err.message || err) }, 502);
  }
}

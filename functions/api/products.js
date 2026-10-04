/* 商品後台 API（Cloudflare Pages Function）
 * GET  /api/products  -> 讀出 data/products.json（周邊頁的商品資料）
 * POST /api/products  -> 檢查前端送來的最終狀態，連同新圖片一起寫回 GitHub
 *
 * 原本是去解析、改寫 Weebly 的 goods.html；新版周邊頁改成讀 data/products.json，
 * 後台只要讀寫這一份 JSON，不再碰 HTML。
 *
 * 安全：必須經過 Cloudflare Access（會帶 Cf-Access-Authenticated-User-Email）
 * 金鑰：Cloudflare 環境變數 GITHUB_TOKEN（Contents: Read and write）
 */
import { requireAccess } from '../../lib/access.js';


const REPO = 'cankingsketch/store';
const BRANCH = 'main';
const FILE = 'data/products.json';

// 周邊頁的分區。明信片區是特殊版面（明信片牆、卡冊 3D），只放 special 商品，後台不能把別的商品移進去
const SECTIONS = ['blind', 'postcard', 'apparel', 'other'];
const HOT_MAX = 8;
const IMG_MAX = 12;
// 商品圖一律是瘦身過的 WebP：-l 是點開看的大圖，-s 是卡片用的小圖（同名）
const IMG_RE = /^img\/opt\/[A-Za-z0-9._-]+-l\.webp$/;
// 後台上傳的檔名固定是 up-日期-時間-序號，不會蓋到既有的圖
const UPLOAD_RE = /^img\/opt\/up-\d{8}-\d{6}-\d{1,2}-[ls]\.webp$/;
const UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

/* ---------- 工具 ---------- */
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8');

function b64FromText(str) {
  const bytes = enc.encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function bytesFromB64(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function textFromB64(b64) { return dec.decode(bytesFromB64(b64)); }
function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
/* 真的驗簽章，不是看 cookie 名字存不存在。細節見 lib/access.js。
 * 這支目前另外還有 Cloudflare Access 擋在路徑前面，但那是設定，設定會被改；
 * 端點自己也要守得住。 */
async function requireAuth(request, env) {
  const auth = await requireAccess(request, json);
  if (auth.error) return auth;
  if (!env.GITHUB_TOKEN) {
    return { error: json({ error: '伺服器尚未設定 GITHUB_TOKEN 環境變數。' }, 500) };
  }
  return auth;
}

/* ---------- GitHub ---------- */
async function gh(env, path, init) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/${path}`, Object.assign({}, init, {
    headers: Object.assign({
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'cankingstore-admin',
    }, (init && init.headers) || {}),
  }));
  return r;
}

async function ghGet(env, path, ref) {
  const r = await gh(env, `contents/${path}?ref=${ref || BRANCH}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub 讀取失敗 (${r.status}): ${await r.text()}`);
  return r.json();
}

async function ghJson(env, path, init, what) {
  const r = await gh(env, path, init);
  if (!r.ok) throw new Error(`GitHub ${what}失敗 (${r.status}): ${await r.text()}`);
  return r.json();
}

/* 分支目前指到哪個 commit。所有寫入都以它為基準，推送時再回頭比對。 */
async function headSha(env) {
  const d = await ghJson(env, `git/ref/heads/${BRANCH}`, null, '讀取分支');
  return d.object.sha;
}

/* 把所有變更打包成「一個 commit、一次推送」。
 *
 * 這件事很重要：Contents API 每寫一個檔案就是一個 commit，而 Cloudflare Pages
 * 是每個 commit 部署一次——上傳 3 張圖會排 4 次部署、彼此還會互相取消。
 * blob 與 tree 都只是 Git 物件，不會驚動 Cloudflare；只有最後更新分支那一步算推送。
 *
 * parentSha 同時是併發保護：中途若有別人推了東西，分支就不是快轉，
 * GitHub 會拒絕，我們回 409 請使用者重新整理，而不是默默蓋掉對方。
 */
async function commitAll(env, files, message, parentSha) {
  if (!files.length) return null;

  // blob 彼此獨立，可以同時建立（這是省時間的關鍵）
  const blobs = await Promise.all(files.map(async function (f) {
    const b = await ghJson(env, 'git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content: f.contentB64, encoding: 'base64' }),
    }, '建立檔案物件');
    return { path: f.path, mode: '100644', type: 'blob', sha: b.sha };
  }));

  const base = await ghJson(env, `git/commits/${parentSha}`, null, '讀取 commit');
  const tree = await ghJson(env, 'git/trees', {
    method: 'POST',
    // base_tree：以現有內容為底，只覆蓋我們指定的路徑，其餘檔案完全不動
    body: JSON.stringify({ base_tree: base.tree.sha, tree: blobs }),
  }, '建立目錄樹');

  const commit = await ghJson(env, 'git/commits', {
    method: 'POST',
    body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] }),
  }, '建立 commit');

  // 唯一一次推送，也是唯一一次觸發部署
  const r = await gh(env, `git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  if (r.status === 422) {
    throw Object.assign(new Error('網站內容在你編輯期間有異動，請重新整理後再試一次。'), { conflict: true });
  }
  if (!r.ok) throw new Error(`GitHub 推送失敗 (${r.status}): ${await r.text()}`);
  return commit.sha;
}

/* ---------- 商品資料檢查 ---------- */
function bad(msg) { return Object.assign(new Error(msg), { bad: true }); }

function str(v, max, what) {
  const s = String(v == null ? '' : v).trim();
  if (s.length > max) throw bad(`${what}太長了（最多 ${max} 字）。`);
  return s;
}

/* 把前端送來的一個商品整理成固定格式。
 * 欄位順序固定，檔案內容才會穩定：照原樣存回去 = 一字不差 = 不推送。
 * view3d（3D 模型設定）與 special（明信片牆、卡冊）是程式碼層級的東西，
 * view3d.module 會被頁面 import，絕對不能讓前端決定——一律沿用檔案裡原本的值。 */
function normalize(p, prev) {
  if (!p || typeof p !== 'object') throw bad('商品資料格式不對。');
  const id = String(p.id || '');
  if (!ID_RE.test(id)) throw bad(`商品代號「${id}」不合格式。`);
  const name = str(p.name, 80, '商品名稱');
  if (!name) throw bad('有商品沒有名稱。');
  const label = `「${name}」`;

  const special = prev && prev.special;
  const section = special ? 'postcard' : String(p.section || '');
  if (SECTIONS.indexOf(section) < 0) throw bad(`${label}的分區不對。`);
  if (section === 'postcard' && !special) throw bad(`明信片區是特殊版面，${label}請放到其他分區。`);

  const price = Number(p.price || 0);
  if (!Number.isInteger(price) || price < 0 || price > 100000) throw bad(`${label}的價格要是 0～100000 的整數。`);

  if (!Array.isArray(p.imgs) || !p.imgs.length) throw bad(`${label}至少要有一張圖。`);
  if (p.imgs.length > IMG_MAX) throw bad(`${label}的圖最多 ${IMG_MAX} 張。`);
  const imgs = p.imgs.map(String);
  imgs.forEach(function (s) { if (!IMG_RE.test(s)) throw bad(`${label}有一張圖的路徑不對：${s}`); });

  const video = str(p.video, 300, '影片網址');
  if (video && !/^https:\/\/[^\s"'<>]+$/.test(video)) throw bad(`${label}的影片網址要是 https:// 開頭。`);
  const shopee = str(p.shopee, 500, '蝦皮網址');
  if (shopee && !/^https:\/\/([a-z0-9-]+\.)*shopee\.tw\/[^\s"'<>]*$/.test(shopee)) {
    throw bad(`${label}的蝦皮網址要是 https://shopee.tw/ 開頭。`);
  }
  const date = String(p.date || '');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad(`${label}的上架日期格式要是 2026-10-03。`);

  const o = { id, section, name };
  const findName = str(p.findName, 80, '賣貨便名稱');
  if (findName) o.findName = findName;
  o.price = price;
  if (p.from) o.from = true;
  o.note = str(p.note, 200, '說明');
  const desc = str(p.desc, 300, '詳細說明');
  if (desc) o.desc = desc;
  o.imgs = imgs;
  o.video = video;
  o.shopee = shopee;
  if (p.soldout) o.soldout = true;
  if (p.hidden) o.hidden = true;
  o.date = date;
  if (prev && prev.view3d) o.view3d = prev.view3d;
  if (special) o.special = special;
  return o;
}

function normalizeAll(data, current) {
  if (!data || !Array.isArray(data.products) || !data.products.length) throw bad('沒有收到商品資料。');
  const prevById = new Map((current.products || []).map(function (p) { return [p.id, p]; }));
  const seen = new Set();
  const products = data.products.map(function (p) {
    const o = normalize(p, prevById.get(String(p && p.id)));
    if (seen.has(o.id)) throw bad(`商品代號「${o.id}」重複了。`);
    seen.add(o.id);
    return o;
  });
  // 明信片牆、卡冊是頁面上的固定版面，刪掉版面會壞——不想賣請改成「隱藏」
  (current.products || []).forEach(function (p) {
    if (p.special && !seen.has(p.id)) throw bad(`「${p.name}」是特殊版面，不能刪除，可以改成隱藏。`);
  });
  const hot = [];
  (Array.isArray(data.hot) ? data.hot : []).forEach(function (id) {
    id = String(id);
    if (!seen.has(id)) throw bad(`熱銷推薦裡的商品「${id}」不存在。`);
    if (hot.indexOf(id) < 0) hot.push(id);
  });
  if (hot.length > HOT_MAX) throw bad(`熱銷推薦最多 ${HOT_MAX} 個。`);
  return { hot, products };
}

/* 上傳的圖：路徑要合格、要真的有商品用到、要真的是 WebP、不能太大 */
function checkUploads(uploads, data) {
  const used = new Set();
  data.products.forEach(function (p) {
    p.imgs.forEach(function (s) { used.add(s); used.add(s.replace(/-l\.webp$/, '-s.webp')); });
  });
  return Object.keys(uploads).filter(function (path) {
    if (!UPLOAD_RE.test(path)) throw bad(`上傳的檔名不對：${path}`);
    return used.has(path);         // 沒被用到的（上傳後又刪掉的圖）就不寫進網站
  }).map(function (path) {
    let bytes;
    try { bytes = bytesFromB64(uploads[path]); } catch (e) { throw bad(`圖片資料壞掉了：${path}`); }
    if (bytes.length > UPLOAD_MAX_BYTES) throw bad(`圖片太大了：${path}`);
    const tag = String.fromCharCode.apply(null, bytes.subarray(0, 4)) + String.fromCharCode.apply(null, bytes.subarray(8, 12));
    if (tag !== 'RIFFWEBP') throw bad(`不是 WebP 圖片：${path}`);
    return { path, contentB64: uploads[path] };
  });
}

function serialize(data) { return JSON.stringify(data, null, 2) + '\n'; }

/* ---------- 路由 ---------- */
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  try {
    const file = await ghGet(env, FILE);
    if (!file) return json({ error: `網站上找不到 ${FILE}。` }, 500);
    const data = JSON.parse(textFromB64(file.content));
    return json({ sha: file.sha, data, user: auth.email });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  try {
    const payload = await request.json();

    // 先鎖定分支目前的位置，再從同一個位置讀檔案，最後以它為 parent 推送。
    // 這樣「讀到的內容」與「推送的基準」一定是同一個狀態。
    const parent = await headSha(env);
    const file = await ghGet(env, FILE, parent);
    if (!file) return json({ error: `網站上找不到 ${FILE}。` }, 500);
    if (payload.sha !== file.sha) {
      return json({ error: '網站內容在你編輯期間有異動，請重新整理後再試一次。' }, 409);
    }
    const src = textFromB64(file.content);
    const data = normalizeAll(payload.data, JSON.parse(src));
    const images = checkUploads(payload.uploads || {}, data);

    const next = serialize(data);
    if (next === src && !images.length) return json({ ok: true, changed: false, message: '沒有變更。' });

    // 圖片與 products.json 一起送，打包成單一 commit ＝ 只觸發一次部署
    const files = images.slice();
    if (next !== src) files.push({ path: FILE, contentB64: b64FromText(next) });

    const big = images.filter(function (f) { return /-l\.webp$/.test(f.path); });
    const message = `Update products via admin (${auth.email})` +
      (big.length ? `\n\n新增圖片 ${big.length} 張：\n${big.map(function (f) { return f.path; }).join('\n')}` : '');
    const sha = await commitAll(env, files, message, parent);

    return json({ ok: true, changed: true, count: data.products.length, images: big.length, commit: sha });
  } catch (e) {
    if (e && e.conflict) return json({ error: e.message }, 409);
    if (e && e.bad) return json({ error: e.message }, 400);
    return json({ error: String(e.message || e) }, 500);
  }
}

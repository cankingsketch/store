/* 商品後台 API（Cloudflare Pages Function）
 * GET  /api/products  -> 讀出 goods.html 目前的商品清單
 * POST /api/products  -> 依前端送來的最終狀態重組 goods.html 並寫回 GitHub
 *
 * 安全：必須經過 Cloudflare Access（會帶 Cf-Access-Authenticated-User-Email）
 * 金鑰：Cloudflare 環境變數 GITHUB_TOKEN（Contents: Read and write）
 */

const REPO = 'cankingsketch/store';
const BRANCH = 'main';
const FILE = 'goods.html';
const H2 = '<h2 class="wsite-content-title"';
// 商品區結尾：容許 LF 或 CRLF，避免換行格式改變就整個解析失敗
const REGION_END_RE = /\r?\n\t\t\t<\/div>\r?\n\t\t<\/div>/;

/* ---------- 工具 ---------- */
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { ignoreBOM: true }); // 保留 BOM，存檔不動到無關內容

function b64FromText(str) {
  const bytes = enc.encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function textFromB64(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return dec.decode(bytes);
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
/* 舊商品標題在 HTML 中是數字實體（&#30332;…），要解碼才能正確顯示 */
function unesc(s) {
  return String(s == null ? '' : s)
    .replace(/&#(\d+);/g, function (_, d) { return String.fromCodePoint(parseInt(d, 10)); })
    .replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); })
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}
function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
function requireAuth(request, env) {
  // Cloudflare Access 通過驗證後，可能以下列任一形式帶入身分資訊
  const email = request.headers.get('Cf-Access-Authenticated-User-Email');
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  const cookie = request.headers.get('Cookie') || '';
  const hasAccessCookie = cookie.indexOf('CF_Authorization=') >= 0;

  if (!email && !jwt && !hasAccessCookie) {
    const cfHeaders = [];
    request.headers.forEach(function (_v, k) { if (/^cf-/i.test(k)) cfHeaders.push(k); });
    return { error: json({
      error: '未通過 Cloudflare Access 驗證，請先在 Cloudflare 設定 /admin 與 /api/products 的存取保護。',
      debug: { cfHeaders: cfHeaders, hasCookie: cookie.length > 0 }
    }, 403) };
  }
  if (!env.GITHUB_TOKEN) {
    return { error: json({ error: '伺服器尚未設定 GITHUB_TOKEN 環境變數。' }, 500) };
  }
  return { email: email || 'Access 使用者' };
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

/* ---------- goods.html 解析 ---------- */
function splitDoc(src) {
  const first = src.indexOf(H2);
  if (first < 0) throw new Error('goods.html 結構無法辨識：找不到商品標題。');
  const m = REGION_END_RE.exec(src.slice(first));
  if (!m) throw new Error('goods.html 結構無法辨識：找不到商品區結尾。');
  const end = first + m.index;
  const region = src.slice(first, end);
  const idxs = [];
  let p = region.indexOf(H2);
  while (p >= 0) { idxs.push(p); p = region.indexOf(H2, p + 1); }
  const blocks = idxs.map((s, i) => region.slice(s, i + 1 < idxs.length ? idxs[i + 1] : region.length));
  return { head: src.slice(0, first), blocks, tail: src.slice(end) };
}

/* 全站共用的賣貨便網址：取頁面上第一個賣貨便連結。
 * 賣貨便是單頁式賣場（實測：點商品只開彈窗、網址不變、無分享功能），
 * 做不到個別商品網址，所以每個商品都指向同一個賣場。 */
function findMyshipUrl(src) {
  const m = src.match(/href="(https:\/\/myship\.7-11\.com\.tw\/[^"]+)"/);
  return m ? m[1] : '';
}

/* ---------- 賣場按鈕 ----------
 * 沿用網站既有的 wsite-button（全站 7 頁約 40 顆都是這個樣式），
 * 不另造一套，才不會出現「新按鈕跟舊按鈕長不一樣」。
 * 紅色 highlight = 主要通路，深灰 normal = 次要。
 *
 * 這排按鈕放在 </h2> 之後、自成一行——刻意不塞進標題裡面：
 * 塞進去會讓 parseBlock 把按鈕文字當成商品名稱、renameLegacy 也會改到按鈕文字。
 * 放在外面就完全碰不到舊商品的標題結構。
 */
const BUY_RE = /\n?<div class="ck-buy" data-ck="1">[\s\S]*?<\/div>\n?/;

/* 把生成的按鈕列拿掉，還原成「乾淨區塊」。
 * 所有解析與改名都在乾淨區塊上做，無損保證才守得住。 */
function stripBuy(block) {
  return block.replace(BUY_RE, '\n');
}

function parseBuy(block) {
  const row = block.match(BUY_RE);
  if (!row) return { myship: '', shopee: '' };
  const get = (cls) => {
    const m = row[0].match(new RegExp('<a class="[^"]*" href="([^"]+)"[^>]*data-buy="' + cls + '"'));
    return m ? unesc(m[1]) : '';
  };
  return { myship: get('myship'), shopee: get('shopee') };
}

function buildBuy(item) {
  const btn = (kind, url, label, variant) => url
    ? `<a class="wsite-button wsite-button-small wsite-button-${variant}" href="${esc(url)}"` +
      ` target="_blank" rel="noopener" data-buy="${kind}"><span class="wsite-button-inner">${label}</span></a>`
    : '';
  const parts = [
    btn('myship', item.myship, '賣貨便', 'highlight'),
    btn('shopee', item.shopee, '蝦皮', 'normal'),
  ].filter(Boolean);
  return parts.length ? `\n<div class="ck-buy" data-ck="1">\n${parts.join('\n')}\n</div>\n` : '';
}

/* 這個舊商品本來就有自己的 Weebly 按鈕嗎？（例如「合作蝦皮賣場」「貼圖」）
 * 有的話後台會提醒，避免再加一組變成重複。 */
function hasOwnButtons(block) {
  return /wsite-button/.test(stripBuy(block));
}

function parseBlock(rawBlock, idx) {
  const block = stripBuy(rawBlock);
  const m = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
  const rawTitle = m ? m[1] : '';
  const title = unesc(rawTitle.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  const isNew = /<h2[^>]*data-ck="1"/.test(block);
  const buy = parseBuy(rawBlock);
  const out = {
    idx, title, editable: isNew, kind: isNew ? 'new' : 'legacy',
    myship: buy.myship, shopee: buy.shopee, ownButtons: hasOwnButtons(rawBlock),
  };
  if (isNew) {
    out.images = [];
    const re = /<figure class="ck-img ck-(lg|md|sm)"><img src="images\/([^"]+)"/g;
    let g;
    while ((g = re.exec(block))) out.images.push({ size: g[1], file: g[2] });
    const d = block.match(/<div class="ck-prod-desc[^"]*">([\s\S]*?)<\/div>/);
    out.desc = d ? unesc(d[1]).trim() : '';
    out.descAlign = /class="ck-prod-desc[^"]*\bck-desc-left\b/.test(block) ? 'left' : 'center';
  } else {
    const imgs = block.match(/<img[^>]+src="images\/[^"]+"/g) || [];
    out.imageCount = imgs.length;
    out.hasVideo = /youtube|iframe|wSlideshow|imageGallery/i.test(block);
    // 清單縮圖用：舊商品取第一張圖（含可能的 ?timestamp）
    const firstImg = block.match(/<img[^>]+src=["'](images\/[^"']+)["']/);
    if (firstImg) out.thumb = firstImg[1];
  }
  return out;
}

function buildBlock(item) {
  const title = esc(item.title || '未命名商品');
  const imgs = (item.images || []).map(function (im, i) {
    const size = ['lg', 'md', 'sm'].indexOf(im.size) >= 0 ? im.size : 'lg';
    // 第一張是主圖、通常一進頁面就看得到，不延遲載入；其餘才延遲以節省流量
    const lazy = i === 0 ? '' : ' loading="lazy"';
    return `<figure class="ck-img ck-${size}"><img src="images/${esc(im.file)}" alt="${title}"${lazy} /></figure>`;
  }).join('\n');
  // 說明文字對齊：後台有明講就照做；沒講就沿用自動規則
  //（有並排圖時靠左，與舊商品多圖排版一致；單張大圖置中）
  const sideBySide = (item.images || []).some(function (im) { return im.size === 'md' || im.size === 'sm'; });
  const left = item.descAlign === 'left' || (item.descAlign !== 'center' && sideBySide);
  const descCls = 'ck-prod-desc' + (left ? ' ck-desc-left' : '');
  const desc = item.desc && item.desc.trim()
    ? `\n<div class="${descCls}">${esc(item.desc.trim())}</div>` : '';
  return `<h2 class="wsite-content-title" data-ck="1"><strong><font size="7">${title}</font></strong></h2>\n` +
    buildBuy(item) + '\n' +
    `<div class="ck-prod" data-ck="1">\n<div class="ck-prod-imgs">\n${imgs}\n</div>${desc}\n</div>\n\n`;
}

/* 只換掉舊商品 h2 內的文字，其餘結構原封不動。
 * 一定要傳入乾淨區塊（stripBuy 過的），否則會把按鈕文字也一起改名。 */
function renameLegacy(block, newTitle) {
  return block.replace(/(<h2[^>]*>)([\s\S]*?)(<\/h2>)/, function (_, open, inner, close) {
    const replaced = inner.replace(/>([^<>]+)</g, function (seg, text) {
      return text.trim() ? '>' + esc(newTitle) + '<' : seg;
    });
    return open + replaced + close;
  });
}

/* 舊商品：在 </h2> 之後插入按鈕列（先確保區塊是乾淨的） */
function withBuy(cleanBlock, item) {
  const row = buildBuy(item);
  if (!row) return cleanBlock;
  return cleanBlock.replace('</h2>', '</h2>' + row.replace(/\n$/, ''));
}

/* ---------- 路由 ---------- */
export async function onRequestGet({ request, env }) {
  const auth = requireAuth(request, env);
  if (auth.error) return auth.error;
  try {
    const file = await ghGet(env, FILE);
    const src = textFromB64(file.content);
    const { blocks } = splitDoc(src);
    return json({ sha: file.sha, products: blocks.map(parseBlock),
      myshipUrl: findMyshipUrl(src), user: auth.email });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const auth = requireAuth(request, env);
  if (auth.error) return auth.error;
  try {
    const payload = await request.json();
    const items = payload.items;
    if (!Array.isArray(items) || !items.length) return json({ error: '沒有收到商品資料。' }, 400);

    // 先鎖定分支目前的位置，再從同一個位置讀檔案，最後以它為 parent 推送。
    // 這樣「讀到的內容」與「推送的基準」一定是同一個狀態。
    const parent = await headSha(env);
    const file = await ghGet(env, FILE, parent);
    if (payload.sha && payload.sha !== file.sha) {
      return json({ error: '網站內容在你編輯期間有異動，請重新整理後再試一次。' }, 409);
    }
    const src = textFromB64(file.content);
    const { head, blocks, tail } = splitDoc(src);

    const uploads = payload.uploads || {};
    const names = Object.keys(uploads);

    // 賣貨便沒有個別商品網址（實測過：整個賣場只有一個網址），
    // 所以全站共用一個，從頁面頂端原本那顆按鈕帶入。
    const myshipUrl = findMyshipUrl(src);

    // 依前端送來的最終狀態重組
    const out = [];
    for (const item of items) {
      // 前端只送「有沒有要放賣貨便」，網址一律用共用的那個
      const buy = { myship: item.myship ? myshipUrl : '', shopee: (item.shopee || '').trim() };
      if (item.new) {
        out.push(buildBlock(Object.assign({}, item, buy)));
      } else {
        const raw = blocks[item.idx];
        if (raw == null) return json({ error: `找不到商品 #${item.idx}，請重新整理。` }, 400);
        if (/<h2[^>]*data-ck="1"/.test(raw)) {
          out.push(buildBlock(Object.assign({}, item, buy)));  // 新結構：整塊重建
        } else {
          // 舊結構：一律先還原成乾淨區塊，改完再把按鈕列放回去。
          // 這樣「沒設定按鈕」時產出的內容與原檔一字不差。
          const clean = stripBuy(raw);
          const renamed = parseBlock(clean, item.idx).title === item.title
            ? clean
            : renameLegacy(clean, item.title);
          out.push(withBuy(renamed, buy));
        }
      }
    }

    const next = head + out.join('') + tail;
    if (next === src && !names.length) return json({ ok: true, changed: false, message: '沒有變更。' });

    // 圖片與 goods.html 一起送，打包成單一 commit ＝ 只觸發一次部署
    const files = names.map(function (name) {
      return { path: `images/${name}`, contentB64: uploads[name] };
    });
    if (next !== src) files.push({ path: FILE, contentB64: b64FromText(next) });

    const message = `Update products via admin (${auth.email})` +
      (names.length ? `\n\n新增圖片 ${names.length} 張：\n${names.join('\n')}` : '');
    const sha = await commitAll(env, files, message, parent);

    return json({ ok: true, changed: true, count: items.length, images: names.length, commit: sha });
  } catch (e) {
    if (e && e.conflict) return json({ error: e.message }, 409);
    return json({ error: String(e.message || e) }, 500);
  }
}

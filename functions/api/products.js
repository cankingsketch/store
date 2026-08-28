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
const REGION_END = '\n\t\t\t</div>\n\t\t</div>';

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
async function ghGet(env, path) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'cankingstore-admin',
    },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub 讀取失敗 (${r.status}): ${await r.text()}`);
  return r.json();
}
async function ghPut(env, path, contentB64, message, sha) {
  const body = { message, content: contentB64, branch: BRANCH };
  if (sha) body.sha = sha;
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'cankingstore-admin',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`GitHub 寫入失敗 (${r.status}): ${await r.text()}`);
  return r.json();
}

/* ---------- goods.html 解析 ---------- */
function splitDoc(src) {
  const first = src.indexOf(H2);
  const end = src.indexOf(REGION_END, first);
  if (first < 0 || end < 0) throw new Error('goods.html 結構無法辨識，請聯絡開發者。');
  const region = src.slice(first, end);
  const idxs = [];
  let p = region.indexOf(H2);
  while (p >= 0) { idxs.push(p); p = region.indexOf(H2, p + 1); }
  const blocks = idxs.map((s, i) => region.slice(s, i + 1 < idxs.length ? idxs[i + 1] : region.length));
  return { head: src.slice(0, first), blocks, tail: src.slice(end) };
}

function parseBlock(block, idx) {
  const m = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
  const rawTitle = m ? m[1] : '';
  const title = unesc(rawTitle.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  const isNew = /<h2[^>]*data-ck="1"/.test(block);
  const out = { idx, title, editable: isNew, kind: isNew ? 'new' : 'legacy' };
  if (isNew) {
    out.images = [];
    const re = /<figure class="ck-img ck-(lg|md|sm)"><img src="images\/([^"]+)"/g;
    let g;
    while ((g = re.exec(block))) out.images.push({ size: g[1], file: g[2] });
    const d = block.match(/<div class="ck-prod-desc">([\s\S]*?)<\/div>/);
    out.desc = d ? unesc(d[1]).trim() : '';
  } else {
    const imgs = block.match(/<img[^>]+src="images\/[^"]+"/g) || [];
    out.imageCount = imgs.length;
    out.hasVideo = /youtube|iframe|wSlideshow|imageGallery/i.test(block);
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
  const desc = item.desc && item.desc.trim()
    ? `\n<div class="ck-prod-desc">${esc(item.desc.trim())}</div>` : '';
  return `<h2 class="wsite-content-title" data-ck="1"><strong><font size="7">${title}</font></strong></h2>\n\n` +
    `<div class="ck-prod" data-ck="1">\n<div class="ck-prod-imgs">\n${imgs}\n</div>${desc}\n</div>\n\n`;
}

/* 只換掉舊商品 h2 內的文字，其餘結構原封不動 */
function renameLegacy(block, newTitle) {
  return block.replace(/(<h2[^>]*>)([\s\S]*?)(<\/h2>)/, function (_, open, inner, close) {
    const replaced = inner.replace(/>([^<>]+)</g, function (seg, text) {
      return text.trim() ? '>' + esc(newTitle) + '<' : seg;
    });
    return open + replaced + close;
  });
}

/* ---------- 路由 ---------- */
export async function onRequestGet({ request, env }) {
  const auth = requireAuth(request, env);
  if (auth.error) return auth.error;
  try {
    const file = await ghGet(env, FILE);
    const src = textFromB64(file.content);
    const { blocks } = splitDoc(src);
    return json({ sha: file.sha, products: blocks.map(parseBlock), user: auth.email });
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

    const file = await ghGet(env, FILE);
    if (payload.sha && payload.sha !== file.sha) {
      return json({ error: '網站內容在你編輯期間有異動，請重新整理後再試一次。' }, 409);
    }
    const src = textFromB64(file.content);
    const { head, blocks, tail } = splitDoc(src);

    // 1) 先上傳新圖片
    const uploads = payload.uploads || {};
    const names = Object.keys(uploads);
    for (const name of names) {
      const existing = await ghGet(env, `images/${name}`);
      await ghPut(env, `images/${name}`, uploads[name],
        `Add product image ${name} (via admin)`, existing ? existing.sha : null);
    }

    // 2) 依前端送來的最終狀態重組
    const out = [];
    for (const item of items) {
      if (item.new) {
        out.push(buildBlock(item));
      } else {
        const b = blocks[item.idx];
        if (b == null) return json({ error: `找不到商品 #${item.idx}，請重新整理。` }, 400);
        if (/<h2[^>]*data-ck="1"/.test(b)) {
          out.push(buildBlock(item));            // 新結構：整塊重建
        } else if (parseBlock(b, item.idx).title === item.title) {
          out.push(b);                           // 舊結構且標題沒改：原封不動
        } else {
          out.push(renameLegacy(b, item.title)); // 舊結構：只換標題文字
        }
      }
    }

    const next = head + out.join('') + tail;
    if (next === src && !names.length) return json({ ok: true, changed: false, message: '沒有變更。' });

    await ghPut(env, FILE, b64FromText(next),
      `Update products via admin (${auth.email})`, file.sha);

    return json({ ok: true, changed: true, count: items.length, images: names.length });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}

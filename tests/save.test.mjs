/* 存檔流程測試：模擬 GitHub API，驗證「所有變更打包成一個 commit、只推一次」。
 *
 * 這是整個專案風險最高的路徑——它直接改寫線上商店的 goods.html，
 * 而且每多推一次就多一次 Cloudflare 部署。
 */

import fs from 'fs';

const REPO_DIR = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const mod = await import('file://' + REPO_DIR + 'functions/api/products.js?v=' + Date.now());

const CR = String.fromCharCode(13);
const SRC = fs.readFileSync(REPO_DIR + 'goods.html', 'utf8').split(CR).join('');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { console.log('  ✅ ' + name); pass++; }
  else { console.log('  ❌ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); fail++; }
};

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const AUTH = { Cookie: 'CF_Authorization=abc', 'content-type': 'application/json' };
const ENV = { GITHUB_TOKEN: 'test-token' };

/* 假的 GitHub：記錄每一次呼叫，好斷言到底推了幾次 */
function fakeGitHub(opts = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    const path = String(url).replace('https://api.github.com/repos/cankingsketch/store/', '');
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method, path, body });
    const reply = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

    if (method === 'GET' && path.startsWith('git/ref/heads/')) return reply({ object: { sha: 'HEAD1' } });
    if (method === 'GET' && path.startsWith('contents/goods.html')) {
      return reply({ sha: 'FILESHA', content: b64(opts.src || SRC) });
    }
    if (method === 'POST' && path === 'git/blobs') return reply({ sha: 'blob' + calls.length });
    if (method === 'GET' && path.startsWith('git/commits/')) return reply({ tree: { sha: 'TREE1' } });
    if (method === 'POST' && path === 'git/trees') return reply({ sha: 'TREE2' });
    if (method === 'POST' && path === 'git/commits') return reply({ sha: 'COMMIT2' });
    if (method === 'PATCH' && path.startsWith('git/refs/heads/')) {
      return opts.pushConflict
        ? reply({ message: 'Update is not a fast forward' }, 422)
        : reply({ object: { sha: 'COMMIT2' } });
    }
    return reply({ message: 'unexpected ' + method + ' ' + path }, 500);
  };
  return calls;
}

const save = (payload, headers = AUTH) =>
  mod.onRequestPost({
    request: new Request('https://cankingstore.com/api/products', {
      method: 'POST', headers, body: JSON.stringify(payload),
    }),
    env: ENV,
  });

/* 先用真的解析結果組出「什麼都不改」的 payload */
const listed = await (async () => {
  fakeGitHub();
  const r = await mod.onRequestGet({
    request: new Request('https://cankingstore.com/api/products', { headers: AUTH }), env: ENV,
  });
  return r.json();
})();

// 賣場按鈕與影片新舊結構都有，不帶上就等於把它們清空，那不是「什麼都不改」
const carry = p => Object.assign(
  { idx: p.idx, title: p.title, myship: !!p.myship, shopee: p.shopee, video: p.video },
  p.editable ? { desc: p.desc, images: p.images, descAlign: p.descAlign } : {});
const keepAll = listed.products.map(carry);

/* ---------------------------------------------------------------- */
console.log('\n[1] 讀取');
{
  ok('讀得到商品清單', Array.isArray(listed.products) && listed.products.length > 0, listed.products?.length);
  ok('有回傳 sha 供併發比對', !!listed.sha);
}

console.log('\n[2] 沒有變更時完全不碰 GitHub');
{
  const calls = fakeGitHub();
  const d = await (await save({ sha: 'FILESHA', items: keepAll })).json();
  ok('回報沒有變更', d.changed === false, d);
  ok('一次都沒有推送', calls.filter(c => c.method === 'PATCH').length === 0,
    calls.map(c => c.method + ' ' + c.path));
  ok('也沒有建立 commit', calls.filter(c => c.path === 'git/commits' && c.method === 'POST').length === 0);
}

console.log('\n[3] 新增一個帶 3 張圖的商品 → 只能推一次');
{
  const calls = fakeGitHub();
  const item = {
    new: true, title: '測試商品', desc: '說明',
    images: [{ file: 'a.jpg', size: 'md' }, { file: 'b.jpg', size: 'md' }, { file: 'c.jpg', size: 'lg' }],
  };
  const d = await (await save({
    sha: 'FILESHA', items: [item].concat(keepAll),
    uploads: { 'a.jpg': b64('AAA'), 'b.jpg': b64('BBB'), 'c.jpg': b64('CCC') },
  })).json();

  ok('存檔成功', d.ok === true && d.changed === true, d);
  const pushes = calls.filter(c => c.method === 'PATCH' && c.path.startsWith('git/refs/'));
  ok('★ 只推送一次（＝只觸發一次部署）', pushes.length === 1, pushes.length);
  ok('★ 只建立一個 commit',
    calls.filter(c => c.method === 'POST' && c.path === 'git/commits').length === 1);

  const blobs = calls.filter(c => c.method === 'POST' && c.path === 'git/blobs');
  ok('3 張圖 + goods.html 共 4 個檔案物件', blobs.length === 4, blobs.length);
  ok('圖片內容以 base64 原樣送出',
    blobs.some(b => b.body.content === b64('AAA') && b.body.encoding === 'base64'));

  const tree = calls.find(c => c.path === 'git/trees').body;
  ok('以現有目錄樹為底（不會刪掉其他檔案）', tree.base_tree === 'TREE1', tree.base_tree);
  ok('樹裡有 4 個路徑', tree.tree.length === 4, tree.tree.length);
  ok('圖片路徑正確', tree.tree.some(t => t.path === 'images/a.jpg'), tree.tree.map(t => t.path));
  ok('goods.html 也在同一個 commit 裡', tree.tree.some(t => t.path === 'goods.html'));
  ok('檔案模式是一般檔案', tree.tree.every(t => t.mode === '100644' && t.type === 'blob'));

  const commit = calls.find(c => c.method === 'POST' && c.path === 'git/commits').body;
  ok('commit 接在讀取時的分支位置之後', commit.parents[0] === 'HEAD1', commit.parents);
  ok('commit 訊息有寫明圖片數', /新增圖片 3 張/.test(commit.message), commit.message);

  const push = pushes[0].body;
  ok('推送指向新的 commit', push.sha === 'COMMIT2', push);
  ok('不強推（分支被動過就該失敗）', push.force === false, push);
}

console.log('\n[4] 只改文字、沒有圖片');
{
  const calls = fakeGitHub();
  const renamed = keepAll.slice();
  const legacyAt = listed.products.findIndex(p => p.kind === 'legacy');
  renamed[legacyAt] = { idx: renamed[legacyAt].idx, title: '改過的名字' };
  const d = await (await save({ sha: 'FILESHA', items: renamed })).json();

  ok('存檔成功', d.ok === true, d);
  ok('只推送一次', calls.filter(c => c.method === 'PATCH').length === 1);
  const tree = calls.find(c => c.path === 'git/trees').body;
  ok('只送 goods.html 一個檔案', tree.tree.length === 1 && tree.tree[0].path === 'goods.html', tree.tree);
}

console.log('\n[5] 併發保護');
{
  fakeGitHub();
  const r = await save({ sha: '別人的 sha', items: keepAll });
  ok('送來的 sha 不符 -> 409', r.status === 409, r.status);

  // 讀完之後、推送之前有人插隊：GitHub 會拒絕非快轉推送
  const calls = fakeGitHub({ pushConflict: true });
  const r2 = await save({
    sha: 'FILESHA', items: [{ new: true, title: 'X', desc: '', images: [{ file: 'z.jpg', size: 'lg' }] }].concat(keepAll),
    uploads: { 'z.jpg': b64('ZZZ') },
  });
  const d2 = await r2.json();
  ok('推送被拒 -> 409 而不是 500', r2.status === 409, r2.status);
  ok('訊息叫使用者重新整理', /重新整理/.test(d2.error || ''), d2.error);
  ok('仍然只嘗試推送一次', calls.filter(c => c.method === 'PATCH').length === 1);
}

console.log('\n[6] 驗證');
{
  fakeGitHub();
  const r = await save({ sha: 'FILESHA', items: keepAll }, { 'content-type': 'application/json' });
  ok('沒有 Access 憑證 -> 403', r.status === 403, r.status);

  fakeGitHub();
  const r2 = await mod.onRequestPost({
    request: new Request('https://cankingstore.com/api/products', {
      method: 'POST', headers: AUTH, body: JSON.stringify({ sha: 'FILESHA', items: keepAll }),
    }),
    env: {},
  });
  ok('沒有 GITHUB_TOKEN -> 500 並說明原因', r2.status === 500, r2.status);
}

console.log('\n[7] 存檔後的內容仍與解析結果一致（無損）');
{
  const calls = fakeGitHub();
  const item = { new: true, title: '暫時商品', desc: '說明', images: [{ file: 'tmp.jpg', size: 'lg' }] };
  await save({ sha: 'FILESHA', items: [item].concat(keepAll), uploads: { 'tmp.jpg': b64('X') } });
  const blob = calls.filter(c => c.path === 'git/blobs').pop().body;
  const written = Buffer.from(blob.content, 'base64').toString('utf8');
  ok('寫出的 goods.html 開頭與原檔相同（BOM/前置內容沒被動）',
    written.slice(0, 200) === SRC.slice(0, 200));
  ok('寫出的內容比原檔長（多了一個商品）', written.length > SRC.length);

  // 把寫出的內容餵回解析器，確認商品一個都沒少、順序也對
  // （舊商品標題在 HTML 裡是 &#nnnn; 實體碼，不能直接用字面比對）
  fakeGitHub({ src: written });
  const after = await (await mod.onRequestGet({
    request: new Request('https://cankingstore.com/api/products', { headers: AUTH }), env: ENV,
  })).json();
  ok('商品數 +1', after.products.length === listed.products.length + 1, after.products.length);
  ok('新商品在最上面', after.products[0].title === '暫時商品', after.products[0].title);
  ok('原有商品順序與標題都沒變',
    after.products.slice(1).map(p => p.title).join('|') === listed.products.map(p => p.title).join('|'));
}

console.log('\n[8] 賣場按鈕經過完整存檔流程');
{
  const calls = fakeGitHub();
  const li = listed.products.findIndex(
    p => p.kind === 'legacy' && !p.myship && !p.shopee && !p.video);
  ok('找得到沒有按鈕的舊版商品可測', li >= 0, li);
  const base = listed.products.filter(p => p.myship || p.shopee).length;
  const items = keepAll.slice();
  items[li] = Object.assign({}, items[li], { myship: true, shopee: 'https://shopee.tw/canking?itemId=1' });
  await save({ sha: 'FILESHA', items });

  const blob = calls.filter(c => c.path === 'git/blobs').pop().body;
  const written = Buffer.from(blob.content, 'base64').toString('utf8');
  ok('寫出的檔案含賣場按鈕', /<div class="ck-buy"/.test(written));
  ok('賣貨便用共用網址（不是前端送什麼就寫什麼）',
    /data-buy="myship"/.test(written) && /myship\.7-11\.com\.tw/.test(written));
  ok('蝦皮用填入的網址', /shopee\.tw\/canking\?itemId=1/.test(written));

  // 讀回來，商品名稱不能被按鈕文字污染
  fakeGitHub({ src: written });
  const after = await (await mod.onRequestGet({
    request: new Request('https://cankingstore.com/api/products', { headers: AUTH }), env: ENV,
  })).json();
  ok('商品數不變', after.products.length === listed.products.length, after.products.length);
  ok('★ 商品名稱沒被按鈕文字污染',
    after.products[li].title === listed.products[li].title, after.products[li].title);
  ok('讀得回賣貨便設定', !!after.products[li].myship);
  ok('讀得回蝦皮網址',
    after.products[li].shopee === 'https://shopee.tw/canking?itemId=1', after.products[li].shopee);
  ok('其他商品沒被加上按鈕',
    after.products.filter(p => p.myship || p.shopee).length === base + 1);

  // 再取消掉，檔案要回到原樣
  const off = after.products.map(carry);
  off[li] = Object.assign({}, off[li], { myship: false, shopee: '' });
  const calls2 = fakeGitHub({ src: written });
  await save({ sha: 'FILESHA', items: off });
  const blob2 = calls2.filter(c => c.path === 'git/blobs').pop().body;
  const restored = Buffer.from(blob2.content, 'base64').toString('utf8');
  ok('★ 取消按鈕後與原檔一字不差', restored === SRC,
    restored.length + ' vs ' + SRC.length);
}

console.log('\n=== ' + pass + ' 通過 / ' + fail + ' 失敗 ===');
process.exit(fail ? 1 : 0);

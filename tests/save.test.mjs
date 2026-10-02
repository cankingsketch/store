/* 存檔流程測試：模擬 GitHub API，驗證「所有變更打包成一個 commit、只推一次」。
 *
 * 這是整個專案風險最高的路徑——它直接改寫線上商店的 data/products.json，
 * 而且每多推一次就多一次 Cloudflare 部署。
 */

import fs from 'fs';

const REPO_DIR = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
import { loadFunction } from './_load.mjs';
// 驗證換成替身：這裡測的是存檔流程，不是 Cloudflare 的登入
const mod = await loadFunction(REPO_DIR, 'functions/api/products.js');

const SRC = fs.readFileSync(REPO_DIR + 'data/products.json', 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { console.log('  ✅ ' + name); pass++; }
  else { console.log('  ❌ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); fail++; }
};

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const clone = o => JSON.parse(JSON.stringify(o));
const AUTH = { 'Cf-Access-Authenticated-User-Email': 'test@example.com',
  'content-type': 'application/json' };
const ENV = { GITHUB_TOKEN: 'test-token' };
const WEBP = (tag) => Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ' + tag)]).toString('base64');

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
    if (method === 'GET' && path.startsWith('contents/data/products.json')) {
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
const read = async (src) => {
  fakeGitHub({ src });
  return (await mod.onRequestGet({
    request: new Request('https://cankingstore.com/api/products', { headers: AUTH }), env: ENV,
  })).json();
};
const written = (calls) => {
  const blob = calls.filter(c => c.path === 'git/blobs').pop().body;
  return Buffer.from(blob.content, 'base64').toString('utf8');
};

const listed = await read();

/* ---------------------------------------------------------------- */
console.log('\n[1] 讀取');
{
  ok('讀得到商品清單', Array.isArray(listed.data?.products) && listed.data.products.length > 0, listed.data?.products?.length);
  ok('有回傳 sha 供併發比對', listed.sha === 'FILESHA');
  ok('有回傳登入者', listed.user === 'test@example.com');
}

console.log('\n[2] 沒有變更時完全不碰 GitHub');
{
  const calls = fakeGitHub();
  const d = await (await save({ sha: 'FILESHA', data: listed.data })).json();
  ok('回報沒有變更', d.changed === false, d);
  ok('一次都沒有推送', calls.filter(c => c.method === 'PATCH').length === 0,
    calls.map(c => c.method + ' ' + c.path));
  ok('也沒有建立 commit', calls.filter(c => c.path === 'git/commits' && c.method === 'POST').length === 0);
}

console.log('\n[3] 新增一個帶 2 張圖的商品 → 只能推一次');
{
  const calls = fakeGitHub();
  const data = clone(listed.data);
  const imgs = ['img/opt/up-20261003-120000-1-l.webp', 'img/opt/up-20261003-120000-2-l.webp'];
  data.products.unshift({ id: 'p-test', section: 'other', name: '測試商品', price: 100, note: '說明', imgs });
  const uploads = {};
  imgs.forEach((l, k) => { uploads[l] = WEBP('L' + k); uploads[l.replace('-l.', '-s.')] = WEBP('S' + k); });
  const d = await (await save({ sha: 'FILESHA', data, uploads })).json();

  ok('存檔成功', d.ok === true && d.changed === true, d);
  const pushes = calls.filter(c => c.method === 'PATCH' && c.path.startsWith('git/refs/'));
  ok('★ 只推送一次（＝只觸發一次部署）', pushes.length === 1, pushes.length);
  ok('★ 只建立一個 commit',
    calls.filter(c => c.method === 'POST' && c.path === 'git/commits').length === 1);

  const blobs = calls.filter(c => c.method === 'POST' && c.path === 'git/blobs');
  ok('2 張圖×大小兩種 + products.json 共 5 個檔案物件', blobs.length === 5, blobs.length);
  ok('圖片內容以 base64 原樣送出',
    blobs.some(b => b.body.content === uploads[imgs[0]] && b.body.encoding === 'base64'));

  const tree = calls.find(c => c.path === 'git/trees').body;
  ok('以現有目錄樹為底（不會刪掉其他檔案）', tree.base_tree === 'TREE1', tree.base_tree);
  ok('圖片路徑正確', tree.tree.some(t => t.path === imgs[0]) && tree.tree.some(t => t.path === imgs[0].replace('-l.', '-s.')),
    tree.tree.map(t => t.path));
  ok('products.json 也在同一個 commit 裡', tree.tree.some(t => t.path === 'data/products.json'));
  ok('檔案模式是一般檔案', tree.tree.every(t => t.mode === '100644' && t.type === 'blob'));

  const commit = calls.find(c => c.method === 'POST' && c.path === 'git/commits').body;
  ok('commit 接在讀取時的分支位置之後', commit.parents[0] === 'HEAD1', commit.parents);
  ok('commit 訊息有寫明圖片數', /新增圖片 2 張/.test(commit.message), commit.message);
  ok('commit 訊息有寫是誰改的', /test@example\.com/.test(commit.message));

  const push = pushes[0].body;
  ok('推送指向新的 commit', push.sha === 'COMMIT2', push);
  ok('不強推（分支被動過就該失敗）', push.force === false, push);

  const after = JSON.parse(written(calls));
  ok('新商品在最上面', after.products[0].id === 'p-test');
  ok('原有商品順序沒變', after.products.slice(1).map(p => p.id).join() === listed.data.products.map(p => p.id).join());
}

console.log('\n[4] 只改文字、沒有圖片');
{
  const calls = fakeGitHub();
  const data = clone(listed.data);
  data.products[0].name = '改過的名字';
  const d = await (await save({ sha: 'FILESHA', data })).json();
  ok('存檔成功', d.ok === true, d);
  ok('只推送一次', calls.filter(c => c.method === 'PATCH').length === 1);
  const tree = calls.find(c => c.path === 'git/trees').body;
  ok('只送 products.json 一個檔案', tree.tree.length === 1 && tree.tree[0].path === 'data/products.json', tree.tree);
  const after = JSON.parse(written(calls));
  ok('名字改到了', after.products[0].name === '改過的名字');
  ok('其他商品一個字都沒動',
    JSON.stringify(after.products.slice(1)) === JSON.stringify(listed.data.products.slice(1)));
}

console.log('\n[5] 改回原樣 → 與原檔一字不差');
{
  const calls = fakeGitHub();
  const data = clone(listed.data);
  data.products[0].soldout = true;
  await save({ sha: 'FILESHA', data });
  const once = written(calls);
  ok('絕版有寫進去', JSON.parse(once).products[0].soldout === true);

  const back = (await read(once)).data;
  back.products[0].soldout = false;
  const calls2 = fakeGitHub({ src: once });
  await save({ sha: 'FILESHA', data: back });
  ok('★ 取消絕版後與原檔一字不差', written(calls2) === SRC);
}

console.log('\n[6] 併發保護');
{
  fakeGitHub();
  const r = await save({ sha: '別人的 sha', data: listed.data });
  ok('送來的 sha 不符 -> 409', r.status === 409, r.status);

  fakeGitHub();
  const r0 = await save({ data: listed.data });
  ok('沒帶 sha -> 409（不能跳過比對）', r0.status === 409, r0.status);

  // 讀完之後、推送之前有人插隊：GitHub 會拒絕非快轉推送
  const calls = fakeGitHub({ pushConflict: true });
  const data = clone(listed.data);
  data.products[0].note = '改一下';
  const r2 = await save({ sha: 'FILESHA', data });
  const d2 = await r2.json();
  ok('推送被拒 -> 409 而不是 500', r2.status === 409, r2.status);
  ok('訊息叫使用者重新整理', /重新整理/.test(d2.error || ''), d2.error);
  ok('仍然只嘗試推送一次', calls.filter(c => c.method === 'PATCH').length === 1);
}

console.log('\n[7] 不合格的資料 → 400，完全不碰 GitHub 寫入');
{
  const calls = fakeGitHub();
  const data = clone(listed.data);
  data.products[0].video = 'javascript:alert(1)';
  const r = await save({ sha: 'FILESHA', data });
  ok('回 400', r.status === 400, r.status);
  ok('錯誤訊息是中文、指出哪個商品', /影片網址/.test((await r.json()).error || ''));
  ok('沒有建立任何 Git 物件', calls.filter(c => c.method === 'POST' || c.method === 'PATCH').length === 0);

  const calls2 = fakeGitHub();
  const r2 = await save({ sha: 'FILESHA', data: listed.data, uploads: { 'functions/api/evil.js': b64('x') } });
  ok('★ 上傳到奇怪的路徑 -> 400', r2.status === 400, r2.status);
  ok('★ 而且什麼都沒寫', calls2.filter(c => c.method === 'POST' || c.method === 'PATCH').length === 0);

  fakeGitHub();
  const r3 = await save({ sha: 'FILESHA', data: { products: [] } });
  ok('空清單 -> 400（不會把商品全部清掉）', r3.status === 400, r3.status);
}

console.log('\n[8] 3D 設定不能從後台改');
{
  const calls = fakeGitHub();
  const data = clone(listed.data);
  const p = data.products.find(x => x.view3d);
  p.view3d = { module: 'https://evil.example/x.js' };
  const d = await (await save({ sha: 'FILESHA', data })).json();
  ok('★ 只改 view3d 等於沒有變更', d.changed === false, d);
  ok('★ 所以沒有推送', calls.filter(c => c.method === 'PATCH').length === 0);
}

console.log('\n[9] 驗證');
{
  fakeGitHub();
  const r = await save({ sha: 'FILESHA', data: listed.data }, { 'content-type': 'application/json' });
  ok('沒有 Access 憑證 -> 403', r.status === 403, r.status);

  fakeGitHub();
  const r1 = await mod.onRequestGet({ request: new Request('https://cankingstore.com/api/products'), env: ENV });
  ok('讀取也要 Access 憑證 -> 403', r1.status === 403, r1.status);

  fakeGitHub();
  const r2 = await mod.onRequestPost({
    request: new Request('https://cankingstore.com/api/products', {
      method: 'POST', headers: AUTH, body: JSON.stringify({ sha: 'FILESHA', data: listed.data }),
    }),
    env: {},
  });
  ok('沒有 GITHUB_TOKEN -> 500 並說明原因', r2.status === 500, r2.status);
}

console.log('\n=== ' + pass + ' 通過 / ' + fail + ' 失敗 ===');
process.exit(fail ? 1 : 0);

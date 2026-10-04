/* 商品資料測試：data/products.json 本身合不合格，以及後端的檢查規則。
 *
 * 周邊頁直接讀這份 JSON 畫出所有商品，格式錯一個字就是整頁空白，
 * 所以每次手動改它、或改了 functions/api/products.js 的檢查規則，都要跑一次。
 */

import fs from 'fs';
import { loadFunction } from './_load.mjs';

const REPO_DIR = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const mod = await loadFunction(REPO_DIR, 'functions/api/products.js',
  ['normalize', 'normalizeAll', 'checkUploads', 'serialize']);

const SRC = fs.readFileSync(REPO_DIR + 'data/products.json', 'utf8');
const DATA = JSON.parse(SRC);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { console.log('  ✅ ' + name); pass++; }
  else { console.log('  ❌ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); fail++; }
};
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return e.bad === true && (!re || re.test(e.message)); } };
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------------------------------------------------------------- */
console.log('\n[1] 檔案本身');
{
  ok('是合法 JSON，有商品', Array.isArray(DATA.products) && DATA.products.length > 0, DATA.products?.length);
  console.log('     目前 ' + DATA.products.length + ' 個商品');
  ok('★ 檔案已經是標準格式（照原樣存回去不會產生變更）', mod.serialize(mod.normalizeAll(DATA, DATA)) === SRC);
  ok('沒有 BOM', SRC.charCodeAt(0) !== 0xFEFF);
  ok('換行是 LF', SRC.indexOf('\r') < 0);
  const ids = DATA.products.map(p => p.id);
  ok('商品代號不重複', new Set(ids).size === ids.length);
  ok('熱銷推薦都指到存在的商品', DATA.hot.every(id => ids.includes(id)), DATA.hot);
  ok('明信片牆、卡冊都在', ['postcards', 'album'].every(s => DATA.products.some(p => p.special === s)));
  ok('四個分區都有商品', ['blind', 'postcard', 'apparel', 'other'].every(s => DATA.products.some(p => p.section === s)));
}

console.log('\n[2] 圖片檔');
{
  // 商品圖在 img/opt/（瘦身過的 WebP），-l 大圖、-s 小圖兩個都要有
  const all = DATA.products.flatMap(p => p.imgs);
  if (fs.existsSync(REPO_DIR + 'img/opt')) {
    const miss = all.flatMap(s => [s, s.replace(/-l\.webp$/, '-s.webp')]).filter(s => !fs.existsSync(REPO_DIR + s));
    ok('★ 每張圖的大圖、小圖都存在', miss.length === 0, miss);
  } else {
    console.log('     （repo 裡還沒有 img/opt/，先跳過檔案存在檢查）');
  }
  ok('圖片路徑全部是 img/opt/…-l.webp', all.every(s => /^img\/opt\/[A-Za-z0-9._-]+-l\.webp$/.test(s)));
}

console.log('\n[3] 欄位整理');
{
  const prev = DATA.products.find(p => p.view3d);
  const sent = Object.assign(clone(prev), {
    name: '  有空白  ', price: '220', from: 0, soldout: '', hidden: 1, junk: '<script>',
    view3d: { module: 'https://evil.example/x.js' }, special: 'postcards',
  });
  const o = mod.normalize(sent, prev);
  ok('名稱前後空白會去掉', o.name === '有空白', o.name);
  ok('價格轉成數字', o.price === 220);
  ok('false 的開關不寫進檔案', !('from' in o) && !('soldout' in o));
  ok('hidden 寫進去', o.hidden === true);
  ok('不認識的欄位丟掉', !('junk' in o));
  ok('★ view3d 一律沿用檔案原本的值（前端不能指定要 import 什麼）', o.view3d === prev.view3d);
  ok('★ special 不能由前端加上', !('special' in o));

  const fresh = mod.normalize({ id: 'p-new', section: 'other', name: '新', imgs: ['img/opt/up-20261003-120000-1-l.webp'],
    view3d: { module: 'x.js' } }, undefined);
  ok('★ 新商品不能自帶 3D', !('view3d' in fresh));
  ok('欄位順序固定', Object.keys(fresh).join() === 'id,section,name,price,note,imgs,video,shopee,date', Object.keys(fresh).join());
}

console.log('\n[4] 擋掉不合格的資料');
{
  const base = { id: 'p-x', section: 'other', name: '測試', price: 100, imgs: ['img/opt/a-l.webp'] };
  const n = (patch) => () => mod.normalize(Object.assign({}, base, patch));
  ok('沒有名稱', throws(n({ name: '  ' })));
  ok('沒有圖', throws(n({ imgs: [] })));
  ok('★ 圖片路徑跳出資料夾', throws(n({ imgs: ['img/opt/../../functions/x-l.webp'] })));
  ok('★ 圖片路徑是外部網址', throws(n({ imgs: ['https://evil.example/a-l.webp'] })));
  ok('圖片不是 WebP', throws(n({ imgs: ['img/opt/a-l.png'] })));
  ok('★ 影片是 javascript:', throws(n({ video: 'javascript:alert(1)' })));
  ok('影片是 http（不是 https）', throws(n({ video: 'http://youtube.com/x' })));
  ok('影片網址可以放', !throws(n({ video: 'https://www.instagram.com/reel/abc/' })));
  ok('★ 蝦皮網址不是蝦皮', throws(n({ shopee: 'https://evil.example/shopee.tw/' })));
  ok('蝦皮網址可以放', !throws(n({ shopee: 'https://shopee.tw/product/12223072/1' })));
  ok('價格是負數', throws(n({ price: -1 })));
  ok('價格有小數', throws(n({ price: 1.5 })));
  ok('分區不存在', throws(n({ section: 'xxx' })));
  ok('★ 一般商品不能放進明信片區', throws(n({ section: 'postcard' }), /明信片/));
  ok('代號有大寫或空白', throws(n({ id: 'A b' })));
  ok('日期格式不對', throws(n({ date: '2026/10/03' })));
  ok('名稱太長', throws(n({ name: 'x'.repeat(81) })));
}

console.log('\n[5] 整份資料的規則');
{
  const d = clone(DATA);
  d.products.push(clone(d.products[0]));
  ok('代號重複', throws(() => mod.normalizeAll(d, DATA), /重複/));

  const d2 = clone(DATA);
  d2.products = d2.products.filter(p => p.special !== 'album');
  ok('★ 特殊版面不能刪（要改成隱藏）', throws(() => mod.normalizeAll(d2, DATA), /隱藏/));

  const d3 = clone(DATA);
  d3.products = d3.products.filter(p => p.id !== 'tote');
  const r3 = mod.normalizeAll(d3, DATA);
  ok('一般商品可以刪', r3.products.length === DATA.products.length - 1);

  const d4 = clone(DATA);
  d4.hot = ['nope'];
  ok('熱銷推薦指到不存在的商品', throws(() => mod.normalizeAll(d4, DATA), /不存在/));

  const d5 = clone(DATA);
  d5.hot = DATA.products.slice(0, 9).map(p => p.id);
  ok('熱銷推薦超過 8 個', throws(() => mod.normalizeAll(d5, DATA), /最多/));

  const d6 = clone(DATA);
  d6.hot = [DATA.hot[0], DATA.hot[0]];
  ok('熱銷推薦重複的會合併', mod.normalizeAll(d6, DATA).hot.length === 1);

  const d7 = clone(DATA);
  d7.products.reverse();
  ok('排序照前端送來的順序', mod.normalizeAll(d7, DATA).products[0].id === DATA.products.at(-1).id);

  const d8 = clone(DATA);
  const post = d8.products.find(p => p.special === 'postcards');
  post.section = 'other';
  ok('特殊版面的分區固定在明信片區', mod.normalizeAll(d8, DATA).products.find(p => p.special === 'postcards').section === 'postcard');
}

console.log('\n[6] 上傳的圖');
{
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]).toString('base64');
  const L = 'img/opt/up-20261003-120000-1-l.webp', Sm = 'img/opt/up-20261003-120000-1-s.webp';
  const d = { hot: [], products: [{ id: 'p', section: 'other', name: 'x', price: 0, imgs: [L] }] };
  const r = mod.checkUploads({ [L]: webp, [Sm]: webp }, d);
  ok('大圖、小圖都收', r.length === 2);
  ok('沒被商品用到的圖不寫', mod.checkUploads({ 'img/opt/up-20261003-120000-2-l.webp': webp }, d).length === 0);
  ok('★ 檔名不是 up- 開頭（可能蓋掉既有的圖）', throws(() => mod.checkUploads({ 'img/opt/bag-l.webp': webp }, d)));
  ok('★ 路徑跳出資料夾', throws(() => mod.checkUploads({ '../functions/api/x.js': webp }, d)));
  ok('★ 內容不是 WebP', throws(() => mod.checkUploads({ [L]: Buffer.from('<html>').toString('base64') }, d), /WebP/));
  const huge = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(2 * 1024 * 1024)]).toString('base64');
  ok('太大', throws(() => mod.checkUploads({ [L]: huge }, d), /太大/));
}

console.log('\n[desc] 詳細說明（選填）');
{
  const base = clone(DATA.products.find(p => !p.special && !p.view3d));
  const a = mod.normalize(Object.assign(clone(base), { desc: '  融會貫通春聯，考生可用  ' }), base);
  ok('有填就保留（去頭尾空白）', a.desc === '融會貫通春聯，考生可用', a.desc);
  ok('排在 note 後面', Object.keys(a).indexOf('desc') === Object.keys(a).indexOf('note') + 1, Object.keys(a));
  const b = mod.normalize(Object.assign(clone(base), { desc: '' }), base);
  ok('空白就不寫這個欄位', !('desc' in b), b);
  ok('太長擋掉', throws(() => mod.normalize(Object.assign(clone(base), { desc: 'x'.repeat(301) }), base), /詳細說明/));
}

console.log('\n=== ' + pass + ' 通過 / ' + fail + ' 失敗 ===');
process.exit(fail ? 1 : 0);

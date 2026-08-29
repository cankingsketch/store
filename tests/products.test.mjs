import fs from 'fs';

const REPO_DIR = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
// 線上 Function 讀的是 GitHub 上的檔案（純 LF）。Windows 的 git core.autocrlf
// 會把工作目錄轉成 CRLF，若不正規化，buildBlock 產生的 LF 會被誤判成「檔案被改了」。
const CR = String.fromCharCode(13);
const src = fs.readFileSync(REPO_DIR + '/goods.html', 'utf8').split(CR).join('');

let code = fs.readFileSync(REPO_DIR + '/functions/api/products.js', 'utf8')
  .replace(/export async function/g, 'async function');
code += '\nexport { splitDoc, parseBlock, buildBlock, renameLegacy, b64FromText, textFromB64 };';
const tmp = REPO_DIR + 'tests/_products_mod.tmp.mjs';
fs.writeFileSync(tmp, code, 'utf8');
const M = await import('file://' + tmp + '?v=' + Date.now());

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { console.log('  ✅ ' + name); pass++; }
  else { console.log('  ❌ ' + name + (extra ? '  → ' + extra : '')); fail++; }
};

const { head, blocks, tail } = M.splitDoc(src);
const parsed = blocks.map((b, i) => M.parseBlock(b, i));

// 模擬後端 onRequestPost 的重組流程
function rebuild(items) {
  const out = items.map(item => {
    if (item.new) return M.buildBlock(item);
    const b = blocks[item.idx];
    if (/<h2[^>]*data-ck="1"/.test(b)) return M.buildBlock(item);
    if (M.parseBlock(b, item.idx).title === item.title) return b;
    return M.renameLegacy(b, item.title);
  });
  return head + out.join('') + tail;
}
// 要跟 admin.html 實際送出的內容一致：新結構商品會連圖片、說明、對齊一起送，
// 只送 {idx,title} 會把它們清空，那不是「什麼都不改」。
const keepAll = parsed.map(p => p.editable
  ? { idx: p.idx, title: p.title, desc: p.desc, images: p.images, descAlign: p.descAlign }
  : { idx: p.idx, title: p.title });

console.log('\n[1] 解析與無損性');
ok('切得出商品（數量隨後台增減，不寫死）', blocks.length > 0, '實際 ' + blocks.length);
console.log('     目前 ' + blocks.length + ' 個商品');
ok('原樣重組 = 原檔', head + blocks.join('') + tail === src);

console.log('\n[2] 標題解碼（舊商品是 HTML 實體）');
const legacy = parsed.filter(p => p.kind === 'legacy');
const fresh = parsed.filter(p => p.kind === 'new');
ok('新舊兩種結構都解析得到', legacy.length > 0 && fresh.length > 0,
  '舊 ' + legacy.length + ' / 新 ' + fresh.length);
ok('舊商品標題解出中文（不是實體碼）',
  legacy.every(p => p.title && !/&#/.test(p.title)),
  legacy.map(p => p.title).join(' / '));
ok('沒有殘留實體碼', !parsed.some(p => /&#\d+;/.test(p.title)));
console.log('     清單預覽：' + parsed.slice(0, 5).map(p => p.title).join(' / '));

console.log('\n[3] 什麼都不改 → 檔案必須完全不變');
ok('重組結果 = 原檔', rebuild(keepAll) === src);

console.log('\n[4] 新增商品到最上面');
const item = { new: true, title: '測試杯子', desc: '陶瓷｜NT$300',
  images: [{ file: 'prod-a.jpg', size: 'lg' }, { file: 'prod-b.jpg', size: 'md' }] };
const next = rebuild([item].concat(keepAll));
const after = M.splitDoc(next);
const np = M.parseBlock(after.blocks[0], 0);
ok('商品數 +1', after.blocks.length === blocks.length + 1, after.blocks.length);
ok('新商品在第一個', np.title === '測試杯子');
ok('可完整編輯', np.editable === true);
ok('圖片數與檔名正確', np.images.length === 2 && np.images[0].file === 'prod-a.jpg');
ok('版型正確 (lg/md)', np.images[0].size === 'lg' && np.images[1].size === 'md');
ok('說明文字正確', np.desc === '陶瓷｜NT$300', np.desc);
ok('其餘商品原封不動', after.blocks.slice(1).join('') === blocks.join(''));

console.log('\n[5] 改舊商品名稱：只動那一個');
// 這條在驗「舊版商品改名時，除了標題什麼都不碰」，所以要挑一個真的舊版商品，
// 不能寫死索引——後台新增的商品會把順序推移。
const T = parsed.findIndex(p => p.kind === 'legacy');
ok('找得到舊版商品可測', T >= 0, T);
const renamedDoc = rebuild(keepAll.map((it, i) => i === T ? { idx: it.idx, title: '新名字' } : it));
const rb = M.splitDoc(renamedDoc).blocks;
ok('目標商品已改名', M.parseBlock(rb[T], T).title === '新名字');
ok('其他商品一字未動', rb.filter((_, i) => i !== T).join('') === blocks.filter((_, i) => i !== T).join(''));
const reH2 = /<h2[^>]*>[\s\S]*?<\/h2>/;
ok('該商品 h2 以外也沒動', rb[T].replace(reH2, '') === blocks[T].replace(reH2, ''));

console.log('\n[6] 下架');
const delDoc = rebuild(keepAll.filter((_, i) => i !== 2));
ok('商品數 -1', M.splitDoc(delDoc).blocks.length === blocks.length - 1);
ok('該商品確實消失', !M.splitDoc(delDoc).blocks.some(b => M.parseBlock(b, 0).title === parsed[2].title));

console.log('\n[7] 排序');
const sw = keepAll.slice(); sw[0] = keepAll[1]; sw[1] = keepAll[0];
const swapped = M.splitDoc(rebuild(sw)).blocks.map((b, i) => M.parseBlock(b, i).title);
ok('前兩個對調成功', swapped[0] === parsed[1].title && swapped[1] === parsed[0].title);

console.log('\n[8] 特殊字元安全');
const evil = M.buildBlock({ title: 'A<b>"&x', desc: '<script>alert(1)</script>', images: [{ file: 'a.jpg', size: 'sm' }] });
ok('標題已跳脫', evil.includes('A&lt;b&gt;&quot;&amp;x'));
ok('說明已跳脫（不會執行）', evil.includes('&lt;script&gt;') && !evil.includes('<script>'));
ok('解析可還原原字串', M.parseBlock(evil, 0).title === 'A<b>"&x', M.parseBlock(evil, 0).title);

console.log('\n[9] 編碼');
ok('UTF-8 base64 往返', M.textFromB64(M.b64FromText('空罐王的商店 🎉')) === '空罐王的商店 🎉');

console.log('');
console.log('[10] 說明文字對齊（單張大圖置中／並排圖靠左）');
const dLg = M.buildBlock({ title: '單圖', desc: '說明', images: [{ file: 'a.jpg', size: 'lg' }] });
const dMd = M.buildBlock({ title: '雙圖', desc: '說明', images: [{ file: 'a.jpg', size: 'md' }, { file: 'b.jpg', size: 'md' }] });
const dSm = M.buildBlock({ title: '三圖', desc: '說明', images: [{ file: 'a.jpg', size: 'sm' }] });
const dMix = M.buildBlock({ title: '混合', desc: '說明', images: [{ file: 'a.jpg', size: 'lg' }, { file: 'b.jpg', size: 'sm' }] });
ok('單張大圖 -> 置中', !/ck-desc-left/.test(dLg));
ok('兩張並排 -> 靠左', /ck-desc-left/.test(dMd));
ok('三張並排 -> 靠左', /ck-desc-left/.test(dSm));
ok('大圖+並排 -> 靠左', /ck-desc-left/.test(dMix));
ok('靠左時說明仍解析得回來', M.parseBlock(dMd, 0).desc === '說明', M.parseBlock(dMd, 0).desc);

console.log('');
console.log('[11] 後台明講的對齊優先於自動規則');
const mkA = (align, sizes) => M.buildBlock({ title: 'T', desc: '說明',
  images: sizes.map((sz, k) => ({ file: 'i' + k + '.jpg', size: sz })), descAlign: align });
ok('並排圖但指定置中 -> 置中', !/ck-desc-left/.test(mkA('center', ['md', 'md'])));
ok('單張大圖但指定靠左 -> 靠左', /ck-desc-left/.test(mkA('left', ['lg'])));
ok('沒指定時仍走自動規則(並排->靠左)', /ck-desc-left/.test(mkA(null, ['md', 'md'])));
ok('沒指定時仍走自動規則(單大圖->置中)', !/ck-desc-left/.test(mkA(undefined, ['lg'])));
ok('亂給的值當成沒指定', /ck-desc-left/.test(mkA('bogus', ['sm'])));
ok('解析得回 left', M.parseBlock(mkA('left', ['lg']), 0).descAlign === 'left');
ok('解析得回 center', M.parseBlock(mkA('center', ['md', 'md']), 0).descAlign === 'center');

// 讀出來的對齊原封不動存回去，檔案必須一字不差
const reSaved = rebuild(parsed.map(p => p.editable
  ? { idx: p.idx, title: p.title, desc: p.desc, images: p.images, descAlign: p.descAlign }
  : { idx: p.idx, title: p.title }));
ok('帶著解析出的對齊重存 = 原檔', reSaved === src);

console.log('\n=== ' + pass + ' 通過 / ' + fail + ' 失敗 ===');
process.exit(fail ? 1 : 0);

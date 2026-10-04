// 三個版面設計稿共用的零件：頁首、現有商品、貼紙磚、3D 預覽燈箱。
// 點視窗外面（暗色背景）才關：按下和放開都要在背景上。
// 在縮圖列上按住拖、最後在視窗外放開，瀏覽器會把那一下「點擊」算在背景上——那種不算（他回報的）
(function () {
  var lastDown = null;
  document.addEventListener('pointerdown', function (ev) { lastDown = ev.target; }, true);   // 記下每次是在哪裡按下的
  window.CK_bgClick = function (el, e) { return e.target === el && lastDown === el; };
  // 點開才載入的 3D 程式（xxx3d.js）的網址：後面帶版本號，程式改了網址就變，瀏覽器不會拿快取的舊版
  // （Cloudflare 給 JS 快取 4 小時）。版本表由 build_site.py 發布時填進來；設計稿裡是空的，照原檔名載
  var MODV = {"album3d.js": "0436370b", "badge3d.js": "32305ec9", "bottles3d.js": "6be0267a", "charm-fx.js": "6de426cc", "charm3d.js": "356c9986", "coaster3d.js": "273b0430", "couplet3d.js": "785c9713", "stamp3d.js": "3ee7b51c", "standee3d.js": "165b2094", "tshirt3d.js": "bf201bd1", "wheel-fx.js": "20905f91"};
  window.CK_MOD = function (name) { return './' + name + (MODV[name] ? '?v=' + MODV[name] : ''); };
})();
(function () {
  'use strict';
  var ALL = window.CK_STICKERS;
  // 牆上只放單賣的；組合裡的貼紙（有 set）只在組合預覽裡出現
  var STICKERS = ALL.filter(function (s) { return !s.set; }).sort(function (a, b) { return a.added < b.added ? 1 : a.added > b.added ? -1 : 0; });
  var SETS = (window.CK_SETS || []).map(function (t) {
    t.items = ALL.filter(function (s) { return s.set === t.id; });
    return t;
  });
  function setOf(s) { return SETS.filter(function (t) { return t.id === s.set; })[0]; }
  var NEW_SINCE = '2026-09-01';      // 示意：這天之後上架的算新款
  var MYSHIP = 'https://myship.7-11.com.tw/general/detail/GM2308212736960';
  var SHOPEE = 'https://shopee.tw/canking';                       // 蝦皮賣場首頁（商品沒有自己的蝦皮網址時用）
  var FORM_OVERSEAS = 'https://forms.gle/o2wVLt5KcqxdsSKd6';       // 海外購買表單（舊周邊頁頂端那顆）

  // 現在周邊頁上的商品（照現在的順序，只取前面幾個當示意）
  var PRODUCTS = [
    { id: 'memo', price: 50, name: '罐快遞便利貼', img: 'img/p-memo.jpg', more: ['img/p-memo-2.jpg'], cat: '文具' },
    { id: 'bag', price: 495, name: '洗沐盥洗包', img: 'img/p-bag.jpg', more: ['img/p-bag-2.jpg'], note: '贈特點明信片+洗沐貼3小張', cat: '生活小物' },
    { id: 'coaster', price: 220, name: '下雨天杯墊', img: 'img/p-coaster.jpg', note: '陶瓷 吸水 杯墊｜UV浮雕印刷', cat: '生活小物' },
    { id: 'omamori', price: 220, name: '肌腱安泰御守 壓克力吊飾', img: 'img/p-omamori.jpg', more: ['img/p-omamori-2.jpg'], cat: '吊飾・徽章' },
    { id: 'badge', price: 220, name: '罐罐吸麵徽章 復刻 金屬徽章', img: 'img/p-badge.jpg', cat: '吊飾・徽章' },
    { id: 'lightbox', price: 220, name: '偷拍禁止小燈箱', img: 'img/p-lightbox.jpg', cat: '生活小物' },
    { id: 'mousepad', price: 220, name: '電影院滑鼠墊', img: 'img/p-mousepad.jpg', cat: '生活小物' },
    { id: 'stamp', price: 220, name: '誇誇水晶印章', img: 'img/p-stamp.jpg', more: ['img/p-stamp-2.jpg'], note: '共5款', cat: '文具' },
    { id: 'anim', price: 220, name: '今日吃什麼?翻頁動畫機', img: 'img/p-anim.jpg', more: ['img/p-anim-2.jpg', 'img/p-anim-3.jpg', 'img/p-anim-4.jpg'],
      note: '內有午餐、甜點、飲料共三款／早餐、晚餐、飲料共三款', cat: '盲盒・玩具' }
  ];
  // 成組賣的貼紙商品：不進貼紙牆，但跟貼紙放在一起
  var STICKER_SETS = [
    { id: 'movie', name: '空罐電影貼紙組', img: 'img/p-movie.jpg', note: '16張防水貼紙+電影票根+發票+紙盒', cat: '貼紙組合' },
    { id: 'label', name: '洗沐標籤貼', img: 'img/p-label.jpg', note: '大3張 小3張', cat: '貼紙組合' }
  ];

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function isNew(s) { return s.added >= NEW_SINCE; }
  function rot(id) { var h = 0; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997; return ((h % 9) - 4) * 0.9; }

  function header(active, extra, links) {
    // links 裡設成 false 的項目不顯示（例如 T 恤頁先隱藏，T 恤只放在周邊頁那一條）
    var items = ['首頁', '課程', '周邊'].concat(extra || [], ['畫冊', 'T恤', '聯名手機殼', '數位賣場', '客製化商品', '實體店寄售'])
      .filter(function (t) { return !(links && links[t] === false); });
    // 手機（≤760px）：頁首縮成一條「≡＋Logo」固定在上面，選單收進左邊滑出的抽屜（照ちいかわマーケット）；電腦版不變
    return '<header class="site-head"><button class="nav-btn" type="button" aria-label="選單"><i></i></button><div class="nav-mask"></div><a class="head-contact" title="聯絡我們"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="17" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>聯絡我們</a>' +
      '<a href="./" aria-label="回首頁"><img class="logo old" src="img/logo.png" alt="空罐商店"><img class="logo new" src="img/logo-canking.png" alt="空罐王 CankingSketch" loading="lazy"></a>' +
      '<nav class="nav"><div class="nav-top"><img src="img/shop-girl.webp" alt=""><img src="img/shop-can.webp" alt=""><button class="nav-x" type="button" aria-label="關閉選單">✕</button></div><ul>' + items.map(function (t) {
        var href = links && links[t] ? ' href="' + links[t] + '"' : t === '首頁' ? ' href="./"' : '';   // 首頁（他要的）：LOGO 置中不好找，選單最前面再放一個
        // 「新分頁」紅點拿掉了（他要的）
        return '<li><a data-nav="' + esc(t) + '"' + href + ' class="' + (t === active ? 'on' : '') + '">' + esc(t) + '</a></li>';
      }).join('') + '</ul></nav></header>';
  }
  // 抽屜開關（每頁共用，事件掛在 document 上）
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.nav-btn, .nav-x, .nav-mask');
    if (t) document.documentElement.classList.toggle('nav-open', t.classList.contains('nav-btn'));
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') document.documentElement.classList.remove('nav-open'); });
  // 手機、平板沒有滑鼠：提示改成用手指的說法
  var TOUCH = window.matchMedia && matchMedia('(pointer:coarse)').matches;
  function touchText(s) { return TOUCH ? String(s).replace(/移動滑鼠/g, '用手指') : s; }
  function hero() {
    return '<img class="hero" src="img/hero.png" alt="周邊一覽">' +
      // 四個賣場入口：四段不同花色的紙膠帶（他選的 2B）。連結照舊周邊頁頂端那四顆（原本設計稿只有賣貨便有連結）
      '<div class="shoprow tapes"><span class="t"><a href="' + MYSHIP + '" target="_blank" rel="noopener">711賣貨便</a></span>' +
      '<span class="t"><a href="' + SHOPEE + '" target="_blank" rel="noopener">蝦皮賣場</a></span>' +
      '<span class="t"><a href="' + FORM_OVERSEAS + '" target="_blank" rel="noopener">海外購買</a></span>' +
      '<span class="t"><a href="events-883299.html">實體店面</a></span></div>';
  }
  function hot() {
    return '<div class="sect-title" data-en="RANKING">熱銷推薦</div><div class="hot">' + ['bag', 'coaster', 'anim'].map(function (id) {
      var p = PRODUCTS.filter(function (x) { return x.id === id; })[0];
      return '<a data-prod="' + p.id + '"><img src="' + p.img + '" alt=""><span>' + esc(p.name) + (p.price ? '<em>' + money(p.price) + '</em>' : '') + '</span></a>';
    }).join('') + '</div>';
  }
  // 頁尾：賣場入口＋版權（細修版才顯示，整條紅底）
  function footer() {
    // 跟現在官網頁尾一樣：社群圖示（紅底白圓）＋版權。賣場入口已經在頁面頂端，這裡不重複
    return '<footer class="site-foot"><div class="sns">' + '<a aria-label="Instagram" title="Instagram" href="https://www.instagram.com/canking_liu" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.2" cy="6.8" r="1.3" fill="currentColor"/></svg></a>' + '<a aria-label="Facebook" title="Facebook" href="https://www.facebook.com/canking" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21z" fill="currentColor"/></svg></a>' + '<a aria-label="YouTube" title="YouTube" href="https://www.youtube.com/c/a12710xxx" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="currentColor"/><path d="M10 9v6l5.2-3z" fill="#fff"/></svg></a>' + '<a aria-label="Email" title="Email" href="mailto:' + ['a12710xxx', 'gmail.com'].join('@') + '"><svg viewBox="0 0 24 24"><rect x="3.5" y="6" width="17" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="2"/></svg></a>' + '<a aria-label="Linktree" title="Linktree" href="https://linktr.ee/cankingsketch" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9M3.5 12h17" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></a>' + '</div><small>@CankingSketch All rights reserved</small></footer>';
  }
  function buyRow() {
    return '<div class="buy"><a class="main" href="' + MYSHIP + '" target="_blank" rel="noopener">賣貨便</a><a class="sub" href="' + SHOPEE + '" target="_blank" rel="noopener">蝦皮</a></div>';
  }
  // 燈箱裡的購買區。賣貨便是「整個賣場同一頁」、蝦皮是「這個商品自己的頁面」，兩顆都留、把差別講明白
  function money(n) { return 'NT$' + n; }
  // 價格只寫賣貨便的（可以從賣場頁面自動同步）；蝦皮不寫數字，只說明為什麼比較貴
  // p 可以帶 from（多種價格，顯示「起」）、shopee（該商品自己的蝦皮網址）、soldout（絕版）
  function priceText(price, from) { return price ? money(price) + (from ? ' 起' : '') : ''; }
  // 購買按鈕都標上商品名（data-track-label）：點擊統計（正式站的 track.js）才知道是在買哪個商品
  // 購買按鈕都帶 data-track-label，流量統計才知道點的是哪個商品；opt.trackLabel 可以另外指定（單張貼紙要記是哪一張）
  function buyBox(name, price, opt) {
    return buyBoxHtml(name, price, opt).replace(/<a /g, '<a data-track-label="' + esc((opt && opt.trackLabel) || name) + '" ');
  }
  function buyBoxHtml(name, price, opt) {
    opt = opt || {};
    if (opt.soldout) return (opt.links || []).map(function (l) { return '<a class="sub" href="' + l.href + '" target="_blank" rel="noopener">' + esc(l.label) + '</a>'; }).join('') + '<small>這個商品已經絕版，目前沒有販售</small>';
    return '<a class="main" href="' + MYSHIP + '" target="_blank" rel="noopener">賣貨便下單' + (price ? '　' + priceText(price, opt.from) : '') + '</a>' +
      (opt.wish === false ? '' : wishBtn(wishItem(name, price, opt))) +
      (opt.noShopee ? '' : '<a class="sub" href="' + (opt.shopee || SHOPEE) + '" target="_blank" rel="noopener">蝦皮商品頁</a>') +
      // 其他連結（T 恤：海外預購表單、T 恤頁）
      (opt.links || []).map(function (l) { return '<a class="sub" href="' + l.href + '" target="_blank" rel="noopener">' + esc(l.label) + '</a>'; }).join('') +
      '<small>' + (price && !opt.noShopee ? '蝦皮含平台手續費，價格可能比賣貨便貴一些<br>' : '') + '賣貨便所有商品在同一頁，進去後找「' + esc(opt.findName || name) + '」</small>';
  }
  // ---------- 想買清單（2026-10-04 他要的）----------
  // 我們沒有購物車：客人在網站上逛、玩 3D，看到想買的按「♡ 加到想買清單」，最後再照清單去賣貨便一次下單。
  // 清單只存在客人自己的瀏覽器（localStorage），不登入、不傳回來；每一頁右下角一顆「♡ 3」打開清單。
  // 一樣東西：n＝網站上的名字、v＝哪一款、f＝賣貨便上的商品名、sp＝賣貨便上要選的規格、p＝單價、img、sh＝蝦皮連結、
  //           na＝賣貨便目前沒有這款、q＝數量、ok＝在賣貨便選好了（客人自己勾）
  var WISH_KEY = 'ck-wish', wish = [];
  function wishLoad() {
    try { wish = JSON.parse(localStorage.getItem(WISH_KEY) || '[]'); } catch (e) { wish = []; }
    if (!Array.isArray(wish)) wish = [];
  }
  function wishSave() { try { localStorage.setItem(WISH_KEY, JSON.stringify(wish)); } catch (e) {} wishPaint(); }
  function wishKey(it) { return it.n + '|' + (it.v || ''); }
  function wishHas(k) { for (var i = 0; i < wish.length; i++) if (wish[i].k === k) return true; return false; }
  // 購買區的那顆按鈕：w 可以覆蓋 n／v／f／sp／p／img／na（貼紙、明信片要記是哪一張）
  function wishItem(name, price, opt) {
    var w = opt.wish || {};
    var it = { n: w.n || name, v: w.v || '', f: w.f || opt.findName || w.n || name, sp: w.sp || '', p: w.p != null ? w.p : (price || 0),
      from: !w.v && !!opt.from, img: w.img || opt.img || '', sh: opt.noShopee ? '' : (opt.shopee || ''), na: !!w.na };
    it.k = wishKey(it);
    return it;
  }
  function wishBtn(it) {
    var on = wishHas(it.k);
    return '<button type="button" class="wish-btn' + (on ? ' on' : '') + '" data-wk="' + esc(it.k) + '" data-wish="' + esc(JSON.stringify(it)) + '">' +
      (on ? '♥ 已加到想買清單' : '♡ 加到想買清單') + '</button>';
  }
  function wishToggle(it) {
    if (wishHas(it.k)) wish = wish.filter(function (x) { return x.k !== it.k; });
    else {
      it.q = 1; it.ok = false; wish.push(it);
      // 統計：哪些東西最常被加進清單（正式站的 track.js 才有；不記任何個人資料）
      try { if (window.CK_TRACK) window.CK_TRACK(it.n + (it.v ? '・' + it.v : '')); } catch (e) {}
    }
    wishSave();
  }
  var wishFab, wishPn;
  function wishPaint() {
    Array.prototype.forEach.call(document.querySelectorAll('.wish-btn'), function (b) {
      var on = wishHas(b.getAttribute('data-wk'));
      b.classList.toggle('on', on); b.textContent = on ? '♥ 已加到想買清單' : '♡ 加到想買清單';
    });
    if (!wishFab) return;
    var n = wish.reduce(function (s, x) { return s + (x.q || 1); }, 0);
    wishFab.hidden = !wish.length || !wishPn.hidden;
    wishFab.querySelector('b').textContent = n;
    if (!wishPn.hidden) wishList();
  }
  function wishList() {
    var ul = wishPn.querySelector('.wish-list');
    if (!wish.length) { ul.innerHTML = '<li class="wish-empty">還沒有想買的商品</li>'; }
    else ul.innerHTML = wish.map(function (x, i) {
      // 賣貨便上的名字跟網站不一樣時才寫（規格跟款式同名就不重複）
      var sp = x.sp && x.sp !== x.v ? x.sp : '';
      var find = x.na ? '<small class="na">賣貨便目前沒有這款</small>'
        : x.f !== x.n ? '<small>賣貨便：' + esc(x.f) + (sp ? '／' + esc(sp) : '') + '</small>' : sp ? '<small>賣貨便：選「' + esc(sp) + '」</small>' : '';
      return '<li class="' + (x.ok ? 'ok' : '') + '" data-i="' + i + '">' +
        (x.img ? '<img src="' + esc(x.img) + '" alt="" loading="lazy">' : '<span class="ph"></span>') +
        '<div class="wn"><b>' + esc(x.n) + '</b>' + (x.v ? '<span>' + esc(x.v) + '</span>' : '') + find +
          (x.sh ? '<a class="wsh" href="' + esc(x.sh) + '" target="_blank" rel="noopener" data-track-label="' + esc(x.n) + '">蝦皮</a>' : '') + '</div>' +
        '<div class="wq"><button data-a="-" aria-label="少一個">−</button><span>' + (x.q || 1) + '</span><button data-a="+" aria-label="多一個">＋</button></div>' +
        '<div class="wr">' + (x.p ? '<span class="wp">' + priceText(x.p * (x.q || 1), x.from) + '</span>' : '') +
          '<label class="wok"><input type="checkbox"' + (x.ok ? ' checked' : '') + '>選好了</label>' +
          '<button class="wdel" data-a="x" aria-label="拿掉">✕</button></div></li>';
    }).join('');
    var sum = wish.reduce(function (s, x) { return s + (x.p || 0) * (x.q || 1); }, 0), from = wish.some(function (x) { return x.from; });
    wishPn.querySelector('.wish-sum').innerHTML = wish.length ? '合計 ' + priceText(sum, from) + '<small>金額以賣貨便為準</small>' : '';
    wishPn.querySelector('.wish-acts').hidden = !wish.length;
  }
  function wishOpen(v) {
    wishPn.hidden = !v; document.body.classList.toggle('wish-open', v);
    // 手機：同一個分頁去賣貨便，按「上一頁」就回來（清單還在）；電腦開新分頁
    wishPn.querySelector('.wish-go').target = matchMedia('(hover: none)').matches ? '_self' : '_blank';
    wishPaint();
  }
  function wishText() {
    return wish.map(function (x) {
      return '・' + (x.na ? x.n : x.f) + (x.sp ? '／' + x.sp : x.v ? '／' + x.v : '') + ' × ' + (x.q || 1) + (x.p ? '（' + money(x.p * (x.q || 1)) + '）' : '') + (x.na ? '（賣貨便目前沒有）' : '');
    }).join('\n') + '\n合計 ' + money(wish.reduce(function (s, x) { return s + (x.p || 0) * (x.q || 1); }, 0)) + '\n' + MYSHIP;
  }
  function copyText(txt) {
    var ta = document.createElement('textarea'), ok = false;
    ta.value = txt; ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { ta.setSelectionRange(0, txt.length); ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
  function wishInit() {
    wishLoad();
    wishFab = document.createElement('button'); wishFab.type = 'button'; wishFab.className = 'wish-fab'; wishFab.hidden = true;
    wishFab.setAttribute('aria-label', '想買清單'); wishFab.innerHTML = '♡ <b></b>';
    wishPn = document.createElement('div'); wishPn.className = 'wish-pn'; wishPn.hidden = true;
    wishPn.innerHTML = '<div class="wish-bg"></div><div class="wish-box" role="dialog" aria-label="想買清單">' +
      '<div class="wish-hd"><b>想買清單</b><button class="wish-x" aria-label="關閉">✕</button></div>' +
      '<a class="wish-go" href="' + MYSHIP + '" rel="noopener" data-track-label="想買清單">去賣貨便下單</a>' +
      '<ul class="wish-list"></ul>' +
      '<div class="wish-ft"><div class="wish-sum"></div><div class="wish-copybox" hidden><small>長按下面的文字全選、複製</small><textarea readonly rows="5"></textarea></div>' +
        '<div class="wish-acts"><button data-a="copy">複製清單</button><button data-a="clear">清空</button></div></div></div>';
    document.body.appendChild(wishFab); document.body.appendChild(wishPn);
    wishFab.addEventListener('click', function () { wishOpen(true); });
    wishPn.addEventListener('click', function (e) {
      var t = e.target;
      if (t.classList.contains('wish-bg') || t.classList.contains('wish-x')) return wishOpen(false);
      var li = t.closest('li[data-i]'), x = li ? wish[+li.getAttribute('data-i')] : null, a = t.getAttribute('data-a');
      if (x && t.matches('input[type=checkbox]')) { x.ok = t.checked; return wishSave(); }
      if (x && a === '+') { x.q = Math.min(99, (x.q || 1) + 1); return wishSave(); }
      if (x && a === '-') { if ((x.q || 1) > 1) x.q--; return wishSave(); }
      if (x && a === 'x') { wish.splice(+li.getAttribute('data-i'), 1); return wishSave(); }
      if (a === 'clear') { wish = []; return wishSave(); }
      if (a === 'copy') {
        // 複製：1. 傳統的 execCommand（點的當下同步做，最多瀏覽器吃）2. clipboard API 3. 都不行就把文字直接放在清單裡給人長按複製
        // （clipboard API 在臉書、LINE 內建瀏覽器常被擋，prompt() 有些地方也不能用——他按了沒反應，2026-10-05）
        var txt = wishText(), box = wishPn.querySelector('.wish-copybox');
        var done = function () { box.hidden = true; t.textContent = '已複製'; setTimeout(function () { t.textContent = '複製清單'; }, 1500); };
        var show = function () { box.hidden = false; var ta = box.querySelector('textarea'); ta.value = txt; ta.focus(); ta.select(); };
        if (copyText(txt)) done();
        else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, show);
        else show();
      }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !wishPn.hidden) wishOpen(false); });
    // 購買區的按鈕（各處燈箱動態產生的）：統一在這裡接
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.wish-btn'); if (!b) return;
      try { wishToggle(JSON.parse(b.getAttribute('data-wish'))); } catch (err) {}
    });
    // 別的分頁改了清單：這頁也跟著變
    window.addEventListener('storage', function (e) { if (e.key === WISH_KEY) { wishLoad(); wishPaint(); } });
    wishPaint();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wishInit); else wishInit();
  // 讓各頁放自己的商品清單（燈箱會從這裡找）
  function setProducts(list) { PRODUCTS.length = 0; Array.prototype.push.apply(PRODUCTS, list); }
  function product(p) {
    return '<section class="prod"><h2>' + esc(p.name) + '</h2>' + buyRow() + '<img src="' + p.img + '" alt="' + esc(p.name) + '" loading="lazy">' +
      (p.note ? '<p>' + esc(p.note) + '</p>' : '') + '</section>';
  }
  function tile(s) {
    var thumb = 'assets/' + s.id + '-thumb.webp';
    var fx = s.holo ? 'assets/' + s.id + '-foil.png' : thumb;      // 雷射款：特效只落在沒白墨的地方
    return '<button class="tile' + (s.holo ? ' holo' : '') + '" data-sticker="' + s.id + '" style="--rot:' + rot(s.id) + 'deg;--mm:' + s.wMm + ";--mask:url('" + fx + "')\">" +
      '<span class="tags">' + (isNew(s) ? '<i class="tag new">NEW</i>' : '') + (s.holo ? '<i class="tag holo">雷射</i>' : '') + '</span>' +
      '<span class="pic"><span class="stk"><img src="' + thumb + '" alt="' + esc(s.name) + '貼紙" loading="lazy"></span></span>' +
      '<span class="nm">' + esc(s.name) + '</span><span class="nt">' + esc(s.note) + '</span>' + (s.price ? '<span class="pr">' + money(s.price) + '</span>' : '') + '</button>';
  }
  function tiles(list) { return list.map(tile).join(''); }

  // ---------- 燈箱 ----------
  var lb, frame, list = STICKERS, at = 0;
  function ensureLb() {
    if (lb) return;
    lb = document.createElement('div'); lb.className = 'lb top';
    lb.innerHTML = '<div class="lb-panel" role="dialog" aria-modal="true" aria-label="貼紙 3D 預覽">' +
      '<button class="lb-x" aria-label="關閉">✕</button><button class="lb-arrow prev" aria-label="上一張">‹</button><button class="lb-arrow next" aria-label="下一張">›</button>' +
      '<div class="lb-stage"><iframe title="貼紙 3D 預覽"></iframe><div class="lb-hint">' + touchText('移動滑鼠看光澤　・　按住邊緣往內拖可以撕起來') + '</div></div>' +
      '<div class="lb-strip"></div>' +
      '<div class="lb-foot"><div><h3></h3><small></small></div><div class="buybox"></div></div></div>';
    document.body.appendChild(lb);
    frame = lb.querySelector('iframe');
    // 下面一排貼紙縮圖（他要的）：直接點想看的那張，不用一張一張按上一張／下一張
    stripify(lb.querySelector('.lb-strip'));
    lb.querySelector('.lb-strip').addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]'); if (b) jump(+b.getAttribute('data-k'));
      var g = e.target.closest('[data-go-set]');                // 組合：關掉這個預覽、打開組合的預覽
      if (g) { close(); openSet(g.getAttribute('data-go-set')); }
    });
    lb.addEventListener('click', function (e) { if (CK_bgClick(lb, e)) close(); });
    lb.querySelector('.lb-x').addEventListener('click', close);
    lb.querySelector('.prev').addEventListener('click', function () { go(-1); });
    lb.querySelector('.next').addEventListener('click', function () { go(1); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1);
    });
    // 在預覽裡把貼紙整張撕掉會自動換下一張，這裡跟著換標題
    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'ck-next' && lb.classList.contains('open')) return go(1);   // 在 3D 裡直接點貼紙＝下一張
      if (!e.data || e.data.type !== 'ck-sticker') return;
      for (var i = 0; i < list.length; i++) if (list[i].id === e.data.id) { at = i; caption(); }
    });
  }
  function caption() {
    var s = list[at];
    var t = s.set ? setOf(s) : null;
    lb.querySelector('h3').innerHTML = esc(s.name) + (!t && isNew(s) ? '<i class="tag new">NEW</i>' : '') + (s.holo ? '<i class="tag holo">雷射</i>' : '');
    lb.querySelector('.prev').style.visibility = lb.querySelector('.next').style.visibility = list.length > 1 ? '' : 'hidden';
    lb.querySelector('small').textContent = s.sheetView ? s.note : s.note + (s.paper ? '' : '・防水貼紙') + (t ? '・' + t.name + '內容物，不單賣' : '');
    // 單張貼紙：畫面上寫「防水貼紙」，統計記成「貼紙・名稱」（原本每一張都記成「防水貼紙」，看不出是哪張，2026-10-04 改）
    var SPEC_SETS = ['空罐表情貼', '通學路散步組合貼'];
    lb.querySelector('.buybox').innerHTML = buyBox(t ? t.name : '防水貼紙', t ? t.price : s.price, t
      ? { img: setThumb(t), wish: SPEC_SETS.indexOf(t.name) >= 0 ? { f: '防水貼紙 共11款', sp: t.name } : null }
      : { trackLabel: '貼紙・' + s.name, wish: { v: s.name, f: '防水貼紙 共11款', sp: s.name, img: 'assets/' + s.id + '-thumb.webp' } });
    // 提示只留撕／翻這種不講不會發現的操作，一句話（照ちいかわマーケット的做法，說明越少越好）
    lb.querySelector('.lb-hint').textContent = s.sheetView ? '按住一枚往內拖，可以撕起來' : s.stack ? '往左上拖，可以翻開票根'
      : s.paper ? '' : '按住邊緣往內拖，可以撕起來';
    // 縮圖列：標出現在這張、捲到看得到
    var on = null;
    Array.prototype.forEach.call(lb.querySelectorAll('.lb-strip [data-k]'), function (b, i) { b.classList.toggle('on', i === at); if (i === at) on = b; });
    if (on) { var st = on.parentNode; st.scrollTo({ left: on.offsetLeft - st.clientWidth / 2 + on.offsetWidth / 2, behavior: 'smooth' }); }
    var sw = lb.querySelector('.strip-wrap'); if (sw && sw.edges) setTimeout(sw.edges, 400);
  }
  function open(id) {
    ensureLb();
    // 左右箭頭只在同一組裡換：單張貼紙一組、每個組合各一組
    var me = ALL.filter(function (s) { return s.id === id; })[0];
    list = me && me.set ? setOf(me).items : STICKERS;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) at = i;
    // 透明貼紙板（半斷、整張不拆）：預覽顯示整張板子，標題用組合名稱，不用左右換
    if (me && me.set && setOf(me).kind === 'sheet') {
      var t = setOf(me);
      list = [{ id: id, set: me.set, name: t.name, note: t.note, sheetView: 1 }]; at = 0;
    }
    frame.src = 'sticker-viewer.html?embed=1&s=' + encodeURIComponent(id);
    strip(); caption(); lb.classList.add('open'); document.body.style.overflow = 'hidden';
  }
  // 縮圖列：不要捲軸（他要的）——電腦按住拖、手機手指滑，兩側小小的圓形半透明 ‹ › 按鈕（跟周邊頁輪播同款）一次捲一頁
  function stripify(el) {
    if (el.parentNode.classList.contains('strip-wrap')) return;
    var w = document.createElement('div'); w.className = 'strip-wrap';
    el.parentNode.insertBefore(w, el); w.appendChild(el);
    w.insertAdjacentHTML('beforeend', '<button class="strip-arrow prev" aria-label="往左">‹</button><button class="strip-arrow next" aria-label="往右">›</button>');
    function edges() {
      w.querySelector('.prev').hidden = el.scrollLeft < 4;
      w.querySelector('.next').hidden = el.scrollLeft > el.scrollWidth - el.clientWidth - 4;
    }
    w.querySelector('.prev').addEventListener('click', function (e) { e.stopPropagation(); el.scrollBy({ left: -el.clientWidth * 0.8, behavior: 'smooth' }); });
    w.querySelector('.next').addEventListener('click', function (e) { e.stopPropagation(); el.scrollBy({ left: el.clientWidth * 0.8, behavior: 'smooth' }); });
    var down = null, moved = false;
    el.addEventListener('pointerdown', function (e) { moved = false; if (e.pointerType === 'mouse') down = { x: e.clientX, left: el.scrollLeft }; });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - down.x;
      if (Math.abs(dx) > 5) { moved = true; el.classList.add('dragging'); }
      if (moved) el.scrollLeft = down.left - dx;
    });
    window.addEventListener('pointerup', function () { down = null; el.classList.remove('dragging'); });
    el.addEventListener('click', function (e) { if (moved) { moved = false; e.stopPropagation(); e.preventDefault(); } }, true);   // 拖過不算點
    el.addEventListener('scroll', edges); window.addEventListener('resize', edges);
    // 內容換了（換組合、換商品）或縮圖載入撐開寬度時重算：不用捲的時候兩顆都不出現
    new MutationObserver(function () { requestAnimationFrame(edges); }).observe(el, { childList: true });
    el.addEventListener('load', function () { requestAnimationFrame(edges); }, true);
    w.edges = edges; edges();
  }
  function jump(i) {
    if (i === at) return;
    var d = i > at ? 1 : -1;
    at = i; caption();
    frame.contentWindow.postMessage({ type: 'ck-show', id: list[at].id, dir: d }, '*');
  }
  // 組合的縮圖：電影貼紙組用盒子正面、透明貼紙板用整張板子，其他用第一枚
  function setThumb(t) {
    if (t.kind === 'box') return 'assets/box-' + t.id + '-front.webp';
    if (t.kind === 'sheet') return 'assets/' + t.id + '-sheet.webp';
    return 'assets/' + t.items[0].id + '-thumb.webp';
  }
  function strip() {
    var el = lb.querySelector('.lb-strip');
    // 看單張的時候，後面接著組合（他要的），點了直接打開那個組合
    if (list !== STICKERS) { el.hidden = true; el.innerHTML = ''; return; }
    var sets = SETS.filter(function (t) { return t.items && t.items.length; });
    el.hidden = list.length + sets.length < 2;
    el.innerHTML = el.hidden ? '' : list.map(function (s, i) {
      return '<button data-k="' + i + '" title="' + esc(s.name) + '"><img src="assets/' + s.id + '-thumb.webp" alt="' + esc(s.name) + '" loading="lazy"></button>';
    }).join('') + sets.map(function (t) {
      return '<button class="set" data-go-set="' + t.id + '" title="' + esc(t.name) + '"><img src="' + setThumb(t) + '" alt="' + esc(t.name) + '" loading="lazy"><i>組合</i></button>';
    }).join('');
  }
  function go(d) {
    at = (at + d + list.length) % list.length; caption();
    frame.contentWindow.postMessage({ type: 'ck-show', id: list[at].id, dir: d > 0 ? 1 : -1 }, '*');   // 貼紙從旁邊滑進來
  }
  function close() { lb.classList.remove('open'); frame.src = 'about:blank'; document.body.style.overflow = sl && sl.classList.contains('open') ? 'hidden' : ''; }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-sticker]') : null;
    if (t) open(t.getAttribute('data-sticker'));
    var p = e.target.closest ? e.target.closest('[data-prod]') : null;
    // data-at＝從第幾張開始看；data-tab＝直接打開哪個分頁（例如 T 恤頁的「尺寸表」連結）
    if (p) openProduct(p.getAttribute('data-prod'), +(e.target.closest('[data-at]') || p).getAttribute('data-at') || 0, p.getAttribute('data-tab'));
    var st = e.target.closest ? e.target.closest('[data-set]') : null;
    if (st) openSet(st.getAttribute('data-set'));
  });

  // ---------- 組合：牆上的磚 ----------
  // 盒子：用展開圖切出來的六個面組成真的立體盒（CSS 3D），k＝每公釐幾像素
  function boxHtml(t, k) {
    var W = t.box.w * k, H = t.box.h * k, D = t.box.d * k, u = "url('assets/box-" + t.id + "-";
    var T = Math.max(2, 1.7 * k);      // 瓦楞紙板厚度（約 1.7mm）
    function face(w, h, left, top, tf, img, extra) {
      var pos = 'width:' + w + 'px;height:' + h + 'px;left:' + left + 'px;top:' + top + 'px;' + (extra || '');
      return '<i class="f" style="' + pos + 'transform:' + tf + ';background-image:' + u + img + ".webp')\"></i>" +
        '<i class="in" style="' + pos + 'transform:' + tf + ' rotateY(180deg)"></i>';      // 同一個面的內側：素色牛皮紙
    }
    // 照實物（94×60×29mm 郵寄盒）：平放，大圖在上蓋頂面；正面側邊中間有拇指缺口；上蓋從後緣掀開，前緣有一片插舌塞進正面裡
    var notch = '-webkit-mask:radial-gradient(' + 11 * k + 'px ' + 7 * k + 'px at 50% 0,transparent 97%,#000 100%);mask:radial-gradient(' + 11 * k + 'px ' + 7 * k + 'px at 50% 0,transparent 97%,#000 100%);';
    return '<div class="bx" style="width:' + W + 'px;height:' + H + 'px">' +
      face(W, H, 0, 0, 'translateZ(' + D / 2 + 'px)', 'front', notch) +
      face(W, H, 0, 0, 'rotateY(180deg) translateZ(' + D / 2 + 'px)', 'back') +
      face(D, H, (W - D) / 2, 0, 'rotateY(-90deg) translateZ(' + W / 2 + 'px)', 'left') +
      face(D, H, (W - D) / 2, 0, 'rotateY(90deg) translateZ(' + W / 2 + 'px)', 'right') +
      face(W, D, 0, (H - D) / 2, 'rotateX(-90deg) translateZ(' + H / 2 + 'px)', 'bottom') +
      // 上蓋：鉸鏈在後上緣，打開時往上往後掀
      // 開口一圈看得到紙板的斷面（上蓋掀開後才露出來）
      '<b class="rim" style="width:' + W + 'px;height:' + D + 'px;border-width:' + T + 'px;transform:translateY(1px) translateZ(' + (-D / 2) + 'px) rotateX(90deg)"></b>' +
      '<div class="bx-lid" style="width:' + W + 'px;height:' + D + 'px;--z:' + (-D / 2) + 'px">' +
      '<b class="edge" style="width:' + W + 'px;height:' + T + 'px;top:' + D + 'px"></b>' +
      '<b class="flap" style="width:' + (W - 4 * T) + 'px;left:' + 2 * T + 'px;height:' + H * 0.8 + 'px;top:' + (D - 1.6 * T) + 'px"></b>' +
      '<i class="f" style="inset:0;background-image:' + u + "top.webp')\"></i>" + '<i class="in" style="inset:0;transform:rotateY(180deg)"></i></div></div>';
  }
  // 背卡＋整板貼紙（牆上的磚用）。板子 100×124mm，貼在 100×150mm 背卡的下方
  var CARD = { w: 100, h: 150, top: 26 };
  function sheetHtml(t, k) {
    return '<span class="sheetcard" style="width:' + CARD.w * k + 'px;height:' + CARD.h * k + 'px">' +
      '<i class="film" style="top:' + CARD.top * k + 'px;height:' + (CARD.h - CARD.top) * k + 'px"></i>' + t.items.map(function (s) {
      return '<img src="assets/' + s.id + '-thumb.webp" alt="" style="left:' + (s.sx - s.wMm / 2) * k + 'px;top:' + (CARD.top + s.sy - s.hMm / 2) * k + 'px;width:' + s.wMm * k + 'px">';
    }).join('') + '</span>';
  }
  function setTile(t) {
    var pic;
    if (t.kind === 'sheet') pic = '<span class="stk sheetwrap">' + sheetHtml(t, 0.95) + '</span>';
    else if (t.kind === 'box') pic = '<span class="stk bxwrap">' + boxHtml(t, 1.25) + '</span>';
    else pic = '<span class="stk fan">' + t.items.slice(0, 3).map(function (s) {
      return '<img src="assets/' + s.id + '-thumb.webp" alt="">';
    }).join('') + '</span>';
    return '<button class="tile set set-' + t.kind + '" data-set="' + t.id + '" style="--rot:' + rot(t.id) + 'deg">' +
      '<span class="tags"><i class="tag setc">組合・' + t.items.length + ' ' + t.unit + '</i></span>' +
      '<span class="pic">' + pic + '</span><span class="nm">' + esc(t.name) + '</span><span class="nt">' + esc(t.note) + '</span>' + (t.price ? '<span class="pr">' + money(t.price) + '</span>' : '') + '</button>';
  }
  function setTiles() { return SETS.map(setTile).join(''); }

  // ---------- 組合預覽：先看到盒子（或一疊），點了才把內容物攤開 ----------
  var sl, cur, opened = false;
  function ensureSl() {
    if (sl) return;
    sl = document.createElement('div'); sl.className = 'lb sl';
    sl.innerHTML = '<div class="lb-panel" role="dialog" aria-modal="true"><button class="lb-x" aria-label="關閉">✕</button>' +
      '<div class="sl-stage"><div class="sl-box"></div><div class="sl-items"></div><div class="sl-hint"></div><div class="sl-photo" hidden></div></div>' +
      '<div class="lb-strip sl-strip"></div>' +
      '<div class="lb-foot"><div><h3></h3><small></small></div><div class="buybox"></div></div></div>';
    document.body.appendChild(sl);
    stripify(sl.querySelector('.sl-strip'));
    sl.querySelector('.sl-strip').addEventListener('click', function (e) {
      var b = e.target.closest('[data-v]'); if (!b) return;
      e.stopPropagation(); setView(b.getAttribute('data-v'));
    });
    sl.addEventListener('click', function (e) {
      if (CK_bgClick(sl, e) || e.target.closest('.lb-x')) return closeSet();
      var it = e.target.closest('[data-item]');
      if (!opened && (it || e.target.closest('.sl-box') || e.target.closest('.sl-hint'))) return burst();
      if (opened && it) return open(it.getAttribute('data-item'));
      // 打開後點畫面空白處就收回盒子／袋子（他要的，不放「收回」按鈕）。
      // 標籤貼（bottles）本來就是一打開就貼好、沒有收回；切到商品圖／影片那幾格時也不收
      if (opened && cur.kind !== 'bottles' && sl.querySelector('.sl-photo').hidden && e.target.closest('.sl-stage')) return resetSet(true);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sl.classList.contains('open') && !(lb && lb.classList.contains('open'))) closeSet();
    });
    // 盒子跟著游標轉一點
    sl.querySelector('.sl-stage').addEventListener('pointermove', function (e) {
      var r = this.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      if (b3d && cur.kind === 'bottles') b3d.pointer(x + 0.5, y + 0.5);      // 瓶子跟著游標轉
      if (cur.kind === 'bottles') this.style.setProperty('--sx', (50 + x * 90).toFixed(0) + '%');   // 亮面標籤的反光跟著滑
      // 貼紙板（袋子裡或拿出來）、電影貼紙組打開後攤開的那一片：跟著游標微微傾斜，袋子反光跟著滑
      if (cur.kind === 'sheet' || (cur.kind === 'box' && opened)) {
        this.style.setProperty('--tx', (x * 14).toFixed(1) + 'deg'); this.style.setProperty('--ty', (-y * 10).toFixed(1) + 'deg');
        this.style.setProperty('--sx', (50 + x * 60).toFixed(0) + '%');
        return;
      }
      var b = sl.querySelector('.bx'); if (!b || opened) return;
      b.style.setProperty('--by', (-24 + x * 34).toFixed(1) + 'deg'); b.style.setProperty('--bx', (-38 - y * 18).toFixed(1) + 'deg');
    });
    window.addEventListener('resize', function () { if (sl.classList.contains('open')) { if (opened) place(false); else resetSet(false); } });
  }
  function stageSize() { var st = sl.querySelector('.sl-stage'); return { w: st.clientWidth, h: st.clientHeight }; }
  // 攤開後的位置：挑一個欄數讓貼紙最大，全部用同一個比例，所以大小關係跟實物一樣
  // 分裝瓶（mm）。labelY＝標籤中心離瓶頂多遠
  // 透明 PET 圓筒瓶配白色掀蓋（100ml 旅行分裝瓶那種）：直徑約 4cm、高約 12.4cm
  // 真空按壓瓶：直徑約 3cm、含外蓋高 11.4cm（尺寸照照片比例估的）；labelY＝標籤中心離瓶頂多遠
  var BT = { w: 32, h: 114, labelY: 70 };
  // 瓶子和貼紙的位置：上面一排大張、下面一排貼好小張的瓶子（瓶子正下方留倒影的位置）
  function bottleGeo() {
    var z = stageSize(), k, x0, loose = [], bottles = [], i;
    var tabH = 0;      // 上方的「3D 示意／商品圖」切換鈕拿掉了（改成下面一排縮圖），不用再讓位
    // 高度預算：大張 60＋間距 10＋瓶子 114＋一小截倒影 16（mm），下方再留標語的位置
    k = Math.min((z.w - 24) / 168, (z.h - 44 - tabH) / 200, 3.4); x0 = (z.w - 168 * k) / 2;
    var top0 = Math.max(10 + tabH, tabH + (z.h - 34 - tabH - 200 * k) / 2);
    for (i = 0; i < 3; i++) { loose.push({ x: x0 + (28 + 56 * i) * k, y: top0 + 30 * k }); bottles.push({ x: x0 + (28 + 56 * i) * k, top: top0 + 70 * k }); }
    return { k: k, loose: loose, bottles: bottles };
  }
  var b3d = null, b3dAsked = false;
  function ensure3d() {
    if (b3dAsked) return;
    b3dAsked = true;
    import(CK_MOD('bottles3d.js')).then(function (m) {
      b3d = m.create();
      if (sl && sl.classList.contains('open') && cur.kind === 'bottles') { if (opened) place(false); else resetSet(false); }
    }).catch(function () { /* 載不到就維持平面瓶子 */ });
  }
  function drawBottles(g) {
    var box = sl.querySelector('.sl-box');
    if (b3d) {
      b3d.mount(box);
      b3d.layout(g, stageSize(), BT, cur.items.slice(3));
      return;
    }
    ensure3d();
    var body = 'M4 40Q4 27 14 25.5H28Q38 27 38 40V112Q38 120 30 120H12Q4 120 4 112Z';
    box.innerHTML = g.bottles.map(function (b) {
      return '<div class="bt" style="left:' + (b.x - BT.w * g.k / 2) + 'px;top:' + b.top + 'px;width:' + BT.w * g.k + 'px">' +
        '<svg viewBox="0 0 42 124" aria-hidden="true"><ellipse cx="21" cy="121.4" rx="16" ry="2.2" fill="rgba(0,0,0,.12)"/>' +
        '<path d="' + body + '" fill="rgba(255,255,255,.55)" stroke="#a7b5c1" stroke-width=".8"/>' +
        '<rect x="7.2" y="33" width="3" height="78" rx="1.5" fill="rgba(255,255,255,.85)"/>' +
        '<rect x="12" y="21.5" width="18" height="4.5" rx="1" fill="#eef1f3" stroke="#b9c3cc" stroke-width=".6"/>' +
        '<rect x="9" y="2" width="24" height="20" rx="2.6" fill="#fcfcfc" stroke="#c3cad1" stroke-width=".8"/>' +
        '<path d="M9 9.5H33" stroke="#d3d8dd" stroke-width=".7"/></svg></div>';
    }).join('');
  }
  var SHEET = { w: 100, h: 124 };
  function sheetOpenGeo() {
    var z = stageSize(), k = Math.min(4.5, (z.h - 60) / SHEET.h, (z.w - 40) / SHEET.w);
    return { k: k, left: z.w / 2 - SHEET.w * k / 2, top: z.h / 2 - SHEET.h * k / 2 + 14 };
  }
  // 透明底紙（圓角長方形，淡淡的亮面）
  function sheetFilm(left, top, k, animate) {
    var f = sl.querySelector('.sheetfilm'); if (!f) return;
    f.style.transition = animate ? 'all .55s cubic-bezier(.2,.8,.2,1)' : 'none';
    f.style.left = left + 'px'; f.style.top = top + 'px'; f.style.width = SHEET.w * k + 'px'; f.style.height = SHEET.h * k + 'px';
    f.style.borderRadius = 2.5 * k + 'px';
  }
  // 有 layout 的組合（電影貼紙組）：照商品照的畫框擺
  function frameGeo() {
    var z = stageSize(), L = cur.layout, tabH = cur.photos && cur.photos.length ? 52 : 12;   // 讓開上方的切換鈕
    var s = Math.min((z.w - 40) / L.w, (z.h - 50 - tabH) / L.h);
    return { s: s, left: (z.w - L.w * s) / 2, top: tabH + (z.h - tabH - L.h * s) / 2 };
  }
  function layoutOpen() {
    if (cur.layout) {
      var fg = frameGeo();
      return cur.items.map(function (s, i) {
        var p = cur.layout.items[s.id] || [cur.layout.w / 2, cur.layout.h / 2, 80];
        // 寬度放大一成二，讓相鄰的貼紙像照片那樣微微疊在一起
        return { x: fg.left + p[0] * fg.s, y: fg.top + p[1] * fg.s, k: p[2] * 1.12 * fg.s / s.wMm, r: ((i * 47) % 7 - 3) * 0.8 };
      });
    }
    if (cur.kind === 'sheet') {
      var sg = sheetOpenGeo();
      return cur.items.map(function (s) { return { x: sg.left + s.sx * sg.k, y: sg.top + s.sy * sg.k, k: sg.k, r: 0 }; });
    }
    if (cur.kind === 'bottles') {
      var g = bottleGeo();
      return cur.items.map(function (s, i) {
        var small = i >= 3, j = i % 3;      // 清單順序：大 3 張、小 3 張；小張貼到瓶子上
        return small ? { x: g.bottles[j].x, y: g.bottles[j].top + BT.labelY * g.k, k: g.k, r: 0, stuck: 1 }
                     : { x: g.loose[j].x, y: g.loose[j].y, k: g.k, r: (j - 1) * 4 };
      });
    }
    var z = stageSize(), n = cur.items.length, top = 46, pad = 10;
    var mw = Math.max.apply(null, cur.items.map(function (s) { return s.wMm; })), mh = Math.max.apply(null, cur.items.map(function (s) { return s.hMm; }));
    var best = null;
    for (var c = 1; c <= n; c++) {
      var r = Math.ceil(n / c), cw = (z.w - pad * 2) / c, ch = (z.h - top - pad) / r, k = Math.min(cw * 0.94 / mw, ch * 0.92 / mh);
      if (!best || k > best.k) best = { c: c, r: r, cw: cw, ch: ch, k: k };
    }
    best.k = Math.min(best.k, 3.2);
    return cur.items.map(function (s, i) {
      var row = Math.floor(i / best.c), inRow = Math.min(best.c, n - row * best.c), col = i % best.c;
      var x0 = (z.w - inRow * best.cw) / 2;                       // 最後一排沒滿就置中
      return { x: x0 + (col + 0.5) * best.cw, y: top + (row + 0.5) * best.ch, k: best.k, r: ((i * 47) % 11 - 5) * 0.9 };
    });
  }
  function itemTf(p, sc) { return 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px) translate(-50%,-50%) rotate(' + p.r + 'deg) scale(' + sc + ')'; }
  function place(animate) {
    var ps = layoutOpen(), z = stageSize(), els = sl.querySelectorAll('[data-item]');
    var fr = sl.querySelector('.sl-frame');
    if (fr) {   // 畫框：黑框＋淺灰底紙，貼紙飛出來的同時淡入
      var fg = frameGeo(), pad = 14 * fg.s * 1.4;
      fr.style.cssText = 'left:' + (fg.left - pad) + 'px;top:' + (fg.top - pad) + 'px;width:' + (cur.layout.w * fg.s + pad * 2) + 'px;height:' + (cur.layout.h * fg.s + pad * 2) + 'px;' +
        'border-width:' + Math.max(6, 16 * fg.s) + 'px;opacity:1;transition:' + (animate ? 'opacity .5s .35s' : 'none');
    }
    if (cur.kind === 'sheet') {
      var sg = sheetOpenGeo();
      sheetFilm(sg.left, sg.top, sg.k, animate);
      var bag = sl.querySelector('.opp'); bag.style.opacity = 0;
      Array.prototype.forEach.call(els, function (el, i) {
        el.style.transition = animate ? 'transform .55s cubic-bezier(.2,.8,.2,1), width .55s cubic-bezier(.2,.8,.2,1)' : 'none';
        el.style.width = (cur.items[i].wMm * ps[i].k) + 'px'; el.style.opacity = 1; el.style.pointerEvents = 'auto';
        el.style.transform = itemTf(ps[i], 1);
      });
      sl.classList.remove('tilt');                // 拿出來後由 3D 預覽自己跟著滑鼠傾斜
      sheet3d(sg, animate ? 600 : 0);
      return;
    }
    if (cur.kind === 'bottles') drawBottles(bottleGeo());
    Array.prototype.forEach.call(els, function (el, i) {
      var s = cur.items[i], p = ps[i];
      el.classList.toggle('stuck', !!p.stuck);
      el.style.width = (s.wMm * p.k) + 'px';
      el.style.opacity = 1; el.style.pointerEvents = 'auto';
      var end = itemTf(p, 1);
      if (animate && el.animate) {
        var from = el.dataset.from ? JSON.parse(el.dataset.from) : { x: z.w / 2, y: z.h * 0.42, r: 0 };
        var mid = { x: from.x + (p.x - from.x) * 0.5 + ((i * 29) % 60 - 30), y: Math.min(from.y, p.y) - 90 - (i * 17) % 70, r: ((i * 61) % 50 - 25) };
        el.animate([{ transform: itemTf(from, cur.kind === 'box' ? 0.12 : 1), opacity: cur.kind === 'box' ? 0 : 1 },
          { transform: itemTf(mid, 0.8), opacity: 1, offset: 0.45 }, { transform: end, opacity: 1 }],
          { duration: 760, delay: (cur.kind === 'box' ? 330 : 0) + i * 42, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' });
      }
      el.style.transform = end;
    });
    if (cur.kind === 'bottles') {
      var mine = cur;
      setTimeout(function () {
        if (!b3d || !opened || cur !== mine) return;
        b3d.labels(1, !animate);
        Array.prototype.forEach.call(sl.querySelectorAll('.sl-item.stuck'), function (el) { el.style.opacity = 0; });
      }, animate ? 760 + 5 * 42 : 0);
    }
  }
  // 收起來的樣子：盒子款把貼紙藏在盒口；一疊款就疊在中間
  function resetSet(animate) {
    opened = false;
    sheet3d(null);
    sl.classList.toggle('tilt', cur.kind === 'sheet');      // 電影貼紙組要打開後才擺動
    var st1 = sl.querySelector('.sl-stage'); ['--tx', '--ty'].forEach(function (v) { st1.style.removeProperty(v); });
    var z = stageSize(), els = sl.querySelectorAll('[data-item]'), boxEl = sl.querySelector('.sl-box');
    sl.querySelector('.sl-hint').hidden = false;
    boxEl.classList.remove('gone', 'lid-open');
    var fr0 = sl.querySelector('.sl-frame'); if (fr0) { fr0.style.transition = 'none'; fr0.style.opacity = 0; }
    boxEl.classList.toggle('flat', cur.kind === 'bottles');
    Array.prototype.forEach.call(els, function (el) { el.classList.remove('stuck'); });
    if (cur.kind === 'bottles') {
      // 還沒貼：三個空瓶，六張貼紙疊在旁邊
      var g = bottleGeo(), cx = (g.loose[0].x + g.loose[2].x) / 2;
      drawBottles(g);
      if (b3d) b3d.labels(0, !animate);
      Array.prototype.forEach.call(els, function (el, i) {
        var n = els.length, p = { x: cx + (i - (n - 1) / 2) * 8, y: g.loose[1].y - (i % 2) * 5, r: (i - (n - 1) / 2) * 5 };
        el.dataset.from = JSON.stringify(p);
        el.style.transition = animate ? 'transform .45s cubic-bezier(.2,.8,.2,1)' : '';
        el.style.width = (cur.items[i].wMm * g.k) + 'px'; el.style.opacity = 1; el.style.pointerEvents = 'auto';
        el.style.zIndex = i < 3 ? 1 : 2;
        el.style.transform = itemTf(p, 1);
      });
    } else if (cur.kind === 'sheet') {
      // 還沒拿出來：OPP 袋裡，紅色背卡上疊著一整張透明貼紙板
      var ks = Math.min(3.2, z.h * 0.86 / CARD.h, z.w * 0.5 / CARD.w), cl = z.w / 2 - CARD.w * ks / 2, ct = z.h / 2 - CARD.h * ks / 2;
      boxEl.classList.add('flat');
      boxEl.innerHTML = '<img class="card" src="assets/card-long-front.webp" alt="" style="left:' + cl + 'px;top:' + ct + 'px;width:' + CARD.w * ks + 'px">';
      sheetFilm(cl, ct + CARD.top * ks, ks, animate);
      var bag = sl.querySelector('.opp');
      bag.style.cssText = 'left:' + (cl - 3 * ks) + 'px;top:' + (ct - 9 * ks) + 'px;width:' + (CARD.w + 6) * ks + 'px;height:' + (CARD.h + 13) * ks + 'px;opacity:1';
      Array.prototype.forEach.call(els, function (el, i) {
        var it = cur.items[i], p = { x: cl + it.sx * ks, y: ct + (CARD.top + it.sy) * ks, r: 0 };
        el.dataset.from = JSON.stringify(p);
        el.style.transition = animate ? 'transform .45s cubic-bezier(.2,.8,.2,1), width .45s' : '';
        el.style.width = (it.wMm * ks) + 'px'; el.style.opacity = 1; el.style.pointerEvents = 'auto';
        el.style.transform = itemTf(p, 1);
      });
    } else if (cur.kind === 'box') {
      var k = Math.min(4, z.w * 0.55 / cur.box.w, z.h * 0.5 / cur.box.d);
      boxEl.innerHTML = '<div class="bx-float">' + boxHtml(cur, k) + '</div>';
      Array.prototype.forEach.call(els, function (el) {
        el.dataset.from = JSON.stringify({ x: z.w / 2, y: z.h * 0.5 - cur.box.h * k * 0.3, r: 0 });   // 從盒口冒出來
        el.style.transition = '';
        el.style.opacity = 0; el.style.pointerEvents = 'none'; el.style.transform = itemTf({ x: z.w / 2, y: z.h / 2, r: 0 }, 0.12);
      });
    } else {
      boxEl.innerHTML = '';
      var k2 = Math.min(3.4, z.h * 0.5 / 60, z.w * 0.5 / 60);
      Array.prototype.forEach.call(els, function (el, i) {
        var n = els.length, p = { x: z.w / 2 + (i - (n - 1) / 2) * 9, y: z.h * 0.47 - (i % 2) * 6, r: (i - (n - 1) / 2) * 5 };
        el.dataset.from = JSON.stringify(p);
        el.style.transition = animate ? 'transform .45s cubic-bezier(.2,.8,.2,1), width .45s' : '';
        el.style.width = (cur.items[i].wMm * k2) + 'px'; el.style.opacity = 1; el.style.pointerEvents = 'auto';
        el.style.transform = itemTf(p, 1);
      });
    }
  }
  function burst() {
    if (opened) return;
    opened = true;
    if (cur.kind === 'box') sl.classList.add('tilt');
    var boxEl = sl.querySelector('.sl-box');
    sl.querySelector('.sl-hint').hidden = true;
    Array.prototype.forEach.call(sl.querySelectorAll('[data-item]'), function (el) { el.style.transition = ''; });
    if (cur.kind === 'box') {
      boxEl.classList.add('lid-open');
      setTimeout(function () { if (opened) boxEl.classList.add('gone'); }, 900);
    }
    if (cur.kind === 'sheet') boxEl.classList.add('gone');   // 板子拿出來，背卡退場
    place(true);
  }
  function openSet(id) {
    ensureSl();
    cur = SETS.filter(function (t) { return t.id === id; })[0];
    sl.classList.toggle('sheet', cur.kind === 'sheet');
    var st0 = sl.querySelector('.sl-stage'); ['--tx', '--ty', '--sx'].forEach(function (v) { st0.style.removeProperty(v); });
    sl.querySelector('.sl-items').innerHTML = (cur.kind === 'sheet' ? '<div class="sheetfilm"></div>' : '') + cur.items.map(function (s) {
      var th = 'assets/' + s.id + '-thumb.webp';
      return '<button class="sl-item' + (s.gloss ? ' gloss' : '') + '" data-item="' + s.id + '" title="' + esc(s.name) + '"' + (s.gloss ? " style=\"--mask:url('" + th + "')\"" : '') + '><img src="' + th + '" alt="' + esc(s.name) + '"></button>';
    }).join('') + (cur.kind === 'sheet' ? '<div class="opp"></div>' : '');
    sl.querySelector('.sl-hint').textContent = cur.closedHint;
    sl.querySelector('h3').innerHTML = esc(cur.name) + '<i class="tag setc">' + cur.items.length + ' ' + cur.unit + '</i>';
    sl.querySelector('small').textContent = cur.note;
    var vEmb = cur.video ? videoEmbed(cur.video) : '';
    sl.querySelector('.buybox').innerHTML = buyBox(cur.name, cur.price, { links: cur.video && !vEmb ? [{ label: '▶ 影片', href: cur.video }] : undefined,
      img: setThumb(cur), wish: ['空罐表情貼', '通學路散步組合貼'].indexOf(cur.name) >= 0 ? { f: '防水貼紙 共11款', sp: cur.name } : null });   // 影片嵌得進來就放在縮圖裡
    sl.classList.add('open'); document.body.style.overflow = 'hidden';
    resetSet(false);
    // 上方「3D 示意／商品圖」拿掉了（他要的）：下面一排縮圖切換——第一格 3D、接著商品圖、最後影片
    var ph = cur.photos || [], cells = '<button data-v="3d" class="th3d" title="3D"><img src="' + setThumb(cur) + '" alt=""><i>3D</i></button>' +
      ph.map(function (s, k) { return '<button data-v="p' + k + '" title="商品圖"><img src="' + s + '" alt=""></button>'; }).join('') +
      (vEmb ? '<button data-v="video" class="thvid" title="影片"><img src="' + videoThumb(cur.video, setThumb(cur)) + '" alt=""><i>▶</i></button>' : '');
    var strip_ = sl.querySelector('.sl-strip');
    strip_.hidden = !ph.length && !vEmb;
    strip_.innerHTML = strip_.hidden ? '' : cells;
    sl.querySelector('.sl-photo').dataset.video = vEmb;
    setView('3d');
    // 標籤貼：不做「點擊貼上」，一打開就是貼好的樣子，並註明不含分裝瓶
    var note = sl.querySelector('.sl-note');
    if (!note) { note = document.createElement('div'); note.className = 'sl-note'; sl.querySelector('.sl-stage').appendChild(note); }
    note.hidden = cur.kind !== 'bottles';
    note.textContent = '※ 商品不含分裝瓶，瓶子僅示意貼上後的樣子';
    if (cur.kind === 'bottles') {
      opened = true;
      sl.querySelector('.sl-hint').hidden = true;
      place(false);
    }
  }
  // 組合視窗切換：'3d'＝原本的盒子／板子；'p0'…＝商品圖；'video'＝影片（只在這格時才載入播放器）
  function setView(v) {
    var photo = sl.querySelector('.sl-photo');
    photo.hidden = v === '3d';
    // 標籤貼（bottles）的 3D：手機上手指在畫面裡拖是要轉瓶子，不能讓整個視窗跟著捲（他反映的）。
    // 只在看 3D 那格時擋；切到商品圖／影片就恢復正常捲動
    sl.querySelector('.sl-stage').style.touchAction = cur.kind === 'bottles' && v === '3d' ? 'none' : '';
    if (v === 'video') photo.innerHTML = '<div class="pl-video' + (/instagram/.test(photo.dataset.video) ? ' ig' : '') + '"><iframe src="' + photo.dataset.video + '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="影片"></iframe></div>';
    else if (v !== '3d') photo.innerHTML = '<img src="' + (cur.photos || [])[+v.slice(1)] + '" alt="' + esc(cur.name) + ' 商品圖">';
    else photo.innerHTML = '';
    Array.prototype.forEach.call(sl.querySelectorAll('.sl-strip [data-v]'), function (b) { b.classList.toggle('on', b.getAttribute('data-v') === v); });
  }
  function closeSet() { sheet3d(null); if (sl.querySelector('.sl-photo')) sl.querySelector('.sl-photo').innerHTML = ''; sl.classList.remove('open'); document.body.style.overflow = ''; }

  // 透明貼紙板拿出來之後：直接換成 3D 預覽（整張板子，按住哪一枚就撕哪一枚），不用再點一次開另一個視窗。
  // iframe 的大小算成讓 3D 裡的板子剛好疊在平面板子的位置上（index.html 嵌入時每公釐像素＝min(寬×0.8/100, 高×0.74/124)）。
  // 傳 null＝收掉（放回袋子、關閉時）
  function sheet3d(sg, delay) {
    var stage = sl.querySelector('.sl-stage'), f = stage.querySelector('.sl-sheet3d');
    var items = sl.querySelector('.sl-items');
    if (!sg) {
      if (f) f.remove();
      items.style.opacity = ''; items.style.pointerEvents = '';
      return;
    }
    if (!f) {
      f = document.createElement('iframe'); f.className = 'sl-sheet3d'; f.title = cur.name + ' 3D 預覽';
      f.src = 'sticker-viewer.html?embed=1&s=' + encodeURIComponent(cur.items[0].id);
      stage.appendChild(f);
      f.addEventListener('load', function () {
        // 等貼圖載完再淡入（太早換會閃一下空白）
        setTimeout(function () { if (f.isConnected) { f.style.opacity = 1; items.style.opacity = 0; items.style.pointerEvents = 'none'; } }, Math.max(delay || 0, 900));
      });
    }
    var w = SHEET.w * sg.k / 0.8, h = SHEET.h * sg.k / 0.74;
    var cx = sg.left + SHEET.w * sg.k / 2, cy = sg.top + SHEET.h * sg.k / 2;
    f.style.left = (cx - w / 2) + 'px'; f.style.top = (cy - h / 2) + 'px'; f.style.width = w + 'px'; f.style.height = h + 'px';
  }

  // ---------- 牆上的貼紙：跟著游標傾斜，反光位置跟著游標走 ----------
  var hot_ = null;
  function calm(t) { var k = t && t.querySelector('.stk'); if (k) ['--rx', '--ry', '--px', '--py'].forEach(function (v) { k.style.removeProperty(v); }); }
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var t = e.target.closest ? e.target.closest('.tile') : null;
    if (hot_ && hot_ !== t) calm(hot_);
    hot_ = t;
    if (!t) return;
    var k = t.querySelector('.stk'), r = t.querySelector('.pic').getBoundingClientRect();
    var x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    k.style.setProperty('--ry', ((x - 0.5) * 30).toFixed(1) + 'deg');
    k.style.setProperty('--rx', ((0.5 - y) * 26).toFixed(1) + 'deg');
    k.style.setProperty('--px', (x * 100).toFixed(0));
    k.style.setProperty('--py', (y * 100).toFixed(0));
  });
  document.addEventListener('pointerleave', function () { calm(hot_); hot_ = null; });

  // ---------- 商品燈箱：多圖＋說明＋購買（版本 C 用） ----------
  var pl, plImgs = [], plAt = 0;
  function ensurePl() {
    if (pl) return;
    pl = document.createElement('div'); pl.className = 'lb pl';
    pl.innerHTML = '<div class="lb-panel" role="dialog" aria-modal="true">' +
      '<button class="lb-x" aria-label="關閉">✕</button><button class="lb-arrow prev" aria-label="上一張">‹</button><button class="lb-arrow next" aria-label="下一張">›</button>' +
      '<div class="pl-stage"></div><div class="pl-3d" hidden><div class="pl-3d-hint">移動滑鼠轉動・看亮光油的反光</div></div><div class="pl-size" hidden></div><div class="pl-tabs" hidden></div><div class="pl-thumbs"></div>' +
      '<div class="lb-foot"><div><h3></h3><small></small></div><div class="buybox"></div></div></div>';
    document.body.appendChild(pl);
    var stage = pl.querySelector('.pl-stage');
    // 上方的切換鈕：3D 預覽／商品圖／實穿（跳到實穿照）／尺寸表（T 恤）
    pl.querySelector('.pl-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      plTab(b.dataset.v);
    });
    pl.querySelector('.pl-3d').addEventListener('pointermove', function (e) {
      var r = this.getBoundingClientRect();
      if (cur3d) cur3d.pointer((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    });
    pl.addEventListener('click', function (e) {
      if (CK_bgClick(pl, e)) closePl();
      var th = e.target.closest('[data-i]');
      if (th) { plTab('photo', +th.getAttribute('data-i')); return; }
      var tv = e.target.closest('[data-v]');
      if (tv && tv.closest('.pl-thumbs')) plTab(tv.getAttribute('data-v'));
    });
    pl.querySelector('.lb-x').addEventListener('click', closePl);
    pl.querySelector('.prev').addEventListener('click', function () { plStep(-1); });
    pl.querySelector('.next').addEventListener('click', function () { plStep(1); });
    // 手機用手指左右滑；滑完把目前第幾張同步回縮圖
    stage.addEventListener('scroll', function () {
      var i = Math.round(stage.scrollLeft / stage.clientWidth);
      if (i !== plAt) { plAt = i; plMark(); }
    });
    document.addEventListener('keydown', function (e) {
      if (!pl.classList.contains('open')) return;
      if (e.key === 'Escape') closePl(); else if (e.key === 'ArrowLeft') plStep(-1); else if (e.key === 'ArrowRight') plStep(1);
    });
  }
  // 影片（IG reel／YouTube）→ 官方嵌入播放器的網址；縮圖：YouTube 有現成的，IG 沒有就用商品第一張圖＋播放鈕
  function videoEmbed(url) {
    var m = /instagram\.com\/(?:reel|p)\/([\w-]+)/.exec(url);
    if (m) return 'https://www.instagram.com/reel/' + m[1] + '/embed/';
    m = /(?:youtu\.be\/|youtube\.com\/(?:shorts\/|watch\?v=|embed\/))([\w-]{6,})/.exec(url);
    if (m) return 'https://www.youtube.com/embed/' + m[1] + '?autoplay=1&playsinline=1&rel=0';
    return '';
  }
  function videoThumb(url, fallback) {
    var m = /(?:youtu\.be\/|youtube\.com\/(?:shorts\/|watch\?v=|embed\/))([\w-]{6,})/.exec(url);
    return m ? 'https://i.ytimg.com/vi/' + m[1] + '/hqdefault.jpg' : fallback;
  }
  // 只有看到影片那格才載入播放器；離開那格或關掉視窗就停掉（把播放器拿掉）
  function plVideo() {
    Array.prototype.forEach.call(pl.querySelectorAll('.pl-video'), function (v) {
      var want = plMode === 'photo' && +v.getAttribute('data-k') === plAt && pl.classList.contains('open');
      var f = v.querySelector('iframe');
      if (want && !f) v.innerHTML = '<iframe src="' + v.getAttribute('data-src') + '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="影片"></iframe>';
      else if (!want && f) v.innerHTML = '<span class="pl-video-ph">▶</span>';
    });
  }
  // 現在看的是哪一格：'3d'、'photo'（第 plAt 張）、'size'
  var plMode = 'photo';
  function plMark() {
    plVideo();
    Array.prototype.forEach.call(pl.querySelectorAll('.pl-thumbs [data-i]'), function (b, i) { b.classList.toggle('on', plMode === 'photo' && i === plAt); });
    Array.prototype.forEach.call(pl.querySelectorAll('.pl-thumbs [data-v]'), function (b) { b.classList.toggle('on', plMode === b.getAttribute('data-v')); });
    // 左右箭頭照縮圖的順序走：3D → 照片 1、2… → 尺寸表
    var seq = plSeq(), k = plPos(seq);
    pl.querySelector('.prev').style.visibility = k > 0 ? '' : 'hidden';
    pl.querySelector('.next').style.visibility = k < seq.length - 1 ? '' : 'hidden';
  }
  function plSeq() {
    var q = []; if (cur3dSpec) q.push(['3d']);
    plImgs.forEach(function (_, i) { q.push(['photo', i]); });
    if (curP && curP.sizeHtml) q.push(['size']);
    return q;
  }
  function plPos(seq) { for (var k = 0; k < seq.length; k++) if (seq[k][0] === plMode && (plMode !== 'photo' || seq[k][1] === plAt)) return k; return 0; }
  function plStep(d) {
    var seq = plSeq(), k = plPos(seq) + d;
    if (k < 0 || k >= seq.length) return;
    plTab(seq[k][0], seq[k][1]);
  }
  function plGo(i) {
    plAt = Math.max(0, Math.min(plImgs.length - 1, i));
    var stage = pl.querySelector('.pl-stage');
    stage.scrollTo({ left: plAt * stage.clientWidth, behavior: 'smooth' });
    plMark();
  }
  function openProduct(id, at, tab) {
    var p = PRODUCTS.concat(STICKER_SETS).filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    if (p.open) return p.open(p);          // 自己有展示方式的商品（明信片牆）
    ensurePl();
    plImgs = [p.img].concat(p.more || []); plAt = 0;
    var vEmb = p.video ? videoEmbed(p.video) : '';
    if (vEmb) plImgs.push('video:' + p.video);                     // 影片當最後一張「圖」：往後滑到底就是影片
    pl.querySelector('.pl-stage').innerHTML = plImgs.map(function (s, i) {
      if (s.indexOf('video:') === 0) return '<div class="pl-slide"><div class="pl-video' + (/instagram/.test(vEmb) ? ' ig' : '') + '" data-k="' + i + '" data-src="' + vEmb + '"><span class="pl-video-ph">▶</span></div></div>';
      return '<div class="pl-slide"><img src="' + s + '" alt="' + esc(p.name) + '"></div>';
    }).join('');
    // 縮圖列：有 3D 的第一格是 3D（用模型的圖＋「3D」標），接著照片，T 恤最後一格是尺寸表
    var thumbs = (p.view3d ? '<button class="th3d" data-v="3d" aria-label="3D 預覽"><img src="' + (p.view3d.thumb || p.view3d.art) + '" alt=""><i>3D</i></button>' : '') +
      plImgs.map(function (s, i) {
        if (s.indexOf('video:') === 0) return '<button class="thvid" data-i="' + i + '" aria-label="影片"><img src="' + videoThumb(p.video, p.img.replace(/-l.webp$/, '-s.webp')) + '" alt=""><i>▶</i></button>';
        return '<button data-i="' + i + '" aria-label="第 ' + (i + 1) + ' 張"><img src="' + s.replace(/-l\.webp$/, '-s.webp') + '" alt=""></button>';
      }).join('') +
      (p.sizeHtml ? '<button class="thsize" data-v="size" aria-label="尺寸表"><span>尺寸</span></button>' : '');
    var cells = (p.view3d ? 1 : 0) + plImgs.length + (p.sizeHtml ? 1 : 0);
    pl.querySelector('.pl-thumbs').innerHTML = cells > 1 ? thumbs : '';
    pl.querySelector('h3').textContent = p.name;
    pl.querySelector('small').textContent = p.note || '';
    // 影片嵌不進來的（不是 IG／YouTube）才在購買區放一顆連結
    var links = (p.links || []).concat(p.video && !vEmb ? [{ label: '▶ 影片', href: p.video }] : []);
    pl.querySelector('.buybox').innerHTML = buyBox(p.name, p.price, { from: p.from, shopee: p.shopee, soldout: p.soldout, noShopee: p.noShopee, links: links, findName: p.findName,
      img: p.img ? p.img.replace(/-l\.webp$/, '-s.webp') : '' });
    pl.classList.add('open'); document.body.style.overflow = 'hidden';
    pl.querySelector('.pl-stage').scrollLeft = 0; plMark();
    cur3dSpec = p.view3d || null; curP = p;
    // 上方的頁籤拿掉了（他選的 A）：3D、照片、尺寸表都在下面同一排縮圖切換。photoFirst（T 恤）：點開先看照片
    var tabs = pl.querySelector('.pl-tabs'); tabs.hidden = true; tabs.innerHTML = '';
    pl.querySelector('.pl-size').innerHTML = p.sizeHtml || '';
    plTab(cur3dSpec && !p.photoFirst && !at ? '3d' : 'photo', 0, true);
    if (at) plTab('photo', Math.min(at, plImgs.length - 1), true);   // 點的是第幾張就直接從那張開始（不要捲動動畫）
    if (tab) plTab(tab);
  }
  var curP = null;
  // 切到某一格：v＝'3d'／'photo'（i＝第幾張）／'size'／'wear'（跳到實穿那張）
  function plTab(v, i, instant) {
    if (v === 'wear') { v = 'photo'; i = curP.wearAt; }
    if (v === '3d' && !cur3dSpec) v = 'photo';
    plMode = v;
    pl.querySelector('.pl-size').hidden = v !== 'size';
    show3d(v === '3d');
    if (v === 'photo') {
      if (instant) { plAt = i || 0; var st = pl.querySelector('.pl-stage'); st.scrollTo({ left: plAt * st.clientWidth, behavior: 'instant' }); plMark(); }
      else plGo(i || 0);
    } else plMark();
  }
  // 3D 預覽（杯墊、印章）：模型程式第一次用到才載入，同一個商品重開時沿用
  var cur3dSpec = null, cur3d = null, viewers3d = {};
  function show3d(on) {
    var box = pl.querySelector('.pl-3d');
    box.hidden = !on;
    if (!on || !cur3dSpec) return;
    var spec = cur3dSpec, key = spec.art;
    // hint 寫空字串＝不要提示字（轉盤吊飾，他說不用寫）；沒寫才用預設
    var hint = box.querySelector('.pl-3d-hint');
    hint.textContent = touchText(spec.hint == null ? '移動滑鼠轉動' : spec.hint); hint.hidden = !hint.textContent;
    // 多款式（印章 5 款）：下方一排款式鈕，切換時同一個 viewer 換圖
    var vars = box.querySelector('.pl-3d-vars');
    if (!vars) {
      vars = document.createElement('div'); vars.className = 'pl-3d-vars'; box.appendChild(vars);
      vars.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b || !cur3d || !cur3d.setArt) return;
        var v = cur3dSpec.variants[+b.dataset.k];
        cur3d.setArt(v.art, v.uv);
        Array.prototype.forEach.call(vars.children, function (x) { x.classList.toggle('on', x === b); });
      });
    }
    vars.hidden = !spec.variants;
    vars.innerHTML = (spec.variants || []).map(function (v, i) { return '<button data-k="' + i + '"' + (i ? '' : ' class="on"') + '>' + esc(v.name) + '</button>'; }).join('');
    if (spec.variants && viewers3d[key]) viewers3d[key].setArt(spec.art, spec.uv);     // 重開燈箱時回到第一款，跟按鈕一致
    function mount(v) { cur3d = v; var host = box.querySelector('.pl-3d-host'); if (!host) { host = document.createElement('div'); host.className = 'pl-3d-host'; box.insertBefore(host, box.firstChild); } v.mount(host); }
    if (viewers3d[key]) return mount(viewers3d[key]);
    import(CK_MOD(spec.module)).then(function (m) {
      viewers3d[key] = m.create(spec.art, spec.uv);
      if (cur3dSpec === spec && !box.hidden) mount(viewers3d[key]);
    });
  }
  function closePl() { pl.classList.remove('open'); document.body.style.overflow = ''; plVideo(); }

  window.CK = { STICKERS: STICKERS, PRODUCTS: PRODUCTS, STICKER_SETS: STICKER_SETS, isNew: isNew, esc: esc, setProducts: setProducts, priceText: priceText,
    money: money, footer: footer, header: header, hero: hero, hot: hot, buyRow: buyRow, product: product, tile: tile, tiles: tiles, open: open,
    SETS: SETS, setTiles: setTiles, openSet: openSet, buyBox: buyBox, stripify: stripify, wishBtn: function (w) { return wishBtn(wishItem(w.n, w.p, { wish: w })); } };
})();

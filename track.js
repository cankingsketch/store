/* 外連點擊追蹤（空罐王商店）
 *
 * 攔截全站所有「連到站外」的連結點擊，回報到 /api/track。
 * 設計原則：
 *   1. 絕不擋住使用者 —— 用 sendBeacon 非同步送出，整段包在 try/catch，
 *      追蹤壞掉時瀏覽器照常跳轉去購買頁。
 *   2. 不用逐一標記連結 —— 之後在後台新增商品貼上新的購買連結會自動被追蹤。
 *   3. 不放 cookie、不記錄任何可識別個人的資料。
 */
(function () {
  'use strict';
  if (!window.navigator || typeof document.addEventListener !== 'function') return;

  /* 通路歸類：比對網址主機名稱。找不到就用主網域當名字。 */
  var CHANNELS = [
    ['myship.7-11.com.tw', '賣貨便'],
    ['shopee.tw', '蝦皮'],
    ['gumroad.com', 'Gumroad'],
    ['hahow.in', 'Hahow'],
    ['store.line.me', 'LINE STORE'],
    ['devilcase.net', 'DEVILCASE'],
    ['pressplay.cc', 'PressPlay'],
    ['forms.gle', '訂購表單'],
    ['docs.google.com', '訂購表單'],
    ['youtube.com', 'YouTube'],
    ['youtu.be', 'YouTube'],
    ['instagram.com', 'Instagram'],
    ['facebook.com', 'Facebook'],
    ['threads.net', 'Threads'],
    ['linktr.ee', 'Linktree']
  ];

  /* 購買通路（要算「導購成效」的），其餘算社群/其他外連 */
  var SHOP = ['賣貨便', '蝦皮', 'Gumroad', 'Hahow', 'LINE STORE', 'DEVILCASE', 'PressPlay', '訂購表單'];

  function channelOf(host) {
    host = String(host || '').toLowerCase();
    for (var i = 0; i < CHANNELS.length; i++) {
      var d = CHANNELS[i][0];
      if (host === d || host.slice(-(d.length + 1)) === '.' + d) return CHANNELS[i][1];
    }
    var p = host.split('.');
    return p.length > 2 ? p.slice(-2).join('.') : host;
  }

  /* 這個連結是在賣什麼？往前找最近的商品標題，找不到就用連結自己的文字 */
  function labelFor(a) {
    var node = a;
    for (var hop = 0; hop < 12 && node; hop++) {
      var sib = node.previousElementSibling;
      while (sib) {
        if (/^H[1-4]$/.test(sib.tagName)) {
          var t = (sib.textContent || '').replace(/\s+/g, ' ').trim();
          if (t) return t.slice(0, 80);
        }
        sib = sib.previousElementSibling;
      }
      node = node.parentElement;
    }
    var own = (a.textContent || '').replace(/\s+/g, ' ').trim();
    if (own) return own.slice(0, 80);
    var img = a.querySelector && a.querySelector('img');
    return img && img.alt ? String(img.alt).slice(0, 80) : '';
  }

  function send(payload) {
    var body = JSON.stringify(payload);
    // sendBeacon 由瀏覽器在背景送出，就算頁面馬上跳走也會送達
    if (navigator.sendBeacon && navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))) return;
    // 舊瀏覽器退路；keepalive 讓請求在頁面卸載後仍能完成
    if (window.fetch) {
      fetch('/api/track', {
        method: 'POST', body: body, keepalive: true,
        headers: { 'content-type': 'application/json' }
      }).catch(function () {});
    }
  }

  document.addEventListener('click', function (e) {
    try {
      if (e.defaultPrevented || e.button !== 0) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;

      var u;
      try { u = new URL(a.href, location.href); } catch (err) { return; }
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return;

      // 只記站外連結；自己的子網域（pos/ar/planner）不算導流出去
      var h = u.hostname.toLowerCase();
      var own = 'cankingstore.com';
      if (h === location.hostname.toLowerCase() || h === own || h.slice(-(own.length + 1)) === '.' + own) return;

      var ch = channelOf(h);
      send({
        channel: ch,
        kind: SHOP.indexOf(ch) >= 0 ? 'shop' : 'other',
        url: u.href.slice(0, 300),
        label: labelFor(a),
        page: (location.pathname + location.search).slice(0, 200)
      });
    } catch (err) {
      /* 追蹤失敗絕不影響跳轉 */
    }
  }, true);
})();

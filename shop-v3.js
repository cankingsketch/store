// 商店頁樣品共用：頁首選單兩側放附屬看板的兩隻（購物空罐妹妹、購物罐罐）。
// 在頁面把頁首畫好之後呼叫 CK_SHOP.chars()
window.CK_SHOP = {
  // 選單每一項都連到 v3 樣品（T 恤分頁先隱藏）；各頁 CK.header(…, CK_SHOP.LINKS)
  LINKS: { '課程': 'lessons.html', '周邊': 'goods.html', '貼紙': 'stickers.html', '畫冊': '3005920874.html', 'T恤': false,
    '聯名手機殼': '3287921517251632723127580.html', '數位賣場': 'illusts.html', '客製化商品': '2345835069212702183021697.html', '實體店寄售': 'events-883299.html' },
  IMG: 'images/',

  // 瘦身過的圖（optimize_images.py 產的 img/opt/）：s＝卡片小圖（寬 600）、l＝點開大圖（長邊 1400）；
  // 吉祥物 GIF → 動態 WebP；Gumroad 縮圖 → gr-<id>-s.webp。原圖很多是 1～2MB 的 PNG，手機太慢（他要的）
  opt: function (src, size) {
    var g = /public-files\.gumroad\.com\/(\w+)/.exec(src);
    if (g) return 'img/opt/gr-' + g[1] + '-s.webp';
    var m = /([\w\-]+)\.(png|jpe?g|gif)(\?.*)?$/i.exec(src);
    if (!m) return src;
    return 'img/opt/' + m[1] + (/gif/i.test(m[2]) ? '' : '-' + (size || 's')) + '.webp';
  },
  // 小圖載不到（例如 Gumroad 新上架、還沒做小圖的）就退回原圖
  fallback: function (src) { return ' onerror="this.onerror=null;this.src=\'' + src + '\'"'; },

  // 區塊標題：粗體中文＋小英文
  // 活動清單：要先載 events-live.js（指揮部推送）和 events-data.js（手動維護的歷史活動）。
  // 指揮部那份優先；手動那份同一天結束的視為同一場（名稱寫法可能不同，例如「臺灣文博會」／「文博會」）
  // 回傳 { up: 預定（近的在前）, past: 過往（新的在前） }，每筆多一個 p＝[年, 開始 12/24, 結束 12/27 或 '']
  events: function () {
    var live = window.CANKING_EVENTS_LIVE || [], seen = {};
    live.forEach(function (e) { seen[e.end] = 1; });
    var all = live.concat((window.CANKING_EVENTS || []).filter(function (e) { return !seen[e.end]; }));
    var t = new Date(), today = t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
    // 「2026/12/24~27」→ [2026, 12/24, 12/27]
    function parts(e) {
      var m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s*[~～-]\s*(.+))?$/.exec(String(e.date).trim());
      if (!m) return [e.end.slice(0, 4), e.date, ''];
      var to = m[4] ? (m[4].indexOf('/') < 0 ? m[2] + '/' + m[4] : m[4]) : '';
      return [m[1], m[2] + '/' + m[3], to];
    }
    all = all.map(function (e) { return { date: e.date, end: e.end, name: e.name, booth: e.booth, p: parts(e) }; });
    return {
      up: all.filter(function (e) { return e.end >= today; }).sort(function (a, b) { return a.end < b.end ? -1 : 1; }),
      past: all.filter(function (e) { return e.end < today; }).sort(function (a, b) { return a.end < b.end ? 1 : -1; })
    };
  },
  head: function (zh, en) { return '<div class="v3-head"><h2>' + zh + '</h2><p class="en">' + en + '</p></div>'; },

  // 整頁：頁首（active 那項反灰）＋一條條帶子＋頁尾；最後一條是直條紋時，頁尾半圓也用直條紋蓋
  page: function (active, bands) {
    document.getElementById('app').innerHTML = CK.header(active, ['貼紙'], CK_SHOP.LINKS) + '<main class="page bands">' + bands.join('') + '</main>' + CK.footer();
    CK_SHOP.chars();
    if (/b-stripe/.test(bands[bands.length - 1].slice(0, 80))) document.querySelector('.site-foot').classList.add('cap-stripe');
  },

  // 放大看圖：o = { imgs:[…], nm, sub, btns:[[字, 連結, 副鈕?]…] }；點背景、×、Esc 關掉，左右鍵換圖
  lightbox: function (o, start) {
    var i = start || 0, lb = document.createElement('div');
    lb.className = 'v3-lb';
    lb.innerHTML = '<div class="box"><button class="x" aria-label="關閉">×</button><img class="big" alt="">' +
      (o.imgs.length > 1 ? '<div class="thumbs">' + o.imgs.map(function (s) { return '<img src="' + s + '" alt="">'; }).join('') + '</div>' : '') +
      (o.nm ? '<p class="nm">' + o.nm + '</p>' : '') + (o.sub ? '<p class="sub">' + o.sub + '</p>' : '') +
      (o.btns && o.btns.length ? '<div class="v3-btns">' + o.btns.map(function (b) {
        return '<a class="v3-btn' + (b[2] ? ' sub' : '') + '" href="' + b[1] + '"' + (o.nm ? ' data-track-label="' + CK.esc(o.nm) + '"' : '') + (/^https?:/.test(b[1]) ? ' target="_blank" rel="noopener"' : '') + '>' + b[0] + '</a>';
      }).join('') + '</div>' : '') + '</div>';
    var big = lb.querySelector('.big'), th = lb.querySelectorAll('.thumbs img');
    function show(n) {
      i = (n + o.imgs.length) % o.imgs.length; big.src = o.imgs[i];
      Array.prototype.forEach.call(th, function (t, k) { t.classList.toggle('on', k === i); });
    }
    Array.prototype.forEach.call(th, function (t, k) { t.addEventListener('click', function () { show(k); }); });
    function close() { lb.remove(); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') show(i + 1); else if (e.key === 'ArrowLeft') show(i - 1); }
    lb.addEventListener('click', function (e) { if (CK_bgClick(lb, e) || e.target.classList.contains('x')) close(); });
    document.addEventListener('keydown', key);
    document.body.appendChild(lb); show(i);
  },

  // 螢幕寵物（他選的 A）：吉祥物扛著購物袋，在畫面最下緣一跳一跳地走來走去。
  // 動畫是 NAS「網站用動畫」那 6 拍原地跳（蓄力→離地→上升→頂點→下落→接地，140/80/110/130/80/100ms），
  // 壓成一張 6 格的 sprite（img/shop-pet3.webp）。只有離地那幾拍往前移，看起來才是「跳著走」而不是滑。
  // 碰到邊緣轉身；永遠在跳、不會靜止（他要的）：停下來只是不往前，原地繼續跳，偶爾自己轉身；點它會跳高一點、冒一顆愛心。
  // 站在頁尾上緣（門楣花紋的半圓上），要捲到頁面最底才看得到（他要的）；不另外留跑道，擋到就擋到
  // 不擋點擊（只有牠自己能點）、在商品視窗後面；系統開了「減少動態效果」就不出現。
  pet: function () {
    if (document.querySelector('.shop-pet')) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var el = document.createElement('div'); el.className = 'shop-pet'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<i class="sp"></i>';
    var foot = document.querySelector('.site-foot') || document.body;
    foot.appendChild(el);
    var sp = el.firstChild;
    var DUR = [140, 80, 110, 130, 80, 100], AIR = [0, 0.3, 0.3, 0.25, 0.15, 0];   // 每一拍往前移多少（佔一跳步幅的比例）
    function room() { return foot.clientWidth || innerWidth; }
    var x = Math.random() * (room() - 120) + 20, dir = Math.random() < 0.5 ? -1 : 1;
    var frame = 0, t0 = performance.now(), mode = 'walk', left = 4 + Math.floor(Math.random() * 5);
    function w() { return el.offsetWidth || 93; }
    function step() { return w() * 0.42; }                        // 一跳往前大約身寬的四成
    function show() {
      sp.style.backgroundPositionX = (frame * 20) + '%';         // 6 格 → 0%、20%…100%
      el.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
      sp.style.transform = 'scaleX(' + (-dir) + ')';            // 原圖朝左，往右走時翻過來
    }
    function tick(now) {
      requestAnimationFrame(tick);
      if (document.hidden) { t0 = now; return; }
      if (now - t0 < DUR[frame]) return;
      t0 = now;
      if (mode === 'walk') {
        x += dir * step() * AIR[frame];
        var max = room() - w() - 6;
        if (x < 6) { x = 6; dir = 1; } else if (x > max) { x = max; dir = -1; }
      }
      frame++;
      if (frame >= 6) {
        frame = 0;
        // 走一陣子 → 原地跳一陣子（不往前，但一直跳）→ 有時轉身 → 再走
        if (--left <= 0) {
          if (mode === 'walk') { mode = 'stay'; left = 3 + Math.floor(Math.random() * 6); }
          else { mode = 'walk'; left = 4 + Math.floor(Math.random() * 8); if (Math.random() < 0.35) dir = -dir; }
        }
      }
      show();
    }
    el.addEventListener('click', function () {
      el.classList.remove('jump'); void el.offsetWidth; el.classList.add('jump');
      var h = document.createElement('b'); h.className = 'sp-heart'; h.textContent = '♥'; el.appendChild(h);
      setTimeout(function () { h.remove(); }, 900);
    });
    window.addEventListener('resize', function () { x = Math.min(x, room() - w() - 6); });
    show(); requestAnimationFrame(tick);
  },

  chars: function () {
    var h = document.querySelector('.site-head');
    if (h && !h.querySelector('.hd-ch')) h.insertAdjacentHTML('beforeend', '<img class="hd-ch l" src="img/shop-girl.webp" alt=""><img class="hd-ch r" src="img/shop-can.webp" alt="">');
  },

  // 輪播：完全照ちいかわマーケット（他們用 Splide）實測的動法——
  // 停 3.5 秒讓人看清楚 → 跳一格，500ms、cubic-bezier(0, 1, .75, 1.1)：一開始幾乎瞬間移到九成，再慢慢煞車到位，最後微微超過一點點再回來。
  // 無限循環（內容排三份，跳出中間那份就無聲接回）；滑鼠移上去暫停；電腦按住拖、手機手指滑，放開用同一條曲線對齊到最近一張；拖過不算點擊。
  // wrap 裡要有 .mq > .mq-track（放好一份 .mq-card）和兩顆 .mq-arrow.prev / .next
  carousel: function (wrap) {
    var mq = wrap.querySelector('.mq'), track = wrap.querySelector('.mq-track');
    var N = track.children.length, EASE = 'transform 500ms cubic-bezier(0, 1, .75, 1.1)', HOLD = 3500;
    track.innerHTML = track.innerHTML + track.innerHTML + track.innerHTML;
    var idx = N, down = null, moved = false, hover = false, lastTouch = performance.now();
    // 圓點（手機才顯示）：現在是第幾張
    var dots = document.createElement('div'); dots.className = 'mq-dots' + (N > 10 ? ' many' : '');   // 太多張（首頁周邊 18 張）就不放圓點
    dots.innerHTML = new Array(N + 1).join('<i></i>');
    wrap.appendChild(dots);
    var cards = track.children;
    // 第 j 張到定位時 track 要移到哪：照每一張實際的位置算（.mq.fit 的卡片寬度不一樣，不能用「張數 × 寬度」）。
    // 手機一次只看得到一張大的：那張置中，左右各露出一點點上一張／下一張；電腦靠左對齊
    function pos(j) {
      var c = cards[j], x = c.offsetLeft - cards[0].offsetLeft;
      return (matchMedia('(max-width:760px)').matches ? (mq.clientWidth - c.offsetWidth) / 2 : 0) - x;
    }
    // 拖到 t 放開時，離哪一張的定位最近
    function nearest(t) {
      var best = idx, d = Infinity;
      for (var j = 0; j < cards.length; j++) { var e = Math.abs(pos(j) - t); if (e < d) { d = e; best = j; } }
      return best;
    }
    // 卡片寬度跟著圖（.mq.fit）：圖載完寬度才確定，載完重新對位
    Array.prototype.forEach.call(track.querySelectorAll('img'), function (im) {
      if (!im.complete) im.addEventListener('load', function () { if (!down && !mq.classList.contains('dragging')) go(idx, false); });
    });
    // 內容排了三份，idx 平常在中間那份（N～2N-1），動畫跑完（transitionend）再無聲接回中間。
    // 但動畫沒跑完就不會有 transitionend（分頁在背景、連按好幾下「下一張」），idx 會一路加到超過三份，
    // 找不到卡片就整條輪播卡死、每 3.5 秒報錯一次（2026-10-03 發現）。所以每次要動之前先把 idx 拉回中間那份
    function mid(j) { return ((j % N) + N) % N + N; }
    function go(i, anim) {
      if (anim && (idx < N || idx >= 2 * N)) {
        var m = mid(idx); i += m - idx; idx = m;
        track.style.transition = 'none'; track.style.transform = 'translateX(' + pos(idx) + 'px)';
        void track.offsetWidth;                   // 先無聲跳到中間那份，再從那裡開始動畫
      }
      idx = Math.max(0, Math.min(3 * N - 1, i));
      track.style.transition = anim ? EASE : 'none';
      track.style.transform = 'translateX(' + pos(idx) + 'px)';
      var k = ((idx % N) + N) % N;
      Array.prototype.forEach.call(dots.children, function (d, j) { d.classList.toggle('on', j === k); });
    }
    track.addEventListener('transitionend', function () {
      if (idx >= 2 * N || idx < N) go(mid(idx), false);
    });
    function poke() { lastTouch = performance.now(); }
    wrap.querySelector('.mq-arrow.prev').addEventListener('click', function () { poke(); go(idx - 1, true); });
    wrap.querySelector('.mq-arrow.next').addEventListener('click', function () { poke(); go(idx + 1, true); });
    setInterval(function () {
      if (hover || down || document.hidden || performance.now() - lastTouch < HOLD) return;
      go(idx + 1, true);
    }, HOLD);
    mq.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hover = true; });
    mq.addEventListener('pointerleave', function () { hover = false; });
    mq.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') return;        // 手指交給下面的觸控事件
      moved = false; poke();
      down = { x: e.clientX, base: pos(idx), id: e.pointerId, from: idx };
    });
    window.addEventListener('pointermove', function (e) {
      if (!down || e.pointerId !== down.id) return;
      var dx = e.clientX - down.x;
      if (Math.abs(dx) > 5) { moved = true; mq.classList.add('dragging'); }
      if (moved) { track.style.transition = 'none'; track.style.transform = 'translateX(' + (down.base + dx) + 'px)'; }
    });
    function up(e) {
      if (!down || (e.pointerId != null && e.pointerId !== down.id)) return;
      var dx = (e.clientX || down.x) - down.x;
      if (moved) {
        mq.classList.remove('dragging');
        // 放開時對齊最近的一張；但只要往左／右滑超過一小段（30px）就算要換張——
        // 手機上一張卡有 280px 寬，原本要拖過半張才會換，輕輕一撥都會彈回原位（他反映的）
        var to = nearest(down.base + dx);
        if (to === down.from && Math.abs(dx) > 30) to = down.from + (dx < 0 ? 1 : -1);
        go(to, true);
      }
      down = null; poke();
    }
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    // 手指：用觸控事件自己處理（他反映快速一撥常常抓不到、要壓久一點）。
    // 原本用 pointer 事件，手指滑得快時瀏覽器會判定成捲動頁面、中途送 pointercancel，拖曳就斷掉。
    // 這裡一開始動就判斷方向：偏左右 → 輪播接手、擋掉頁面捲動；偏上下 → 讓頁面捲。
    // 放開時：滑超過 30px，或 0.3 秒內快速一撥超過 12px，就換一張
    var tch = null;
    mq.addEventListener('touchstart', function (e) {
      var t = e.touches[0]; moved = false; poke();
      tch = { x: t.clientX, y: t.clientY, lx: t.clientX, t: performance.now(), base: pos(idx), from: idx, dir: '' };
    }, { passive: true });
    mq.addEventListener('touchmove', function (e) {
      if (!tch) return;
      var t = e.touches[0], dx = t.clientX - tch.x, dy = t.clientY - tch.y;
      if (!tch.dir) { if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return; tch.dir = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'; }
      if (tch.dir !== 'h') return;
      e.preventDefault();
      moved = true; mq.classList.add('dragging'); tch.lx = t.clientX;
      track.style.transition = 'none'; track.style.transform = 'translateX(' + (tch.base + dx) + 'px)';
    }, { passive: false });
    function tend(e) {
      if (!tch) return;
      if (tch.dir === 'h') {
        var c = e.changedTouches && e.changedTouches[0], dx = (c ? c.clientX : tch.lx) - tch.x, quick = performance.now() - tch.t < 300;
        mq.classList.remove('dragging');
        var to = nearest(tch.base + dx);
        if (to === tch.from && (Math.abs(dx) > 30 || (quick && Math.abs(dx) > 12))) to = tch.from + (dx < 0 ? 1 : -1);
        go(to, true);
      }
      tch = null; poke();
    }
    mq.addEventListener('touchend', tend); mq.addEventListener('touchcancel', tend);
    mq.addEventListener('click', function (e) { if (moved) { moved = false; e.stopPropagation(); e.preventDefault(); } }, true);
    window.addEventListener('resize', function () { go(idx, false); });
    go(N, false);
  }
};

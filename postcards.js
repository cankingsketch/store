// 明信片牆：周邊頁「明信片組合」點開就是這面牆（不是一般的商品燈箱）。要在 shared.js 之後載入。
// 每一款一張小卡釘在牆上，點了放大，可以翻到背面（直的、橫的各一種背面）。
// 圖：build_postcards.py 從 NAS「明信片\10x15cm\双面 直／双面 横」裁掉出血做的（designs/img/post/）。
// 二創明信片（2026-10-03 加）：「明信片\10x15cm\单面」的 A1～A12，單面，所以點了只放大、不翻面。
// 兩組各自一面牆、各自一條，程式共用：make(清單, 設定) 做出一組。
(function () {
  var P = 'img/post/';
  // [編號, 名稱, 橫?]，照編號排。牆上不標售完、不分新舊（他在賣貨便上自己調整）
  var CARDS = [
    [1, '手繪女僕'], [2, '手繪二姊'], [3, '封面女僕'], [4, '睡覺罐妹'], [5, '吃冰棒'], [6, '吃西瓜'], [7, '大姊吃拉麵'], [8, '大哥吃拉麵'],
    [9, '南瓜'], [10, '水手服'], [11, '動畫機'], [12, '情人節'], [13, '捧花'], [14, '馬尾女孩'], [15, '橘子蘇打'], [16, '龍年'], [17, '盔甲'],
    [18, '騎機車', 1], [19, '黃花', 1], [20, '黑絲OL'], [21, '小魔女'], [22, '月餅罐罐'], [23, '白花罐罐'], [24, '街頭風罐罐'], [25, '泳裝罐罐'],
    [26, '草莓吐司'], [27, '大姊沙發', 1], [28, '封面泳裝', 1], [29, '帝雉'], [31, '破防拉麵']
  ];
  // 賣得比較好的排最前面（他 2026-10-02 圈的），其他照編號
  var TOP = [9, 10, 13, 15, 16, 24, 26, 18, 19];
  CARDS.sort(function (a, b) {
    var x = TOP.indexOf(a[0]), y = TOP.indexOf(b[0]);
    return (x < 0 ? 99 : x) - (y < 0 ? 99 : y) || a[0] - b[0];
  });
  // 春聯也放進原創明信片牆（他要的，2026-10-04）：正方形、單面、自己的價格和賣貨便商品（不是明信片，所以不算在「N 款」裡）
  // 圖：NAS 商品照片「春節_春聯_效果圖.png」（燙金效果）→ img/post/cl-l／-s.webp
  CARDS.push(['cl', '龍會罐通燙金春聯', 'sq', { price: 50, single: 1, note: '15.2 × 15.2 cm・燙金・新年考生兩用' }]);
  // 二創（单面資料夾的 A 編號）：[編號, 角色名, 橫?]
  var FAN = [
    [1, '靜謐'], [2, '凜'], [3, '雙貞德', 1], [4, '虞美人', 1], [5, '黑貞'], [6, '小霞|寶可夢'],
    [7, '莉佳|寶可夢'], [8, '娜姿|寶可夢'], [9, '戀雪|鬼滅之刃'], [10, '林克|薩爾達傳說'], [11, '露西|電馭叛客'], [12, 'D.VA|鬥陣特工']
  ];

  // 賣貨便「空罐原創明信片」沒有的款（2026-10-04 對過；有上架了就從這裡拿掉）
  var NOT_ON_MYSHIP = ['月餅罐罐', '白花罐罐', '街頭風罐罐', '泳裝罐罐', '草莓吐司', '大姊沙發', '封面泳裝', '帝雉', '破防拉麵'];
  // 二創裡 FGO 這 5 張：賣貨便是包成「FGO明信片組|共5張」（NT$200），沒有單張
  var FGO = ['靜謐', '凜', '雙貞德', '虞美人', '黑貞'];
  // O：pre＝圖檔開頭（p／a）、single＝單面（不翻）、buyName＝賣貨便上找的名字、more＝牆最下面的一行小字
  function make(CARDS, O) {
  var list = CARDS.map(function (c, i) {
    var id = typeof c[0] === 'string' ? c[0] : O.pre + (c[0] < 10 ? '0' : '') + c[0];
    return { no: c[0], name: c[1], wide: c[2] === 1, sq: c[2] === 'sq', x: c[3] || null, s: P + id + '-s.webp', l: P + id + '-l.webp', rot: ((i * 37) % 9 - 4) * 0.6 };
  });
  var pw, at = -1, prod = null;
  function esc(s) { return CK.esc(s); }
  function cls(c) { return c.wide ? ' wide' : c.sq ? ' sq' : ''; }
  function ensure() {
    if (pw) return;
    pw = document.createElement('div'); pw.className = 'lb pw';
    pw.innerHTML = '<div class="lb-panel" role="dialog" aria-modal="true" aria-label="明信片牆"><button class="lb-x" aria-label="關閉">✕</button>' +
      '<div class="pw-wall"></div>' +
      '<div class="pw-zoom" hidden><button class="pw-back">← 回到明信片牆</button><button class="lb-arrow prev" aria-label="上一張">‹</button><button class="lb-arrow next" aria-label="下一張">›</button>' +
      '<div class="pw-card"><div class="pw-flip"><img class="f" alt=""><img class="b" alt=""></div></div>' +
      '<div class="pw-cap"><b></b></div></div>' +
      '<div class="lb-strip pw-strip"></div>' +           // 放大時下面一排全部明信片的縮圖，直接點想看的那張（跟貼紙預覽一樣）
      '<div class="lb-foot"><div><h3></h3><small></small></div><div class="buybox"></div></div></div>';
    document.body.appendChild(pw);
    CK.stripify(pw.querySelector('.pw-strip'));
    pw.addEventListener('click', function (e) {
      if (CK_bgClick(pw, e) || e.target.closest('.lb-x')) return close();
      var c = e.target.closest('[data-pc]');
      if (c) return zoom(+c.dataset.pc);
      var k = e.target.closest('[data-pk]');
      if (k) return zoom(+k.dataset.pk);
      if (e.target.closest('.pw-back')) return zoom(-1);
      if (e.target.closest('.prev')) return slide(-1);
      if (e.target.closest('.next')) return slide(1);
      // 點卡片本身就翻面（不放按鈕，照ちいかわ的少字原則）；剛剛是滑動換張的那一下不算點
      if (e.target.closest('.pw-card')) { if (Date.now() - swipedAt < 450) return; return turn(); }
    });
    // 放大的那張跟著游標微微傾斜
    pw.querySelector('.pw-zoom').addEventListener('pointermove', function (e) {
      var r = this.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      this.style.setProperty('--tx', (x * 16).toFixed(1) + 'deg'); this.style.setProperty('--ty', (-y * 12).toFixed(1) + 'deg');
    });
    document.addEventListener('keydown', function (e) {
      if (!pw.classList.contains('open')) return;
      if (e.key === 'Escape') { if (at >= 0) zoom(-1); else close(); }
      else if (at >= 0 && e.key === 'ArrowLeft') slide(-1);
      else if (at >= 0 && e.key === 'ArrowRight') slide(1);
    });

    // 手機：放大的明信片可以左右滑換上一張／下一張（他要的；原本只能點了翻面）。
    // 一開始動就判方向：偏左右 → 卡片跟著手指走、擋掉頁面捲動；偏上下 → 不管。
    // 放開時滑超過 40px，或 0.3 秒內快速一撥超過 15px，就換張；不夠就彈回原位。輕點還是翻面
    var z = pw.querySelector('.pw-zoom'), tch = null;
    z.style.touchAction = 'pan-y';
    z.addEventListener('touchstart', function (e) {
      if (at < 0 || e.touches.length !== 1) return;
      var t = e.touches[0];
      tch = { x: t.clientX, y: t.clientY, t: performance.now(), dir: '', dx: 0 };
    }, { passive: true });
    z.addEventListener('touchmove', function (e) {
      if (!tch) return;
      var t = e.touches[0], dx = t.clientX - tch.x, dy = t.clientY - tch.y;
      if (!tch.dir) { if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return; tch.dir = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'; }
      if (tch.dir !== 'h') return;
      e.preventDefault();
      tch.dx = dx;
      var card = pw.querySelector('.pw-card');
      card.style.transition = 'none'; card.style.translate = dx + 'px 0';
    }, { passive: false });
    function tend() {
      if (!tch) return;
      var t = tch; tch = null;
      if (t.dir !== 'h') return;
      swipedAt = Date.now();
      var quick = performance.now() - t.t < 300;
      if (Math.abs(t.dx) > 40 || (quick && Math.abs(t.dx) > 15)) return slide(t.dx < 0 ? 1 : -1, t.dx);
      var card = pw.querySelector('.pw-card');               // 不夠遠：彈回原位
      card.style.transition = 'translate .2s ease-out'; card.style.translate = '0 0';
      setTimeout(function () { card.style.transition = ''; }, 220);
    }
    z.addEventListener('touchend', tend); z.addEventListener('touchcancel', tend);
  }
  // 換張的動畫：目前這張往滑的方向滑出去、淡掉，下一張從另一邊滑進來（滑動、左右箭頭、鍵盤共用）
  var swipedAt = 0, sliding = false;
  function slide(dir) {
    if (sliding || at < 0) return;
    sliding = true;
    var card = pw.querySelector('.pw-card');
    card.style.transition = 'translate .18s ease-in, opacity .18s ease-in';
    card.style.translate = (-dir * 70) + '% 0'; card.style.opacity = '0';
    setTimeout(function () {
      zoom((at + dir + list.length) % list.length);
      card.style.transition = 'none'; card.style.translate = (dir * 45) + '% 0';
      void card.offsetWidth;                                  // 讓瀏覽器先畫出起點，再滑進來
      card.style.transition = 'translate .26s cubic-bezier(.2,.8,.2,1), opacity .26s ease-out';
      card.style.translate = '0 0'; card.style.opacity = '1';
      setTimeout(function () { card.style.transition = ''; sliding = false; }, 280);
    }, 180);
  }
  function wallHtml() {
    return '<div class="pw-row">' + list.map(function (c, i) {
      return '<button class="pc' + cls(c) + '" data-pc="' + i + '" style="--r:' + c.rot + 'deg" title="' + esc(c.name) + '">' +
        '<img src="' + c.s + '" alt="' + esc(c.name) + '" loading="lazy"></button>';
    }).join('') + '</div>' + (O.more ? '<p class="pw-more">' + O.more + '</p>' : '');
  }
  function zoom(i) {
    at = i;
    var z = pw.querySelector('.pw-zoom'), st = pw.querySelector('.pw-strip');
    z.hidden = i < 0; st.parentNode.hidden = i < 0;
    if (i < 0) return buy(null);
    var on = null;
    Array.prototype.forEach.call(st.querySelectorAll('[data-pk]'), function (b, k) { b.classList.toggle('on', k === i); if (k === i) on = b; });
    if (on) st.scrollTo({ left: on.offsetLeft - st.clientWidth / 2 + on.offsetWidth / 2, behavior: 'smooth' });
    var sw = st.parentNode; if (sw.edges) setTimeout(sw.edges, 400);
    var c = list[i], card = pw.querySelector('.pw-card');
    card.classList.toggle('wide', c.wide); card.classList.remove('flipped');
    card.querySelector('.f').src = c.l;
    card.classList.toggle('sq', c.sq);
    if (O.single || (c.x && c.x.single)) card.querySelector('.b').removeAttribute('src');      // 單面：沒有背面
    else card.querySelector('.b').src = P + (c.wide ? 'back-h.webp' : 'back-v.webp');
    pw.querySelector('.pw-cap b').textContent = c.name;
    buy(c);
  }
  // 購買區：放大某一張時「加到想買清單」記的是那一張
  function buy(c) {
    var w = !c ? null : FGO.indexOf(c.name) >= 0 ? { n: 'FGO明信片組', f: 'FGO明信片組|共5張', p: 200, img: c.s }
      : { v: c.name, sp: c.name, img: c.s, na: O.pre === 'p' && NOT_ON_MYSHIP.indexOf(c.name) >= 0 };
    if (c && c.x) w = { img: c.s };                          // 春聯：自己是一樣商品
    pw.querySelector('.lb-foot small').textContent = c && c.x ? (c.x.note || '') : '單張 NT$44・10 × 15 cm';
    pw.querySelector('.buybox').innerHTML = c && c.x ? CK.buyBox(c.name, c.x.price, { wish: w })
      : CK.buyBox(O.buyName, prod.price, { from: !c, shopee: prod.shopee, wish: w });
  }
  function turn() {
    if (O.single || (list[at] && list[at].x && list[at].x.single)) return;   // 單面的點了不翻
    pw.querySelector('.pw-card').classList.toggle('flipped');
  }
  // 周邊頁的明信片列：一排小卡（點了直接放大那一張）
  function stripHtml() {
    return list.map(function (c, i) {
      return '<button class="pc' + cls(c) + '" data-pcs="' + i + '" style="--r:' + c.rot + 'deg" title="' + esc(c.name) + '">' +
        '<img src="' + c.s + '" alt="' + esc(c.name) + '" loading="lazy" draggable="false"></button>';
    }).join('');
  }
  function open(p, startAt) {
    ensure(); prod = p;
    pw.querySelector('.pw-wall').innerHTML = wallHtml();
    pw.querySelector('.pw-strip').innerHTML = list.map(function (c, i) {
      return '<button class="' + cls(c).trim() + '" data-pk="' + i + '" title="' + esc(c.name) + '"><img src="' + c.s + '" alt="' + esc(c.name) + '" loading="lazy"></button>';
    }).join('');
    pw.querySelector('.lb-foot h3').innerHTML = esc(p.name) + '<i class="tag setc">' + list.filter(function (c) { return !c.x; }).length + ' 款</i>';
    pw.querySelector('.lb-foot small').textContent ='單張 NT$44・10 × 15 cm';
    zoom(-1);
    pw.classList.add('open'); document.body.style.overflow = 'hidden';
    pw.querySelector('.pw-wall').scrollTop = 0;
    if (startAt != null) zoom(startAt);
  }
  function close() { pw.classList.remove('open'); document.body.style.overflow = ''; }
  return { open: open, list: list, stripHtml: stripHtml };
  }

  window.CK_POSTCARDS = make(CARDS, { pre: 'p', buyName: '空罐原創明信片', more: 'FGO 明信片組（5 張 NT$200）請到賣貨便看' });
  window.CK_FANCARDS = make(FAN, { pre: 'a', single: true, buyName: '空罐二創明信片' });
})();

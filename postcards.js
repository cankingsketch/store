// 明信片牆：周邊頁「明信片組合」點開就是這面牆（不是一般的商品燈箱）。要在 shared.js 之後載入。
// 每一款一張小卡釘在牆上，點了放大，可以翻到背面（直的、橫的各一種背面）。
// 圖：build_postcards.py 從 NAS「明信片\10x15cm\双面 直／双面 横」裁掉出血做的（designs/img/post/）。
(function () {
  var P = 'img/post/';
  // [編號, 名稱, 橫?]，照編號排。牆上不標售完、不分新舊（他在賣貨便上自己調整）
  var CARDS = [
    [1, '手繪女僕'], [2, '手繪二姊'], [3, '封面女僕'], [4, '睡覺罐妹'], [5, '吃冰棒'], [6, '吃西瓜'], [7, '大姊吃拉麵'], [8, '大哥吃拉麵'],
    [9, '南瓜'], [10, '水手服'], [11, '動畫機'], [12, '情人節'], [13, '捧花'], [14, '泥泥汝'], [15, '橘子蘇打'], [16, '龍年'], [17, '盔甲'],
    [18, '騎機車', 1], [19, '黃花', 1], [20, '黑絲OL'], [21, '小魔女'], [22, '月餅罐罐'], [23, '白花罐罐'], [24, '街頭風罐罐'], [25, '泳裝罐罐'],
    [26, '草莓吐司'], [27, '大姊沙發', 1], [28, '封面泳裝', 1], [29, '帝雉'], [31, '破防拉麵']
  ];
  // 賣得比較好的排最前面（他 2026-10-02 圈的），其他照編號
  var TOP = [9, 10, 13, 15, 16, 24, 26, 18, 19];
  CARDS.sort(function (a, b) {
    var x = TOP.indexOf(a[0]), y = TOP.indexOf(b[0]);
    return (x < 0 ? 99 : x) - (y < 0 ? 99 : y) || a[0] - b[0];
  });
  var list = CARDS.map(function (c, i) {
    var id = 'p' + (c[0] < 10 ? '0' : '') + c[0];
    return { no: c[0], name: c[1], wide: !!c[2], s: P + id + '-s.webp', l: P + id + '-l.webp', rot: ((i * 37) % 9 - 4) * 0.6 };
  });
  var pw, at = -1, prod = null;
  function esc(s) { return CK.esc(s); }
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
      if (e.target.closest('.prev')) return zoom((at - 1 + list.length) % list.length);
      if (e.target.closest('.next')) return zoom((at + 1) % list.length);
      if (e.target.closest('.pw-card')) return turn();          // 點卡片本身就翻面（不放按鈕，照ちいかわ的少字原則）
    });
    // 放大的那張跟著游標微微傾斜
    pw.querySelector('.pw-zoom').addEventListener('pointermove', function (e) {
      var r = this.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      this.style.setProperty('--tx', (x * 16).toFixed(1) + 'deg'); this.style.setProperty('--ty', (-y * 12).toFixed(1) + 'deg');
    });
    document.addEventListener('keydown', function (e) {
      if (!pw.classList.contains('open')) return;
      if (e.key === 'Escape') { if (at >= 0) zoom(-1); else close(); }
      else if (at >= 0 && e.key === 'ArrowLeft') zoom((at - 1 + list.length) % list.length);
      else if (at >= 0 && e.key === 'ArrowRight') zoom((at + 1) % list.length);
    });
  }
  function wallHtml() {
    return '<div class="pw-row">' + list.map(function (c, i) {
      return '<button class="pc' + (c.wide ? ' wide' : '') + '" data-pc="' + i + '" style="--r:' + c.rot + 'deg" title="' + esc(c.name) + '">' +
        '<img src="' + c.s + '" alt="' + esc(c.name) + '" loading="lazy"></button>';
    }).join('') + '</div><p class="pw-more">另有二創明信片 7 款、FGO 明信片組（5 張 NT$200），請到賣貨便看</p>';
  }
  function zoom(i) {
    at = i;
    var z = pw.querySelector('.pw-zoom'), st = pw.querySelector('.pw-strip');
    z.hidden = i < 0; st.parentNode.hidden = i < 0;
    if (i < 0) return;
    var on = null;
    Array.prototype.forEach.call(st.querySelectorAll('[data-pk]'), function (b, k) { b.classList.toggle('on', k === i); if (k === i) on = b; });
    if (on) st.scrollTo({ left: on.offsetLeft - st.clientWidth / 2 + on.offsetWidth / 2, behavior: 'smooth' });
    var sw = st.parentNode; if (sw.edges) setTimeout(sw.edges, 400);
    var c = list[i], card = pw.querySelector('.pw-card');
    card.classList.toggle('wide', c.wide); card.classList.remove('flipped');
    card.querySelector('.f').src = c.l;
    card.querySelector('.b').src = P + (c.wide ? 'back-h.webp' : 'back-v.webp');
    pw.querySelector('.pw-cap b').textContent = c.name;
  }
  function turn() {
    pw.querySelector('.pw-card').classList.toggle('flipped');
  }
  // 周邊頁的明信片列：一排小卡（點了直接放大那一張）
  function stripHtml() {
    return list.map(function (c, i) {
      return '<button class="pc' + (c.wide ? ' wide' : '') + '" data-pcs="' + i + '" style="--r:' + c.rot + 'deg" title="' + esc(c.name) + '">' +
        '<img src="' + c.s + '" alt="' + esc(c.name) + '" loading="lazy" draggable="false"></button>';
    }).join('');
  }
  function open(p, startAt) {
    ensure(); prod = p;
    pw.querySelector('.pw-wall').innerHTML = wallHtml();
    pw.querySelector('.pw-strip').innerHTML = list.map(function (c, i) {
      return '<button class="' + (c.wide ? 'wide' : '') + '" data-pk="' + i + '" title="' + esc(c.name) + '"><img src="' + c.s + '" alt="' + esc(c.name) + '" loading="lazy"></button>';
    }).join('');
    pw.querySelector('.lb-foot h3').innerHTML = esc(p.name) + '<i class="tag setc">' + list.length + ' 款</i>';
    pw.querySelector('.lb-foot small').textContent ='單張 NT$44・10 × 15 cm';
    pw.querySelector('.buybox').innerHTML = CK.buyBox('空罐原創明信片', p.price, { from: 1, shopee: p.shopee });
    zoom(-1);
    pw.classList.add('open'); document.body.style.overflow = 'hidden';
    pw.querySelector('.pw-wall').scrollTop = 0;
    if (startAt != null) zoom(startAt);
  }
  function close() { pw.classList.remove('open'); document.body.style.overflow = ''; }
  window.CK_POSTCARDS = { open: open, list: list, stripHtml: stripHtml };
})();

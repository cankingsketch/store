// T 恤預覽：平面薄片（跟明信片翻面同一種做法），正面一張、背面一張疊在一起。
// 手指／滑鼠移動時微微傾斜，點一下翻到背面（再點翻回來）。shared.js 需要時才動態載入。
//
// 原本用 three.js 把前後兩片衣服「鼓起來」做出厚度，但 iPhone 上轉到側面時兩片的接縫會破圖（修了兩次都沒好），
// 而且要先下載 three.js、建 4 萬多點的網格，打開要等 2 秒。他決定改成平面（2026-10-03）：
// 不用 three.js、沒有接縫，打開幾乎立刻顯示。衣服照片本身就有皺褶明暗，傾斜角度小就看不出是平的。
// 介面跟其他 3D 模組一樣：create(正面圖, 背面圖) → { mount(host), pointer(x, y) }

const TILT_Y = 12, TILT_X = 6;   // 跟著手指／滑鼠傾斜的最大角度（度）

let styled = false;
function addStyle() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent =
    '.teeflat{position:absolute;inset:0;perspective:1400px;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:none}' +   // 手指拖＝傾斜衣服，不捲動整頁
    '.teeflat .tf-card{position:absolute;left:50%;top:50%;transform-style:preserve-3d;will-change:transform}' +
    '.teeflat img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;' +
      'backface-visibility:hidden;-webkit-backface-visibility:hidden;user-select:none;-webkit-user-drag:none;pointer-events:none;' +
      'filter:drop-shadow(0 10px 14px rgba(60,40,30,.18))}' +
    '.teeflat img.b{transform:rotateY(180deg)}';
  document.head.appendChild(st);
}

export function create(frontUrl, backUrl) {
  addStyle();
  const el = document.createElement('div'); el.className = 'teeflat';
  const card = document.createElement('div'); card.className = 'tf-card';
  const f = new Image(), b = new Image();
  f.className = 'f'; b.className = 'b'; f.alt = ''; b.alt = '';
  f.decoding = 'async'; b.decoding = 'async';
  f.src = frontUrl; b.src = backUrl;
  card.appendChild(f); card.appendChild(b); el.appendChild(card);

  let host = null, aspect = 2202 / 2400;          // 高／寬；圖載完用實際比例
  function layout() {
    if (!host) return;
    const w = host.clientWidth, h = host.clientHeight;
    // 衣服全寬約佔畫面寬的八成、高度不超過畫面的九成
    const cw = Math.min(w * 0.82, h * 0.9 / aspect), ch = cw * aspect;
    card.style.width = cw + 'px'; card.style.height = ch + 'px';
    card.style.marginLeft = (-cw / 2) + 'px'; card.style.marginTop = (-ch / 2 - h * 0.03) + 'px';   // 稍微偏上，下面留給提示字
  }
  f.addEventListener('load', () => { if (f.naturalWidth) aspect = f.naturalHeight / f.naturalWidth; layout(); });

  // 姿勢：傾斜跟著手指／滑鼠，翻面用彈簧追上目標（跟原本 3D 版的手感一樣）
  let tx = 0, ty = 0, rx = 0, ry = 0, flip = 0, flipNow = 0, raf = 0;
  el.addEventListener('click', () => { flip = flip ? 0 : 1; kick(); });
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame() {
    raf = 0;
    if (!el.isConnected) return;
    rx += (ty - rx) * 0.1; ry += (tx - ry) * 0.1; flipNow += (flip - flipNow) * 0.11;
    card.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + (ry + flipNow * 180).toFixed(2) + 'deg)';
    if (Math.abs(ty - rx) + Math.abs(tx - ry) + Math.abs(flip - flipNow) > 0.01) kick();
  }
  window.addEventListener('resize', layout);

  return {
    canvas: el,                                   // 舊介面的名字，有人拿來判斷就沿用
    mount(h) {
      host = h;
      if (el.parentNode !== h) { h.innerHTML = ''; h.appendChild(el); }
      flip = flipNow = 0; tx = ty = rx = ry = 0;  // 每次打開都從正面開始
      layout(); frame();
    },
    pointer(x, y) { tx = (x - 0.5) * 2 * TILT_Y; ty = -(y - 0.5) * 2 * TILT_X; kick(); }
  };
}

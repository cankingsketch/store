// 畫圖抉擇轉盤吊飾：可以玩的預覽（2026-10-03 他要的）。
// 實品是上下兩片壓克力夾住、中間一根轉軸，轉中間那片角色，看箭頭停在哪個選項。
// 這裡用平面圖層疊出來（跟 T 恤一樣不用 three.js）：底板 → 轉動的指針 → 上層壓克力的反光。
// 轉軸是黏在下面的，表面看不到（他說的），所以不畫鉚釘。
// 手指／滑鼠按住指針拖著轉，放開會帶慣性繼續轉；輕點一下就隨機甩一圈。
// 停下來不另外顯示結果（他說大家自己會看箭頭指到哪）。
// 素材由 tools/sticker-preview/build_spinner.py 產生，下面的轉軸位置是它量出來的。
// 介面跟其他 3D 模組一樣：create(底板圖, 指針圖) → { mount(host), pointer(x, y) }

const AXIS = [0.44, 0.4896];      // 轉軸在圖上的位置（寬、高的比例）
const ASPECT = 605 / 841;         // 圖的高／寬
const TILT_Y = 10, TILT_X = 7;    // 跟著游標傾斜的最大角度

let styled = false;
function addStyle() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent =
    '.charmspin{position:absolute;inset:0;perspective:1300px;touch-action:none;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}' +
    '.charmspin .cs-card{position:absolute;left:50%;top:50%;transform-style:preserve-3d;will-change:transform}' +
    '.charmspin img{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;-webkit-user-drag:none}' +
    '.charmspin .cs-base{filter:drop-shadow(0 12px 16px rgba(60,40,30,.22))}' +
    // 指針浮在底板上一點點（有厚度、傾斜時會跟底板錯開），影子打在底板上、方向不跟著轉
    '.charmspin .cs-ptr{position:absolute;inset:0;transform:translateZ(14px);filter:drop-shadow(3px 6px 4px rgba(30,20,10,.32))}' +
    '.charmspin .cs-ptr img{will-change:transform;cursor:grab}' +
    '.charmspin.drag .cs-ptr img{cursor:grabbing}' +
    // 上層壓克力：整片淡淡的反光，跟著傾斜移動
    '.charmspin .cs-glare{position:absolute;inset:1.5%;border-radius:4%;transform:translateZ(26px);pointer-events:none;mix-blend-mode:screen;' +
      'background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.28) 45%,rgba(255,255,255,.06) 55%,transparent 70%) no-repeat;background-size:250% 250%}';
  document.head.appendChild(st);
}

const norm = a => ((a % 360) + 540) % 360 - 180;          // 角度收到 -180～180

export function create(baseUrl, ptrUrl) {
  addStyle();
  const el = document.createElement('div'); el.className = 'charmspin';
  el.innerHTML = '<div class="cs-card"><img class="cs-base" alt=""><div class="cs-ptr"><img alt=""></div>' +
    '<div class="cs-glare"></div></div>';
  const card = el.querySelector('.cs-card'), glare = el.querySelector('.cs-glare');
  const ptr = el.querySelector('.cs-ptr img');
  el.querySelector('.cs-base').src = baseUrl; ptr.src = ptrUrl;
  ptr.style.transformOrigin = (AXIS[0] * 100) + '% ' + (AXIS[1] * 100) + '%';

  let host = null;
  function layout() {
    if (!host) return;
    const w = host.clientWidth, h = host.clientHeight;
    const cw = Math.min(w * 0.9, h * 0.9 / ASPECT), ch = cw * ASPECT;     // 上下都沒有字，置中就好
    card.style.width = cw + 'px'; card.style.height = ch + 'px';
    card.style.marginLeft = (-cw / 2) + 'px'; card.style.marginTop = (-ch / 2) + 'px';
  }
  window.addEventListener('resize', layout);

  // ---- 轉動：rot＝指針目前轉了幾度，vel＝每秒幾度 ----
  let rot = 0, vel = 0, drag = null, last = 0, raf = 0, spinning = false;
  let tx = 0, ty = 0, rx = 0, ry = 0;
  function center() {
    const r = card.getBoundingClientRect();
    return [r.left + r.width * AXIS[0], r.top + r.height * AXIS[1]];
  }
  const ang = (e, c) => Math.atan2(e.clientY - c[1], e.clientX - c[0]) * 180 / Math.PI;

  el.addEventListener('pointerdown', e => {
    if (e.button) return;
    const c = center();
    drag = { c, a: ang(e, c), x: e.clientX, y: e.clientY, t: performance.now(), moved: false, hist: [] };
    vel = 0; spinning = false;
    el.setPointerCapture(e.pointerId); el.classList.add('drag');
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) drag.moved = true;
    const a = ang(e, drag.c), d = norm(a - drag.a), now = performance.now();
    drag.a = a; rot += d;
    drag.hist.push([now, d]); while (drag.hist.length && now - drag.hist[0][0] > 90) drag.hist.shift();
    kick();
  });
  function up() {
    if (!drag) return;
    const d = drag; drag = null; el.classList.remove('drag');
    if (!d.moved) vel = (900 + Math.random() * 900) * (Math.random() < 0.5 ? -1 : 1);   // 輕點：隨機甩一圈
    else {                                                    // 拖曳放開：照最後 0.09 秒的速度繼續轉
      const sum = d.hist.reduce((s, h) => s + h[1], 0), span = d.hist.length > 1 ? d.hist[d.hist.length - 1][0] - d.hist[0][0] : 0;
      vel = span > 8 ? sum / span * 1000 : 0;
      vel = Math.max(-6000, Math.min(6000, vel));   // 最高速：原本 2600 他嫌不夠快，拉到 6000（每秒約 17 圈）
    }
    if (Math.abs(vel) < 40) vel = 0; else spinning = true;
    kick();
  }
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);

  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0;
    if (!el.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (spinning && !drag) {
      rot += vel * dt;
      // 摩擦：比例減速＋固定減速，快的時候掉得快、最後慢慢停
      const s = Math.sign(vel);
      vel -= vel * 0.9 * dt + s * 90 * dt;
      if (Math.sign(vel) !== s || Math.abs(vel) < 6) { vel = 0; spinning = false; }
    }
    rx += (ty - rx) * 0.1; ry += (tx - ry) * 0.1;
    ptr.style.transform = 'rotate(' + rot.toFixed(2) + 'deg)';
    card.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
    glare.style.backgroundPosition = (50 + ry * 4).toFixed(1) + '% ' + (50 - rx * 4).toFixed(1) + '%';
    if (spinning || drag || Math.abs(ty - rx) + Math.abs(tx - ry) > 0.01) kick();
  }

  return {
    canvas: el,
    mount(h) {
      host = h;
      if (el.parentNode !== h) { h.innerHTML = ''; h.appendChild(el); }
      tx = ty = rx = ry = 0;
      layout(); kick();
    },
    pointer(x, y) { if (drag) return; tx = (x - 0.5) * 2 * TILT_Y; ty = -(y - 0.5) * 2 * TILT_X; kick(); }
  };
}

// 畫圖抉擇轉盤吊飾：可以玩的預覽（2026-10-03 他要的；10-04 改用工廠檔，加上背面）。
// 實品是一片壓克力底板（正面畫板、背面「inkpad4」平板背面），嘴巴那裡一根轉軸，上面裝一片會轉的角色指針。
// 用平面圖層疊出來（跟 T 恤一樣不用 three.js）：底板正面／背面各一張，中間疊幾層剪影當壓克力厚度，指針浮在正面上。
//   ・按住角色拖：轉指針，放開帶慣性；輕點角色：隨機甩一圈
//   ・按住其他地方左右拖：整片跟著轉，放開停在正面或背面；輕點其他地方：翻面
// 轉軸是黏在下面的，表面看不到（他說的），所以不畫鉚釘；停下來也不顯示結果（他說大家自己會看）。
// 素材由 tools/sticker-preview/build_spinner.py 從 不畫畫_廠商用_50套.psd 產生，三張同一個框，下面的轉軸位置是它量出來的。
// 介面跟其他 3D 模組一樣：create(正面圖, 指針圖) → { mount(host), pointer(x, y) }；背面圖、剪影圖＝正面圖檔名的 -front 換成 -back／-edge
// 右上角「特效」開關（2026-10-04）：打開才載入 charm-fx.js（音效、跑燈、中獎演出），關著的時候完全不載；開關狀態記在這支手機

const AXIS = [0.4436, 0.4883];    // 轉軸在圖上的位置（寬、高的比例）
const ASPECT = 1021 / 1331;       // 圖的高／寬
const THICK = 10;                 // 壓克力厚度（px，畫面上）
const SLICES = 6;                 // 厚度用幾層剪影疊
const TILT_Y = 10, TILT_X = 7;    // 跟著游標傾斜的最大角度
const GRAB = 0.17;                // 離轉軸多近（佔圖寬的比例）算按到角色

let styled = false;
function addStyle() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent =
    '.charmspin{position:absolute;inset:0;perspective:1300px;touch-action:none;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;cursor:grab}' +
    '.charmspin.drag{cursor:grabbing}' +
    '.charmspin .cs-card{position:absolute;left:50%;top:50%;transform-style:preserve-3d;will-change:transform}' +
    '.charmspin img{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;-webkit-user-drag:none}' +
    // 哪一面看得到由程式切（frame() 裡看 turn）；不用 backface-visibility：Chrome 會把它跟厚度層的前後順序排錯
    '.charmspin .cs-face{position:absolute;inset:0}' +
    '.charmspin .cs-back{transform:rotateY(180deg) translateZ(' + (THICK / 2) + 'px)}' +
    '.charmspin .cs-front{transform:translateZ(' + (THICK / 2) + 'px)}' +
    // 厚度：底板剪影圖（charm-draw-edge）一層一層疊在正反面之間。不用 CSS mask：Chrome 會把有 mask 的層畫到背面上面
    // 指針浮在正面上一點點，影子打在底板上、方向不跟著轉；翻到背面時看不到
    '.charmspin .cs-ptr{position:absolute;inset:0;transform:translateZ(' + (THICK / 2 + 8) + 'px);filter:drop-shadow(3px 6px 4px rgba(30,20,10,.32))}' +
    '.charmspin .cs-ptr img{will-change:transform}' +
    '.charmspin .cs-fxbtn{position:absolute;right:12px;top:12px;z-index:5;border:1.5px solid #ddd;background:#fff;color:#777;border-radius:999px;' +
      'padding:5px 12px;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.04em;box-shadow:0 2px 6px rgba(0,0,0,.06)}' +
    '.charmspin .cs-fxbtn.on{background:#ffd23a;border-color:#f0a800;color:#7a4b00;box-shadow:0 0 10px rgba(255,190,0,.6)}' +
    // 上層壓克力：整片淡淡的反光，跟著傾斜移動
    '.charmspin .cs-glare{position:absolute;inset:1.5%;border-radius:4%;transform:translateZ(' + (THICK / 2 + 12) + 'px);pointer-events:none;mix-blend-mode:screen;' +
      'background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.28) 45%,rgba(255,255,255,.06) 55%,transparent 70%) no-repeat;background-size:250% 250%}';
  document.head.appendChild(st);
}

const norm = a => ((a % 360) + 540) % 360 - 180;          // 角度收到 -180～180

export function create(frontUrl, ptrUrl) {
  addStyle();
  const backUrl = frontUrl.replace('-front', '-back'), edgeUrl = frontUrl.replace('-front', '-edge');
  const el = document.createElement('div'); el.className = 'charmspin';
  let slices = '';
  for (let i = 0; i < SLICES; i++) {
    const z = -THICK / 2 + THICK * (i + 0.5) / SLICES;
    slices += '<img class="cs-slice" src="' + edgeUrl + '" alt="" style="transform:translateZ(' + z.toFixed(1) + 'px)">';
  }
  el.innerHTML = '<button class="cs-fxbtn" type="button">🔈 特效</button><div class="cs-card">' + slices +
    '<div class="cs-face cs-back"><img alt=""></div><div class="cs-face cs-front"><img alt=""></div>' +
    '<div class="cs-ptr"><img alt=""></div><div class="cs-glare"></div></div>';
  const card = el.querySelector('.cs-card'), glare = el.querySelector('.cs-glare');
  const frontSide = [el.querySelector('.cs-front'), el.querySelector('.cs-ptr'), glare], backSide = [el.querySelector('.cs-back')];
  let shownFront = null;
  const ptr = el.querySelector('.cs-ptr img');
  el.querySelector('.cs-front img').src = frontUrl;
  el.querySelector('.cs-back img').src = backUrl;
  ptr.src = ptrUrl;
  ptr.style.transformOrigin = (AXIS[0] * 100) + '% ' + (AXIS[1] * 100) + '%';

  // ---- 特效開關：打開才 import charm-fx.js（版本號照 CK_MOD，跟其他 3D 程式一樣） ----
  const fxBtn = el.querySelector('.cs-fxbtn');
  let fx = null, fxOn = false, fxLoading = null;
  const store = { get() { try { return localStorage.getItem('ck-charm-fx') === '1'; } catch (e) { return false; } },
    set(v) { try { localStorage.setItem('ck-charm-fx', v ? '1' : '0'); } catch (e) {} } };
  function setFx(on) {
    fxOn = on; store.set(on);
    fxBtn.classList.toggle('on', on); fxBtn.textContent = (on ? '🔊' : '🔈') + ' 特效';
    if (on && !fx && !fxLoading) {
      const url = window.CK_MOD ? window.CK_MOD('charm-fx.js') : './charm-fx.js';
      fxLoading = import(url).then(m => m.attach({ el, card, base: frontUrl.replace(/[^/]*$/, ''), thick: THICK }))
        .then(f => { fx = f; el.csFx = f; fx.show(fxOn); if (fxOn) fx.unlockAudio(); kick(); })   // el.csFx：除錯用
        .catch(() => { fxLoading = null; });
    }
    if (fx) { fx.show(on); if (on) fx.unlockAudio(); }
  }
  fxBtn.addEventListener('pointerdown', e => e.stopPropagation());   // 按開關不要變成拖曳
  fxBtn.addEventListener('click', () => setFx(!fxOn));

  let host = null;
  function layout() {
    if (!host) return;
    const w = host.clientWidth, h = host.clientHeight;
    const cw = Math.min(w * 0.88, h * 0.86 / ASPECT), ch = cw * ASPECT;   // 上下都沒有字，置中就好
    card.style.width = cw + 'px'; card.style.height = ch + 'px';
    card.style.marginLeft = (-cw / 2) + 'px'; card.style.marginTop = (-ch / 2) + 'px';
  }
  window.addEventListener('resize', layout);

  // ---- 狀態：rot／vel＝指針的角度和角速度；turn＝整片繞直軸轉了幾度（0＝正面、180＝背面），turnTo＝放開後要停在哪 ----
  let rot = 0, vel = 0, spinning = false;
  let turn = 0, turnTo = 0, turnVel = 0;
  let drag = null, last = 0, raf = 0;
  let tx = 0, ty = 0, rx = 0, ry = 0;
  const facingFront = () => Math.abs(norm(turn)) < 90;
  function center() {
    const r = card.getBoundingClientRect();
    return [r.left + r.width * AXIS[0], r.top + r.height * AXIS[1], r.width];
  }
  const ang = (e, c) => Math.atan2(e.clientY - c[1], e.clientX - c[0]) * 180 / Math.PI;

  el.addEventListener('pointerdown', e => {
    if (e.button) return;
    const c = center();
    // 正面朝外、而且按在轉軸附近（角色身上）→ 轉指針；其他 → 轉整片
    const onPtr = facingFront() && Math.hypot(e.clientX - c[0], e.clientY - c[1]) < c[2] * GRAB;
    drag = { mode: onPtr ? 'spin' : 'turn', c, a: ang(e, c), x: e.clientX, y: e.clientY, moved: false, hist: [], turn0: turn };
    if (onPtr) { vel = 0; spinning = false; }
    try { el.setPointerCapture(e.pointerId); } catch (err) {}   // 有些瀏覽器拿不到就算了，照樣能拖
    el.classList.add('drag');
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) drag.moved = true;
    const now = performance.now();
    if (drag.mode === 'spin') {
      const a = ang(e, drag.c), d = norm(a - drag.a);
      drag.a = a; rot += d;
      drag.hist.push([now, d]);
    } else {
      // 拖過整個卡片寬度＝轉半圈
      const t = drag.turn0 + (e.clientX - drag.x) / drag.c[2] * 180;
      drag.hist.push([now, t - turn]);
      turn = turnTo = t;
    }
    while (drag.hist.length && now - drag.hist[0][0] > 90) drag.hist.shift();
    kick();
  });
  function speed(d) {                                     // 最後 0.09 秒的速度（每秒幾度）
    const sum = d.hist.reduce((s, h) => s + h[1], 0), span = d.hist.length > 1 ? d.hist[d.hist.length - 1][0] - d.hist[0][0] : 0;
    return span > 8 ? sum / span * 1000 : 0;
  }
  function up() {
    if (!drag) return;
    const d = drag; drag = null; el.classList.remove('drag');
    if (d.mode === 'spin') {
      if (fx && fxOn) fx.unlockAudio();                    // iPhone：聲音要在使用者點的那一下開
      if (!d.moved) vel = (900 + Math.random() * 900) * (Math.random() < 0.5 ? -1 : 1);   // 輕點角色：隨機甩一圈
      else vel = Math.max(-6000, Math.min(6000, speed(d)));   // 最高速 6000（每秒約 17 圈，他嫌 2600 不夠快）
      if (Math.abs(vel) < 40) { vel = 0; if (fx && fxOn) fx.stop(rot); } else spinning = true;   // 拖完直接停住：當場開獎
    } else {
      // 輕點：翻面；拖：照放開時的方向和速度，停在最近的正面或背面
      if (!d.moved) turnTo = Math.round(turn / 180) * 180 + 180;
      else turnTo = Math.round((turn + speed(d) * 0.25) / 180) * 180;
    }
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
      if (Math.sign(vel) !== s || Math.abs(vel) < 6) { vel = 0; spinning = false; if (fx && fxOn) fx.stop(rot); }   // 停了：開獎
    }
    if (!drag) {                                         // 翻面：彈簧追上 turnTo
      turnVel += (turnTo - turn) * 140 * dt; turnVel *= Math.pow(0.0009, dt);
      turn += turnVel * dt;
      if (Math.abs(turnTo - turn) < 0.05 && Math.abs(turnVel) < 0.5) { turn = turnTo; turnVel = 0; }
    }
    rx += (ty - rx) * 0.1; ry += (tx - ry) * 0.1;
    const ff = facingFront();
    if (ff !== shownFront) {                             // 轉過 90 度：換一面
      shownFront = ff;
      frontSide.forEach(x => { x.style.visibility = ff ? '' : 'hidden'; });
      backSide.forEach(x => { x.style.visibility = ff ? 'hidden' : ''; });
    }
    ptr.style.transform = 'rotate(' + rot.toFixed(2) + 'deg)';
    if (fx && fxOn) {
      const dv = drag && drag.mode === 'spin' ? speed(drag) : vel;
      fx.frame({ rot, vel: dv, active: !!(drag && drag.mode === 'spin') || spinning, front: ff });
    }
    card.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + (ry + turn).toFixed(2) + 'deg)';
    glare.style.backgroundPosition = (50 + (ry + norm(turn) * 0.1) * 4).toFixed(1) + '% ' + (50 - rx * 4).toFixed(1) + '%';
    if (spinning || drag || turn !== turnTo || Math.abs(ty - rx) + Math.abs(tx - ry) > 0.01) kick();
  }

  return {
    canvas: el,
    mount(h) {
      host = h;
      if (el.parentNode !== h) { h.innerHTML = ''; h.appendChild(el); }
      tx = ty = rx = ry = 0; turn = turnTo = turnVel = 0;   // 每次打開都從正面開始
      layout(); kick();
      if (store.get() && !fxOn) setFx(true);              // 上次開著：這次也開（聲音要等第一次點轉盤才會響，iPhone 的規定）
    },
    pointer(x, y) { if (drag) return; tx = (x - 0.5) * 2 * TILT_Y; ty = -(y - 0.5) * 2 * TILT_X; kick(); }
  };
}

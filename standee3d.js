// 小立牌盲盒・通學路：可以轉著看的預覽（2026-10-04 他要的，先做妹妹這組）。
// 實品：一塊壓克力底座（斑馬線，上面挖 3～4 個插孔），每片小壓克力底下有插腳，插進不同的孔，所以前後錯開。
// 跟轉盤一樣用平面圖層疊出來、不用 three.js：底座平躺，每片照它插的孔立在對應的位置和深度；
// 厚度＝外形剪影一層一層疊（跟轉盤同一招），翻到背後看到的是鏡像的圖（實品雙面印，背面就是左右相反）。
//   ・左右拖：整組轉（放開帶慣性，可以轉一整圈）；上下拖：從比較高或比較低的角度看
// 素材由 tools/sticker-preview/build_standee.py 從工廠排版產生：每組一個資料夾，set.json 是尺寸和插孔（單位 mm）。
// 介面跟其他 3D 模組一樣：create(資料夾) → { mount(host), pointer(x, y), setArt(資料夾) }

const PIECE_T = 3;                // 小片壓克力厚度（mm）
const BASE_T = 3;                 // 底座厚度（mm；插腳高 2.9mm，跟底座一樣厚）
const MM_PER_SLICE = 0.45;        // 厚度每幾 mm 疊一層剪影
const TILT_MIN = 6, TILT_MAX = 42, TILT0 = 16, YAW0 = -24;   // 俯角範圍、一打開的角度

let styled = false;
function addStyle() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent =
    '.standee3d{position:absolute;inset:0;perspective:1500px;perspective-origin:50% 40%;touch-action:none;cursor:grab;' +
      '-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;overflow:hidden}' +
    '.standee3d.drag{cursor:grabbing}' +
    '.standee3d .sd-stage{position:absolute;left:50%;top:70%;width:0;height:0;transform-style:preserve-3d;will-change:transform}' +
    // 裡面每一張都是平的（transform-style 不能設 preserve-3d：Chrome 會把厚度那疊層畫到正面上面，整片變白白的）
    '.standee3d .sd-stage *{position:absolute;left:0;top:0;transform-origin:0 0}' +
    // max-width:none：全站的 img{max-width:100%} 會把圖縮成舞台的寬（舞台是 0 寬的原點），整片變不見
    '.standee3d img{display:block;max-width:none;max-height:none;pointer-events:none;-webkit-user-drag:none}' +
    // 底座的四面側邊（透明壓克力的切邊：亮一點、帶一點藍綠）
    '.standee3d .sd-wall{background:linear-gradient(rgba(240,247,250,.92),rgba(196,214,222,.8));box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}' +
    '.standee3d .sd-shadow{border-radius:50%;background:radial-gradient(closest-side,rgba(20,25,45,.35),rgba(20,25,45,0))}';
  document.head.appendChild(st);
}

const norm = a => ((a % 360) + 540) % 360 - 180;

export function create(dir) {
  addStyle();
  const el = document.createElement('div'); el.className = 'standee3d';
  const stage = document.createElement('div'); stage.className = 'sd-stage';
  el.appendChild(stage);

  let host = null, set = null, S = 4;                    // S＝每 mm 幾 px（照畫面大小算）
  let pieces = [];                                       // 每片：{ box（整片一張平的）, layers:[{el, d}]（d＝離片中線多深，正＝往前）, front, back }
  let walls = [];                                        // 底座四面側邊：[元素, 朝向角]，只顯示朝向觀眾的
  let base = '';

  function load(d) {
    base = d.replace(/\/?$/, '/');
    set = null;
    return fetch(base + 'set.json').then(r => r.json()).then(j => { set = j; build(); });
  }

  // 一張圖立在 (x, y, z)，寬 w、高 h（mm），可以再加旋轉
  const place = (node, x, y, z, w, h, extra) => {
    node.style.width = (w * S) + 'px'; node.style.height = (h * S) + 'px';
    node.style.transform = 'translate3d(' + (x * S).toFixed(2) + 'px,' + (y * S).toFixed(2) + 'px,' + (z * S).toFixed(2) + 'px)' + (extra || '');
    return node;
  };
  const img = (src, cls) => { const i = new Image(); i.src = src; i.alt = ''; if (cls) i.className = cls; i.decoding = 'async'; return i; };

  function build() {
    if (!set || !host) return;
    const W = host.clientWidth, H = host.clientHeight, b = set.base;
    const tallest = Math.max.apply(null, set.pieces.map(p => p.h));
    const diag = Math.hypot(b.w, b.d);
    // 轉一圈都要塞得下：寬看底座對角線，高看最高的那片＋底座往前斜的深度
    S = Math.min(W * 0.96 / diag, H * 0.9 / (tallest + b.d * 0.5));
    stage.innerHTML = ''; pieces = []; walls = [];
    const ox = -b.w / 2, oz = -b.d / 2;                  // 底座中心在原點

    // ---- 底座：平躺（rotateX 90 讓圖的往下＝往觀眾） ----
    stage.appendChild(place(img(base + 'base.webp'), ox, 0, oz, b.w, b.d, ' rotateX(90deg)'));
    // 厚度＝四面側邊（不用剪影往下疊：平躺的一疊層 Chrome 會排錯前後，蓋到底座上面）。
    // 角是圓的，側邊兩頭各縮一點，轉角不會凸出去
    const r = 2.6, wall = (x, z, w, rot, face) => {
      const d = place(Object.assign(document.createElement('div'), { className: 'sd-wall' }), x, 0, z, w, BASE_T, rot);
      stage.appendChild(d); walls.push([d, face]);
    };
    wall(ox + r, oz + b.d, b.w - 2 * r, '', 0);                              // 前
    wall(ox + b.w - r, oz, b.w - 2 * r, ' rotateY(180deg)', 180);           // 後
    wall(ox, oz + b.d - r, b.d - 2 * r, ' rotateY(90deg)', -90);            // 左
    wall(ox + b.w, oz + r, b.d - 2 * r, ' rotateY(-90deg)', 90);            // 右

    // ---- 每一片：插腳中心對準插孔，站在底座上面 ----
    // 一片＝一張「平的」板子（立在片的中線），正面、背面、厚度那疊剪影都畫在這張板子裡面，
    // 用 2D 位移做出前後錯開（frame() 裡照角度算）。不讓每一層各自做 3D：
    // 層和層只差零點幾 mm，Chrome 的前後排序會亂，剪影蓋到正面上，整片白白的（2026-10-04 踩到）。
    // 板子裡面是平的，畫的順序就是 z-index，正面一定在最上面。
    set.pieces.forEach(p => {
      const x = ox + p.x, z = oz + p.y, y = -p.h;
      // 影子：片底下一圈淡淡的
      stage.appendChild(place(Object.assign(document.createElement('div'), { className: 'sd-shadow' }),
        x + p.w * 0.1, -0.05, z - 2.2, p.w * 0.8, 4.4, ' rotateX(90deg)'));
      const box = place(Object.assign(document.createElement('div'), { className: 'sd-piece' }), x, y, z, p.w, p.h);
      const layers = [];
      const add = (src, d) => {
        const i = img(src); i.style.width = (p.w * S) + 'px'; i.style.height = (p.h * S) + 'px';
        box.appendChild(i); layers.push({ el: i, d }); return i;
      };
      const n = Math.max(4, Math.round(PIECE_T / MM_PER_SLICE));
      const edge = base + p.img.replace('.webp', '-edge.webp');
      for (let i = 0; i < n; i++) add(edge, -PIECE_T / 2 + PIECE_T * (i + 0.5) / n);
      // 背面：板子從背後看本來就是左右相反，直接放正面的圖＝背後看到鏡像（跟實品雙面印一樣）
      const back = add(base + p.img, -PIECE_T / 2), front = add(base + p.img, PIECE_T / 2);
      stage.appendChild(box);
      pieces.push({ box, layers, front, back });
    });
    shownFront = null;
    kick();
  }

  // ---- 轉動：yaw＝左右、tilt＝俯角 ----
  let yaw = YAW0, tilt = TILT0, yawVel = 0, drag = null, raf = 0, last = 0, shownFront = null, hx = 0, hy = 0;
  el.addEventListener('pointerdown', e => {
    if (e.button) return;
    drag = { x: e.clientX, y: e.clientY, yaw0: yaw, tilt0: tilt, hist: [] };
    yawVel = 0;
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    el.classList.add('drag');
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    const now = performance.now(), w = el.clientWidth || 400;
    const ny = drag.yaw0 + (e.clientX - drag.x) / w * 220;   // 拖過整個寬度≈轉 220 度
    drag.hist.push([now, ny - yaw]);
    while (drag.hist.length && now - drag.hist[0][0] > 90) drag.hist.shift();
    yaw = ny;
    tilt = Math.max(TILT_MIN, Math.min(TILT_MAX, drag.tilt0 + (e.clientY - drag.y) / (el.clientHeight || 400) * 70));
    kick();
  });
  function up() {
    if (!drag) return;
    const d = drag; drag = null; el.classList.remove('drag');
    const sum = d.hist.reduce((s, h) => s + h[1], 0), span = d.hist.length > 1 ? d.hist[d.hist.length - 1][0] - d.hist[0][0] : 0;
    yawVel = span > 8 ? Math.max(-900, Math.min(900, sum / span * 1000)) : 0;   // 放開帶一點慣性
    kick();
  }
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);

  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0;
    if (!el.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!drag && yawVel) {
      yaw += yawVel * dt;
      yawVel *= Math.pow(0.04, dt);
      if (Math.abs(yawVel) < 2) yawVel = 0;
    }
    const y = yaw + hx, t = tilt + hy;
    // 正面朝外（-90～90 度）看正面，其他看背面。不用 backface-visibility：Chrome 會跟厚度層排錯前後
    const ff = Math.abs(norm(y)) < 90;
    if (ff !== shownFront) {
      shownFront = ff;
      pieces.forEach(p => {
        p.front.style.visibility = ff ? '' : 'hidden';
        p.back.style.visibility = ff ? 'hidden' : '';
        // 離觀眾近的畫在上面：照深度 d 排，看正面時 d 大（往前）的在上，看背面時 d 小的在上
        p.layers.slice().sort((a, c) => ff ? a.d - c.d : c.d - a.d).forEach((l, i) => { l.el.style.zIndex = i; });
      });
    }
    // 每一層在板子裡的位移：深 d 的點投影到板子上，水平差 d·tan(yaw)、垂直差 d·tan(俯角)/cos(yaw)
    const ry = y * Math.PI / 180, rt = t * Math.PI / 180;
    let cy = Math.cos(ry); if (Math.abs(cy) < 0.08) cy = cy < 0 ? -0.08 : 0.08;   // 正側面時別除到無限大
    const kx = Math.sin(ry) / cy * S, ky = Math.tan(rt) / cy * S;
    pieces.forEach(p => p.layers.forEach(l => {
      l.el.style.transform = 'translate(' + (l.d * kx).toFixed(2) + 'px,' + (l.d * ky).toFixed(2) + 'px)';
    }));
    // 側邊：朝向觀眾的才顯示（法線轉了 yaw 之後朝 +z）
    walls.forEach(w => { w[0].style.visibility = Math.cos((y + w[1]) * Math.PI / 180) > 0.02 ? '' : 'hidden'; });
    stage.style.transform = 'rotateX(' + (-t).toFixed(2) + 'deg) rotateY(' + y.toFixed(2) + 'deg)';
    if (drag || yawVel) kick();
  }

  window.addEventListener('resize', () => { if (host) build(); });
  load(dir);

  return {
    canvas: el,
    mount(h) {
      host = h;
      if (el.parentNode !== h) { h.innerHTML = ''; h.appendChild(el); }
      yaw = YAW0; tilt = TILT0; yawVel = 0; hx = hy = 0;
      build(); kick();
    },
    // 滑鼠移動時微微偏一點（不拖的時候），看得出前後層次
    pointer(x, y) { if (drag) return; hx = (x - 0.5) * 16; hy = (y - 0.5) * -6; kick(); },
    setArt(d) { return load(d); }
  };
}

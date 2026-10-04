// 小立牌盲盒・通學路：可以轉著看的 3D 預覽（2026-10-04 他要的，先做妹妹這組）。
// 實品：一塊壓克力底座（斑馬線，上面挖 3～4 個插孔），每片小壓克力底下有插腳，插進不同的孔，所以前後錯開。
// three.js 版（他看了平面圖層版之後說反光不夠好看，印章那種透明感要用 three.js 才做得出來）：
//   ・底座、每一片都照工廠刀模的外形擠出 3mm 厚的壓克力（transmission 透明材質＋切邊導一點圓角，邊緣會亮）
//   ・印刷圖貼在正反兩面的表面上（實品是 UV 直噴在表面）。原本夾在中間，但透過 transmission 看會被降解析度、
//     顏色變淡，改貼表面後清楚；印刷上面加一層亮面清漆（clearcoat），一樣會反光。背面那張用 BackSide＝鏡像
//   ・環境光照抄印章的攝影棚（上方柔光、左右窗光、地平線暗板），轉動時反光會在表面和切邊上滑過
//   ・左右拖：整組轉（放開帶慣性，可以轉一整圈）；上下拖：從比較高或比較低的角度看
//   ・下面一排按鈕切換 7 組；隱藏款先是黑色剪影＋「點一下揭曉」，點了轉一圈揭曉（他選的方式，2026-10-04）
//   ・名店選（assets/meiten/）每組多一個幸運轉盤：裝在轉盤柱上，按住轉盤拖＝轉它（放開帶慣性），輕點轉盤＝隨機甩一圈，
//     玩法跟畫圖抉擇轉盤一樣；按其他地方拖才是轉整組（set.json 有 wheel 才有）
//   ・有轉盤的時候右上角多一顆「特效」開關（跟畫圖抉擇轉盤共用開關狀態）：打開才載入 wheel-fx.js＋charm-fx.js 的音效，
//     轉動有跑燈、嗶嗶聲，停下來指到的那格亮紅框＋中獎音效＋星星
//   ・通學路有「📱 AR」開關（2026-10-04）：實品掃 QR Code（ar.cankingstore.com）手機對準人物那片，整組角色的動畫會浮在立牌前面；
//     這裡直接在立牌前面播（動畫裡的人物剛好疊在立牌的人物上），可以照樣拖著轉。
//     試過做一支迷你手機、動畫只在手機螢幕裡播——在手機上看太小，他說取消。素材 build_standee_ar.py 做的
//     （一組一張拼格子的 webp、幾百 KB），開關打開才載入、而且只載目前這一組；隱藏款要先揭曉才有
//   ・轉盤一轉，鏡頭就往轉盤拉近（轉盤變兩倍大，實品字太小、轉完看不出指到什麼——他說的）；
//     停下來不拉回去，可以在這個距離繼續轉；輕點轉盤以外的地方才回到原本的距離（他說的）
// 素材由 tools/sticker-preview/build_standee.py 從工廠排版產生：index.json＝有哪幾組，每組一個資料夾，
// set.json 是尺寸、插孔、外形（單位 mm）。
// 介面跟其他 3D 模組一樣：create(素材根目錄) → { mount(host), pointer(x, y) }
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const PIECE_T = 3;                // 小片壓克力厚度（mm）
const BASE_T = 3;                 // 底座厚度（mm；插腳高 2.9mm，跟底座一樣厚）
const BEVEL = 0.3;                // 切邊導圓角（mm），邊緣才會反光
// 俯角範圍、一打開的角度：幾乎正面、往右偏一點、只往下看一點（他截圖指定的，2026-10-04；隱藏款揭曉也停在這）
const TILT_MIN = 4, TILT_MAX = 40, TILT0 = 7, YAW0 = 6;
const BG = new THREE.Color(0.965, 0.962, 0.952);             // 燈箱背景色（.pl-3d 的漸層中間值），跟印章一樣
const WHEEL_T = 2;                // 轉盤厚度（mm）
const WHEEL_GAP = 1;              // 轉盤跟柱子之間的空隙（轉軸那段）

// ---- 攝影棚環境（照 stamp3d.js 的 env()）：畫成一張全景圖，給壓克力反射、折射用 ----
function studio(renderer) {
  const W = 512, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d'), im = g.createImageData(W, H), bg = [BG.r, BG.g, BG.b];
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - (y + 0.5) / H) * Math.PI, dy = Math.sin(lat);
    for (let x = 0; x < W; x++) {
      const az = ((x + 0.5) / W - 0.5) * 2 * Math.PI;
      let col;
      if (dy < -0.02) col = bg.slice();
      else {
        // 天空只到淡灰（原本到純白，整片反光都是白的，看起來霧霧的、太亮；他 10-04 說太亮），窗光留著當亮帶
        const k = ss(0.2, 0.75, dy);
        col = bg.map(v => v * 0.8 * (1 - k) + 0.86 * k);
        const band = ss(-0.12, -0.02, dy) * (1 - ss(0.35, 0.5, dy));
        const fr = az * 0.6366 + 0.2, flag = 1 - ss(0.13, 0.17, Math.abs(fr - Math.floor(fr) - 0.5));
        col = col.map((v, i) => v + ([0.32, 0.33, 0.35][i] - v) * band * flag * 0.75);   // 暗板深一點：切邊才有明暗
        const win = (1 - ss(0.16, 0.22, Math.abs(Math.abs(az) - 1.15))) * ss(-0.05, 0.05, dy) * (1 - ss(0.55, 0.7, dy));
        col = col.map(v => v + (1.12 - v) * win);
      }
      const o = (y * W + x) * 4;
      im.data[o] = Math.min(255, col[0] * 255); im.data[o + 1] = Math.min(255, col[1] * 255); im.data[o + 2] = Math.min(255, col[2] * 255); im.data[o + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer), env = pm.fromEquirectangular(t).texture;
  t.dispose(); pm.dispose();
  return env;
}

// 壓克力：正反面幾乎全透明、很亮的反光；切邊另外一種，透明度低一點、帶一點藍綠（實品切邊看起來就是這樣）
function acrylicMats(env) {
  const face = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.02, transmission: 1, thickness: PIECE_T, ior: 1.49,
    envMap: env, envMapIntensity: 0.7, clearcoat: 0.5, clearcoatRoughness: 0.02, specularIntensity: 0.8
  });
  const side = new THREE.MeshPhysicalMaterial({
    color: 0xf2f8f8, metalness: 0, roughness: 0.06, transmission: 0.9, thickness: 6, ior: 1.49,
    envMap: env, envMapIntensity: 1.0, clearcoat: 0.6, clearcoatRoughness: 0.05,
    attenuationColor: new THREE.Color(0.82, 0.93, 0.93), attenuationDistance: 30
  });
  return [face, side];
}

// 外形多邊形 → 擠出厚 t 的板子（z 從 -t/2 到 t/2），切邊導圓角
function slab(pts, t, mats) {
  const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const geo = new THREE.ExtrudeGeometry(sh, { depth: t - 2 * BEVEL, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL * 0.6, bevelSegments: 2, curveSegments: 1 });
  geo.translate(0, 0, -(t - 2 * BEVEL) / 2);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mats);                      // ExtrudeGeometry：群組 0＝正反面、1＝切邊
}

export function create(dir) {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;inset:0;touch-action:none;cursor:grab;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(BG, 1);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  el.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = BG;
  const env = studio(renderer);
  scene.environment = env;
  const [faceMat, sideMat] = acrylicMats(env);
  const camera = new THREE.PerspectiveCamera(26, 1, 5, 2000);
  // 切換按鈕＋隱藏款的提示（疊在畫面上）
  const ui = document.createElement('div');
  ui.innerHTML = '<div class="sd-tag" hidden></div><div class="sd-reveal" hidden>點一下揭曉</div><div class="sd-vars"></div>' +
    '<div class="sd-btns"><button class="sd-fx" type="button" hidden>🔈 特效</button><button class="sd-ar" type="button" hidden>📱 AR</button></div>';
  el.appendChild(ui);
  if (!document.getElementById('sd-style')) {
    const st = document.createElement('style'); st.id = 'sd-style';
    st.textContent =
      '.sd-vars{position:absolute;left:0;right:0;bottom:10px;display:flex;flex-wrap:wrap;justify-content:center;gap:6px;padding:0 10px}' +
      '.sd-vars button{border:1px solid #ddd;background:#fff;border-radius:999px;padding:5px 13px;font-size:13px;cursor:pointer;color:#555}' +
      '.sd-vars button.on{border-color:var(--red2,#e5483d);background:var(--red2,#e5483d);color:#fff;font-weight:700}' +
      '.sd-vars button.hid{border-style:dashed}' +
      // 隱藏款的機率：左上角一行細字（他要的，不要膠囊底）
      '.sd-tag{position:absolute;left:14px;top:12px;color:#8a8780;font-size:12px;font-weight:400;letter-spacing:.04em;pointer-events:none}' +
      '.sd-reveal{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);padding:8px 18px;border-radius:999px;background:rgba(43,47,69,.88);' +
        'color:#fff;font-size:15px;font-weight:800;letter-spacing:.08em;pointer-events:none;animation:sd-pulse 1.6s ease-in-out infinite}' +
      '@keyframes sd-pulse{50%{transform:translate(-50%,-50%) scale(1.06)}}' +
      '.sd-btns{position:absolute;right:12px;top:12px;display:flex;flex-direction:column;align-items:flex-end;gap:6px}' +
      '.sd-fx,.sd-ar{border:1.5px solid #ddd;background:#fff;color:#777;border-radius:999px;' +
        'padding:5px 12px;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.04em;box-shadow:0 2px 6px rgba(0,0,0,.06)}' +
      '.sd-fx.on,.sd-ar.on{background:#ffd23a;border-color:#f0a800;color:#7a4b00;box-shadow:0 0 10px rgba(255,190,0,.6)}' +
      // AR 的掃描框：四個角，掃到的那一下變亮、放大淡掉
      '.sd-tag[hidden],.sd-reveal[hidden],.sd-fx[hidden],.sd-ar[hidden]{display:none}';
    document.head.appendChild(st);
  }
  const varsBox = ui.querySelector('.sd-vars'), tagEl = ui.querySelector('.sd-tag'), revealEl = ui.querySelector('.sd-reveal');
  varsBox.addEventListener('pointerdown', e => e.stopPropagation());      // 按按鈕不要變成拖曳
  varsBox.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    pick(+b.dataset.k);
  });
  let list = [], cur = -1, revealed = false, prints = [];
  // ---- 轉盤特效開關（只有名店選有轉盤）：打開才 import wheel-fx.js 和 charm-fx.js（音效） ----
  const fxBtn = ui.querySelector('.sd-fx');
  let fx = null, fxOn = false, fxLoading = null, fxUnlock = null, fxBusy = false;
  const fxStore = { get() { try { return localStorage.getItem('ck-charm-fx') === '1'; } catch (e) { return false; } },
    set(v) { try { localStorage.setItem('ck-charm-fx', v ? '1' : '0'); } catch (e) {} } };
  const fxBind = () => { if (fx && wheelGroup) fx.bind(wheelGroup, set.wheel.d / 2, WHEEL_T / 2 + 0.03); };
  function setFx(v) {
    fxOn = v; fxStore.set(v);
    fxBtn.classList.toggle('on', v); fxBtn.textContent = (v ? '🔊' : '🔈') + ' 特效';
    if (v && !fx && !fxLoading) {
      const mod = n => window.CK_MOD ? window.CK_MOD(n) : './' + n;
      fxLoading = Promise.all([import(mod('wheel-fx.js')), import(mod('charm-fx.js'))])
        .then(([w, cf]) => { fx = w.create(THREE, cf.SFX); fxUnlock = cf.unlock; fxBind(); fx.show(fxOn); if (fxOn) fxUnlock(); kick(); })
        .catch(() => { fxLoading = null; });
    }
    if (fx) { fx.show(v); if (v) fxUnlock(); kick(); }
  }
  fxBtn.addEventListener('pointerdown', e => e.stopPropagation());   // 按開關不要變成拖曳
  fxBtn.addEventListener('click', () => setFx(!fxOn));
  // ---- AR 動畫開關（通學路）：打開才載入目前這組的 ar.webp；不記住（每次進來都是關的，不要一進來就載） ----
  const arBtn = ui.querySelector('.sd-ar');
  let arOn = false, arMesh = null, arTex = null, arReady = 0, arT = 0, arIdx = 0, arToken = 0, pieceGroups = [];
  arBtn.addEventListener('pointerdown', e => e.stopPropagation());
  arBtn.addEventListener('click', () => {
    arOn = !arOn; arBtn.classList.toggle('on', arOn);
    if (arOn) arStart(); else arStop();
  });
  const arTag = () => {                                  // 左上角細字：AR 打開時說怎麼玩（隱藏款那組照樣顯示機率）
    const it = list[cur]; if (!it || it.hidden || wheelGroup) return;
    tagEl.textContent = '掃立牌附的 QR Code，用手機看角色動起來'; tagEl.hidden = !arOn;
  };
  function arStop() {
    arToken++;
    if (arMesh) { arMesh.parent && arMesh.parent.remove(arMesh); arMesh.geometry.dispose(); arMesh.material.dispose(); }
    if (arTex) arTex.dispose();
    arMesh = null; arTex = null; arReady = 0; arTag(); kick();
  }
  function arStart() {
    arStop();
    if (!arOn || !set || !set.ar || !pieceGroups[set.ar.piece]) return;
    if (list[cur] && list[cur].hidden && !revealed) return;          // 隱藏款：揭曉之後才有
    const a = set.ar, p = set.pieces[a.piece], tok = arToken, t0 = performance.now();
    arTag();
    // 鏡頭轉回正面（跟揭曉同一套轉法，不換圖）
    const to = yaw - ((((yaw - YAW0) % 360) + 540) % 360 - 180);
    if (Math.abs(to - yaw) > 1) { spin = { t0, dur: 600, from: yaw, to, tilt0: tilt, swapped: true, ar: true }; yawVel = 0; }
    loader.load(base + a.img, t => {
      if (tok !== arToken) { t.dispose(); return; }
      t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / a.cols, 1 / a.rows);
      arTex = t; arIdx = 0; arT = 0; arFrame();
      arMesh = new THREE.Mesh(new THREE.PlaneGeometry(a.size, a.size),
        new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false, side: THREE.FrontSide }));
      arMesh.position.set(p.w / 2 + (a.dx || 0), p.h / 2 + (a.dy || 0), PIECE_T / 2 + a.z); arMesh.renderOrder = 10;   // dx／dy：讓動畫裡的人物疊在立牌的人物上
      pieceGroups[a.piece].add(arMesh);
      // 等鏡頭轉回正面（最多 0.6 秒）再彈出來
      setTimeout(() => { if (tok === arToken) { arReady = performance.now(); kick(); } }, Math.max(0, 600 - (performance.now() - t0)));
    });
  }
  function arFrame() {
    const a = set.ar, c = arIdx % a.cols, r = Math.floor(arIdx / a.cols);
    arTex.offset.set(c / a.cols, 1 - (r + 1) / a.rows);
  }
  // 轉盤：wheelSpin＝轉了幾度、wheelVel＝每秒幾度
  let wheelGroup = null, wheelMeshes = [], wheelSpin = 0, wheelVel = 0;
  const ray = new THREE.Raycaster();
  const root = new THREE.Group(); scene.add(root);
  const loader = new THREE.TextureLoader();
  let host = null, set = null, base = '', root0 = '', target = new THREE.Vector3(), dist = 300;

  const tex = src => {
    const t = loader.load(src, () => kick());
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  };
  // 印刷：顏色照原圖（用 emissive 發光，不受打光影響變暗），上面一層亮面清漆反射攝影棚的光。
  // color 設黑＝不吃漫射光，map 只拿來給 alpha（透明的地方挖掉）。alphaToCoverage：邊緣才不會鋸齒
  const printMat = (map, side) => new THREE.MeshPhysicalMaterial({
    color: 0x000000, map, emissive: 0xffffff, emissiveMap: map, side, alphaTest: 0.5, alphaToCoverage: true,
    roughness: 0.35, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.05, envMapIntensity: 0.25
  });

  // 隱藏款還沒揭曉：印刷只留形狀（全黑），壓克力照常透明
  const silMat = map => new THREE.MeshBasicMaterial({ color: 0x1f2233, map, side: THREE.DoubleSide, alphaTest: 0.5, alphaToCoverage: true });
  function setPrints(show) {
    prints.forEach(p => {
      if (!p.real) p.real = p.mesh.material;
      if (!p.sil) p.sil = silMat(p.real.map);
      p.mesh.material = show ? p.real : p.sil;
    });
    kick();
  }

  function clear() {
    root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      // 壓克力的材質是 [正反面, 切邊] 陣列、整個模組共用，不丟（陣列也有 .map，別當成貼圖）；印刷、影子的才丟
      if (o.material && !Array.isArray(o.material)) {
        if (o.material.map) o.material.map.dispose();       // 正反面共用一張圖，dispose 兩次沒關係
        o.material.dispose();
      }
    });
    root.clear();
    wheelGroup = null; wheelMeshes = []; wheelSpin = 0; wheelVel = 0; zoom = 0; zoomed = false;
    prints.forEach(p => { if (p.sil) p.sil.dispose(); });   // 剪影材質不在場景裡時（已揭曉）上面丟不到
    prints = []; pieceGroups = [];
    if (arTex) arTex.dispose();
    arToken++; arMesh = null; arTex = null; arReady = 0;
  }

  function build() {
    clear();
    const b = set.base, hw = b.w / 2, hd = b.d / 2;
    // ---- 底座：外形擠出（圖的 y 往下＝往觀眾），平躺，頂面在 y=0 ----
    const bs = slab(b.outline.map(p => [p[0] - hw, -(p[1] - hd)]), BASE_T, [faceMat, sideMat]);
    bs.rotation.x = -Math.PI / 2; bs.position.y = -BASE_T / 2;
    root.add(bs);
    const bp = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.d), printMat(tex(base + 'base.webp'), THREE.FrontSide));
    bp.rotation.x = -Math.PI / 2; bp.position.y = 0.03;          // 印在底座頂面
    root.add(bp);
    // 底下一片淡淡的影子
    const sc = document.createElement('canvas'); sc.width = sc.height = 128;
    const sg = sc.getContext('2d'), gr = sg.createRadialGradient(64, 64, 8, 64, 64, 64);
    gr.addColorStop(0, 'rgba(40,35,30,.28)'); gr.addColorStop(1, 'rgba(40,35,30,0)');
    sg.fillStyle = gr; sg.fillRect(0, 0, 128, 128);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(b.w * 1.5, b.d * 1.7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = -BASE_T - 0.4;
    root.add(sh);

    // ---- 每一片：插腳中心對準插孔，站在底座上面（插腳插進底座那段不做） ----
    set.pieces.forEach((p, pi) => {
      const g = new THREE.Group();
      g.position.set(p.x - hw, 0, p.y - hd);
      g.add(slab(p.outline, PIECE_T, [faceMat, sideMat]));
      // 正面、背面各一張（背面 BackSide：從背後看是鏡像，跟雙面印的實品一樣）
      const map = tex(base + p.img), pg = new THREE.PlaneGeometry(p.w, p.h);
      const pf = new THREE.Mesh(pg, printMat(map, THREE.FrontSide)), pb = new THREE.Mesh(pg, printMat(map, THREE.BackSide));
      prints.push({ mesh: pf }, { mesh: pb });
      pf.position.set(p.w / 2, p.h / 2, PIECE_T / 2 + 0.03);
      pb.position.set(p.w / 2, p.h / 2, -PIECE_T / 2 - 0.03);
      g.add(pf); g.add(pb);
      root.add(g); pieceGroups[pi] = g;
      // 轉盤（名店選）：裝在轉盤柱這一片的前面，繞自己的中心轉
      if (set.wheel && set.wheel.piece === pi) {
        const w = set.wheel, r = w.d / 2, wg = new THREE.Group();
        wg.position.set(w.cx, w.cy, PIECE_T / 2 + WHEEL_GAP + WHEEL_T / 2);
        const circle = []; for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2; circle.push([Math.cos(a) * r, Math.sin(a) * r]); }
        const disc = slab(circle, WHEEL_T, [faceMat, sideMat]);
        const wf = new THREE.Mesh(new THREE.PlaneGeometry(w.d, w.d), printMat(tex(base + w.img), THREE.FrontSide));
        const wbk = new THREE.Mesh(new THREE.PlaneGeometry(w.d, w.d), printMat(tex(base + w.back), THREE.BackSide));
        wf.position.z = WHEEL_T / 2 + 0.03; wbk.position.z = -WHEEL_T / 2 - 0.03;
        // 轉軸：柱子和轉盤之間一小段透明的圓柱
        const axle = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, WHEEL_GAP + 0.4, 24), sideMat);
        axle.rotation.x = Math.PI / 2; axle.position.set(w.cx, w.cy, PIECE_T / 2 + WHEEL_GAP / 2);
        wg.add(disc); wg.add(wf); wg.add(wbk);
        g.add(wg); g.add(axle);
        prints.push({ mesh: wf }, { mesh: wbk });
        wheelGroup = wg; wheelMeshes = [disc, wf, wbk];
      }
    });
    fxBtn.hidden = !wheelGroup;
    arBtn.hidden = !set.ar;
    // 名店選：左上角一行細字，說轉盤背面是空白的、可以自己寫（他要的，跟隱藏款機率同一個樣式）
    if (wheelGroup && tagEl.hidden) { tagEl.textContent = '轉盤背面是空白的，可以寫上自己的菜單'; tagEl.hidden = false; }
    if (wheelGroup) { if (fxStore.get() && !fxOn) setFx(true); else fxBind(); }

    // 鏡頭：整組（底座對角線＋最高的那片）都要塞得下，轉一圈也不會出框
    const tall = Math.max.apply(null, set.pieces.map(p => p.h));
    target.set(0, tall * 0.36, 0);
    const R = Math.hypot(Math.hypot(b.w, b.d) / 2, tall * 0.62);
    const vf = camera.fov * Math.PI / 360;
    dist = Math.max(R / Math.tan(vf), R / (Math.tan(vf) * (camera.aspect || 1))) * 1.06;   // 下面留給按鈕
    const hid = list[cur] && list[cur].hidden;
    if (hid && !revealed) setPrints(false);
    if (arOn) arStart(); else arTag();
    kick();
  }

  function load(d) {
    base = d.replace(/\/?$/, '/');
    return fetch(base + 'set.json').then(r => r.json()).then(j => { set = j; build(); });
  }
  // 換一組：按鈕狀態、隱藏款的標籤和提示
  function pick(k) {
    if (k === cur || !list[k]) return;
    cur = k;
    const it = list[k];
    Array.prototype.forEach.call(varsBox.children, (b, i) => b.classList.toggle('on', i === k));
    tagEl.hidden = !it.hidden; tagEl.textContent = '隱藏款機率為 1/64';
    revealEl.hidden = !(it.hidden && !revealed);
    yaw = YAW0; yawVel = 0; spin = null;
    load(root0 + it.id + '/');
  }
  // 揭曉：固定的動畫，剛好轉一整圈、停在一打開的斜前方角度（不能用慣性：停在哪不一定，他看到停在側面覺得怪）。
  // 轉到一半（背對觀眾的時候）換成真的圖
  let spin = null;
  function reveal() {
    revealed = true; revealEl.hidden = true;
    yawVel = 0; hx = hy = 0;
    const to = YAW0 - 360 * Math.ceil((yaw - YAW0 + 300) / 360);   // 往同一方向轉，至少轉 300 度、停在 YAW0
    spin = { t0: performance.now(), dur: 1400, from: yaw, to, tilt0: tilt, swapped: false };
    kick();
  }
  function start(d) {
    root0 = d.replace(/\/?$/, '/');
    fetch(root0 + 'index.json').then(r => r.json()).then(j => {
      list = j;
      varsBox.innerHTML = list.map((it, i) => '<button data-k="' + i + '"' + (it.hidden ? ' class="hid"' : '') + '>' +
        (it.hidden ? '？ ' : '') + it.name + '</button>').join('');
      cur = -1; pick(0);
    });
  }

  function resize() {
    if (!host) return;
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (set) build(); else kick();
  }

  // ---- 轉動：yaw＝左右、tilt＝俯角（滑鼠移動時微微偏 hx/hy，看得出前後層次） ----
  let yaw = YAW0, tilt = TILT0, yawVel = 0, drag = null, raf = 0, last = 0, hx = 0, hy = 0;
  // 拉近轉盤：zoom 0＝原本的鏡頭、1＝對準轉盤、距離剩一半（轉盤看起來兩倍大）；zoomed＝要不要拉近
  let zoom = 0, zoomed = false;
  const wheelPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
  el.addEventListener('pointerdown', e => {
    if (e.button) return;
    if (spin) return;                                    // 揭曉動畫中不能拖
    drag = { x: e.clientX, y: e.clientY, yaw0: yaw, tilt0: tilt, hist: [], moved: false, mode: 'orbit' };
    if (wheelGroup && hitWheel(e)) {                      // 按到轉盤：轉它，不轉整組
      const c = wheelScreen();
      drag.mode = 'wheel'; drag.c = c; drag.a = Math.atan2(e.clientY - c[1], e.clientX - c[0]) * 180 / Math.PI;
      drag.sign = wheelFacing() ? -1 : 1;                 // 從背後看，順時針是反過來的
      wheelVel = 0;
      if (fx && fxOn) fxUnlock();
    }
    yawVel = 0;
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    el.style.cursor = 'grabbing';
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    const now = performance.now(), w = el.clientWidth || 400;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) drag.moved = true;
    if (drag.mode === 'wheel') {
      drag.c = wheelScreen();                            // 鏡頭在拉近，中心會跑
      const a = Math.atan2(e.clientY - drag.c[1], e.clientX - drag.c[0]) * 180 / Math.PI;
      const dd = ((a - drag.a) % 360 + 540) % 360 - 180;
      drag.a = a; wheelSpin += drag.sign * dd;
      drag.hist.push([now, drag.sign * dd]);
      while (drag.hist.length && now - drag.hist[0][0] > 90) drag.hist.shift();
      kick(); return;
    }
    const ny = drag.yaw0 - (e.clientX - drag.x) / w * 220;   // 拖過整個寬度≈轉 220 度
    drag.hist.push([now, ny - yaw]);
    while (drag.hist.length && now - drag.hist[0][0] > 90) drag.hist.shift();
    yaw = ny;
    tilt = Math.max(TILT_MIN, Math.min(TILT_MAX, drag.tilt0 + (e.clientY - drag.y) / (el.clientHeight || 400) * 70));
    kick();
  });
  function up() {
    if (!drag) return;
    const d = drag; drag = null; el.style.cursor = 'grab';
    if (d.mode === 'wheel') {
      const sum = d.hist.reduce((s, h) => s + h[1], 0), span = d.hist.length > 1 ? d.hist[d.hist.length - 1][0] - d.hist[0][0] : 0;
      // 輕點：隨機甩一圈；拖：照放開時的速度繼續轉（最高跟畫圖抉擇轉盤一樣 6000）
      wheelVel = !d.moved ? (900 + Math.random() * 900) * (Math.random() < 0.5 ? -1 : 1)
        : (span > 8 ? Math.max(-6000, Math.min(6000, sum / span * 1000)) : 0);
      if (!wheelVel && fx && fxOn) fx.stop(wheelSpin, wheelFacing());   // 拖完直接停住：當場開獎
      kick(); return;
    }
    // 拉近轉盤時，輕點轉盤以外的地方＝回到原本的距離
    if (!d.moved && zoomed) { zoomed = false; yawVel = 0; kick(); return; }
    // 隱藏款還沒揭曉時，輕點一下＝揭曉
    if (!d.moved && list[cur] && list[cur].hidden && !revealed) { reveal(); return; }
    const sum = d.hist.reduce((s, h) => s + h[1], 0), span = d.hist.length > 1 ? d.hist[d.hist.length - 1][0] - d.hist[0][0] : 0;
    yawVel = span > 8 ? Math.max(-600, Math.min(600, sum / span * 1000)) : 0;   // 放開帶一點慣性
    kick();
  }
  // 放開可能發生在框外、或燈箱已經關掉（pointer capture 沒抓到時 el 收不到）：整頁都聽，免得 drag 卡在 true，
  // 之後滑鼠一動就跟著轉（2026-10-04 踩到）
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);

  // 轉盤：有沒有按到、中心在畫面上哪裡、正面有沒有朝著鏡頭
  function hitWheel(e) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    return ray.intersectObjects(wheelMeshes, false).length > 0;
  }
  function wheelScreen() {
    const v = new THREE.Vector3(); wheelGroup.getWorldPosition(v); v.project(camera);
    const r = canvas.getBoundingClientRect();
    return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
  }
  function wheelFacing() {
    const p = new THREE.Vector3(), n = new THREE.Vector3(0, 0, 1);
    wheelGroup.getWorldPosition(p); n.applyQuaternion(wheelGroup.getWorldQuaternion(new THREE.Quaternion()));
    return n.dot(camera.position.clone().sub(p)) > 0;
  }

  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0;
    if (!el.isConnected || !host) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (spin) {
      const k = Math.min(1, (now - spin.t0) / spin.dur), e = 1 - Math.pow(1 - k, 3);   // 先快後慢
      yaw = spin.from + (spin.to - spin.from) * e;
      tilt = spin.tilt0 + (TILT0 - spin.tilt0) * e;
      if (!spin.swapped && e > 0.5) { spin.swapped = true; setPrints(true); }
      if (k >= 1) { const wasReveal = !spin.ar && list[cur] && list[cur].hidden; spin = null; yaw = YAW0; if (wasReveal && arOn && !arMesh) arStart(); }
    }
    if (wheelGroup) {
      const wDrag = !!(drag && drag.mode === 'wheel');
      if (wheelVel && !wDrag) {
        wheelSpin += wheelVel * dt;
        const sg = Math.sign(wheelVel);
        wheelVel -= wheelVel * 0.9 * dt + sg * 90 * dt;        // 摩擦：跟畫圖抉擇轉盤一樣
        if (Math.sign(wheelVel) !== sg || Math.abs(wheelVel) < 6) { wheelVel = 0; if (fx && fxOn) fx.stop(wheelSpin, wheelFacing()); }   // 停了：開獎
      }
      wheelGroup.rotation.z = wheelSpin * Math.PI / 180;
      if (wDrag || wheelVel) zoomed = true;
      fxBusy = false;
      if (fx && fxOn) {
        let v = wheelVel;
        if (wDrag && drag.hist.length > 1) { const h = drag.hist, sp = h[h.length - 1][0] - h[0][0]; v = sp > 0 ? h.reduce((a, x) => a + x[1], 0) / sp * 1000 : 0; }
        fxBusy = fx.frame(wheelSpin, v, wDrag || !!wheelVel, wheelFacing(), dt);
      }
    }
    if (arMesh && arReady) {
      const a = set.ar;
      arT += dt * 1000;
      while (arT >= a.dur[arIdx]) { arT -= a.dur[arIdx]; arIdx = (arIdx + 1) % a.n; }
      arFrame();
      const k = Math.min(1, (now - arReady) / 320), e = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);   // 彈一下
      arMesh.material.opacity = k; arMesh.scale.setScalar(0.6 + 0.4 * e);
    }
    if (!drag && yawVel) {
      yaw += yawVel * dt;
      yawVel *= Math.pow(0.04, dt);
      if (Math.abs(yawVel) < 2) yawVel = 0;
    }
    const zTo = wheelGroup && zoomed ? 1 : 0;
    zoom += (zTo - zoom) * (1 - Math.exp(-dt * 4));
    if (Math.abs(zTo - zoom) < 0.002) zoom = zTo;
    camTarget.copy(target);
    const dz = dist * (1 - 0.5 * zoom);
    const ry = (yaw + hx) * Math.PI / 180, rt = (tilt + hy) * Math.PI / 180;
    if (zoom && wheelGroup) {
      wheelGroup.getWorldPosition(wheelPos); camTarget.lerp(wheelPos, zoom);
      // 轉盤放在畫面偏右，左邊留給人物（他說人物也是看點）：往右推畫面寬的 17%，但轉盤右緣不能出框（手機直式會推少一點）
      const halfW = dz * Math.tan(camera.fov * Math.PI / 360) * (camera.aspect || 1);
      const sh = Math.max(0, Math.min(halfW * 0.34, halfW - set.wheel.d / 2 * 1.2)) * zoom;
      camTarget.x -= Math.cos(ry) * sh; camTarget.z += Math.sin(ry) * sh;
    }
    camera.position.set(camTarget.x + dz * Math.cos(rt) * Math.sin(ry), camTarget.y + dz * Math.sin(rt), camTarget.z + dz * Math.cos(rt) * Math.cos(ry));
    camera.lookAt(camTarget);
    renderer.render(scene, camera);
    if (drag || yawVel || spin || wheelVel || fxBusy || (zoom !== (zoomed ? 1 : 0)) || (arMesh && arReady)) kick();
  }

  window.addEventListener('resize', resize);
  el.dataset.sd = '1'; el.sdState = () => ({ yaw, tilt, hx, hy, dist, yawVel, drag: !!drag, wheelSpin, wheelVel }); el.sdScene = () => ({ root, prints, set, kick });   // 除錯用
  el.sdWheel = v => { wheelVel = v; kick(); }; el.sdFx = () => fx;                    // 除錯用：直接甩轉盤
  start(dir);

  return {
    canvas: el,
    mount(h) {
      host = h;
      if (el.parentNode !== h) { h.innerHTML = ''; h.appendChild(el); }
      yaw = YAW0; tilt = TILT0; yawVel = 0; hx = hy = 0; drag = null; zoom = 0; zoomed = false; el.style.cursor = 'grab';
      resize(); kick();
    },
    pointer(x, y) { if (drag) return; hx = -(x - 0.5) * 16; hy = (y - 0.5) * 6; kick(); }
  };
}

// 小立牌盲盒・通學路：可以轉著看的 3D 預覽（2026-10-04 他要的，先做妹妹這組）。
// 實品：一塊壓克力底座（斑馬線，上面挖 3～4 個插孔），每片小壓克力底下有插腳，插進不同的孔，所以前後錯開。
// three.js 版（他看了平面圖層版之後說反光不夠好看，印章那種透明感要用 three.js 才做得出來）：
//   ・底座、每一片都照工廠刀模的外形擠出 3mm 厚的壓克力（transmission 透明材質＋切邊導一點圓角，邊緣會亮）
//   ・印刷圖貼在正反兩面的表面上（實品是 UV 直噴在表面）。原本夾在中間，但透過 transmission 看會被降解析度、
//     顏色變淡，改貼表面後清楚；印刷上面加一層亮面清漆（clearcoat），一樣會反光。背面那張用 BackSide＝鏡像
//   ・環境光照抄印章的攝影棚（上方柔光、左右窗光、地平線暗板），轉動時反光會在表面和切邊上滑過
//   ・左右拖：整組轉（放開帶慣性，可以轉一整圈）；上下拖：從比較高或比較低的角度看
// 素材由 tools/sticker-preview/build_standee.py 從工廠排版產生：每組一個資料夾，set.json 是尺寸、插孔、外形（單位 mm）。
// 介面跟其他 3D 模組一樣：create(資料夾) → { mount(host), pointer(x, y), setArt(資料夾) }
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const PIECE_T = 3;                // 小片壓克力厚度（mm）
const BASE_T = 3;                 // 底座厚度（mm；插腳高 2.9mm，跟底座一樣厚）
const BEVEL = 0.3;                // 切邊導圓角（mm），邊緣才會反光
const TILT_MIN = 4, TILT_MAX = 40, TILT0 = 14, YAW0 = -24;   // 俯角範圍、一打開的角度
const BG = new THREE.Color(0.965, 0.962, 0.952);             // 燈箱背景色（.pl-3d 的漸層中間值），跟印章一樣

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
        const k = ss(0.2, 0.75, dy);
        col = bg.map(v => v * 0.97 * (1 - k) + 1.0 * k);
        const band = ss(-0.12, -0.02, dy) * (1 - ss(0.35, 0.5, dy));
        const fr = az * 0.6366 + 0.2, flag = 1 - ss(0.13, 0.17, Math.abs(fr - Math.floor(fr) - 0.5));
        col = col.map((v, i) => v + ([0.45, 0.46, 0.48][i] - v) * band * flag * 0.6);
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
    color: 0xffffff, metalness: 0, roughness: 0.03, transmission: 1, thickness: PIECE_T, ior: 1.49,
    envMap: env, envMapIntensity: 1.25, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1,
    attenuationColor: new THREE.Color(0.86, 0.95, 0.95), attenuationDistance: 80
  });
  const side = new THREE.MeshPhysicalMaterial({
    color: 0xeef8f8, metalness: 0, roughness: 0.08, transmission: 0.82, thickness: 8, ior: 1.49,
    envMap: env, envMapIntensity: 1.7, clearcoat: 1, clearcoatRoughness: 0.05,
    attenuationColor: new THREE.Color(0.7, 0.9, 0.9), attenuationDistance: 20
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
  const root = new THREE.Group(); scene.add(root);
  const loader = new THREE.TextureLoader();
  let host = null, set = null, base = '', target = new THREE.Vector3(), dist = 300;

  const tex = src => {
    const t = loader.load(src, () => kick());
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  };
  // 印刷：顏色照原圖（用 emissive 發光，不受打光影響變暗），上面一層亮面清漆反射攝影棚的光。
  // color 設黑＝不吃漫射光，map 只拿來給 alpha（透明的地方挖掉）。alphaToCoverage：邊緣才不會鋸齒
  const printMat = (map, side) => new THREE.MeshPhysicalMaterial({
    color: 0x000000, map, emissive: 0xffffff, emissiveMap: map, side, alphaTest: 0.5, alphaToCoverage: true,
    roughness: 0.25, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.9
  });

  function clear() {
    root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material.map) { o.material.map.dispose(); o.material.dispose(); }   // 正反面共用一張圖，dispose 兩次沒關係
    });
    root.clear();
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
    set.pieces.forEach(p => {
      const g = new THREE.Group();
      g.position.set(p.x - hw, 0, p.y - hd);
      g.add(slab(p.outline, PIECE_T, [faceMat, sideMat]));
      // 正面、背面各一張（背面 BackSide：從背後看是鏡像，跟雙面印的實品一樣）
      const map = tex(base + p.img), pg = new THREE.PlaneGeometry(p.w, p.h);
      const pf = new THREE.Mesh(pg, printMat(map, THREE.FrontSide)), pb = new THREE.Mesh(pg, printMat(map, THREE.BackSide));
      pf.position.set(p.w / 2, p.h / 2, PIECE_T / 2 + 0.03);
      pb.position.set(p.w / 2, p.h / 2, -PIECE_T / 2 - 0.03);
      g.add(pf); g.add(pb);
      root.add(g);
    });

    // 鏡頭：整組（底座對角線＋最高的那片）都要塞得下，轉一圈也不會出框
    const tall = Math.max.apply(null, set.pieces.map(p => p.h));
    target.set(0, tall * 0.36, 0);
    const R = Math.hypot(Math.hypot(b.w, b.d) / 2, tall * 0.62);
    const vf = camera.fov * Math.PI / 360;
    dist = Math.max(R / Math.tan(vf), R / (Math.tan(vf) * (camera.aspect || 1))) * 1.02;
    kick();
  }

  function load(d) {
    base = d.replace(/\/?$/, '/');
    return fetch(base + 'set.json').then(r => r.json()).then(j => { set = j; build(); });
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
  el.addEventListener('pointerdown', e => {
    if (e.button) return;
    drag = { x: e.clientX, y: e.clientY, yaw0: yaw, tilt0: tilt, hist: [] };
    yawVel = 0;
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    el.style.cursor = 'grabbing';
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    const now = performance.now(), w = el.clientWidth || 400;
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
    const sum = d.hist.reduce((s, h) => s + h[1], 0), span = d.hist.length > 1 ? d.hist[d.hist.length - 1][0] - d.hist[0][0] : 0;
    yawVel = span > 8 ? Math.max(-600, Math.min(600, sum / span * 1000)) : 0;   // 放開帶一點慣性
    kick();
  }
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);

  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0;
    if (!el.isConnected || !host) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!drag && yawVel) {
      yaw += yawVel * dt;
      yawVel *= Math.pow(0.04, dt);
      if (Math.abs(yawVel) < 2) yawVel = 0;
    }
    const ry = (yaw + hx) * Math.PI / 180, rt = (tilt + hy) * Math.PI / 180;
    camera.position.set(target.x + dist * Math.cos(rt) * Math.sin(ry), target.y + dist * Math.sin(rt), target.z + dist * Math.cos(rt) * Math.cos(ry));
    camera.lookAt(target);
    renderer.render(scene, camera);
    if (drag || yawVel) kick();
  }

  window.addEventListener('resize', resize);
  el.dataset.sd = '1'; el.sdState = () => ({ yaw, tilt, hx, hy, dist, yawVel, drag: !!drag });   // 除錯用：目前的角度
  load(dir);

  return {
    canvas: el,
    mount(h) {
      host = h;
      if (el.parentNode !== h) { h.innerHTML = ''; h.appendChild(el); }
      yaw = YAW0; tilt = TILT0; yawVel = 0; hx = hy = 0;
      resize(); kick();
    },
    pointer(x, y) { if (drag) return; hx = -(x - 0.5) * 16; hy = (y - 0.5) * 6; kick(); },
    setArt(d) { return load(d); }
  };
}

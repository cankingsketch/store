// T 恤 3D 預覽：用效果圖（去背的白 T 實拍，build_tee.py 已經把高解析的圖案和布標蓋上去）當布面，
// 照衣服外形把正面、背面兩片各自「鼓起來」（離邊越遠越厚，袖子窄所以比較薄），兩片在外形邊緣接在一起。
// 布料的皺褶、領口都是照片本身的明暗，3D 只負責讓它轉起來有厚度。
// 滑鼠左右移動轉一點角度看側面，點一下翻到背面（再點翻回來）。shared.js 需要時才動態載入。
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const WIDTH = 86;          // 衣服攤平含袖子的全寬（cm），只用來定比例
const PUFF = 2.6;          // 身體正中間鼓起的厚度（cm，單面）
const SEG = 220;           // 網格密度（橫向）

function loadImg(url) {
  return new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = url; });
}

// 從衣服外形（貼圖的透明度）算出每一點要鼓多高：外形模糊一次，離邊越遠越接近 1，再開根號讓邊緣是圓弧
function heightField(img, nx, ny) {
  const c = document.createElement('canvas'); c.width = nx; c.height = ny;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, nx, ny);
  const a = x.getImageData(0, 0, nx, ny).data;
  const b = document.createElement('canvas'); b.width = nx; b.height = ny;
  const bx = b.getContext('2d', { willReadFrequently: true });
  bx.filter = 'blur(' + (nx * 0.045) + 'px)';                    // 約 4cm：袖子、肩膀會比身體扁
  bx.drawImage(c, 0, 0);
  const bl = bx.getImageData(0, 0, nx, ny).data;
  const h = new Float32Array(nx * ny);
  for (let i = 0; i < nx * ny; i++) {
    const inside = a[i * 4 + 3] / 255;
    const v = Math.min(1, Math.max(0, (bl[i * 4 + 3] / 255 - 0.5) * 2));
    h[i] = inside * Math.sqrt(v);
  }
  return h;
}

function panel(img, tex, w, h, hf, nx, ny) {
  const g = new THREE.PlaneGeometry(w, h, nx - 1, ny - 1);
  const p = g.attributes.position;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    p.setZ(k, hf[k] * PUFF);
  }
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0, alphaTest: 0.5, alphaToCoverage: true, side: THREE.FrontSide });
  return new THREE.Mesh(g, mat);
}

export function create(frontUrl, backUrl) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * 1.25, 3));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement; canvas.className = 'tshirt3d'; canvas.style.cursor = 'pointer';
  const scene = new THREE.Scene();
  // 照片本身已經有明暗，燈光以環境光為主，只留一點方向光讓轉動時看得出鼓起來的厚度
  scene.add(new THREE.AmbientLight(0xffffff, 2.6));
  const key = new THREE.DirectionalLight(0xffffff, 0.75); key.position.set(-40, 60, 100); scene.add(key);
  const camera = new THREE.PerspectiveCamera(28, 1, 10, 2000);
  camera.position.set(0, 0, 220);
  const aniso = renderer.capabilities.getMaxAnisotropy();

  const shirt = new THREE.Group();
  scene.add(shirt);
  let ready = false;
  const loader = new THREE.TextureLoader();
  const tex = (url) => new Promise(ok => loader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; ok(t); }));
  Promise.all([loadImg(frontUrl), tex(frontUrl), tex(backUrl)]).then(([img, tf, tb]) => {
    const W = WIDTH, Hh = WIDTH * img.height / img.width;
    const nx = SEG, ny = Math.round(SEG * img.height / img.width);
    const hf = heightField(img, nx, ny);
    shirt.add(panel(img, tf, W, Hh, hf, nx, ny));
    // 背面：同一個外形轉 180°（build_tee.py 已經把背面拉成正面的外形），從後面看就是背面圖
    const back = panel(img, tb, W, Hh, hf, nx, ny);
    back.rotation.y = Math.PI; shirt.add(back);
    ready = true; dirty = true;
  });

  // 姿勢：滑鼠左右轉一點角度；點一下翻面（轉 180°），動畫用彈簧追上目標
  let tx = 0, ty = 0, rx = 0, ry = 0, flip = 0, flipNow = 0, raf = 0, dirty = true;
  canvas.addEventListener('click', () => { flip = flip ? 0 : 1; dirty = true; });
  function frame() {
    raf = canvas.isConnected ? requestAnimationFrame(frame) : 0;
    if (!raf || !ready) return;
    const nrx = rx + (ty - rx) * 0.08, nry = ry + (tx - ry) * 0.08, nf = flipNow + (flip - flipNow) * 0.09;
    if (!dirty && Math.abs(nrx - rx) + Math.abs(nry - ry) + Math.abs(nf - flipNow) < 1e-5) return;
    rx = nrx; ry = nry; flipNow = nf; dirty = false;
    shirt.rotation.set(rx, ry + flipNow * Math.PI, 0, 'YXZ');
    renderer.render(scene, camera);
  }
  return {
    canvas,
    mount(host) {
      if (canvas.parentNode !== host) { host.innerHTML = ''; host.appendChild(canvas); }
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h;
      // 衣服全寬約佔畫面寬的八成、高度不超過畫面
      const t = 2 * Math.tan(THREE.MathUtils.degToRad(14));
      camera.position.z = Math.max(WIDTH * 1.2 / (t * camera.aspect), WIDTH * 1.15 / t);
      camera.updateProjectionMatrix();
      flip = flipNow = 0;                    // 每次打開都從正面開始
      dirty = true;
      if (!raf) raf = requestAnimationFrame(frame);
    },
    pointer(x, y) { tx = (x - 0.5) * 1.0; ty = (y - 0.5) * 0.35; }
  };
}

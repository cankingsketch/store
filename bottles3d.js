// 洗沐標籤貼用的立體分裝瓶：照真空按壓分裝瓶（旅行組那種）的樣子——
// 透明瓶身、厚透明瓶底、裡面一片活塞、白色瓶肩和按壓頭、外面再罩一個透明蓋。空瓶、不裝液體。
// 瓶子沒有現成免費模型可用，這裡照照片的剖面繞中心軸轉一圈做出來（LatheGeometry）。
// 桌面上有淡淡的倒影：每一格畫完後，把畫面上下翻轉貼到地板線下面，再用漸層遮罩淡出。
// 標籤是真的包在瓶身曲面上；瓶子只在滑鼠移動時才轉。shared.js 需要時才動態載入這支。
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const R = 15;          // 瓶身半徑（mm）
const H = 114;         // 含外蓋總高
const BODY = [[0, 0], [13.6, 0], [14.7, 0.6], [15.2, 2], [15.2, 78.2], [14.8, 78.6]];
const BASE = [[0, 0.4], [14.2, 0.4], [14.4, 9.6], [0, 9.6]];              // 厚透明瓶底
const COLLAR = [[0, 78], [15.5, 78], [15.6, 79], [15.6, 85.2], [11.5, 85.6], [0, 85.6]];
const PUMP = [[0, 85], [9.6, 85], [9.8, 97.5], [9, 99.2], [0, 99.6]];
const CAP = [[15.9, 85.4], [15.9, 107.5], [15.3, 111.2], [13.6, 113], [0, 113.4]]; // 透明外蓋

function softbox() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#dfe3e6'); g.addColorStop(1, '#9aa1a6');
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  x.fillStyle = '#ffffff';
  [[40, 40, 46, 170], [150, 30, 18, 190], [300, 50, 60, 150], [430, 36, 22, 180]].forEach(r => x.fillRect(r[0], r[1], r[2], r[3]));
  x.fillStyle = '#5d646a';
  [[110, 60, 14, 150], [240, 40, 26, 170], [380, 70, 12, 130]].forEach(r => x.fillRect(r[0], r[1], r[2], r[3]));
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function shadowTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 32;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 16, 2, 64, 16, 62);
  g.addColorStop(0, 'rgba(0,0,0,.2)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.setTransform(1, 0, 0, 0.25, 0, 12); x.fillStyle = g; x.fillRect(0, -40, 128, 120);
  return new THREE.CanvasTexture(c);
}

export function create() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'bt3d';
  const refl = document.createElement('canvas');      // 倒影
  refl.className = 'bt3d refl';
  const rctx = refl.getContext('2d');
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromEquirectangular(softbox()).texture;
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(-60, 120, 200); scene.add(sun);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -600, 600);
  camera.position.z = 200;

  const lathe = pts => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 64);
  const bodyGeo = lathe(BODY), baseGeo = lathe(BASE), collarGeo = lathe(COLLAR), pumpGeo = lathe(PUMP), capGeo = lathe(CAP);
  // 透明塑膠：很淡的反光面（裡外各一層）＋邊緣變深的輪廓，不然在淺色底上看不出形狀
  const glass = (side, op) => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: op,
    clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.7, depthWrite: false, side: side });
  const rimMat = strength => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vN; void main(){ float f = 1.0 - abs(normalize(vN).z); float a = (pow(f, 3.2) * 0.9 + 0.012) * ' + strength.toFixed(2) + ';' +
      ' gl_FragColor = vec4(mix(vec3(0.62, 0.70, 0.76), vec3(0.30, 0.38, 0.45), pow(f, 5.0)), a); }' });
  const glint = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.FrontSide,
    vertexShader: 'varying vec3 vN; varying float vY; void main(){ vN = normalize(normalMatrix * normal); vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vN; varying float vY; void main(){ vec3 n = normalize(vN); float a = smoothstep(0.10, 0.02, abs(n.x + 0.62)) * 0.8 + smoothstep(0.035, 0.0, abs(n.x - 0.74)) * 0.5;' +
      ' a *= smoothstep(1.0, 4.0, vY) * smoothstep(0.45, 0.2, abs(n.y)); gl_FragColor = vec4(1.0, 1.0, 1.0, a); }' });
  const white = new THREE.MeshStandardMaterial({ color: 0xf1f2f3, roughness: 0.4, metalness: 0, envMapIntensity: 0.8 });
  const piston = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.5, transparent: true, opacity: 0.85 });
  const shTex = shadowTex(), loader = new THREE.TextureLoader();

  function mesh(geo, mat, order, y) { const m = new THREE.Mesh(geo, mat); m.renderOrder = order; if (y) m.position.y = y; return m; }
  const bottles = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    g.add(mesh(bodyGeo, glass(THREE.BackSide, 0.05), 1), mesh(bodyGeo, rimMat(1), 2), mesh(bodyGeo, glass(THREE.FrontSide, 0.1), 3), mesh(bodyGeo, glint, 7));
    g.add(mesh(baseGeo, glass(THREE.FrontSide, 0.22), 2), mesh(baseGeo, rimMat(1.3), 2));                 // 厚瓶底
    const ring = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.35, 8, 48), rimMat(1.6)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.6; ring.renderOrder = 2; g.add(ring);
    g.add(mesh(new THREE.CylinderGeometry(13.9, 13.9, 2.6, 48), piston, 2, 11.2));                      // 活塞
    // 白色瓶肩和按壓頭：白色放在淺色底上看不出形狀，所以也加一層邊緣變深的輪廓
    g.add(mesh(collarGeo, white, 5), mesh(pumpGeo, white, 5), mesh(collarGeo, rimMat(1.4), 5), mesh(pumpGeo, rimMat(1.6), 5));
    const nozzle = mesh(new THREE.CylinderGeometry(1.5, 1.7, 6, 16), white, 5, 95.5); nozzle.rotation.z = Math.PI / 2; nozzle.position.x = -11.5; g.add(nozzle);
    g.add(mesh(capGeo, glass(THREE.BackSide, 0.06), 6), mesh(capGeo, rimMat(0.9), 6), mesh(capGeo, glass(THREE.FrontSide, 0.12), 6), mesh(capGeo, glint, 8));
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(48, 12), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
    shadow.renderOrder = 0;
    scene.add(shadow, g);
    bottles.push({ g, shadow, label: null, src: '' });
  }

  let tx = 0, ty = 0, rx = 0, ry = 0, want = 0, shown = 0, raf = 0, floorPx = 0;
  function frame() {
    raf = canvas.isConnected ? requestAnimationFrame(frame) : 0;
    if (!raf) return;
    // 只跟著滑鼠轉；滑鼠不動就停在原地，一開始是正面朝前
    ry += (tx - ry) * 0.08; rx += (ty - rx) * 0.08;
    shown += (want - shown) * 0.16;
    bottles.forEach((b, i) => {
      b.g.rotation.y = ry + (i - 1) * 0.06; b.g.rotation.x = rx;
      if (b.label) { b.label.material.opacity = shown; b.label.visible = shown > 0.01; b.gloss.uniforms.op.value = shown; }
    });
    renderer.render(scene, camera);
    // 倒影：把地板線以上的畫面翻下來，淡淡地貼在地板線下面（漸層遮罩在 CSS）
    rctx.clearRect(0, 0, refl.width, refl.height);
    rctx.save(); rctx.globalAlpha = 0.16; rctx.translate(0, 2 * floorPx); rctx.scale(1, -1);
    rctx.drawImage(canvas, 0, 0, canvas.width, floorPx, 0, 0, canvas.width, floorPx);
    rctx.restore();
  }

  return {
    canvas,
    mount(host) {
      if (canvas.parentNode !== host) { host.innerHTML = ''; host.appendChild(refl); host.appendChild(canvas); }
      if (!raf) raf = requestAnimationFrame(frame);
    },
    // geo：shared.js 算好的版面（像素）；bt：瓶子的外框尺寸（mm）；items：要貼上去的三張貼紙
    layout(geo, size, bt, items) {
      const k = geo.k, w = size.w / k, h = size.h / k;
      renderer.setSize(size.w, size.h, false);
      refl.width = canvas.width; refl.height = canvas.height;
      camera.left = -w / 2; camera.right = w / 2; camera.top = h / 2; camera.bottom = -h / 2; camera.updateProjectionMatrix();
      const floorCss = geo.bottles[0].top + bt.h * k;
      floorPx = Math.round(floorCss * canvas.width / size.w);
      const fade = bt.h * k * 0.15;      // 倒影只留短短一截、很淡
      const m = 'linear-gradient(to bottom, transparent ' + floorCss + 'px, #000 ' + (floorCss + 1) + 'px, transparent ' + (floorCss + fade) + 'px)';
      refl.style.webkitMaskImage = m; refl.style.maskImage = m;
      geo.bottles.forEach((p, i) => {
        const b = bottles[i], x = (p.x - size.w / 2) / k, bottom = (size.h / 2 - floorCss) / k;
        b.g.position.set(x, bottom, 0);
        b.shadow.position.set(x, bottom - 0.3, -40);
        const it = items[i], src = 'assets/' + it.id + '-thumb.webp';
        if (b.src !== src) {
          if (b.label) { b.g.remove(b.label); b.label.geometry.dispose(); }
          const th = it.wMm / (R + 0.35);
          const tex = loader.load(src); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
          b.label = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.35, R + 0.35, it.hMm, 48, 1, true, -th / 2, th),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, side: THREE.DoubleSide, alphaTest: 0.02 }));      // 不吃打光，顏色才跟貼紙本人一樣
          b.label.position.y = bt.h - bt.labelY; b.label.renderOrder = 4; b.label.visible = false;
          // 亮面貼紙：一道直的高光，只落在貼紙形狀上，瓶子轉的時候會在貼紙上滑過去
          b.gloss = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.FrontSide, uniforms: { map: { value: tex }, op: { value: 0 } },
            vertexShader: 'varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: 'uniform sampler2D map; uniform float op; varying vec2 vUv; varying vec3 vN; void main(){ float a = texture2D(map, vUv).a;' +
              ' float x = normalize(vN).x + 0.32; float g = smoothstep(0.09, 0.0, abs(x)) * 0.5 + smoothstep(0.45, 0.0, abs(x)) * 0.07; gl_FragColor = vec4(1.0, 1.0, 1.0, a * g * op); }' });
          const gl = new THREE.Mesh(b.label.geometry, b.gloss); gl.renderOrder = 4.5; b.label.add(gl);
          b.g.add(b.label); b.src = src;
        }
      });
    },
    labels(on, now) { want = on ? 1 : 0; if (now) shown = want; },
    pointer(x, y) { tx = (x - 0.5) * 1.5; ty = (y - 0.5) * 0.35; }
  };
}

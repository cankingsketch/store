// 罐罐吸麵金屬徽章的 3D 預覽：34.1 × 35 mm，照給工廠的稿（build_badge.py 產的 assets/badge-*）。
// 正面是「凸起鍍金」的金屬線，線和線中間填色（白、7548C 黃、1655C 橘、Cool Gray 10C）比金屬線低一點；
// 背面是鍍金的平面＋兩顆背扣（直徑約 11 mm）。
// 外形：輪廓（badge-shape.json）用 three.js 內建的 ExtrudeGeometry 擠出 1.6 mm、邊緣倒角；
// 金屬線凸起不建模，用法線貼圖做（從鍍金遮罩算），再用金屬度貼圖讓金屬線反射環境、填色的地方像亮面的漆。
// 滑鼠移動會輕輕轉；點一下翻到背面看背扣。介面跟 coaster3d.js 一樣：create(art, gold) → { mount, pointer }
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const T = 1.6, BV = 0.3;                      // 厚度、倒角（mm）

function envTex() {
  // 拍金屬飾品的打法：亮的柔光箱長條＋暗底，金屬線轉一下就會閃過亮條
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#d9d6d2'); g.addColorStop(0.5, '#8d8a86'); g.addColorStop(1, '#3a3836');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
  x.fillStyle = '#ffffff';
  [[120, 50, 140, 260], [420, 30, 50, 300], [620, 60, 170, 220], [900, 40, 40, 280]].forEach(r => x.fillRect(...r));
  x.fillStyle = '#2a2826';
  [[300, 80, 70, 250], [500, 60, 80, 260], [820, 70, 50, 240]].forEach(r => x.fillRect(...r));
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 鍍金遮罩 → 金屬度、粗糙度、法線（金屬線高、填色低，交界是一道斜坡）
function maps(img) {
  const n = 1024, w = n, h = Math.round(n * img.naturalHeight / img.naturalWidth);
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const src = mk(), sx = src.getContext('2d'); sx.drawImage(img, 0, 0, w, h);
  const m = sx.getImageData(0, 0, w, h).data;
  const bl = mk(), bx = bl.getContext('2d'); bx.filter = 'blur(1.5px)'; bx.drawImage(img, 0, 0, w, h);
  const b = bx.getImageData(0, 0, w, h).data;
  const met = mk(), mx = met.getContext('2d'), md = mx.createImageData(w, h);
  const nor = mk(), nx = nor.getContext('2d'), nd = nx.createImageData(w, h);
  const H = (x, y) => b[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4] / 255;
  const K = 2.2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, g = m[i] / 255;
    // 金屬度貼圖用 B、粗糙度用 G：金屬線 金屬 1／粗糙 0.22；填色 金屬 0／粗糙 0.32
    md.data[i] = 255; md.data[i + 1] = Math.round((0.32 - 0.10 * g) * 255); md.data[i + 2] = Math.round(g * 255); md.data[i + 3] = 255;
    const gx = (H(x - 1, y) - H(x + 1, y)) * K, gy = (H(x, y + 1) - H(x, y - 1)) * K;   // 畫布 y 朝下、貼圖 v 朝上
    const l = Math.hypot(gx, gy, 1);
    nd.data[i] = (gx / l * 0.5 + 0.5) * 255; nd.data[i + 1] = (gy / l * 0.5 + 0.5) * 255; nd.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; nd.data[i + 3] = 255;
  }
  mx.putImageData(md, 0, 0); nx.putImageData(nd, 0, 0);
  return { mr: new THREE.CanvasTexture(met), nrm: new THREE.CanvasTexture(nor) };
}

export function create(artUrl, goldUrl) {
  const canvas = document.createElement('canvas');
  // touch-action:none：手機上手指在徽章上拖是要轉它，不是捲動整頁（他反映的）
  canvas.style.cssText = 'display:block;width:100%;height:100%;cursor:pointer;touch-action:none';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  scene.environment = envTex();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 1000);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(-30, 40, 60); scene.add(key);

  const goldMetal = new THREE.MeshStandardMaterial({ color: 0xd9ad4a, metalness: 1, roughness: 0.25 });
  const backMetal = new THREE.MeshStandardMaterial({ color: 0xe8c66a, metalness: 1, roughness: 0.42 });   // 背面霧一點
  const art = new THREE.TextureLoader().load(artUrl); art.colorSpace = THREE.SRGBColorSpace; art.anisotropy = 8;
  // 填色的漆要跟稿一樣鮮豔：補一點自發光，不然被環境光一照就發白（橘色會變粉橘）
  const face = new THREE.MeshPhysicalMaterial({ map: art, metalness: 1, roughness: 1, clearcoat: 0.4, clearcoatRoughness: 0.15, envMapIntensity: 0.8,
    emissiveMap: art, emissive: 0xffffff, emissiveIntensity: 0.22 });
  const goldImg = new Image();
  goldImg.onload = () => {
    const m = maps(goldImg);
    face.metalnessMap = m.mr; face.roughnessMap = m.mr; face.normalMap = m.nrm; face.normalScale.set(1, 1); face.needsUpdate = true;
  };
  goldImg.src = goldUrl;

  const badge = new THREE.Group(), spin = new THREE.Group();
  spin.add(badge); scene.add(spin);
  fetch(goldUrl.replace(/badge-gold\.png.*/, 'badge-shape.json')).then(r => r.json()).then(sp => {
    const sh = new THREE.Shape(sp.outline.map(p => new THREE.Vector2(p[0], p[1])));
    const depth = T - 2 * BV;
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: BV, bevelSize: BV * 0.6, bevelSegments: 4, curveSegments: 4 });
    g.translate(0, 0, -depth / 2);
    // 正面（頂蓋 +z）的 UV 對到彩稿
    const p = g.attributes.position, nn = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) if (Math.abs(nn.getZ(i)) > 0.99) uv.setXY(i, p.getX(i) / sp.w + 0.5, p.getY(i) / sp.h + 0.5);
    const caps = g.groups[0].count, all = p.count;
    g.clearGroups(); g.addGroup(0, caps / 2, 0); g.addGroup(caps / 2, caps / 2, 1); g.addGroup(caps, all - caps, 2);
    badge.add(new THREE.Mesh(g, [backMetal, face, goldMetal]));
    // 背扣：細針＋蝴蝶扣（圓盤、外圈、中間鼓起）
    sp.pins.forEach(([x, y, d]) => {
      const pin = new THREE.Group(); pin.position.set(x, y, -T / 2); badge.add(pin);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 7, 16), goldMetal);
      post.rotation.x = Math.PI / 2; post.position.z = -3.5; pin.add(post);
      const r = d / 2;
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.9, 40), goldMetal);
      disc.rotation.x = Math.PI / 2; disc.position.z = -4.6; pin.add(disc);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r - 0.4, 0.45, 12, 48), goldMetal); rim.position.z = -5.1; pin.add(rim);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), goldMetal);
      dome.rotation.x = -Math.PI / 2; dome.scale.set(1, 0.45, 1); dome.position.z = -5.05; pin.add(dome);
    });
  });

  // 姿勢：正面朝鏡頭、稍微往後躺；滑鼠讓它左右上下轉，點一下翻面
  let tx = 0, ty = 0, rx = 0, ry = 0, flip = 0, flipT = 0, raf = 0;
  canvas.addEventListener('click', () => { flipT = flipT ? 0 : Math.PI; });
  function frame() {
    raf = canvas.isConnected ? requestAnimationFrame(frame) : 0;
    if (!raf) return;
    rx += (ty - rx) * 0.08; ry += (tx - ry) * 0.08; flip += (flipT - flip) * 0.1;
    spin.rotation.set(-0.25 + rx, ry + flip, 0, 'XYZ');
    renderer.render(scene, camera);
  }
  return {
    canvas,
    mount(host) {
      if (canvas.parentNode !== host) { host.innerHTML = ''; host.appendChild(canvas); }
      flipT = flip = 0;                    // 每次打開都從正面開始
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h;
      camera.position.z = (35 * 1.7) / (2 * Math.tan(THREE.MathUtils.degToRad(15)) * Math.min(1, camera.aspect));
      camera.updateProjectionMatrix();
      if (!raf) raf = requestAnimationFrame(frame);
    },
    pointer(x, y) { tx = (x - 0.5) * 1.2; ty = (y - 0.5) * 0.8; }
  };
}

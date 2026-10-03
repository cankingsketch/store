// 陶瓷吸水杯墊的 3D 預覽：直徑 11cm、厚 0.5cm，邊緣圓角。
// 表面是霧面的陶瓷印刷；印刷檔「晶透浮雕黑稿」那些地方有 UV 亮光油：像滴膠，會反光、而且圓圓地凸起。
// 光油用貼圖做：clearcoatMap（哪裡有亮面）、roughnessMap（光油處很光滑）、clearcoatNormalMap（膠的圓弧），
// 再疊一層自己畫的高光（水滴上的小亮點、背光邊的暗圈）。不用另外建模：膠只有零點幾公釐高，從側面看不出輪廓，
// 看得出來的全是光怎麼在圓弧上走，用法線算就夠了。
// 杯墊跟著滑鼠轉，反光就會在水花上滑過去。shared.js 需要時才動態載入。
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const R = 55, H = 5, FILLET = 1.4;
let ANISO = 8;

function envTex() {
  // 反射用的環境：商品攝影拍亮面的打法——暗的攝影棚＋幾條很亮的長條燈。
  // 霧面陶瓷只會吃到「平均」的亮度（整體偏暗一點），亮面光油會清楚映出亮條和暗底，對比就出來了
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#8e9398'); g.addColorStop(0.5, '#6b7075'); g.addColorStop(1, '#3a3e42');   // 試過再暗 10%，整體發灰，他覺得這個亮度比較好
  x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
  x.fillStyle = '#ffffff';
  [[130, 60, 120, 230], [400, 40, 46, 270], [590, 60, 150, 200], [880, 50, 34, 250]].forEach(r => x.fillRect(r[0], r[1], r[2], r[3]));
  x.fillStyle = '#1e2124';
  [[300, 70, 60, 240], [480, 50, 70, 250], [790, 70, 60, 220]].forEach(r => x.fillRect(r[0], r[1], r[2], r[3]));
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 從光油遮罩做出三張貼圖
function uvMaps(img) {
  const n = img.naturalWidth, mk = () => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
  const src = mk(), sx = src.getContext('2d'); sx.drawImage(img, 0, 0);
  const m = sx.getImageData(0, 0, n, n).data;
  const rough = mk(), rx = rough.getContext('2d'), rd = rx.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const v = m[i * 4] / 255;                         // 1＝光油
    const r = Math.round((0.78 - 0.72 * v) * 255);    // 陶瓷霧面 0.78、光油 0.06
    rd.data[i * 4] = rd.data[i * 4 + 1] = rd.data[i * 4 + 2] = r; rd.data[i * 4 + 3] = 255;
  }
  rx.putImageData(rd, 0, 0);
  // 滴膠的高度：光油像一層水，邊緣被表面張力拉成圓弧、中間平。
  // 把遮罩模糊一次：離邊緣越遠值越接近 1；在邊緣是 0.5 → 換成 0～1 再開根號，就是圓弧的斷面。
  // 很細的線本身就到不了 1，所以細線比較低、大塊的水花比較飽滿，跟真的滴膠一樣
  const EDGE = n / 160;                                // 圓弧寬度約 0.7mm（2200px 時約 14px）
  const bl = mk(), blx = bl.getContext('2d');
  blx.filter = 'blur(' + EDGE + 'px)'; blx.drawImage(img, 0, 0);
  const b = blx.getImageData(0, 0, n, n).data;
  const h = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) {
    const v = Math.min(1, Math.max(0, (b[i * 4] / 255 - 0.5) * 2));
    h[i] = (m[i * 4] / 255) * Math.sqrt(v);
  }
  // 法線貼圖（給 clearcoat：亮面那層膠自己的凹凸，底下的印刷是平的）
  const SLOPE = EDGE * 0.45;                           // 高度（以像素計）：膠厚約為圓弧寬的一半
  const nc = mk(), ncx = nc.getContext('2d'), nd = ncx.createImageData(n, n);
  const hc = mk(), hcx = hc.getContext('2d'), hd = hcx.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x;
    const gx = (h[y * n + Math.max(x - 1, 0)] - h[y * n + Math.min(x + 1, n - 1)]) * 0.5 * SLOPE;
    const gy = (h[Math.min(y + 1, n - 1) * n + x] - h[Math.max(y - 1, 0) * n + x]) * 0.5 * SLOPE;   // 畫布 y 朝下、貼圖 v 朝上
    const l = Math.hypot(gx, gy, 1);
    nd.data[i * 4] = (gx / l * 0.5 + 0.5) * 255; nd.data[i * 4 + 1] = (gy / l * 0.5 + 0.5) * 255; nd.data[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; nd.data[i * 4 + 3] = 255;
    hd.data[i * 4] = hd.data[i * 4 + 1] = hd.data[i * 4 + 2] = h[i] * 255; hd.data[i * 4 + 3] = 255;
  }
  ncx.putImageData(nd, 0, 0); hcx.putImageData(hd, 0, 0);
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; return t; };
  return { coat: tex(src), rough: tex(rough), normal: tex(nc), height: tex(hc) };
}

export function create(artUrl, uvUrl) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  // 超取樣：比螢幕多畫 1.5 倍像素，斜看時細線和水花邊緣才不會糊
  renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * 1.5, 3));
  ANISO = renderer.capabilities.getMaxAnisotropy();
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement; canvas.className = 'coaster3d';
  // 手機上手指在畫面裡拖是要轉它，不是捲動整頁（他反映的，跟徽章一起改）
  canvas.style.touchAction = 'none';
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromEquirectangular(envTex()).texture;
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(-80, 160, 120); scene.add(key);
  const camera = new THREE.PerspectiveCamera(30, 1, 10, 2000);
  camera.position.set(0, 0, 330);

  const coaster = new THREE.Group();
  // 側邊＋底：白色陶瓷，上下邊緣倒圓角
  const prof = [[0, 0], [R - FILLET, 0]];
  for (let i = 1; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * Math.PI / 2; prof.push([R - FILLET + Math.cos(a) * FILLET, FILLET + Math.sin(a) * FILLET]); }
  for (let i = 1; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; prof.push([R - FILLET + Math.cos(a) * FILLET, H - FILLET + Math.sin(a) * FILLET]); }
  prof.push([R - FILLET - 0.3, H]);
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 128),
    new THREE.MeshPhysicalMaterial({ color: 0xf3f1ec, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.25 }));
  coaster.add(body);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(R - FILLET, 96), new THREE.MeshStandardMaterial({ color: 0xe6e2da, roughness: 0.95 }));
  bottom.rotation.x = Math.PI / 2; coaster.add(bottom);
  // 頂面：印刷圖＋光油
  const loader = new THREE.TextureLoader();
  const art = loader.load(artUrl); art.colorSpace = THREE.SRGBColorSpace; art.anisotropy = ANISO;
  // envMapIntensity 壓低：霧面陶瓷不該被環境光洗白，亮面的反光交給 clearcoat
  // 霧面打光下白色會偏灰；拿印刷圖本身當一點自發光，白底才會跟側邊的白陶瓷一樣白，顏色也不會被洗淡
  const topMat = new THREE.MeshPhysicalMaterial({ map: art, roughness: 0.78, clearcoat: 0, clearcoatRoughness: 0.03, envMapIntensity: 0.55,
    emissive: 0xffffff, emissiveMap: art, emissiveIntensity: 0.16 });
  const top = new THREE.Mesh(new THREE.CircleGeometry(R - FILLET - 0.3, 128), topMat);
  top.rotation.x = -Math.PI / 2; top.position.y = H + 0.01;
  // CircleGeometry 的 UV 是平面投影（0～1），剛好對到印刷圖的正方形範圍。
  // 印刷圖是 110mm 的正方形、頂面只有 107.5mm，縮一點讓圖跟刀模對齊
  const k = (R - FILLET - 0.3) / R;
  for (let i = 0; i < top.geometry.attributes.uv.count; i++) {
    const u = top.geometry.attributes.uv.getX(i), v = top.geometry.attributes.uv.getY(i);
    top.geometry.attributes.uv.setXY(i, 0.5 + (u - 0.5) * k, 0.5 + (v - 0.5) * k);
  }
  coaster.add(top);
  const uvImg = new Image(); uvImg.crossOrigin = 'anonymous';
  uvImg.onload = () => {
    const m = uvMaps(uvImg);
    topMat.clearcoat = 1; topMat.clearcoatMap = m.coat; topMat.roughnessMap = m.rough; topMat.roughness = 1;
    topMat.clearcoatNormalMap = m.normal; topMat.clearcoatNormalScale = new THREE.Vector2(1, 1); topMat.needsUpdate = true;
    // 滴膠的亮光層：環境反射不一定剛好映在水花上，所以另外畫會跟著角度移動的光：
    //   ・圓弧朝光的那一側：一顆小而銳利的高光（水滴最像水滴的地方）
    //   ・背光那側的邊：暗一圈（膠的邊緣把光折走）
    //   ・背光那側的內緣：一點透過膠聚起來的亮光（焦散），讓膠看起來是透明的、不是白漆
    //   ・整片掃過的柔光帶，只在平的頂面
    gloss = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      uniforms: { raw: { value: m.coat }, hgt: { value: m.height }, sweep: { value: 0.5 }, ldir: { value: new THREE.Vector2(-0.6, 0.8) }, px: { value: 1.5 / uvImg.naturalWidth } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform sampler2D raw, hgt; uniform float sweep, px; uniform vec2 ldir; varying vec2 vUv;',
        'void main(){',
        '  float m = texture2D(raw, vUv).r;',
        '  float h = texture2D(hgt, vUv).r;',
        '  vec2 g = vec2(texture2D(hgt, vUv + vec2(px, 0.)).r - texture2D(hgt, vUv - vec2(px, 0.)).r,',
        '                texture2D(hgt, vUv + vec2(0., px)).r - texture2D(hgt, vUv - vec2(0., px)).r) * 3.0;',
        '  float slope = length(g);',
        '  float f = slope > 1e-3 ? dot(g / slope, -ldir) : 0.;      // 1＝這段圓弧朝著光',
        '  float spec = pow(max(f, 0.), 6.) * smoothstep(0.08, 0.5, slope) * smoothstep(0.15, 0.6, h);',
        '  float shade = max(-f, 0.) * smoothstep(0.05, 0.6, slope) * (1. - h);',
        '  float caus = max(-f, 0.) * smoothstep(0.35, 0.8, h) * smoothstep(0.02, 0.25, slope);',
        '  float d = (vUv.x * 0.75 + vUv.y * 0.55) - sweep;',
        '  float band = (exp(-d * d / 0.006) + 0.35 * exp(-d * d / 0.05)) * smoothstep(0.7, 1., h);',
        '  float hi = m * (1.0 * band + 0.10) + spec * 1.3 + caus * 0.35;',      // 光油高光再加強（方案 3）
        '  float lo = shade * 0.55 + m * (1. - band) * 0.07;',   // 光油沒被光掃到的地方微微偏深，像濕濕的一層',
        '  float a = clamp(hi + lo, 0., 1.);',
        '  gl_FragColor = vec4(vec3(hi / max(hi + lo, 1e-4)), a);',
        '}'].join('\n') });
    const g = new THREE.Mesh(top.geometry, gloss); g.position.z = 0.02; g.renderOrder = 2; top.add(g);
  };
  let gloss = null;
  uvImg.src = uvUrl;
  // 桌面上的影子
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const sx = sc.getContext('2d'), sg = sx.createRadialGradient(64, 64, 20, 64, 64, 64);
  sg.addColorStop(0, 'rgba(0,0,0,.28)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = sg; sx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.5, R * 2.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.5; coaster.add(shadow);
  scene.add(coaster);

  // 姿勢：頂面朝向鏡頭、往後躺一點；滑鼠讓它左右上下轉，反光跟著在光油上滑
  const BASE_X = 0.95;                  // 約 54°，看得到頂面和一點側邊厚度
  let tx = 0, ty = 0, rx = 0, ry = 0, raf = 0;
  function frame() {
    raf = canvas.isConnected ? requestAnimationFrame(frame) : 0;
    if (!raf) return;
    rx += (ty - rx) * 0.08; ry += (tx - ry) * 0.08;
    coaster.rotation.set(BASE_X + rx, ry, 0, 'XYZ');
    if (gloss) {
      gloss.uniforms.sweep.value = 0.62 + ry * 0.55 + rx * 0.45;     // 轉到哪，高光就掃到哪
      // 光的方向也跟著轉：每顆水滴上的小高光會在圓弧上滑動
      gloss.uniforms.ldir.value.set(-0.6 - ry * 1.4, 0.8 - rx * 1.6).normalize();
    }
    renderer.render(scene, camera);
  }
  return {
    canvas,
    mount(host) {
      if (canvas.parentNode !== host) { host.innerHTML = ''; host.appendChild(canvas); }
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h;
      // 讓杯墊直徑大約佔畫面短邊的九成
      const fit = Math.max(1, (R * 2.15) / (2 * Math.tan(THREE.MathUtils.degToRad(15)) * Math.min(1, camera.aspect)));
      camera.position.z = fit; camera.updateProjectionMatrix();
      if (!raf) raf = requestAnimationFrame(frame);
    },
    pointer(x, y) { tx = (x - 0.5) * 1.1; ty = (y - 0.5) * 0.6; }
  };
}

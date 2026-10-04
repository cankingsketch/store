// 誇誇印章的 3D 預覽：3.5×3.5cm、厚 2cm 的透明壓克力磚（邊緣導圓角），
// 頂面 UV 印刷（白墨打底＋黑線），底下黏一片透明橡皮章（線稿凸起，透過壓克力看得到）。
// 透明厚壓克力靠一般貼圖做不像，所以整塊磚在 fragment shader 裡做光線追蹤：
// 進入時折射、穿過磚：撞到頂面背後是白墨、撞到底面就穿進橡皮章看到凸起的線，其他地方直接穿出去
// （不做內部反彈，側面才不會映出一堆倒影）。shared.js 需要時才動態載入。
// 蓋章（他選的 B）：磚底下鋪一張紙，點一下印章 → 抬起、移到紙上、壓下去、抬起來移到旁邊，紙上留下章印。
// 蓋下去的動態（2026-10-04 他要的）：往下加速落到紙上 →「咚」→ 底下的軟水晶膠被壓扁、往外擠一點 →
// 前後輕輕晃兩下把墨壓實→ 抬起時水晶膠黏著紙被拉長一下才「啵」地離開、彈回原狀 → 移到旁邊放著。
// 聲音都用 Web Audio 即時合成，沒有音檔：落下是短短悶悶的「啪」，離開是一聲小小的撕離聲（紙張摩擦聲他說先拿掉）。
// 章印＝橡皮章圖的 R（凸起的線；從磚頂往下看是正的，蓋出來也是正的），墨色有顆粒、偶爾沒吃到墨、邊緣微暈、每次歪一點。
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const W = 35, H = 20;                 // 磚：寬 35mm 正方形、厚 20mm
// build_stamp.py 輸出正方形圖，圖案長邊置中、四周各留 5%：圖檔邊長＝圖案長邊 × 1.1
const PRINT_W = 26 * 1.1;             // 頂面印刷：圖案長邊 26mm
const RUBBER_W = 31 * 1.1;            // 橡皮章：圖案長邊 31mm
const RUBBER_T = 2.5;                 // 橡皮章厚度（磚因此被墊高）
const BG = [0.965, 0.962, 0.952];     // 燈箱背景色（.pl-3d 的漸層中間值），透過壓克力看到的「桌面」用這個

const FRAG = `
precision highp float;
uniform sampler2D tPrint, tRubber;
uniform vec3 uCamL, uBg;
uniform mat3 uRot;
uniform float uAspect, uPrintW, uRubW, uPx, uPixAng;
varying vec3 vLocal;
const vec3 B = vec3(${W / 2}, ${H / 2}, ${W / 2});
const float RAD = 1.6;           // 導圓角半徑
// 壓克力實際折射率 1.49，但那樣從上面看，底下的橡皮章會被「拉近」到只剩 2/3 深，看起來像浮在中間；
// 調低一點，視差大一些，橡皮章才看得出是在最底下
const float IOR = 1.28;
uniform float uRT;                // 橡皮章（軟水晶膠）目前的厚度：蓋下去會被壓薄
#define RT uRT
#define FLOOR_Y (-B.y - uRT)
const vec3 L = normalize(vec3(-0.45, 0.8, 0.45));

float sd(vec3 p) { vec3 q = abs(p) - B + RAD; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.) - RAD; }
vec3 nrm(vec3 p) {
  const vec2 e = vec2(0.003, -0.003);
  return normalize(e.xyy * sd(p + e.xyy) + e.yyx * sd(p + e.yyx) + e.yxy * sd(p + e.yxy) + e.xxx * sd(p + e.xxx));
}
float fres(float c) { return 0.04 + 0.96 * pow(1. - clamp(c, 0., 1.), 5.); }
float sdRect(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }

// 攝影棚：上方大片柔光、左右兩道窗光、地平線附近幾塊暗的遮光板（壓克力的稜線靠它們才看得出來）
vec3 env(vec3 dl) {
  vec3 d = normalize(uRot * dl);
  if (d.y < -0.02) return uBg;
  float az = atan(d.x, -d.z);
  vec3 c = mix(uBg * 0.97, vec3(1.0), smoothstep(0.2, 0.75, d.y));
  float band = smoothstep(-0.12, -0.02, d.y) * smoothstep(0.5, 0.35, d.y);
  float flag = smoothstep(0.17, 0.13, abs(fract(az * 0.6366 + 0.2) - 0.5));
  c = mix(c, vec3(0.45, 0.46, 0.48), band * flag * 0.6);   // 太暗會在側面折出一條黑線
  float win = smoothstep(0.22, 0.16, abs(abs(az) - 1.15)) * smoothstep(-0.05, 0.05, d.y) * smoothstep(0.7, 0.55, d.y);
  c = mix(c, vec3(1.12), win);
  return c;
}
// 透過壓克力看到的桌面：光會穿過壓克力，所以磚底下只比外面暗一點點，中間還有一點聚光
vec3 floorCol(vec2 q) {
  float d = sdRect(q, B.xz, RAD);
  float s = 1. - smoothstep(-3., 9., d);
  float edge = smoothstep(-5., 0., d) * s;
  float caustic = smoothstep(-6., -14., d) * 0.05;
  return uBg * (1. - 0.05 * s - 0.08 * edge) + caustic;
}
vec3 escape(vec3 p, vec3 d) {
  if (d.y < -0.001) { float t = (FLOOR_Y - p.y) / d.y; if (t > 0.) return floorCol((p + d * t).xz); }
  return env(d);
}
vec2 printUv(vec3 p) { return vec2(0.5 + p.x / uPrintW, 0.5 - p.z / (uPrintW * uAspect)); }
vec2 rubUv(vec3 p) { return vec2(0.5 + p.x / uRubW, 0.5 - p.z / (uRubW * uAspect)); }
float inside01(vec2 uv) { return step(0., uv.x) * step(uv.x, 1.) * step(0., uv.y) * step(uv.y, 1.); }

// 光線從壓克力底面穿進橡皮章：凸起的線在橡皮章最底下（有視差），邊緣會折光，所以亮一邊暗一邊
vec3 rubber(vec3 p, vec3 d) {
  vec3 pb = p + d * (RT / max(-d.y, 0.2));               // 走到橡皮章底面
  vec2 uv = rubUv(pb);
  float m = texture2D(tRubber, uv).r;
  float mx = texture2D(tRubber, uv + vec2(uPx, 0.)).r - texture2D(tRubber, uv - vec2(uPx, 0.)).r;
  float my = texture2D(tRubber, uv + vec2(0., uPx)).r - texture2D(tRubber, uv - vec2(0., uPx)).r;
  vec2 g = vec2(mx, my);
  float gx = texture2D(tRubber, rubUv(p) + vec2(uPx * 2., 0.)).g - texture2D(tRubber, rubUv(p) - vec2(uPx * 2., 0.)).g;
  float gy = texture2D(tRubber, rubUv(p) + vec2(0., uPx * 2.)).g - texture2D(tRubber, rubUv(p) - vec2(0., uPx * 2.)).g;
  vec3 dOut = refract(d, vec3(0., -1., 0.), IOR);
  vec3 base = dot(dOut, dOut) < 1e-4 ? env(reflect(d, vec3(0., -1., 0.))) * 0.92 : floorCol((pb + dOut * ((FLOOR_Y - pb.y) / min(dOut.y, -0.05))).xz);
  float rel = dot(g, normalize(vec2(-0.55, 0.85)));
  vec3 c = base * (1. - 0.22 * length(g)) + vec3(0.5) * max(rel, 0.) - vec3(0.2) * max(-rel, 0.);
  c = mix(c, vec3(1.0), 0.22 * m);                          // 凸起的地方微微霧白
  c *= 1. - 0.35 * length(vec2(gx, gy));                    // 橡皮片外緣的一圈折光
  return c;
}

// 光線在壓克力裡面走：最多反彈 5 次
vec3 trace(vec3 p, vec3 d) {
  vec3 acc = vec3(0.); float thr = 1.;
  for (int b = 0; b < 5; b++) {
    // 先算方盒的出口，再在圓角附近二分逼近（磚是凸的，沿著光線只會出去一次）
    vec3 tb = (sign(d) * B - p) / d;
    float t1 = min(tb.x, min(tb.y, tb.z));
    float t0 = max(t1 - 4. * RAD, 0.);
    if (sd(p + d * t0) > 0.) t0 = 0.;
    for (int i = 0; i < 12; i++) { float tm = 0.5 * (t0 + t1); if (sd(p + d * tm) < 0.) t0 = tm; else t1 = tm; }
    p += d * t0;
    thr *= exp(-t0 * 0.003);                                // 壓克力很透，只吸一點點光
    vec3 n = nrm(p);
    if (n.y > 0.9) {                                         // 頂面：從背後看到白墨
      vec2 uv = printUv(p); float a = texture2D(tPrint, uv).a * inside01(uv);
      acc += thr * a * vec3(0.94, 0.94, 0.93); thr *= 1. - a;
    } else if (n.y < -0.9) {                                 // 底面：黏著橡皮章的地方光直接穿進去
      // 從側面很斜地看進去時橡皮章會被拉成一大片，像多一個倒影 → 太斜的角度淡掉
      vec2 uv = rubUv(p); float s = texture2D(tRubber, uv).g * inside01(uv) * smoothstep(0.3, 0.6, -d.y);
      if (s > 0.) { acc += thr * s * rubber(p, d); thr *= 1. - s; }
    }
    // 不在裡面反彈：反彈會在四個側面映出印刷和橡皮章的倒影，實物照片看起來側面是乾淨透明的（他糾正過）。
    // 光穿出去就看到外面；斜到全反射的角度就當成看到一片乾淨的亮光
    vec3 dOut = refract(d, -n, IOR);
    acc += thr * (dot(dOut, dOut) < 1e-4 ? escape(p, reflect(d, n)) * 0.97 : escape(p, dOut));
    return acc;
  }
  return acc + thr * uBg;
}

// 磚底下那片透明橡皮章本身（厚 RT）：從側面看得到它的邊，磚才是「坐在」橡皮章上，而不是飄著。
// 形狀照橡皮片的範圍（橡皮圖的 G），在 y = -B.y-RT ～ -B.y 這層裡沿著光線找第一個進到橡皮片裡的點。
float rubberSlab(vec3 ro, vec3 rd, out vec3 col) {
  vec3 lo = vec3(-B.x, -B.y - RT, -B.z), hi = vec3(B.x, -B.y, B.z);
  vec3 ta = (lo - ro) / rd, tb = (hi - ro) / rd;
  vec3 tn = min(ta, tb), tf = max(ta, tb);
  float t0 = max(max(tn.x, tn.y), tn.z), t1 = min(min(tf.x, tf.y), tf.z);
  if (t1 <= max(t0, 0.)) return -1.;
  float dt = (t1 - t0) / 40.;
  for (int i = 0; i <= 40; i++) {
    float t = t0 + dt * float(i);
    vec3 p = ro + rd * t;
    vec2 uv = rubUv(p);
    if (texture2D(tRubber, uv).g * inside01(uv) > 0.5) {
      // 橡皮片邊緣的法線：從橡皮片範圍的坡度來（朝外）
      float e = uPx * 2.;
      vec2 g = vec2(texture2D(tRubber, uv + vec2(e, 0.)).g - texture2D(tRubber, uv - vec2(e, 0.)).g,
                    -(texture2D(tRubber, uv + vec2(0., e)).g - texture2D(tRubber, uv - vec2(0., e)).g));
      vec3 n = length(g) > 1e-4 ? normalize(vec3(-g.x, 0., -g.y)) : vec3(0., 1., 0.);
      float f = fres(abs(dot(rd, n)));
      // 透明矽膠的切邊：大多透出後面的桌面，帶一點霧白，上下兩條細邊稍暗，看得出厚度
      vec3 c = mix(floorCol(p.xz + rd.xz * 3.), vec3(1.), 0.18) * 0.96 + f * env(reflect(rd, n)) * 0.6;
      float yy = (p.y + B.y + RT) / RT;
      c *= 1. - 0.18 * (smoothstep(0.25, 0., yy) + smoothstep(0.75, 1., yy));
      col = c;
      return t;
    }
  }
  return -1.;
}

void main() {
  vec3 rd = normalize(vLocal - uCamL);
  float t = length(vLocal - uCamL) - 0.3;
  float tEnd = t + 2. * length(B) + 1.;
  float dmin = 1e9, tmin = t; bool hit = false;
  for (int i = 0; i < 40; i++) {
    float d = sd(uCamL + rd * t);
    if (d < dmin) { dmin = d; tmin = t; }
    if (d < 0.0015) { hit = true; break; }
    t += d;
    if (t > tEnd) break;
  }
  vec3 rcol;
  float tr = rubberSlab(uCamL, rd, rcol);
  if (tr > 0. && (!hit || tr < t)) { gl_FragColor = vec4(rcol, 1.); return; }
  // 外輪廓抗鋸齒：沒打到但很接近的像素，照最近點著色、按距離淡出
  float pix = tmin * uPixAng;
  float cov = hit ? 1. : 1. - smoothstep(0., pix, dmin);
  if (cov < 0.004) discard;
  if (!hit) t = tmin;
  vec3 p = uCamL + rd * t;
  vec3 n = nrm(p);
  float F = fres(dot(-rd, n));
  vec3 col = F * env(reflect(rd, n));
  float T = 1. - F;
  if (n.y > 0.9) {                                           // 頂面印刷：白墨＋黑線，半光澤
    vec2 uv = printUv(p); vec4 pr = texture2D(tPrint, uv) * inside01(uv);
    float lit = 0.84 + 0.16 * max(dot(uRot * n, L), 0.);
    col += T * pr.a * pr.rgb * lit;
    T *= 1. - pr.a;
  }
  if (T > 0.002) col += T * trace(p - n * 0.004, refract(rd, n, 1. / IOR));
  gl_FragColor = vec4(col, cov);
}`;

const VERT = 'varying vec3 vLocal; void main(){ vLocal = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

export function create(printUrl, rubberUrl) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
  // 每個像素都是自己算的光線，抗鋸齒靠超取樣：比螢幕多畫 1.5 倍
  renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * 1.5, 3));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement; canvas.className = 'stamp3d';
  // 手機上手指在畫面裡拖是要轉它，不是捲動整頁（他反映的，跟徽章一起改）
  canvas.style.touchAction = 'none';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 10, 2000);
  camera.position.set(0, 0, 200);
  const aniso = renderer.capabilities.getMaxAnisotropy();

  const uni = {
    tPrint: { value: null }, tRubber: { value: null },
    uCamL: { value: new THREE.Vector3() }, uRot: { value: new THREE.Matrix3() },
    uBg: { value: new THREE.Vector3(...BG) },
    uAspect: { value: 0.7 }, uPrintW: { value: PRINT_W }, uRubW: { value: RUBBER_W }, uRT: { value: RUBBER_T },
    uPx: { value: 0.002 }, uPixAng: { value: 0.001 }
  };
  let dirty = true;
  const loader = new THREE.TextureLoader();
  const load = (url, key) => loader.load(url, tx => {
    if (uni[key].value) uni[key].value.dispose();
    tx.anisotropy = aniso; tx.needsUpdate = true;
    uni.uAspect.value = tx.image.height / tx.image.width;
    if (key === 'tRubber') { uni.uPx.value = 2.5 / tx.image.width; makeInk(tx.image); }
    uni[key].value = tx; dirty = true;
  });
  // 換款：五款印章共用同一個 viewer，只換兩張圖
  function setArt(printUrl, rubberUrl) { load(printUrl, 'tPrint'); load(rubberUrl, 'tRubber'); }
  setArt(printUrl, rubberUrl);

  // 桌面這一整組（紙、影子、磚）一起跟滑鼠轉；磚在裡面自己動（蓋章動畫）
  const world = new THREE.Group();
  const block = new THREE.Group(); world.add(block);
  const FLOOR = -(H / 2 + RUBBER_T);
  // 紙：14 × 10 cm，每 mm 8px 的畫布；章印畫在上面
  const PW = 140, PD = 100, PXMM = 8;
  const pc = document.createElement('canvas'); pc.width = PW * PXMM; pc.height = PD * PXMM;
  const px = pc.getContext('2d');
  const PAPER = 'rgb(249,247,242)';
  function clearPaper() { px.fillStyle = PAPER; px.fillRect(0, 0, pc.width, pc.height); paperTex.needsUpdate = true; dirty = true; }
  const paperTex = new THREE.CanvasTexture(pc); paperTex.colorSpace = THREE.SRGBColorSpace; paperTex.anisotropy = aniso;
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), new THREE.MeshBasicMaterial({ map: paperTex }));
  paper.rotation.x = -Math.PI / 2; paper.position.y = FLOOR - 0.05; world.add(paper);
  // 紙邊一圈很淡的影子，看得出是一張紙
  const ps = document.createElement('canvas'); ps.width = ps.height = 64;
  const psx = ps.getContext('2d'); psx.fillStyle = 'rgba(0,0,0,0.10)'; psx.filter = 'blur(6px)'; psx.fillRect(10, 10, 44, 44);
  const paperShadow = new THREE.Mesh(new THREE.PlaneGeometry(PW * 1.18, PD * 1.25), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ps), transparent: true, depthWrite: false }));
  paperShadow.rotation.x = -Math.PI / 2; paperShadow.position.set(1.5, FLOOR - 0.3, 2); world.add(paperShadow);
  // 包圍盒比磚大一點點，留給外輪廓抗鋸齒
  const mat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: FRAG, transparent: true });
  // 往下多包橡皮章的厚度
  const box = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, H + RUBBER_T + 0.6, W + 0.6).translate(0, -RUBBER_T / 2, 0), mat);
  box.renderOrder = 2; block.add(box);
  // 磚外面的影子（磚底下那塊在 shader 裡畫，兩邊用同一個公式）；放在桌面上、跟著磚的位置走，磚抬越高越淡
  const shadowA = { value: 0.16 };
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 3, W * 3), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uA: shadowA },
    vertexShader: 'varying vec2 q; void main(){ q = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 q; float sdRect(vec2 p, vec2 b, float r){ vec2 k = abs(p) - b + r; return length(max(k, 0.)) + min(max(k.x, k.y), 0.) - r; }' +
      'uniform float uA; void main(){ float s = 1. - smoothstep(-3., 9., sdRect(q, vec2(' + (W / 2).toFixed(1) + '), 1.6)); gl_FragColor = vec4(vec3(0.), uA * s); }'
  }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = FLOOR + 0.02;
  world.add(shadow);
  scene.add(world);

  // ---- 章印 ----
  let ink = null;                                         // 目前這款的墨（R＝凸起的線）
  function makeInk(img) {
    const n = img.width, c = document.createElement('canvas'); c.width = n; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, n, c.height);
    for (let i = 0; i < n * c.height; i++) { const a = d.data[i * 4]; d.data[i * 4] = 28; d.data[i * 4 + 1] = 24; d.data[i * 4 + 2] = 30; d.data[i * 4 + 3] = a; }
    x.putImageData(d, 0, 0);
    ink = c;
  }
  let noise = null;                                       // 墨色不均：低頻的斑＋細顆粒
  function makeNoise() {
    const n = 512, c = document.createElement('canvas'); c.width = c.height = n;
    const x = c.getContext('2d'), lo = document.createElement('canvas'); lo.width = lo.height = 28;
    const lx = lo.getContext('2d'), ld = lx.createImageData(28, 28);
    for (let i = 0; i < 28 * 28; i++) ld.data[i * 4 + 3] = 165 + Math.random() * 90;
    lx.putImageData(ld, 0, 0); x.drawImage(lo, 0, 0, n, n);
    const d = x.getImageData(0, 0, n, n);
    for (let j = 0; j < n * n; j++) d.data[j * 4 + 3] = Math.min(255, d.data[j * 4 + 3] * (0.8 + Math.random() * 0.32));
    x.putImageData(d, 0, 0); return c;
  }
  // 在紙上 (x, z)（mm，紙中心為原點）蓋一個，角度 rot（跟磚的 rotation.y 一樣）
  function inkAt(x, z, rot) {
    if (!ink) return;
    if (!noise) noise = makeNoise();
    const w = uni.uRubW.value * PXMM, h = w * uni.uAspect.value;
    const c = document.createElement('canvas'); c.width = ink.width; c.height = ink.height;
    const cx = c.getContext('2d');
    cx.filter = 'blur(' + (ink.width / 700).toFixed(2) + 'px)'; cx.drawImage(ink, 0, 0); cx.filter = 'none';   // 邊緣微微暈
    cx.globalCompositeOperation = 'destination-in';
    const o = Math.random() * 180, q = 260 + Math.random() * 120;
    cx.drawImage(noise, o, o, q, q, 0, 0, c.width, c.height);
    px.save(); px.translate((x + PW / 2) * PXMM, (z + PD / 2) * PXMM); px.rotate(-rot);
    px.globalAlpha = 0.86 + Math.random() * 0.12;
    px.drawImage(c, -w / 2, -h / 2, w, h); px.restore();
    paperTex.needsUpdate = true;
  }
  clearPaper();

  // ---- 蓋章動畫：抬起 → 移到要蓋的地方 → 壓下 → 抬起 → 移到旁邊放著 ----
  const REST = { x: -W * 1.05, y: 16, z: -W * 0.55, r: 0.25 };     // 蓋完放在左後方，章印才看得到
  const cur = { x: 0, y: 0, z: 0, r: 0, rx: 0, rz: 0, sq: 0 };   // sq：水晶膠被壓扁的程度（1＝壓到底，負的＝被拉長）
  let anim = null, stamps = 0;
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const EASE_IN = t => t * t * t, EASE_OUT = t => 1 - Math.pow(1 - t, 3);
  const EASE_OUT_BACK = t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);   // 稍微超過再回來（膠彈回去）
  function tween(from, to, ms, done, ez) { return { from: Object.assign({}, from), to, ms, t0: performance.now(), done, ez: ez || ease }; }
  // 蓋章聲。AudioContext 在點擊那一下開（iPhone 規定）
  let ac = null, nbuf = null;
  // 一段濾過的雜訊：type＝lowpass/bandpass/highpass，env＝[[秒, 音量], ...] 的音量折線
  function hiss(at, type, freq, q, env) {
    if (!nbuf) { nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = ac.currentTime + at, n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    n.buffer = nbuf; n.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); env.forEach(([k, v]) => g.gain.linearRampToValueAtTime(v, t + k));
    n.connect(f).connect(g).connect(ac.destination); n.start(t); n.stop(t + env[env.length - 1][0] + 0.02);
  }
  function hum(at, f0, f1, len, vol, type) {
    const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + len + 0.02);
  }
  const SND = {
    // 落下：短短悶悶的「啪」＝一小段低通雜訊＋很低的「咚」（第一版的聲音；厚實版他說像打鼓，改回來）
    thud() {
      if (!ac) return;
      const t = ac.currentTime, n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      const buf = ac.createBuffer(1, ac.sampleRate * 0.12, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      n.buffer = buf; f.type = 'lowpass'; f.frequency.value = 700;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      n.connect(f).connect(g).connect(ac.destination); n.start(t);
      hum(0, 150, 60, 0.14, 0.35);
    },
    // 離開紙：水晶膠從紙上撕離的一小聲「啵」
    peel() {
      if (!ac) return;
      hiss(0, 'highpass', 2600, 0.7, [[0.01, 0.06], [0.08, 0]]);
      hum(0.02, 520, 260, 0.06, 0.07);
    }
  };
  function stampOnce() {
    if (anim) return;
    try {
      if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); }
      if (ac && ac.state === 'suspended') ac.resume();
    } catch (e) { ac = null; }
    // 每次換個地方、歪一點，蓋幾次就排成一小片（五個位置輪流，太多次就清掉重來）
    const SPOTS = [[0, 2], [32, -10], [30, 26], [-26, 24], [2, 34]];   // 避開左後方（印章蓋完放那裡）
    if (stamps && stamps % SPOTS.length === 0) clearPaper();
    const s = SPOTS[stamps % SPOTS.length];
    const T = { x: s[0] + (Math.random() - 0.5) * 6, y: 0, z: s[1] + (Math.random() - 0.5) * 6, r: (Math.random() - 0.5) * 0.18, rx: 0, rz: 0, sq: 0 };
    const at = o => Object.assign({}, T, o);
    const ROCK = 0.022, RUB = 0.42;                       // 晃的角度（弧度，約 1.3°）、晃的總時間
    const steps = [
      tween(cur, { x: cur.x, y: Math.max(cur.y, 14), z: cur.z, r: cur.r, rx: 0, rz: 0, sq: 0 }, cur.y > 10 ? 1 : 220),
      tween(null, at({ y: 14 }), 380),
      tween(null, T, 150, () => { inkAt(T.x, T.z, T.r); SND.thud(); stamps++; }, EASE_IN),   // 加速落下，碰到紙「咚」
      tween(null, at({ sq: 1 }), 110, null, EASE_OUT),                                           // 水晶膠被壓扁、往外擠（紙張摩擦聲他說先拿掉）
      tween(null, at({ sq: 1, rx: ROCK }), RUB * 0.3 * 1000),                                  // 前後晃兩下把墨壓實
      tween(null, at({ sq: 1, rx: -ROCK * 0.8, rz: ROCK * 0.5 }), RUB * 0.4 * 1000),
      tween(null, at({ sq: 1 }), RUB * 0.3 * 1000),
      tween(null, at({ sq: 1 }), 60, () => SND.peel()),
      tween(null, at({ sq: -0.35 }), 170),                                                     // 抬起：膠還黏著紙，被拉長一下
      tween(null, at({ y: 14, sq: 0 }), 240, null, EASE_OUT_BACK),                             // 離開、彈回原狀
      tween(null, Object.assign({ rx: 0, rz: 0, sq: 0 }, REST), 420)
    ];
    let i = 0;
    function next() {
      if (i >= steps.length) { anim = null; return; }
      const st = steps[i++]; st.from = Object.assign({}, cur); st.t0 = performance.now(); anim = st; anim.next = next;
    }
    next(); dirty = true;
    if (!raf) raf = requestAnimationFrame(frame);
  }
  canvas.addEventListener('click', stampOnce);
  canvas.style.cursor = 'pointer';

  // 姿勢：頂面朝鏡頭、轉一點角度露出兩個側面（像照片那樣拿在手上看）
  const BASE_X = 0.78, BASE_Y = 0.42;
  let tx = 0, ty = 0, rx = 0, ry = 0, raf = 0;
  const inv = new THREE.Matrix4();
  function frame() {
    raf = canvas.isConnected ? requestAnimationFrame(frame) : 0;
    if (!raf) return;
    const nx = rx + (ty - rx) * 0.08, ny = ry + (tx - ry) * 0.08;
    if (!dirty && !anim && Math.abs(nx - rx) < 1e-5 && Math.abs(ny - ry) < 1e-5) return;   // 沒在動就不重畫（這個 shader 很吃 GPU）
    rx = nx; ry = ny; dirty = false;
    if (anim) {
      const k = Math.min(1, (performance.now() - anim.t0) / anim.ms), e = anim.ez(k);
      Object.keys(anim.to).forEach(p => { cur[p] = anim.from[p] + (anim.to[p] - anim.from[p]) * e; });
      if (k >= 1) { const a = anim; anim = null; if (a.done) a.done(); a.next(); }
    }
    // 水晶膠壓扁：變薄 40%（磚跟著往下沉）、往外擠 3%；拉長時反過來
    uni.uRT.value = RUBBER_T * (1 - 0.4 * cur.sq); uni.uRubW.value = RUBBER_W * (1 + 0.03 * cur.sq);
    block.position.set(cur.x, cur.y - RUBBER_T * 0.4 * cur.sq, cur.z); block.rotation.set(cur.rx, cur.r, cur.rz);
    shadow.position.x = cur.x; shadow.position.z = cur.z; shadow.rotation.z = cur.r;
    shadowA.value = 0.16 * Math.max(0.25, 1 - cur.y / 30);
    world.rotation.set(BASE_X + rx, BASE_Y + ry, 0, 'XYZ');
    world.updateMatrixWorld();
    inv.copy(block.matrixWorld).invert();
    uni.uCamL.value.copy(camera.position).applyMatrix4(inv);
    uni.uRot.value.setFromMatrix4(block.matrixWorld);
    renderer.render(scene, camera);
  }
  return {
    canvas,
    setArt,
    mount(host) {
      if (canvas.parentNode !== host) { host.innerHTML = ''; host.appendChild(canvas); }
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h;
      // 拉遠到看得到紙、章印和蓋完放在旁邊的印章（磚約佔畫面短邊的四成）
      const fit = (W * 3.6) / (2 * Math.tan(THREE.MathUtils.degToRad(15)) * Math.min(1, camera.aspect));
      camera.position.z = fit; camera.updateProjectionMatrix();
      uni.uPixAng.value = 2 * Math.tan(THREE.MathUtils.degToRad(15)) / (h * renderer.getPixelRatio()) * 1.5;
      dirty = true;
      if (!raf) raf = requestAnimationFrame(frame);
    },
    pointer(x, y) { tx = (x - 0.5) * 0.6; ty = (y - 0.5) * 0.35; }
  };
}

// 明信片卡冊的 3D 預覽：封面 15 × 17 cm、書脊 3 cm，二孔活頁夾（兩個環相距 8 cm），裡面 25 頁透明內頁，
// 每一頁正反兩面各一個口袋（放 10 × 15 cm 明信片），所以一本放 50 張。
// 封面／書脊／封底的圖是印刷檔（NAS 明信集卡冊\6寸4寸活页爱心_厂商用2.psd）裁掉出血做的 assets/album-*.webp。
// 單位都是公分。closed＝闔起來；打開後書攤平：左邊封面內側、中間書脊和環、右邊一疊內頁。
// 用法：const a = create(); a.mount(host); a.setOpen(true); a.flip(1); a.insert({ img, wide })
// 封面的形狀用 three.js 內建的 ExtrudeGeometry：圓角矩形（照實物照片，外側兩角圓 8mm、靠書脊那邊是直角，因為整片 PVC 是連著的）
// 擠出厚度＋倒角，邊緣是軟軟的圓弧，像包了海綿的 PVC
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const W = 15, H = 17, SP = 3, T = 0.5;           // 封面寬、高、書脊寬、封面厚（PVC 包海綿，約 5mm）
const N = 25, GAP = 0.05;                         // 內頁數、每頁厚（含空氣）
const PW = 12.6, PH = 16.2, CW = 10.2, CH = 15.2; // 內頁大小、明信片口袋大小
const HOLE = 1.3;                                 // 內頁靠環那一條（打孔＋熱壓線）的寬

function tex(url, renderer, look) {
  const an = renderer.capabilities.getMaxAnisotropy();
  if (!look) {
    const t = new THREE.TextureLoader().load(url);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = an;
    return t;
  }
  // 封面：先在畫布上調色（照實物照片），再當貼圖
  const c = document.createElement('canvas'), t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = an;
  const img = new Image();
  img.onload = () => {
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.filter = look; x.drawImage(img, 0, 0);
    t.dispose(); t.needsUpdate = true;           // 畫布大小變了：先丟掉 GPU 上那張空的（WebGL2 的貼圖大小配置後不能改），再重新上傳
  };
  img.src = url;
  return t;
}
const LOOK = 'saturate(1.3) hue-rotate(-6deg) brightness(1.04)';
// 透明內頁：四周一圈熱壓的點點線（照實物照片），其他地方幾乎透明
function sleeveTex() {
  const c = document.createElement('canvas'), s = 16;           // 每公分 16px
  c.width = PW * s; c.height = PH * s;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,0.03)'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = 'rgba(255,255,255,0.55)';
  const L = HOLE * s, m = 0.35 * s;
  // 口袋的熱壓線：上、下、外側三邊和靠環那條
  for (let px = L; px < c.width - m; px += 6) { x.fillRect(px, m - 1, 3, 3); x.fillRect(px, c.height - m - 1, 3, 3); }
  for (let py = m; py < c.height - m; py += 6) { x.fillRect(c.width - m - 1, py, 3, 3); x.fillRect(L - 1, py, 3, 3); }
  // 兩個孔（間距 8 cm，跟環對齊）
  x.globalCompositeOperation = 'destination-out';
  [-4, 4].forEach(dy => { x.beginPath(); x.arc(0.6 * s, (PH / 2 - dy) * s, 0.28 * s, 0, 7); x.fill(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// 軟封面的壓痕：PVC 包海綿，離邊約 6mm 熱壓一圈凹線，凹線外是壓扁的平邊、裡面的海綿鼓起來。
// 做成法線貼圖（不用真的建模）：高度＝平邊 0.25、凹線 0、裡面從凹線慢慢鼓到 1。seams＝[左, 右, 上, 下] 各邊壓痕離邊多遠（cm）
function padNormal(wcm, hcm, seams) {
  const s = 40, w = Math.round(wcm * s), h = Math.round(hcm * s);
  const ht = new Float32Array(w * h);
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x / s, Y = y / s;
    // 到壓痕的距離（在壓痕裡面是正的）
    const d = Math.min(X - seams[0], wcm - seams[1] - X, Y - seams[2], hcm - seams[3] - Y);
    let v;
    if (d < -0.07) v = 0.25 * ss(-0.5, -0.12, d);                    // 外圈平邊（靠邊緣再往下收一點）
    else if (d < 0.07) v = 0;                                          // 凹線本身
    else v = 0.15 + 0.85 * ss(0.07, 1.4, d);                          // 海綿鼓起來
    ht[y * w + x] = v;
  }
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cx = c.getContext('2d'), id = cx.createImageData(w, h), K = 16;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const gx = (ht[y * w + Math.max(x - 1, 0)] - ht[y * w + Math.min(x + 1, w - 1)]) * K;
    const gy = (ht[Math.min(y + 1, h - 1) * w + x] - ht[Math.max(y - 1, 0) * w + x]) * K;   // 畫布 y 朝下、貼圖 v 朝上
    const l = Math.hypot(gx, gy, 1);
    id.data[i * 4] = (gx / l * 0.5 + 0.5) * 255; id.data[i * 4 + 1] = (gy / l * 0.5 + 0.5) * 255; id.data[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; id.data[i * 4 + 3] = 255;
  }
  cx.putImageData(id, 0, 0);
  return new THREE.CanvasTexture(c);
}
function envTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#f4f1ef'); g.addColorStop(0.55, '#c9c3c0'); g.addColorStop(1, '#6e6866');
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  x.fillStyle = '#fff'; [[60, 30, 90, 90], [300, 20, 40, 120], [420, 40, 60, 70]].forEach(r => x.fillRect(...r));
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function create(base = 'assets/') {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.NoToneMapping;     // ACES 會把紫色洗淡，封面要跟印刷品一樣飽和
  const scene = new THREE.Scene();
  scene.environment = envTex();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 400);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(-20, 30, 50); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5); rim.position.set(30, -10, 20); scene.add(rim);

  // 印刷面：顏色大部分用自發光（emissive）直接給，燈光只負責一點明暗和壓痕的立體感——不然光照角度一斜整面就變灰變暗。
  // 環境反射會蓋一層灰霧 → 不吃環境光
  const pvc = (map, nrm) => new THREE.MeshPhysicalMaterial({ map, color: new THREE.Color(0.38, 0.38, 0.38), emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.6,
    normalMap: nrm, roughness: 0.55, specularIntensity: 0.3, clearcoat: 0.12, clearcoatRoughness: 0.3, clearcoatNormalMap: nrm, envMapIntensity: 0 });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf6f5f3, roughness: 0.5, clearcoat: 0.3 });
  const edge = new THREE.MeshStandardMaterial({ color: 0xa765cf, roughness: 0.5, emissive: 0x5a2d78, emissiveIntensity: 0.5 });
  const edgeS = new THREE.MeshStandardMaterial({ color: 0xe6e3ea, roughness: 0.5, emissive: 0x777777, emissiveIntensity: 0.4 });   // 書脊是淺灰白
  const metal = new THREE.MeshStandardMaterial({ color: 0xd8dadd, metalness: 1, roughness: 0.22 });
  const front = tex(base + 'album-front.webp', renderer, LOOK), back = tex(base + 'album-back.webp', renderer, LOOK), spineT = tex(base + 'album-spine.webp', renderer, LOOK);
  // 一片板子：w 寬、H 高、T 厚，中心在原點，外側（印刷面）朝 -z、內側在 z=0。rL／rR＝左／右（x 負／正）那兩個角要不要圓
  const RC = 0.8, BV = 0.18;                                   // 角的圓半徑 8mm、邊緣倒角 1.8mm
  function board(w, map, nrm, rL, rR, sideMat) {
    const x0 = -w / 2 + BV, x1 = w / 2 - BV, y0 = -H / 2 + BV, y1 = H / 2 - BV, r = RC - BV;
    const sh = new THREE.Shape();
    sh.moveTo(x0 + (rL ? r : 0), y0);
    if (rR) { sh.lineTo(x1 - r, y0); sh.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0); sh.lineTo(x1, y1 - r); sh.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2); }
    else { sh.lineTo(x1, y0); sh.lineTo(x1, y1); }
    if (rL) { sh.lineTo(x0 + r, y1); sh.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI); sh.lineTo(x0, y0 + r); sh.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5); }
    else { sh.lineTo(x0, y1); sh.lineTo(x0, y0); }
    const depth = T - 2 * BV;
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: BV, bevelSize: BV, bevelSegments: 5, curveSegments: 14 });
    g.translate(0, 0, -(depth + BV));                           // z 從 -T 到 0
    // 印刷面的 UV：從外面（-z）看，左邊是 +x，所以 u＝(右緣 - x) / 寬
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(n.getZ(i)) > 0.99) uv.setXY(i, (w / 2 - p.getX(i)) / w, (p.getY(i) + H / 2) / H);
    }
    // ExtrudeGeometry 的面：先底蓋（-z，印刷面）、再頂蓋（+z，內側），最後一圈側面
    const caps = g.groups[0].count, all = p.count;
    g.clearGroups(); g.addGroup(0, caps / 2, 0); g.addGroup(caps / 2, caps / 2, 1); g.addGroup(caps, all - caps, 2);
    return new THREE.Mesh(g, [pvc(map, nrm), white, sideMat || edge]);
  }
  // 壓痕離邊 3mm（之前 6mm 會壓到圖），書脊兩條長邊各一條
  const nCover = padNormal(W, H, [0.32, 0.32, 0.32, 0.32]), nSpine = padNormal(SP, H, [0.28, 0.28, 0.32, 0.32]);

  const book = new THREE.Group(); scene.add(book);
  // 封底：平放，x 從 SP/2 到 SP/2+W（書脊在左），外側朝下
  const backM = board(W, back, nCover, false, true); backM.position.set(SP / 2 + W / 2, 0, 0); book.add(backM);
  // 書脊：鉸鏈在封底左緣；闔起來時立起來 90°
  const spineHinge = new THREE.Group(); spineHinge.position.set(SP / 2, 0, 0); book.add(spineHinge);
  const spineM = board(SP, spineT, nSpine, false, false, edgeS); spineM.position.set(-SP / 2, 0, 0); spineHinge.add(spineM);
  // 書脊外側上下兩顆鉚釘（實物照片上有，固定環的）
  [-1, 1].forEach(k => {
    const rv = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.12, 24), metal);
    rv.rotation.x = Math.PI / 2; rv.position.set(-SP / 2, k * (H / 2 - 1.1), -T - 0.04); spineHinge.add(rv);
  });
  // 環：底座一條金屬片＋兩個半圓環（間距 8 cm），站在書脊內側中間
  const ring = new THREE.Group(); ring.position.set(-SP / 2, 0, 0); spineHinge.add(ring);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 11.5, 0.35), metal); plate.position.z = 0.17; ring.add(plate);
  [-4, 4].forEach(y => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.11, 12, 40, Math.PI), metal);
    r.rotation.x = Math.PI / 2; r.position.set(0, y, 0.3); ring.add(r);
  });
  // 封面：鉸鏈在書脊另一邊
  const frontHinge = new THREE.Group(); frontHinge.position.set(-SP, 0, 0); spineHinge.add(frontHinge);
  const frontM = board(W, front, nCover, true, false); frontM.position.set(-W / 2, 0, 0); frontHinge.add(frontM);

  // 內頁：每頁一個鉸鏈（在環的位置），頁面往 +x 伸出去；翻過去就是繞 y 轉 180°
  const sTex = sleeveTex();
  const sleeveMat = new THREE.MeshPhysicalMaterial({ map: sTex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, opacity: 1, envMapIntensity: 0.35 });
  const pages = [];
  const sleeveGeo = new THREE.PlaneGeometry(PW, PH), cardGeo = new THREE.PlaneGeometry(CW, CH);
  for (let i = 0; i < N; i++) {
    const hinge = new THREE.Group(); book.add(hinge);
    // 一頁＝前後兩層透明膜，明信片夾在中間（正面口袋、背面口袋背對背）
    const sl = new THREE.Mesh(sleeveGeo, sleeveMat); sl.position.x = PW / 2; hinge.add(sl);
    const sl2 = sl.clone(); sl2.position.z = -0.016; hinge.add(sl2);
    pages.push({ hinge, sl, slots: [null, null], ang: 0, target: 0 });
  }
  const cx = HOLE + (PW - HOLE) / 2;                // 口袋中心（離環多遠）
  // 明信片是兩面的：正面朝口袋外、明信片背面朝另一邊。之前只畫一面，翻頁時背面朝上就整張不見（他回報的）。
  // 同一頁另一個口袋也放了卡時，那張比較靠外（z 錯開），自然擋住這張的背面
  function cardTex(img, wide) {
    const t = new THREE.TextureLoader().load(img);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    if (wide) { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; }                  // 橫的明信片轉 90° 直著放進口袋（口袋是直的）
    return t;
  }
  function putCard(p, side, img, wide, backImg) {
    const g = new THREE.Group();
    const f = new THREE.Mesh(cardGeo, new THREE.MeshStandardMaterial({ map: cardTex(img, wide), roughness: 0.6 }));
    const b = new THREE.Mesh(cardGeo, new THREE.MeshStandardMaterial({ map: cardTex(backImg || img, wide), roughness: 0.7 }));
    b.rotation.y = Math.PI; b.position.z = -0.003; g.add(f, b);
    // 正面口袋：正面朝 +z；背面口袋：整組翻過來、放在更靠 -z 那層
    if (side) { g.rotation.y = Math.PI; g.position.set(cx, 0, -0.013); } else g.position.set(cx, 0, -0.004);
    g.userData.slide = 1;                                                             // 從下面滑進去
    p.hinge.add(g); p.slots[side] = g;
  }

  // 狀態：t＝打開程度（0 闔、1 攤平）、flipped＝翻到左邊的頁數
  let zoomK = 1, t = 0, tTarget = 0, flipped = 0, yaw = 0.38, pitch = 0.04,   // 闔著時的角度照他截的圖：看得到左邊書脊、幾乎平視
    _a = 0, ty = yaw, tp = pitch, raf = 0, hostEl = null, fit = 60, fitOpen = 90;
  function layout() {
    const a = (1 - t) * Math.PI / 2;
    spineHinge.rotation.y = a; frontHinge.rotation.y = a;
    // 環（內頁鉸鏈）的位置：攤平時在書脊中間；闔起來時貼著立起來的書脊
    const hx = THREE.MathUtils.lerp(SP / 2 + 0.6, 0.45, t);     // 攤平時孔剛好套在環的右腳
    pages.forEach((p, i) => {
      p.ang += (p.target - p.ang) * 0.14;
      // 右邊那疊：上面的頁在上；左邊那疊：最後翻過去的在上
      const zr = 0.45 + (N - 1 - i) * GAP, zl = 0.45 + i * GAP;
      const k = p.ang / Math.PI;
      p.hinge.position.set(hx, 0, THREE.MathUtils.lerp(zr, zl, k) + Math.sin(p.ang) * 0.6 * t);
      p.hinge.rotation.y = -p.ang;
      [0, 1].forEach(s => { const c = p.slots[s]; if (c && c.userData.slide > 0.001) { c.userData.slide *= 0.86; c.position.y = -c.userData.slide * 14; } });
    });
    // 鏡頭：闔起來看封面（書在 x 1.5～16.5），打開看整本攤平（33 cm）
    book.position.x = -THREE.MathUtils.lerp(SP / 2 + W / 2, 0, t);
    book.position.z = -THREE.MathUtils.lerp(SP / 2, 0, t);
    camera.position.z = THREE.MathUtils.lerp(fit * zoomK, fitOpen, t);
  }
  function frame() {
    raf = canvas.isConnected ? requestAnimationFrame(frame) : 0;
    if (!raf) return;
    t += (tTarget - t) * 0.09;
    yaw += (ty - yaw) * 0.1; pitch += (tp - pitch) * 0.1;
    // 打開後轉正一點，比較好看內頁
    const k = Math.min(1, t);
    scene.rotation.set(-pitch * (1 - 0.55 * k), yaw * (1 - 0.6 * k), 0);
    layout();
    renderer.render(scene, camera);
  }

  // 拖曳轉動；沒拖動的單純點擊：打開時點右半邊往後翻、左半邊往前翻，闔著時點一下打開
  let down = null, moved = false, onTap = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pageSet = new Set(pages.map(p => p.hinge));       // 點到的東西是不是內頁（或夾在裡面的明信片）
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, yaw: ty, pitch: tp }; moved = false; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
    if (moved) { ty = Math.max(-1.2, Math.min(1.2, down.yaw + dx * 0.006)); tp = Math.max(-0.4, Math.min(0.9, down.pitch + dy * 0.004)); }
  });
  canvas.addEventListener('pointerup', e => {
    canvas.style.cursor = 'grab';
    // 沒拖動的點擊（他要的，不要打開／闔上鈕）：點空白處＝打開或闔上；點到闔著的卡冊＝打開；
    // 打開時點到內頁＝翻頁（右半往後、左半往回），點到內頁以外的書（封面、封底內側、書脊、環）＝闔上
    if (down && !moved) {
      const r = canvas.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObject(book, true), hit = hits.length > 0;
      let onPage = false;
      if (hit) for (let o = hits[0].object; o; o = o.parent) if (pageSet.has(o)) { onPage = true; break; }
      if (!hit) api.setOpen(tTarget < 0.5);
      else if (tTarget < 0.5) api.setOpen(true);
      else if (onPage) api.flip(e.clientX - r.left > r.width / 2 ? 1 : -1);
      else api.setOpen(false);
      onTap && onTap();
    }
    down = null;
  });

  const api = {
    canvas, scene,
    mount(host) {
      hostEl = host;
      if (canvas.parentNode !== host) { host.innerHTML = ''; host.appendChild(canvas); }
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h;
      // 鏡頭距離：闔起來時整本（約 18 × 21）塞得進畫面；打開時攤平的寬（約 36）塞得進畫面
      const k = 2 * Math.tan(THREE.MathUtils.degToRad(15));
      fit = Math.max(H * 1.25 / k, W * 1.6 / (k * camera.aspect));
      fitOpen = Math.max(H * 1.2 / k, (2 * W + SP) * 1.12 / (k * camera.aspect));
      camera.updateProjectionMatrix();
      if (!raf) raf = requestAnimationFrame(frame);
    },
    resize() { if (hostEl) api.mount(hostEl); },
    set zoom(k) { zoomK = k; },
    pose(y, p) { yaw = ty = y; pitch = tp = p; },   // 直接擺好角度（截縮圖用）          // 闔著時的鏡頭距離倍數（截縮圖用：小於 1 拉近）
    get isOpen() { return tTarget > 0.5; },
    setOpen(on) {
      tTarget = on ? 1 : 0;
      if (!on) { flipped = 0; pages.forEach(p => p.target = 0); }
      ty = on ? 0 : 0.38; tp = on ? 0.18 : 0.04;
    },
    // 翻頁：dir 1＝往後翻一頁、-1＝往回
    flip(dir) {
      if (tTarget < 0.5) return;
      const n = Math.max(0, Math.min(N, flipped + dir));
      if (n === flipped) return;
      flipped = n; pages.forEach((p, i) => p.target = i < flipped ? Math.PI : 0);
    },
    // 現在打開的這一面：左邊＝上一頁的背面口袋、右邊＝這一頁的正面口袋
    get spread() { return flipped; },
    get pageCount() { return N; },
    get filled() { return pages.reduce((n, p) => n + (p.slots[0] ? 1 : 0) + (p.slots[1] ? 1 : 0), 0); },
    // 放一張進「現在看得到、還空著」的口袋，照真的放法的順序：左邊（上一頁背面）先、再右邊（這一頁正面）；放不下回傳 false
    insert(card) {
      if (tTarget < 0.5) api.setOpen(true);
      const right = pages[flipped], left = pages[flipped - 1];
      if (left && !left.slots[1]) { putCard(left, 1, card.img, card.wide, card.back); return true; }
      if (right && !right.slots[0]) { putCard(right, 0, card.img, card.wide, card.back); return true; }
      return false;
    },
    clear() { pages.forEach(p => [0, 1].forEach(s => { if (p.slots[s]) { p.hinge.remove(p.slots[s]); p.slots[s] = null; } })); },
    onTap(fn) { onTap = fn; }
  };
  return api;
}

// 名店選幸運轉盤的「特效」（2026-10-04 他要的，跟畫圖抉擇轉盤同一套感覺）。standee3d.js 的「特效」開關打開才載入這支。
//   ・轉動中：指針指到的那一格淡淡亮黃色、一格一格跟著跳（小瑪莉跑燈）；每經過一格「嗶」一聲，快的時候底下一層「嗡」；
//     轉盤外圈印好的 24 顆燈泡跟著跑馬燈閃，轉越快跑越快
//   ・停下來：指到的那一格亮紅框閃三下、整格變亮、從那格噴星星，配中獎音效（他選的拉霸機風格，二獎那一版）。
//     8 格都一樣（他說只是食物不同，沒有大小獎）。從背面看時（背面沒有字）只放音效
//   ・指針：每家店人物手上拿的東西（酒瓶、咖啡杯、壽司盤、筷子、肉盤、聖代）伸向轉盤左邊。
//     他指定以居酒屋酒瓶指的方向為準、六家都用同一格：酒瓶的延長線正好穿過轉盤中心，在 3D 畫面上約 253°
//     （順時針、從正上方算；原本用 225° 會選到酒瓶下面那一格，他糾正過）
//   ・轉盤圖六家同一個版型：8 格、正上方那格置中（格線在 22.5° + 45°×k），24 顆燈泡在半徑 0.904 處、每 15° 一顆
// 音效用 charm-fx.js 的合成音（SFX），由 standee3d.js 一起載入後傳進來。
// 介面：create(THREE, SFX) → { bind(wheelGroup, r, z), frame(spin, vel, active, facing, dt) → 還要不要重畫, stop(spin, facing), show(on) }

const N = 8, STEP = 360 / N, POINTER = 253;
const BULBS = 24, BULB_R = 0.904;
const HUB_R = 0.17, RIM_R = 0.83;                 // 格子從中心圓盤外緣到外框內緣（半徑比例）

export function create(THREE, SFX) {
  let grp = null, r = 1, z = 0, on = true;
  let hiMesh = null, frame = null, glow = null, bulbs = [], stars = [];
  let lastIdx = -1, chase = 0, winT = -1, winIdx = -1, winFront = true;

  // cw-from-top 角度 θ（度）→ 轉盤上的點
  const at = (th, rr) => { const a = th * Math.PI / 180; return [Math.sin(a) * rr, Math.cos(a) * rr]; };
  // 一格扇形（中心角 th），r0～r1；inset＞0 時做成框（外形減掉往內縮 inset 的內形）
  function sector(th, r0, r1, inset) {
    const ring = (q0, q1, d) => {
      const pts = [], a0 = th - STEP / 2 + d / q1 * 57.3, a1 = th + STEP / 2 - d / q1 * 57.3, b0 = th - STEP / 2 + d / q0 * 57.3, b1 = th + STEP / 2 - d / q0 * 57.3;
      for (let i = 0; i <= 16; i++) pts.push(at(a0 + (a1 - a0) * i / 16, q1));
      for (let i = 16; i >= 0; i--) pts.push(at(b0 + (b1 - b0) * i / 16, q0));
      return pts.map(p => new THREE.Vector2(p[0], p[1]));
    };
    const s = new THREE.Shape(ring(r0, r1, 0));
    if (inset) s.holes.push(new THREE.Path(ring(r0 + inset, r1 - inset, inset).reverse()));
    return new THREE.ShapeGeometry(s);
  }
  const mat = (color, opacity, add) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false,
    blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.FrontSide });

  function bind(wheelGroup, radius, zFront) {
    grp = wheelGroup; r = radius; z = zFront; lastIdx = -1; winT = -1; stars = [];
    // 指到的那一格（轉動中淡黃、停下來變亮）：中心角 0 的扇形，每次轉到要的那格
    // 畫面上轉盤只有一兩公分大，框要粗（1.6mm）＋外面一圈紅色光暈才看得出來
    hiMesh = new THREE.Mesh(sector(0, HUB_R * r, RIM_R * r, 0), mat(0xffe14a, 0));
    frame = new THREE.Mesh(sector(0, HUB_R * r - 0.6, RIM_R * r + 0.6, 1.6), mat(0xff1f1f, 0));
    glow = new THREE.Mesh(sector(0, HUB_R * r - 1.6, RIM_R * r + 1.6, 3.6), mat(0xff3b3b, 0, true));
    hiMesh.position.z = z + 0.06; glow.position.z = z + 0.08; frame.position.z = z + 0.1;
    hiMesh.renderOrder = glow.renderOrder = frame.renderOrder = 5;
    grp.add(hiMesh); grp.add(glow); grp.add(frame);
    bulbs = [];
    for (let k = 0; k < BULBS; k++) {
      const [x, y] = at(k * 360 / BULBS, BULB_R * r);
      const core = new THREE.Mesh(new THREE.CircleGeometry(r * 0.05, 16), mat(0xfffbe0, 0, true));
      const halo = new THREE.Mesh(new THREE.CircleGeometry(r * 0.12, 20), mat(0xffc23a, 0, true));
      core.position.set(x, y, z + 0.12); halo.position.set(x, y, z + 0.11);
      core.renderOrder = halo.renderOrder = 6;
      grp.add(halo); grp.add(core); bulbs.push([core, halo]);
    }
    show(on);
  }
  function show(v) {
    on = v;
    if (!grp) return;
    [hiMesh, frame, glow].concat(...bulbs).concat(stars.map(s => s.m)).forEach(m => { m.visible = v; });
    if (!v) { SFX.whir(0); winT = -1; }
  }
  // 現在指針指到第幾格（spin＝轉盤轉了幾度；正的是逆時針，所以指針在圖上的角度＝POINTER + spin）
  const idxAt = spin => ((Math.round((POINTER + spin) / STEP) % N) + N) % N;
  const place = (m, idx) => { m.rotation.z = -idx * STEP * Math.PI / 180; };   // 扇形中心角 0 → 第 idx 格

  function lights(dt, speed, winning, t) {
    if (winning) {                                   // 中獎：全部一起閃
      const lit = Math.floor(t * 8) % 2 === 0 && t < 2;
      bulbs.forEach(([c, h], k) => { c.material.opacity = lit ? 1 : 0.15; h.material.opacity = lit ? (k % 2 ? 0.55 : 0.4) : 0; });
      return;
    }
    chase += dt * (3 + speed / 120);                 // 跑馬燈：轉越快跑越快
    const ph = Math.floor(chase);
    bulbs.forEach(([c, h], k) => {
      const l = speed > 20 && (k + ph) % 3 === 0;
      c.material.opacity = l ? 1 : 0; h.material.opacity = l ? 0.45 : 0;
    });
  }
  function burst(idx) {
    const th = idx * STEP, [cx, cy] = at(th, (HUB_R + RIM_R) / 2 * r);
    for (let k = 0; k < 14; k++) {
      const g = new THREE.ShapeGeometry(starShape(r * (0.04 + Math.random() * 0.04)));
      const m = new THREE.Mesh(g, mat(Math.random() < 0.5 ? 0xffd23a : 0xfff7b0, 1));
      m.position.set(cx, cy, z + 0.3 + k * 0.01); m.renderOrder = 7; grp.add(m);
      const a = Math.random() * Math.PI * 2, v = r * (0.6 + Math.random() * 0.9);
      stars.push({ m, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 6 + Math.random() * 10, vr: (Math.random() - 0.5) * 8, life: 1 + Math.random() * 0.5, t: 0 });
    }
  }
  function starShape(rr) {
    const s = new THREE.Shape();
    for (let k = 0; k < 10; k++) { const q = k % 2 ? rr * 0.42 : rr, a = k * Math.PI / 5; k ? s.lineTo(Math.sin(a) * q, Math.cos(a) * q) : s.moveTo(0, q); }
    return s;
  }

  return {
    bind, show,
    // 每一格畫面呼叫；回傳 true＝特效還在動，要繼續重畫
    frame(spin, vel, active, facing, dt) {
      if (!grp || !on) return false;
      const speed = Math.abs(vel), idx = idxAt(spin);
      if (active) {
        if (winT >= 0) { winT = -1; frame.material.opacity = glow.material.opacity = 0; }   // 又開始轉：收掉上一次的演出
        if (lastIdx !== -1 && idx !== lastIdx) SFX.tick(speed);
        SFX.whir(speed);
        place(hiMesh, idx); hiMesh.material.opacity = facing ? 0.3 : 0;
      } else SFX.whir(0);
      lastIdx = idx;
      let busy = active;
      if (winT >= 0) {
        winT += dt;
        const t = winT, blink = t < 1.2 ? (Math.floor(t * 5) % 2 === 0 ? 1 : 0.25) : 1, fade = t < 2.6 ? 1 : Math.max(0, 1 - (t - 2.6) / 0.6);
        frame.material.opacity = winFront ? blink * fade : 0;
        glow.material.opacity = winFront ? 0.5 * blink * fade : 0;
        hiMesh.material.opacity = winFront ? 0.4 * fade : 0;
        if (fade <= 0) { winT = -1; hiMesh.material.opacity = 0; }
        busy = true;
      }
      lights(dt, active ? speed : 0, winT >= 0 && winFront, winT);
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i]; s.t += dt;
        s.m.position.x += s.vx * dt; s.m.position.y += s.vy * dt; s.m.position.z += s.vz * dt;
        s.vy -= r * 1.4 * dt; s.m.rotation.z += s.vr * dt;
        s.m.material.opacity = Math.max(0, 1 - s.t / s.life);
        if (s.t >= s.life) { grp.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); stars.splice(i, 1); }
      }
      return busy || stars.length > 0;
    },
    // 停下來：開獎
    stop(spin, facing) {
      if (!grp || !on) return;
      SFX.whir(0);
      const idx = idxAt(spin);
      winIdx = idx; winFront = facing; winT = 0;
      place(hiMesh, idx); place(frame, idx); place(glow, idx);
      SFX.dododo();
      if (facing) burst(idx);
    }
  };
}

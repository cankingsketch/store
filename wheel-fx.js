// 名店選幸運轉盤的「特效」（2026-10-04 他要的，跟畫圖抉擇轉盤同一套感覺）。standee3d.js 的「特效」開關打開才載入這支。
//   ・轉動中：指針指到的那一格淡淡亮黃色、一格一格跟著跳（小瑪莉跑燈）；每經過一格「啵」一聲（他選的 H），快的時候底下一層「嗡」
//   ・停下來：指到的那一格亮起來、從那格噴星星，配一聲投幣音（他選的拉霸機短版，後來說只留投幣）。
//     8 格都一樣（他說只是食物不同，沒有大小獎）。從背面看時（背面沒有字）只放音效
//   ・做過又拿掉的（他說的）：外圈燈泡跑馬燈閃、停下來的紅框＋紅光
//   ・指針：每家店人物手上拿的東西（酒瓶、咖啡杯、壽司盤、筷子、肉盤、聖代）伸向轉盤左邊。
//     他指定以居酒屋酒瓶指的方向為準、六家都用同一格：酒瓶的延長線正好穿過轉盤中心，在 3D 畫面上約 253°
//     （順時針、從正上方算；原本用 225° 會選到酒瓶下面那一格，他糾正過）
//   ・轉盤圖六家同一個版型：8 格、正上方那格置中（格線在 22.5° + 45°×k）
// 音效用 charm-fx.js 的合成音（SFX），由 standee3d.js 一起載入後傳進來。
// 介面：create(THREE, SFX) → { bind(wheelGroup, r, z), frame(spin, vel, active, facing, dt) → 還要不要重畫, stop(spin, facing), show(on) }

const N = 8, STEP = 360 / N, POINTER = 253;
const HUB_R = 0.17, RIM_R = 0.83;                 // 格子從中心圓盤外緣到外框內緣（半徑比例）

export function create(THREE, SFX) {
  let grp = null, r = 1, z = 0, on = true;
  let hiMesh = null, stars = [];
  let lastIdx = -1, winT = -1, winFront = true;

  // cw-from-top 角度 θ（度）→ 轉盤上的點
  const at = (th, rr) => { const a = th * Math.PI / 180; return [Math.sin(a) * rr, Math.cos(a) * rr]; };
  // 一格扇形（中心角 th），r0～r1
  function sector(th, r0, r1) {
    const pts = [];
    for (let i = 0; i <= 16; i++) pts.push(at(th - STEP / 2 + STEP * i / 16, r1));
    for (let i = 16; i >= 0; i--) pts.push(at(th - STEP / 2 + STEP * i / 16, r0));
    return new THREE.ShapeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1]))));
  }
  const mat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.FrontSide });

  function bind(wheelGroup, radius, zFront) {
    grp = wheelGroup; r = radius; z = zFront; lastIdx = -1; winT = -1; stars = [];
    // 指到的那一格（轉動中淡黃、停下來變亮）：中心角 0 的扇形，每次轉到要的那格
    hiMesh = new THREE.Mesh(sector(0, HUB_R * r, RIM_R * r), mat(0xffe14a, 0));
    hiMesh.position.z = z + 0.06; hiMesh.renderOrder = 5;
    grp.add(hiMesh);
    show(on);
  }
  function show(v) {
    on = v;
    if (!grp) return;
    [hiMesh].concat(stars.map(s => s.m)).forEach(m => { m.visible = v; });
    if (!v) { SFX.whir(0); winT = -1; }
  }
  // 現在指針指到第幾格（spin＝轉盤轉了幾度；正的是逆時針，所以指針在圖上的角度＝POINTER + spin）
  const idxAt = spin => ((Math.round((POINTER + spin) / STEP) % N) + N) % N;
  const place = (m, idx) => { m.rotation.z = -idx * STEP * Math.PI / 180; };   // 扇形中心角 0 → 第 idx 格

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
        winT = -1;                                       // 又開始轉：收掉上一次的演出
        if (lastIdx !== -1 && idx !== lastIdx) SFX.pop();
        SFX.whir(speed);
        place(hiMesh, idx); hiMesh.material.opacity = facing ? 0.3 : 0;
      } else SFX.whir(0);
      lastIdx = idx;
      let busy = active;
      if (winT >= 0) {
        winT += dt;
        const fade = winT < 2.6 ? 1 : Math.max(0, 1 - (winT - 2.6) / 0.6);
        hiMesh.material.opacity = winFront ? 0.4 * fade : 0;
        if (fade <= 0) { winT = -1; hiMesh.material.opacity = 0; }
        busy = true;
      }
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
      winFront = facing; winT = 0;
      place(hiMesh, idx);
      SFX.short();
      if (facing) burst(idx);
    }
  };
}

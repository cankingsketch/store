// 貓咪吐
// 座標：直接用 PSD 像素座標，x 向右，y 取負（three.js 往上為正）。
// 畫面：直式，以 iPhone 18 Pro（402×874 點）為準；電腦版是置中的手機框＋貓咪花紋背景。
import * as THREE from 'three';

const STROKE = '#5a79a3';
const STROKE_RGB = [90 / 255, 121 / 255, 163 / 255];
const BG = 0xf4efe4;   // 米白
const L = await (await fetch('img/layers.json')).json();

// ---------- 可調參數 ----------
const P = {
  FEET: { x: 1460, y: -1450 },       // 身體縮放的基準點（腳底）
  FLOOR: -1448,                      // 地板（貓坐的地方，PSD 腳底）
  // 地面是往鏡頭延伸的透視平面（不畫出來）：每股嘔吐物落在不同深度，越近越靠畫面下方
  DEPTH_MIN: 60, DEPTH_MAX: 360,
  PIVOT: { x: 1345, y: -1128 },      // 頭轉動的脖子軸心
  MOUTH: { x: 1302, y: -1098 },      // 嘴巴（左吐姿態、未旋轉時）
  BASE_DIR: Math.atan2(-345, -500),  // 示意圖的噴射方向（左下）
  HEAD_MIN: -30 * Math.PI / 180,     // 頭可轉角度（逆時針為正，越大越往下）
  HEAD_MAX: 75 * Math.PI / 180,
  AIM_MIN: 10 * Math.PI / 180,       // 每局隨機的主要方向範圍
  AIM_MAX: 45 * Math.PI / 180,
  SWAY_DIR: 47 * Math.PI / 180, SWAY_DIR_R: 36 * Math.PI / 180,     // 身體扭到底時，吐的方向偏離正下方幾度（左下 -145°～右下 -35°）
  SWAY_LEAN: 0.33,                   // 身體扭到底時傾斜多少（弧度），腳固定在地上
  SWAY_SPEED: 2.6,
  NOTICE: 0.35,                      // 發現碗後先愣住（頭上驚嘆號）多久才甩開
  SWAY_FAST: 7,                      // 甩開時扭多快
  REARM: 0.45,                       // 甩完多久之後才會再被嚇到                   // 每秒最多扭多少（-1～1 全程是 2）
  SWEEP_S: 0.3,                      // 沒發現碗時，方向自己左右晃的幅度
  FAN: 20 * Math.PI / 180,          // 開始吐之後，噴的方向只在這個扇形內擺動（碗接得住的寬度）
  SWEEP: 22 * Math.PI / 180,         // 主要方向左右擺動的幅度
  HEAD_SPEED: 150 * Math.PI / 180,   // 每秒最多轉幾度
  LEAN: 0.3,                        // 轉角裡有多少給身體傾斜（其餘給頭），脖子才不會斷
  STRETCH: 0.12,                     // 身體傾斜到底時拉長多少
  AVOID: 50 * Math.PI / 180,         // 想跟碗保持的角度
  HEAD_RANGE: 330,
  PERSONAL: 200,
  PATH_SENSE: 110,                   // 碗離預告拋物線這麼近，貓也會發現
  CORNER: 0.2,
  FLIP_GAP: 0.7,                     // 翻頭（左吐↔右吐）之後至少隔幾秒才能再翻                       // 被逼到角落多久就甩頭到另一邊                     // 碗不能比這更靠近嘴巴：貓會用頭把碗頂開
  DODGE: 85 * Math.PI / 180, DODGE_SPEED: 280 * Math.PI / 180, // 發現碗時轉多開、多快                   // 碗進到嘴巴這個距離內（約一個頭）貓才會發現、開始躲
  REACH_UP: 0.2, REACH_DOWN: 0.18,  // 躲的時候身體最多拉長／縮短多少（碗在下面就抬頭、在上面就縮頭）
  CAT_K: 85, CAT_C: 7,               // 頭和身體的果凍彈簧（k 越小越慢、c 越小晃越多下）
  REACT: 0.22,                       // 反應延遲（秒）
  SPEED: 760,                        // 噴出速度
  RATE: 170,                          // 每條每秒幾顆
  LANES: 2, LANE_GAP: 9,
  TOTAL: 185,                        // 一次吐多少顆＝碗剛好裝滿的量（實測碗約裝 187～190 顆）
  BURSTS: [0.5, 0.3, 0.2],           // 連續吐 3 坨，各佔總量多少（一坨比一坨小）
  BURST_TIME: [0.3, 0.2, 0.15],      // 每坨噴幾秒
  GAP: [0.35, 0.6],                  // 坨與坨之間停幾秒（隨機）
  SWING: 0.35, SMALL_TURN: 0.65,     // 空檔裡：快速甩到另一邊 35%、其餘小幅轉頭
  SPOT_SEP: 0.45,                    // 每坨方向至少差多少（扇形半寬約 0.21，0.45 落點就不重疊）
  VOMIT_SEG: [[0.13, 1.35, 1], [1.55, 0.97, 1.9], [2.84, 0.27, 1.9]], // 嘔吐聲檔案裡三坨各自的 [開始秒, 長度, 音量]（後兩段錄得比較小聲，補大）
  VOMIT_TIME: 0.55,                  // 吐得很快：考反應
  ML: 20 / 185,                          // 每顆代表幾毫升
  // 液體
  G: 3300, H: 22, RHO0: 2.5, K: 0.08, KN: 0.2, VISC: 0.9, R: 6, SUB: 4,
  STICK: 0.6, DRIP: 0.22, DMAX: 0.6, FLOOR_DRAG: 22, DVMAX: 90, BOWL_DAMP: 0.2, VMAX: 2400, CMAX: 150, AIR_COHESION: 0.75, // 空中液體互相黏多緊（胃液很黏，不容易散開）
  // 畫面
  // 直版：畫面以 402×874（iPhone 直拿）為準；鏡頭拉遠讓貓小一點，往最左、最右吐的落點都在畫面 14%～86% 之間，不會碰牆
  ASPECT: 402 / 874, VIEW_CX: 1310, VIEW_HALFW: 640, FLOOR_AT: 0.4, // 地板在畫面由下往上 40% 的高度
  CUP_X: 1300, POUR_DX: 100,        // 倒的時候碗往右挪多少（實測液體從碗口往左流出約 100）
  POUR_ZOOM: 2.2, ZOOM_RATE: 2.5,   // 倒量杯時鏡頭拉近幾倍、拉近速度
  ZOOM_DX: 40, ZOOM_DY: 200,        // 拉近後畫面中心：量杯底往右、往上多少（把碗和量杯都框進來）
  CUP_SINK: 250,       // 量杯放在前景，杯底在地板線下方多少                       // 量杯放在地上的位置
  TOUCH_LIFT: 150,                   // 手機上碗在手指上方多少，手指才不會擋住
  // 量杯（內徑半寬、內高）
  CUP_W: 60, CUP_H: 110, CUP_MLH: 4.75, // 量杯內徑半寬、內高；每 1 ml 液面高（固定 1/60 步長實測每 ml 約 4.7）
  CUP_ML0: 13,                       // 畫出來的液面比顆粒中心高一圈（液體輪廓的厚度），刻度整排往上移這麼多；20 ml 在 108
};
window.P = P;

// ---------- 版面：手機全螢幕／電腦置中手機框 ----------
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); // 留住畫面，截圖分享才拍得到
renderer.setPixelRatio(Math.min(devicePixelRatio, 3));
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
cam.position.z = 5;
const FLOOR = P.FLOOR;

const texLoader = new THREE.TextureLoader();
function matFor(tex) {
  return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
}
function layer(key, order, parent, origin) {
  const d = L[key];
  const t = texLoader.load('img/' + key + '.png');
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.h), matFor(t));
  m.position.set(d.x + d.w / 2 - origin.x, -(d.y + d.h / 2) - origin.y, 0);
  m.renderOrder = order;
  parent.add(m);
  return m;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.lineJoin = g.lineCap = 'round'; g.strokeStyle = STROKE; g.lineWidth = 14;
  draw(g);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- 貓 ----------
// 身體用斜切（腳釘在地上、上半身傾斜＋拉長）；頭另外放在斜切後的脖子位置再轉，脖子才接得起來
const cat = new THREE.Group();
cat.matrixAutoUpdate = false;
scene.add(cat);
const headRoot = new THREE.Group();
scene.add(headRoot);
layer('body_fill', 0, cat, P.FEET);
layer('body_line', 1, cat, P.FEET);
function neck() {
  const g = new THREE.Group();
  headRoot.add(g);
  return g;
}
const headNormal = neck(); layer('normal_fill', 5, headNormal, P.PIVOT);
const eyesOpen = layer('normal_line', 6, headNormal, P.PIVOT), eyesShut = layer('normal_blink', 6, headNormal, P.PIVOT);
eyesShut.visible = false;
// 眨眼：普通表情時隨機眨（偶爾連眨兩下）；待機時偶爾閉眼久一點，像在打盹
const blink = { next: 0.9, end: -1, again: false };
function updateBlink() {
  const calm = S.name === 'title' || S.name === 'idle' || S.name === 'settle' || S.name === 'pour' || S.name === 'result';
  if (!calm) { blink.next = now + 0.6 + Math.random(); blink.end = -1; }
  else if (now >= blink.next) {
    const long = S.name === 'idle' && Math.random() < 0.35;
    blink.end = now + (long ? 0.45 : 0.12);
    blink.again = !long && !blink.again && Math.random() < 0.25; // 最多連眨兩下
    blink.next = blink.again ? blink.end + 0.12 : now + 1.6 + Math.random() * 2.6;
  }
  const shut = now < blink.end;
  eyesShut.visible = shut; eyesOpen.visible = !shut;
}
const headSick = neck(); layer('sick_fill', 5, headSick, P.PIVOT); layer('sick_line', 6, headSick, P.PIVOT);
const sickFx = layer('sick_fx', 7, headRoot, P.PIVOT);
const headVBack = neck(); layer('vomit_backfill', 2, headVBack, P.PIVOT); layer('vomit_chin', 3, headVBack, P.PIVOT);
const headVFront = neck(); layer('vomit_headfill', 5, headVFront, P.PIVOT); layer('vomit_headline', 6, headVFront, P.PIVOT);
const mouth = new THREE.Object3D();
mouth.position.set(P.MOUTH.x - P.PIVOT.x, P.MOUTH.y - P.PIVOT.y, 0);
headVBack.add(mouth);
let curPose = 'normal';
function setPose(p) {
  curPose = p;
  headNormal.visible = p === 'normal';
  headSick.visible = p === 'sick';
  sickFx.visible = p === 'sick';
  headVBack.visible = headVFront.visible = p === 'vomit';
}



// ---------- 碗與手（暫代圖，之後換成手繪） ----------
const BOWL = { rx: 110, ry: 46, depth: 85, cap: 200 }; // ry：碗口往鏡頭傾，看得到碗裡；cap：裝滿大約幾顆
const bowl = new THREE.Group(); scene.add(bowl);
{
  const W = 280, H = 160, ox = 140, oy = 56;
  const back = canvasTex(W, H, g => {
    g.fillStyle = '#c3cede';
    g.beginPath(); g.ellipse(ox, oy, BOWL.rx, BOWL.ry, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  });
  const front = canvasTex(W, H, g => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(ox, oy, BOWL.rx, BOWL.depth, 0, 0, Math.PI);
    g.ellipse(ox, oy, BOWL.rx, BOWL.ry, 0, Math.PI, 0, true);
    g.closePath(); g.fill(); g.stroke();
  });
  for (const [t, o] of [[back, 3.5], [front, 11]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), matFor(t));
    m.position.set(W / 2 - ox, -(H / 2 - oy), 0); m.renderOrder = o; bowl.add(m);
  }
}
// 碗裡的液面：接越多越大、越高（碗前緣會蓋住下半），玩家一眼看得出接了多少
const bowlFill = new THREE.Mesh(new THREE.PlaneGeometry(BOWL.rx * 2 - 16, BOWL.ry * 2 - 10), new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uResY: { value: 1 }, uStroke: { value: new THREE.Vector3(...STROKE_RGB) } },
  transparent: true, depthTest: false, depthWrite: false,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `varying vec2 vUv; uniform float uTime, uResY; uniform vec3 uStroke;
    void main(){ vec2 c=vUv*2.-1.; float r=length(c); if(r>1.) discard;
      if(r>0.9){ gl_FragColor=vec4(uStroke,1.); return; }
      vec2 sp=gl_FragCoord.xy/uResY;
      float t=(sp.x*0.45+sp.y*0.7)+uTime*0.12+c.x*0.08;
      vec3 rain=0.5+0.5*cos(6.2831*(t+vec3(0.,0.33,0.67)));
      rain=mix(vec3(1.),rain,0.78);
      float gl=smoothstep(0.35,0.0,length(c-vec2(-0.35,0.35)))*0.25;
      gl_FragColor=vec4(min(rain+gl,vec3(1.)),1.); }`,
}));
bowlFill.renderOrder = 3.6; bowlFill.visible = false; bowl.add(bowlFill);

// ---------- 預告箭頭：咳嗽時從嘴巴畫出會吐到哪裡的點點拋物線 ----------
const aim = new THREE.Group(); aim.visible = false; scene.add(aim);
const AIM_N = 13;
const aimMatN = new THREE.MeshBasicMaterial({ color: STROKE, transparent: true, opacity: 0.85, depthTest: false });
const aimMatA = new THREE.MeshBasicMaterial({ color: 0xe5574f, transparent: true, opacity: 0.95, depthTest: false });
const aimDots = [];
for (let i = 0; i < AIM_N; i++) {
  const d = new THREE.Mesh(new THREE.CircleGeometry(11, 14), aimMatN); d.renderOrder = 8; aim.add(d); aimDots.push(d);
}
const headShape = new THREE.Shape(); headShape.moveTo(34, 0); headShape.lineTo(-12, 22); headShape.lineTo(-12, -22); headShape.closePath();
const aimHead = new THREE.Mesh(new THREE.ShapeGeometry(headShape), aimMatN); aimHead.renderOrder = 8; aim.add(aimHead);
// 驚嘆號：發現碗時從頭上彈出來
const bang = new THREE.Mesh(new THREE.PlaneGeometry(70, 120), matFor(canvasTex(70, 120, g => {
  g.lineWidth = 10; g.fillStyle = '#e5574f';
  g.beginPath(); g.moveTo(22, 10); g.lineTo(48, 10); g.lineTo(42, 78); g.lineTo(28, 78); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.arc(35, 98, 11, 0, Math.PI * 2); g.fill(); g.stroke();
})));
bang.renderOrder = 14; bang.visible = false; scene.add(bang);
function updateBang() {
  const age = now - (S.bangT ?? -9);
  bang.visible = S.name === 'sick' && age < P.NOTICE + 0.35;
  if (!bang.visible) return;
  const r = headRoot.rotation.z, up = 300;
  bang.position.set(headRoot.position.x - Math.sin(r) * up - 60, headRoot.position.y + Math.cos(r) * up, 0);
  const pop = Math.min(1, age * 10);
  bang.scale.setScalar(pop * (1 + 0.35 * Math.exp(-age * 9) * Math.sin(age * 40)));
  bang.rotation.z = 0.15 * Math.sin(age * 30) * Math.exp(-age * 5);
}

// 殘影：甩得快的時候，身後留下幾個淡淡的線稿
const GHOSTS = [], ghostHist = [];
for (let i = 0; i < 3; i++) {
  const gc = new THREE.Group(); gc.matrixAutoUpdate = false; scene.add(gc);
  const gh = new THREE.Group(); scene.add(gh);
  const body = layer('body_line', -0.5, gc, P.FEET);
  const heads = { normal: layer('normal_line', -0.5, gh, P.PIVOT), sick: layer('sick_line', -0.5, gh, P.PIVOT), vomit: layer('vomit_headline', -0.5, gh, P.PIVOT) };
  for (const mm of [body, ...Object.values(heads)]) mm.material.opacity = 0;
  GHOSTS.push({ gc, gh, body, heads, lag: (i + 1) * 3 });
}
function updateGhosts() {
  ghostHist.push({ m: cat.matrix.clone(), p: headRoot.position.clone(), r: headRoot.rotation.z, pose: curPose });
  if (ghostHist.length > 12) ghostHist.shift();
  const a = Math.min(1, Math.max(0, (Math.abs(catVA) - 1.0) / 3));
  for (const g of GHOSTS) {
    const h = ghostHist[Math.max(0, ghostHist.length - 1 - g.lag)];
    g.gc.matrix.copy(h.m); g.gc.matrixWorldNeedsUpdate = true;
    g.gh.position.copy(h.p); g.gh.rotation.z = h.r;
    const op = a * 0.38 * (1 - g.lag / 12);
    g.body.material.opacity = op;
    for (const k in g.heads) { g.heads[k].visible = k === h.pose; g.heads[k].material.opacity = op; }
    g.gc.visible = g.gh.visible = op > 0.01;
  }
}

// 落點提示：箭頭尖端在地上畫一個扁扁的圈
const landRing = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 40), aimMatN);
landRing.renderOrder = 2.6; aim.add(landRing);
const LAND_Y = () => FLOOR - (P.DEPTH_MIN + P.DEPTH_MAX) / 2; // 嘔吐物平均落地的高度
function landT(m, vy) { // 從嘴巴噴出後幾秒落地
  const yL = LAND_Y(), c = yL - m.y;
  return (vy + Math.sqrt(Math.max(0, vy * vy - 2 * P.G * c))) / P.G;
}
function updateAim() {
  aim.visible = S.name === 'sick' || (S.name === 'vomit' && S.phase === 'gap'); // 空檔也看得到下一坨往哪
  if (!aim.visible) return;
  mouth.updateWorldMatrix(true, false);
  const m = mouth.getWorldPosition(tmpV);
  const dir = dirOf(catA), vx = Math.cos(dir) * P.SPEED, vy = Math.sin(dir) * P.SPEED;
  const mat = S.alert ? aimMatA : aimMatN;
  const T = landT(m, vy), t0 = 0.035;
  let x = m.x, y = m.y, t = 0;
  for (let i = 0; i < AIM_N; i++) {
    t = t0 + (T - t0) * i / AIM_N;
    x = m.x + vx * t; y = m.y + vy * t - 0.5 * P.G * t * t;
    aimDots[i].position.set(x, y, 0); aimDots[i].visible = i % 2 === 0 || i > 3; aimDots[i].material = mat;
    aimDots[i].scale.setScalar(0.6 + 0.4 * i / AIM_N);
  }
  const tl = T * 0.97;
  aimHead.position.set(m.x + vx * tl, m.y + vy * tl - 0.5 * P.G * tl * tl, 0); aimHead.material = mat;
  aimHead.rotation.z = Math.atan2(vy - P.G * tl, vx);
  landRing.position.set(m.x + vx * T, LAND_Y(), 0); landRing.material = mat;
  landRing.scale.set(80, 22, 1);
}
// 手：PSD「手」資料夾的手掌＋大拇指。手掌在碗下面，大拇指壓在碗上面
// HAND.ax/ay：手掌圖上的哪一點對齊碗口中心；s：縮放
const HAND = { s: 0.6, ax: 120, ay: 110 };
const handPt = (ix, iy) => ({ x: HAND.s * (ix - HAND.ax), y: -HAND.s * (iy - HAND.ay) }); // 手掌圖座標 → 碗的區域座標
// 果凍感：握碗的地方（大拇指壓碗口）不動，越往手腕晃越多；晃動量用彈簧跟著碗的加速度
const JELLY = { k: 110, c: 3.2, m: 0.3, max: 120 }; // k 越小晃越慢、c 越小回彈越多下、m 越大甩越大
const jelly = { uLag: { value: new THREE.Vector2() }, uGrip: { value: new THREE.Vector2() }, uWrist: { value: new THREE.Vector2() } };
const jl = { x: 0, y: 0, vx: 0, vy: 0, pvx: 0, pvy: 0 };
function handLayer(key, order) {
  const d = L[key], pd = L.hand_palm;
  const t = texLoader.load('img/' + key + '.png'); t.colorSpace = THREE.SRGBColorSpace;
  const mat = matFor(t);
  const c = handPt(d.x - pd.x + d.w / 2, d.y - pd.y + d.h / 2);
  const uOff = { value: new THREE.Vector2(c.x, c.y) };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, jelly, { uOff });
    sh.vertexShader = 'uniform vec2 uLag, uGrip, uWrist, uOff;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = vec3(position);
      vec2 bp = position.xy + uOff, gd = uWrist - uGrip;
      float w = clamp(dot(bp - uGrip, gd) / dot(gd, gd), 0., 1.3);
      w = 0.22 + 0.78 * w * w; // 整個手掌都會晃，手腕那頭最多
      transformed.xy += uLag * w;`);
  };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(d.w * HAND.s, d.h * HAND.s, 14, 14), mat);
  m.position.set(c.x, c.y, 0); m.renderOrder = order; bowl.add(m);
  return m;
}
handLayer('hand_palm', 3.4);
handLayer('hand_thumb', 12);
const FIST = { ...handPt(250, 240), r: 62 };          // 手掌碰撞圓
const WRIST = handPt(410, 440);                         // 手腕切口
jelly.uGrip.value.copy(handPt(225, 150)); jelly.uWrist.value.copy(WRIST);
const ARM_DIR = { x: 0.2, y: -0.98 };                   // 前臂方向（碗的區域座標，往右下伸出畫面）
const ARM_W = 100;
const armGeo = new THREE.PlaneGeometry(1, ARM_W + 16); armGeo.translate(0.5, 0, 0);
const arm = new THREE.Mesh(armGeo, matFor(canvasTex(64, 80, g => {
  g.fillStyle = '#fff'; g.fillRect(0, 8, 64, 64);
  g.beginPath(); g.moveTo(-10, 8); g.lineTo(80, 8); g.moveTo(-10, 72); g.lineTo(80, 72); g.stroke();
})));
arm.renderOrder = 3.3; arm.visible = false; // 不接手臂，只用手 
scene.add(arm);

// ---------- 量杯（暫代圖） ----------
const cup = new THREE.Group(); cup.visible = false; scene.add(cup);
const CUP = { x: 0, y0: 0, top: 0 };
{
  const W = P.CUP_W * 2 + 60, H = P.CUP_H + 40, ix = 30, iy = 30; // 內部左上角在 (ix, iy)
  const back = canvasTex(W, H, g => {
    // 不透明：杯子後面地上的液體不會透過來，看起來像在杯子裡
    g.fillStyle = '#fbf8f2'; g.fillRect(ix - 5, iy - 6, P.CUP_W * 2 + 10, P.CUP_H + 11);
  });
  const front = canvasTex(W, H, g => {
    g.lineWidth = 10;
    g.beginPath(); g.moveTo(ix - 5, iy - 6); g.lineTo(ix - 5, iy + P.CUP_H + 5); g.lineTo(ix + P.CUP_W * 2 + 5, iy + P.CUP_H + 5); g.lineTo(ix + P.CUP_W * 2 + 5, iy - 6); g.stroke();
    // 刻度：每 5 ml 一條，最上面一條＝一碗＝P.TOTAL * P.ML ml
    g.lineWidth = 5; g.fillStyle = STROKE; g.font = '900 17px "Arial Black",sans-serif'; g.textBaseline = 'middle';
    const full = P.TOTAL * P.ML;
    for (let ml = 5; ml <= full + 0.01; ml += 5) {
      const y = iy + P.CUP_H - (P.CUP_ML0 + ml * P.CUP_MLH);
      const xr = ix + P.CUP_W * 2; // 刻度畫在右側，左手拿著不會擋到
      g.beginPath(); g.moveTo(xr - 2, y); g.lineTo(xr - 22, y); g.stroke();
      g.textAlign = 'right'; g.fillText(String(ml), xr - 26, y);
    }
  });
  for (const [t, o] of [[back, 3.6], [front, 9]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), matFor(t));
    // group 原點 = 內部底部中央
    m.position.set(W / 2 - (ix + P.CUP_W), iy + P.CUP_H - H / 2, 0); m.renderOrder = o; cup.add(m);
  }
}
// 量測時拿量杯的左手：把右手圖左右鏡像，大拇指壓在量杯左側前面、手掌在杯子後面
const leftHand = new THREE.Group(); leftHand.scale.x = -1; cup.add(leftHand);
function leftHandPart(key, order) {
  const d = L[key], pd = L.hand_palm;
  const t = texLoader.load('img/' + key + '.png'); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(d.w * HAND.s, d.h * HAND.s), matFor(t));
  const c = handPt(d.x - pd.x + d.w / 2, d.y - pd.y + d.h / 2);
  m.position.set(c.x, c.y, 0); m.renderOrder = order; leftHand.add(m);
}
leftHandPart('hand_palm', 3.65); // 畫在不透明杯背之上、杯裡液體之下
leftHandPart('hand_thumb', 9.5);
{ const g = handPt(225, 150); leftHand.position.set(-P.CUP_W - 6 + g.x, P.CUP_H * 0.62 - g.y, 0); }
let CUP_SEGS = [];
function placeCup() {
  CUP.x = P.CUP_X; CUP.y0 = FLOOR - P.CUP_SINK; CUP.top = CUP.y0 + P.CUP_H;
  cup.position.set(CUP.x, CUP.y0, 0);
  const l = CUP.x - P.CUP_W - 5, r = CUP.x + P.CUP_W + 5, b = CUP.y0 - 5, t = CUP.top;
  CUP_SEGS = [[l, t, l, b], [l, b, r, b], [r, b, r, t]];
}
function inCup(p) { return p.x > CUP.x - P.CUP_W - 2 && p.x < CUP.x + P.CUP_W + 2 && p.y > CUP.y0 - 4 && p.y < CUP.top + 12; }

// ---------- 液體繪製：密度圖 → 門檻合成；表面用密度梯度當法線，做彩虹雷射反射 ----------
const MAX = 4000, DRAW_MAX = 16000;
const uTime = { value: 0 };
class LiquidLayer {
  constructor(order) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(DRAW_MAX * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.big = new Float32Array(DRAW_MAX);
    this.geo.setAttribute('aBig', new THREE.BufferAttribute(this.big, 1));
    this.uSize = { value: 20 };
    this.dens = new THREE.ShaderMaterial({
      uniforms: { uSize: this.uSize }, transparent: true, depthTest: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uSize; attribute float aBig; varying float vBig; void main(){ vBig=aBig; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_PointSize=uSize*(1.+aBig*1.2); }`,
      fragmentShader: `varying float vBig; void main(){ vec2 c=gl_PointCoord*2.-1.; c.y*=1.+vBig*1.2; /* 地上的一灘：又大又扁，連成一片 */ float r=dot(c,c); if(r>1.)discard; float w=(1.-r)*(1.-r); gl_FragColor=vec4(w); }`,
    });
    this.pts = new THREE.Points(this.geo, this.dens); this.pts.frustumCulled = false;
    this.ptsScene = new THREE.Scene(); this.ptsScene.add(this.pts);
    this.rtD = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    this.res = { value: new THREE.Vector2(4, 4) };
    this.texel = { value: 3 };
    const comp = new THREE.ShaderMaterial({
      uniforms: { tD: { value: this.rtD.texture }, uRes: this.res, uTime, uStep: this.texel,
        uStroke: { value: new THREE.Vector3(...STROKE_RGB) } },
      transparent: true, depthTest: false, depthWrite: false,
      vertexShader: `void main(){ gl_Position=vec4(position.xy,0.,1.); }`,
      fragmentShader: `uniform sampler2D tD; uniform vec2 uRes; uniform vec3 uStroke; uniform float uTime, uStep;
        float D(vec2 uv){ return texture2D(tD,uv).r; }
        void main(){
          vec2 uv=gl_FragCoord.xy/uRes; float d=D(uv);
          if(d<0.34) discard;
          if(d<0.44){ gl_FragColor=vec4(uStroke,1.); return; }
          vec2 e=uStep/uRes;
          float gx=D(uv+vec2(e.x,0.))-D(uv-vec2(e.x,0.));
          float gy=D(uv+vec2(0.,e.y))-D(uv-vec2(0.,e.y));
          // 越靠近邊緣越斜：用密度做隆起的高度
          // 平的液體：顏色主要是畫面上平順流動的彩虹漸層，表面角度只輕輕影響；一條柔和的白色反光
          vec3 N=normalize(vec3(-gx*0.5,-gy*0.5,1.));
          vec2 sp=gl_FragCoord.xy/uRes.y;
          float t=(sp.x*0.45+sp.y*0.7) + uTime*0.12 + dot(N.xy,vec2(0.8,0.6))*0.12;
          vec3 rain=0.5+0.5*cos(6.2831*(t+vec3(0.,0.33,0.67)));
          rain=mix(vec3(1.), rain, 0.78);                    // 粉彩一點、亮一點
          float edge=smoothstep(0.5,0.9,d);                   // 靠邊緣的地方
          float gl=smoothstep(0.55,0.95,dot(N.xy,vec2(-0.55,0.83))*4.+0.5)*(1.-edge*0.6);
          vec3 c=rain + gl*0.12;
          gl_FragColor=vec4(min(c,vec3(1.)),1.); }`,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), comp);
    this.quad.frustumCulled = false; this.quad.renderOrder = order;
    scene.add(this.quad);
  }
  setSize(w, h, ppu, dpr) {
    this.rtD.setSize(w, h); this.res.value.set(w, h);
    this.uSize.value = P.R * 9.5 * ppu;
    this.texel.value = 5 * dpr;
  }
  fill(list) {
    let n = 0;
    for (const p of list) {
      if (n >= DRAW_MAX - 4) break;
      this.big[n] = p.floor ? 1 : 0;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = 0; n++;
      // 掉很快的拖一段尾巴，噴流才是一整條、不會斷成一顆一顆
      const v = p.stuck ? 0 : Math.hypot(p.vx, p.vy);
      if (v > 250) for (const k of [0.33, 0.66, 1]) {
        const tt = Math.min(0.03, 9 / v * 3) * k;
        this.big[n] = 0;
        this.pos[n * 3] = p.x - p.vx * tt; this.pos[n * 3 + 1] = p.y - p.vy * tt; this.pos[n * 3 + 2] = 0; n++;
      }
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = this.geo.attributes.aBig.needsUpdate = true;
    this.quad.visible = n > 0;
    this.n = n;
  }
  draw() {
    if (!this.n) return;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(this.rtD); renderer.clear(); renderer.render(this.ptsScene, cam);
    renderer.setRenderTarget(null);
  }
}
const liquidFree = new LiquidLayer(4);    // 在下巴之上、頭之下
const liquidStuck = new LiquidLayer(13);  // 沾在手上的，畫在手上面
const liquidFloor = new LiquidLayer(2.5); // 地上的一灘：在貓身體前、碗和量杯後面

// ---------- 視窗 ----------
let ppu = 1, SW = 402, SH = 874, camZ = 1;
function resize() {
  const W = innerWidth, H = innerHeight;
  // 手機：橫拿全螢幕，直拿顯示「請把手機橫過來」；電腦：置中的橫向外框，不要太大
  const phone = matchMedia('(pointer: coarse)').matches && Math.min(W, H) < 700;
  document.getElementById('rotate').classList.toggle('hidden', !(phone && W > H)); // 手機橫拿時請他轉回直的
  if (phone) { SW = W; SH = H; }
  else { SH = Math.min(H - 48, 920); SW = Math.round(SH * P.ASPECT); }
  stage.classList.toggle('phone', phone);
  stage.style.width = SW + 'px'; stage.style.height = SH + 'px';
  renderer.setSize(SW, SH);
  const a = SW / SH;
  cam.left = P.VIEW_CX - P.VIEW_HALFW; cam.right = P.VIEW_CX + P.VIEW_HALFW;
  const vh = 2 * P.VIEW_HALFW / a;
  cam.bottom = FLOOR - vh * P.FLOOR_AT; cam.top = cam.bottom + vh;
  cam.updateProjectionMatrix();
  placeCup();
  const db = renderer.getDrawingBufferSize(new THREE.Vector2());
  ppu = db.x / (cam.right - cam.left);
  const dpr = renderer.getPixelRatio();
  liquidFree.setSize(db.x, db.y, ppu, dpr); liquidStuck.setSize(db.x, db.y, ppu, dpr); liquidFloor.setSize(db.x, db.y, ppu, dpr);
}
addEventListener('resize', resize);
if (window.visualViewport) visualViewport.addEventListener('resize', resize);
resize();

// 電腦版背景：貓咪線稿重複花紋
{
  // 印花用 PSD「身體」資料夾裡的「貓印花」「貓印花2」（各一整隻貓），兩隻交錯排
  const imgs = ['pattern1', 'pattern2'].map(k => { const i = new Image(); i.src = 'img/' + k + '.png'; return i; });
  Promise.all(imgs.map(i => i.decode())).then(() => {
    const s = 0.2, T = 260;
    const c = document.createElement('canvas'); c.width = T; c.height = T;
    const g = c.getContext('2d'); g.globalAlpha = 0.45;
    const drawCat = (im, cx, cy, rot) => {
      g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(s, s);
      g.drawImage(im, -im.width / 2, -im.height / 2);
      g.restore();
    };
    drawCat(imgs[0], T * 0.27, T * 0.27, -0.15); drawCat(imgs[1], T * 0.77, T * 0.77, 0.12);
    document.body.style.backgroundImage = `url(${c.toDataURL()})`;
  }).catch(() => {});
}

// ---------- 防誤觸（iOS） ----------
for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'contextmenu', 'selectstart'])
  document.addEventListener(ev, e => { if (!e.target.classList?.contains('shotImg')) e.preventDefault(); }, { passive: false }); // 截圖要能長按儲存
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
  const t = performance.now();
  if (t - lastTouchEnd < 320 && !(e.target instanceof HTMLButtonElement)) e.preventDefault(); // 點兩下放大
  lastTouchEnd = t;
}, { passive: false });

// ---------- 指標 → 碗 ----------
const target = { x: 1000, y: -1300 };
function onPointer(e) {
  const r = renderer.domElement.getBoundingClientRect();
  const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
  target.x = THREE.MathUtils.lerp(cam.left, cam.right, u);
  target.y = THREE.MathUtils.lerp(cam.top, cam.bottom, v) + (e.pointerType === 'touch' ? P.TOUCH_LIFT : 0);
}
addEventListener('pointermove', onPointer);
addEventListener('pointerdown', onPointer);
// 手的起始位置：畫面左下、貓的前面（畫面寬 42%、高 71% 的地方）
const HOME = { u: 0.4, v: 0.72 };
function homeBowl() {
  target.x = THREE.MathUtils.lerp(cam.left, cam.right, HOME.u);
  target.y = THREE.MathUtils.lerp(cam.top, cam.bottom, HOME.v);
  bowl.position.set(target.x, target.y, 0);
}
homeBowl();
const bowlHist = [];

// ---------- 音效（Web Audio：iPhone 上比較穩，也能變音高） ----------
let ac = null;
const RAW = {}, BUF = {};
// 聲音開關（試聽面板用）：on＝總開關（快轉時關掉）；pour 黏液倒出聲、bloop 進杯啵聲、mlBeep 舊版每 ml 嗶聲、jingle 結算音
// 每個音檔的音量倍數：音檔都先統一到約 -20 LUFS（原檔在 sfx/候選/原始音量），
// 乾嘔、咳嗽尖峰大、壓不到那麼響，這裡補；倒杯黏液聲是背景，壓低一點讓「啵」聽得到
const VOL = { retch: 1, cough: 1.12, vomit: 0.56, pour: 0.56, meow_sweet1: 0.66, meow_sweet3: 0.66, meow_sad: 1.36 }; // 11/26 短時響度實測：主要音效約 -19、黏液聲 -24、啵 -21
const SND = { on: true, pour: true, bloop: true, mlBeep: false, jingle: true, meow: true };
const SFX_NAMES = ['retch', 'cough', 'vomit', 'pour', 'meow_sweet1', 'meow_sweet3', 'meow_sad'];
for (const n of SFX_NAMES) fetch(`sfx/${n}.mp3`).then(r => r.arrayBuffer()).then(b => RAW[n] = b).catch(() => {});
function initAudio() {
  if (ac) { ac.resume(); return; }
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {} // 靜音鍵開著也有聲音
  ac = new (window.AudioContext || window.webkitAudioContext)();
  ac.resume();
  const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, 22050); s.connect(ac.destination); s.start(0);
  for (const n of SFX_NAMES) decode(n);
}
function decode(n) {
  if (!RAW[n]) { fetch(`sfx/${n}.mp3`).then(r => r.arrayBuffer()).then(b => { RAW[n] = b; decode(n); }).catch(() => {}); return; }
  ac.decodeAudioData(RAW[n].slice(0), b => BUF[n] = b, () => {});
}
// offset、dur：只播檔案中的一段（秒）
function play(name, vol = 0.9, rate = 1, offset = 0, dur) {
  if (!ac || !BUF[name] || !SND.on) return;
  const s = ac.createBufferSource(); s.buffer = BUF[name]; s.playbackRate.value = rate;
  const g = ac.createGain(); g.gain.value = vol * (VOL[name] ?? 1);
  s.connect(g).connect(ac.destination);
  if (dur) s.start(0, offset, dur); else s.start(0, offset);
  return { s, g };
}
let vomitSnd = null; // 正在播的嘔吐聲：下一坨開始時淡出，不要疊在一起
// 倒進量杯的黏液聲：循環播放，倒完淡出
let pourSrc = null, pourGain = null;
function pourStart() {
  if (!ac || !BUF.pour || pourSrc || !SND.on || !SND.pour) return;
  pourSrc = ac.createBufferSource(); pourSrc.buffer = BUF.pour; pourSrc.loop = true;
  pourGain = ac.createGain(); pourGain.gain.setValueAtTime(0.0001, ac.currentTime);
  pourGain.gain.exponentialRampToValueAtTime(VOL.pour, ac.currentTime + 0.15);
  pourSrc.connect(pourGain).connect(ac.destination); pourSrc.start();
}
function pourStop() {
  if (!pourSrc) return;
  const t = ac.currentTime; pourGain.gain.cancelScheduledValues(t); pourGain.gain.setValueAtTime(pourGain.gain.value, t);
  pourGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); pourSrc.stop(t + 0.4); pourSrc = null;
}
// 量杯嗶聲：第 i 格，每格高四分之一個半音×2（24 格一個八度）
function beep(i, vol = 0.2, len = 0.12, delay = 0) {
  if (!ac || !SND.on) return;
  const t = ac.currentTime + delay, f = 440 * Math.pow(2, i / 24);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  g.connect(ac.destination);
  for (const [type, mul, v] of [['triangle', 1, 1], ['sine', 2, 0.35]]) {
    const o = ac.createOscillator(); o.type = type; o.frequency.value = f * mul;
    const og = ac.createGain(); og.gain.value = v;
    o.connect(og).connect(g); o.start(t); o.stop(t + len + 0.02);
  }
}

// 一顆液體掉進量杯的「啵」：短短的氣泡聲，音高往上滑；fill 0→1 越滿越高，每聲音高略有亂數
// delay：同一格進好幾顆時，把聲音平均排在這一格的時間裡；k：這一格進了幾顆（多的時候每聲小聲一點，疊起來才不會爆）
function bloop(fill, delay = 0, k = 1) {
  if (!ac || !SND.on || !SND.bloop) return;
  const t = ac.currentTime + delay, f0 = 300 * Math.pow(2, fill * 1.5) * (0.9 + Math.random() * 0.2);
  const vol = 0.2 / Math.sqrt(k);
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * 2.2, t + 0.05);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.09);
}

// ---------- 液體模擬（Clavet 雙密度鬆弛，2D） ----------
const parts = [];
function emit(dt, state) {
  state.acc += (state.rate || P.RATE) * dt;
  mouth.updateWorldMatrix(true, false);
  const m = mouth.getWorldPosition(new THREE.Vector3());
  const dir = dirOf(catA); // catA = 身體傾斜＋頭轉的總角度（顯示用、有果凍）
  const dx = Math.cos(dir), dy = Math.sin(dir), nx = -dy, ny = dx;
  while (state.acc >= 1 && state.emitted < (state.cap ?? P.TOTAL)) {
    state.acc -= 1;
    const age = state.acc / P.RATE; // 這一顆其實是 age 秒前噴出的，往前補位置，噴流才連續
    for (let l = 0; l < P.LANES && state.emitted < (state.cap ?? P.TOTAL); l++) {
      const off = (l - (P.LANES - 1) / 2) * P.LANE_GAP;
      const s = P.SPEED * (0.99 + Math.random() * 0.02);
      const vx = dx * s + nx * (Math.random() - .5) * 4, vy = dy * s + ny * (Math.random() - .5) * 4;
      const x = m.x + nx * off + vx * age, y = m.y + ny * off + vy * age - 0.5 * P.G * age * age;
      const u = 0.5 + 0.5 * Math.sin(state.t * 2.3 + state.dph + l * 0.7);
      const depth = P.DEPTH_MIN + (P.DEPTH_MAX - P.DEPTH_MIN) * (0.8 * u + 0.2 * Math.random());
      parts.push({ x, y, px: x, py: y, vx, vy: vy - P.G * age, depth, floor: false, stuck: false, air: true, lx: 0, ly: 0, noStick: 0, rho: 0, rhoN: 0 });
      state.emitted++;
    }
  }
}

// 碗內壁（下半橢圓）切成線段，當作有厚度的牆（碗的區域座標）
const BOWL_SEGS = [];
{
  const n = 18, rx = BOWL.rx - 6, ry = BOWL.depth - 7;
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + Math.PI * i / n;
    const p = { x: Math.cos(a) * rx, y: Math.sin(a) * ry };
    if (prev) BOWL_SEGS.push([prev, p]);
    prev = p;
  }
}
function pushOutSeg(p, ax, ay, bx, by, rad) {
  const ex = bx - ax, ey = by - ay;
  const len2 = ex * ex + ey * ey;
  let t = len2 > 0 ? ((p.x - ax) * ex + (p.y - ay) * ey) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + ex * t, cy = ay + ey * t;
  let dx = p.x - cx, dy = p.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rad * rad) return false;
  const d = Math.sqrt(d2) || 1e-4;
  if (d2 === 0) { dx = 0; dy = 1; }
  p.x = cx + dx / d * rad; p.y = cy + dy / d * rad;
  return true;
}
function bowlRot() { const a = bowl.rotation.z; return { c: Math.cos(a), s: Math.sin(a) }; }
function toBowl(p, r) { const dx = p.x - bowl.position.x, dy = p.y - bowl.position.y; return { x: dx * r.c + dy * r.s, y: -dx * r.s + dy * r.c }; }

let shoulder = { x: 0, y: 0 };
function handFrame() {
  const r = bowlRot();
  const W = (q) => ({ x: bowl.position.x + q.x * r.c - q.y * r.s, y: bowl.position.y + q.x * r.s + q.y * r.c });
  const f = W(FIST), w = W(WRIST);
  const dx = ARM_DIR.x * r.c - ARM_DIR.y * r.s, dy = ARM_DIR.x * r.s + ARM_DIR.y * r.c;
  shoulder = { x: w.x + dx * 1400, y: w.y + dy * 1400 };
  const a = Math.atan2(dy, dx);
  return { fx: f.x, fy: f.y, wx: w.x, wy: w.y, c: Math.cos(a), s: Math.sin(a) };
}
function handHit(p, hf) {
  return pushOutSeg(p, hf.fx, hf.fy, hf.wx, hf.wy, FIST.r + P.R); // 手掌到手腕
}

const grid = new Map();
function step(dt) {
  const H = P.H, free = [];
  for (const p of parts) if (!p.stuck) free.push(p);
  const drag = Math.exp(-P.FLOOR_DRAG * dt);
  for (const p of free) { if (p.floor) { p.vx *= drag; p.vy *= drag; } else p.vy -= P.G * dt; }
  buildGrid(free);
  const pairs = [];
  for (const p of free) { p.rho = 0; p.rhoN = 0; }
  forPairs(free, (a, b, dx, dy, d) => {
    if (a.floor !== b.floor) return; // 地上的和空中的不互相推
    const q = 1 - d / H;
    a.rho += q * q; b.rho += q * q; a.rhoN += q * q * q; b.rhoN += q * q * q;
    pairs.push(a, b, dx / d, dy / d, q);
  });
  for (let i = 0; i < pairs.length; i += 5) {
    const a = pairs[i], b = pairs[i + 1], ux = pairs[i + 2], uy = pairs[i + 3], q = pairs[i + 4];
    const u = (a.vx - b.vx) * ux + (a.vy - b.vy) * uy;
    if (u > 0) { const I = P.VISC * q * u * 0.5; a.vx -= I * ux; a.vy -= I * uy; b.vx += I * ux; b.vy += I * uy; }
  }
  for (const p of free) {
    const v = Math.hypot(p.vx, p.vy); if (v > P.VMAX) { p.vx *= P.VMAX / v; p.vy *= P.VMAX / v; }
    p.px = p.x; p.py = p.y; p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = 0; i < pairs.length; i += 5) {
    const a = pairs[i], b = pairs[i + 1], ux = pairs[i + 2], uy = pairs[i + 3], q = pairs[i + 4];
    const Pa = P.K * (a.rho - P.RHO0), Pb = P.K * (b.rho - P.RHO0);
    let D = ((Pa + Pb) * q + P.KN * (a.rhoN + b.rhoN) * q * q) * 0.25;
    D = Math.max(-P.DMAX, Math.min(P.DMAX, D));
    if (a.air && b.air && D < 0) D *= P.AIR_COHESION; // 還在空中的只輕輕相吸：成一條，但不會縮成一顆一顆
    const fy = a.floor ? 0.45 : 1; // 地上的一灘：透視下前後方向看起來比較扁
    a.x -= D * ux; a.y -= D * uy * fy; b.x += D * ux; b.y += D * uy * fy;
  }
  for (const p of free) { p.rx = p.x; p.ry = p.y; }
  // 碰撞
  const r = bowlRot(), bx = bowl.position.x, by = bowl.position.y;
  const hf = handFrame();
  for (const p of free) {
    if (p.floor) {
      // 攤在地面上：在平面上散開，不能跑到貓腳那條線後面
      p.hitBowl = false;
      if (p.y > FLOOR - 2) p.y = FLOOR - 2;
      if (p.y < cam.bottom + P.R) p.y = cam.bottom + P.R;
      if (p.x < cam.left + P.R) p.x = cam.left + P.R;
      if (p.x > cam.right - P.R) p.x = cam.right - P.R;
      continue;
    }
    // 碗（換到碗的區域座標算，碗可以傾斜）
    const lp = toBowl(p, r);
    if (lp.x > -BOWL.rx - 20 && lp.x < BOWL.rx + 20 && lp.y < 20 && lp.y > -BOWL.depth - 20) {
      let hit = false;
      for (const [s0, s1] of BOWL_SEGS) hit = pushOutSeg(lp, s0.x, s0.y, s1.x, s1.y, 7 + P.R) || hit;
      p.x = bx + lp.x * r.c - lp.y * r.s; p.y = by + lp.x * r.s + lp.y * r.c;
      p.hitBowl = hit; if (hit) p.air = false;
    } else p.hitBowl = false;
    // 量杯
    if (cup.visible && !p.carried) for (const s of CUP_SEGS) if (pushOutSeg(p, s[0], s[1], s[2], s[3], 5 + P.R)) p.air = false;
    // 從碗倒出來的：掉到杯口高度以下就一定在杯子裡面（看不見的漏斗），一滴都不漏
    if (p.pour && !p.carried && S.t > 0.8 && p.y < CUP.top + 14) { // 碗還在搬運（裡面的液體跟著碗走）時不吸
      const lo = CUP.x - P.CUP_W + 10, hi = CUP.x + P.CUP_W - 10;
      if (p.x < lo || p.x > hi) { p.x = Math.max(lo, Math.min(hi, p.x)); if (p.y > CUP.top - 6) p.y = Math.min(p.y, CUP.top + 14); }
      if (p.y < CUP.y0 + P.R) p.y = CUP.y0 + P.R;
    }
    // 手
    if (S.name !== 'pour' && !inBowl(p) && handHit(p, hf) && now > p.noStick && Math.random() < P.STICK) {
      p.stuck = true; p.air = false;
      const dx = p.x - hf.fx, dy = p.y - hf.fy;
      p.lx = dx * hf.c + dy * hf.s; p.ly = -dx * hf.s + dy * hf.c;
    } else if (S.name === 'pour') { if (handHit(p, hf)) p.air = false; }
    // 地板、左右牆
    // 落到自己那股的深度就變成地上的一灘（量杯範圍內交給量杯接）
    // 在碗裡的不會「落地」：碗拿得很低（地面那一區）也一樣是碗裡的液體
    if (!p.stuck && !p.pour && !p.carried && !p.hitBowl && p.y <= FLOOR - p.depth && !overBowl(p) && !(cup.visible && Math.abs(p.x - CUP.x) < P.CUP_W + 12 && p.y > CUP.y0 - 20)) {
      p.floor = true; p.air = false; p.vx *= 0.35; p.vy *= 0.12;
    }
  }
  for (const p of free) {
    if (p.stuck) continue;
    let nvx = (p.rx - p.px) / dt, nvy = (p.ry - p.py) / dt;
    const ddx = nvx - p.vx, ddy = nvy - p.vy, dl = Math.hypot(ddx, ddy), cap = P.DVMAX;
    if (dl > cap) { const k = cap / dl; nvx = p.vx + ddx * k; nvy = p.vy + ddy * k; }
    // 碰撞修正換成的速度有上限：被碗、手推到也不會彈飛
    let cx = (p.x - p.rx) / dt, cy = (p.y - p.ry) / dt;
    const cl = Math.hypot(cx, cy); if (cl > P.CMAX) { cx *= P.CMAX / cl; cy *= P.CMAX / cl; }
    p.vx = nvx + cx; p.vy = nvy + cy;
    // 倒的時候，量杯口上方像漏斗：從碗流下來的往杯口中央集中
    if (S.name === 'pour' && !p.hitBowl && p.y > CUP.top - 10 && p.y < CUP.top + 280 && (p.pour || Math.abs(p.x - CUP.x) < 240)) {
      p.vx += ((CUP.x - p.x) * 55 - p.vx * 14) * dt;
    }
    if (p.carried) { if (p.hitBowl) { p.vx *= P.BOWL_DAMP; p.vy *= P.BOWL_DAMP; } } // 碗裡的：速度是相對碗的
    else if (p.hitBowl) { p.vx = bowlVel.x + (p.vx - bowlVel.x) * P.BOWL_DAMP; p.vy = bowlVel.y + (p.vy - bowlVel.y) * P.BOWL_DAMP; }
  }
}
function buildGrid(list) {
  grid.clear();
  for (const p of list) {
    const k = (Math.floor(p.x / P.H) + 5000) * 100000 + (Math.floor(p.y / P.H) + 50000);
    let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(p);
  }
}
function forPairs(list, fn) {
  const H = P.H, H2 = H * H;
  for (const a of list) {
    const gx = Math.floor(a.x / H) + 5000, gy = Math.floor(a.y / H) + 50000;
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const c = grid.get((gx + ox) * 100000 + gy + oy); if (!c) continue;
      for (const b of c) {
        if (b._i <= a._i) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= H2 || d2 < 1e-6) continue;
        fn(a, b, dx, dy, Math.sqrt(d2));
      }
    }
  }
}
function updateStuck(dt) {
  const hf = handFrame();
  for (const p of parts) {
    if (!p.stuck) continue;
    p.x = hf.fx + p.lx * hf.c - p.ly * hf.s;
    p.y = hf.fy + p.lx * hf.s + p.ly * hf.c;
    if (S.name !== 'pour' && Math.random() < P.DRIP * dt) {
      p.stuck = false; p.noStick = now + 1.2;
      p.px = p.x; p.py = p.y; p.vx = bowlVel.x; p.vy = bowlVel.y - 40; p.air = false;
    }
  }
}
// 在碗口正上方往下掉（或已在碗裡）：畫面上看起來會掉進碗，就讓它掉進碗，不在半空落地
function overBowl(p) {
  const l = toBowl(p, bowlRot());
  return Math.abs(l.x) < BOWL.rx + 10 && l.y > -BOWL.depth - 10 && l.y < 600;
}
function inBowl(p) {
  const l = toBowl(p, bowlRot());
  const x = l.x / BOWL.rx, y = l.y / BOWL.depth;
  return y < 0.15 && x * x + Math.min(y, 0) ** 2 < 1;
}

// ---------- 流程 ----------
// title → idle → sick → vomit → settle → pour → result
const $ = id => document.getElementById(id);
const ui = { title: $('title'), result: $('result'), cupNum: $('cupNum'), grade: $('grade'), desc: $('desc'), amt: $('amt') };
let now = 0, headAngle = 0;
let catA = 0, catVA = 0, catH = 0, catVH = 0;
// 扭動量：headAngle（目標）／catA（顯示，有果凍）都在 -1～1：-1 身體扭到左邊、往左下吐；+1 扭到右邊、往右下吐
function dirOf(a) { return -Math.PI / 2 + a * (a > 0 ? P.SWAY_DIR_R : P.SWAY_DIR); } // 往右扭時頭本來就移得多，角度給小一點，左右落點才對稱 // 果凍：實際顯示的轉角、身高，用彈簧追 headAngle、S.hgt
const S = { side: 1, name: 'title', t: 0, dur: 0, acc: 0, heaves: [], emitted: 0, aim: 0, ph: 0, w: 0,
  shown: 0, lastN: -1, stableT: 0, from: null };
const bowlVel = { x: 0, y: 0 };
function startBurst() {
  S.phase = 'spit'; S.pt = 0; S.acc = 0;
  S.cap = S.cuts[S.bi];
  S.rate = (S.cap - S.emitted) / (P.BURST_TIME[S.bi] * P.LANES);
  S.fan0 = headAngle; setPose('vomit');
  if (S.bi === 0) S.fans = []; S.fans.push(S.fan0); // 記下每一坨吐的方向
  // 嘔吐聲（他錄的 貓咪吐.m4a）：檔案裡三段聲音一大、一中、一小，剛好對上三坨，每坨播對應那段
  const seg = P.VOMIT_SEG[Math.min(S.bi, P.VOMIT_SEG.length - 1)];
  if (vomitSnd && ac) { const t = ac.currentTime; vomitSnd.g.gain.setValueAtTime(vomitSnd.g.gain.value, t); vomitSnd.g.gain.linearRampToValueAtTime(0, t + 0.08); try { vomitSnd.s.stop(t + 0.1); } catch (e) {} }
  vomitSnd = play('vomit', seg[2], 1, seg[0], seg[1]) || null;
}
function pickAim() {
  // 這一局的主要方向：左下到右下之間隨機，之後左右擺動
  S.aim = (Math.random() * 2 - 1) * 0.85;
  S.ph = Math.random() * Math.PI * 2; S.w = 2.2 + Math.random() * 1.6; S.avoidT = 0;
}
const ease = u => u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u);
function enter(name) {
  S.name = name; S.t = 0;
  stage.classList.toggle('play', name !== 'title' && name !== 'result');
  if (name === 'title' || name === 'idle') { setPose('normal'); S.dur = name === 'idle' ? 2.0 : 1e9; } // 開場先原地呼吸 2 秒
  if (name === 'idle') { blink.next = now + 0.6 + Math.random() * 0.4; blink.again = false; } // 待機 2 秒內一定眨一次
  if (name === 'pour') { blink.next = now + 0.35; blink.again = false; } // 吐完回到普通臉，很快眨一下
  // 三下乾嘔對齊 retch 的三段聲音，第四下是最後的咳嗽
  if (name === 'sick') { S.tagged = false; S.notice = false; S.dodge = null; S.dodgeT = -9; S.bangT = -9; pickAim(); S.juke = null; S.cornerT = 0; S.dur = 3.4; S.heaves = [0.0, 0.88, 2.02, 2.7]; S.played = 0; play('retch', 1); }
  if (name === 'vomit') {
    S.acc = 0; S.emitted = 0; S.alert = false; S.juke = null; S.dph = Math.random() * 6.28;
    // 連續吐 3 坨：累計到第幾顆為止
    let c = 0; S.cuts = P.BURSTS.map((f, i) => i === P.BURSTS.length - 1 ? P.TOTAL : (c += Math.round(P.TOTAL * f)));
    S.bi = 0; startBurst();
  }
  if (name === 'settle') S.dur = 1.1;
  if (name === 'pour') {
    // 量杯出現；杯子位置上原本的液體先清掉
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; if (p.floor && Math.abs(p.x - CUP.x) < P.CUP_W + 40 && p.y > CUP.y0 - 30 && p.y < CUP.top + 160) parts.splice(i, 1); } // 只清地上的（量杯和杯口上方那一片），碗裡的別動
    cup.visible = true;
    // 沾在手上的順著手滴回碗裡（也算接到）
    { const r = bowlRot();
      for (const p of parts) if (p.stuck) {
        p.stuck = false; const lx = (Math.random() - 0.5) * BOWL.rx, ly = -BOWL.depth * (0.3 + Math.random() * 0.4);
        p.x = p.px = bowl.position.x + lx * r.c - ly * r.s; p.y = p.py = bowl.position.y + lx * r.s + ly * r.c; p.vx = p.vy = 0; p.floor = false;
      } }
    // 碗裡每一滴都做記號（含稍微堆出碗口的），量杯只算這些，而且保證全部進杯
    S.tagged = true; S.pourN = 0;
    { const r = bowlRot();
      for (const p of parts) {
        p.pour = false;
        if (p.floor) continue;
        const l = toBowl(p, r), x = l.x / BOWL.rx, y = l.y / BOWL.depth;
        // 碗裡＋堆出碗口的（黏稠的會堆高）都算
        if (Math.abs(l.x) < BOWL.rx + 15 && l.y > -BOWL.depth - 15 && l.y < BOWL.ry + 90 && x * x + Math.min(y, 0) ** 2 < 1.25) { p.pour = true; S.pourN++; }
      } }
    S.from = { x: bowl.position.x, y: bowl.position.y };
    S.shown = 0; S.heard = 0; S.lastN = -1; S.stableT = 0;
    ui.cupNum.textContent = '0 ml'; ui.cupNum.classList.remove('hidden');
  }
  if (name === 'result') { pourStop(); ui.cupNum.classList.add('hidden'); showResult(); } // 結算畫面已有接到幾 ml，量杯讀數收起來
}

const GRADES = [
  { min: 1, g: '滿分', d: '一滴不漏的<br>貓奴之神' },        // 只有 100% 才是一滴不漏
  // 11/26 他定的門檻：S 95、A 90、B 80、C 70 以上，70 以下 D
  { min: 0.95, g: 'S', d: '神之手<br>鏟屎官' },
  { min: 0.9, g: 'A', d: '身手俐落的<br>鏟屎官' },
  { min: 0.8, g: 'B', d: '手忙腳亂<br>但有接到' },
  { min: 0.7, g: 'C', d: '接到一點點<br>地板比較慘' },
  { min: -1, g: 'D', d: '滿地都是<br>貓咪很滿意' },
];
function cupCount() { let n = 0; for (const p of parts) if (p.pour && !p.carried && inCup(p)) n++; return n; } // 只算從碗倒出來的
function showResult() {
  const n = cupCount(), ml = n * P.ML, total = Math.max(S.emitted * P.ML, 0.1), pct = n >= S.emitted ? 1 : Math.min(0.99, Math.round(ml / total * 100) / 100); // 等級跟畫面上顯示的 % 一致
  const G = GRADES.find(x => pct >= x.min);
  ui.grade.textContent = G.g; ui.desc.innerHTML = G.d;
  playLog('完成・' + G.g);
  ui.amt.innerHTML = `接到 ${ml.toFixed(1)} ml<br>貓吐了 ${total.toFixed(1)} ml（${Math.round(pct * 100)}%）`;
  ui.result.classList.remove('hidden');
  const notes = { '滿分': [0, 8, 14, 24, 32], S: [0, 8, 14, 24], A: [0, 8, 14], B: [0, 8], C: [8, 0], D: [6, 0, -8] }[G.g];
  if (SND.jingle) notes.forEach((n, i) => beep(24 + n, 0.41, 0.22, i * 0.13));
  // 貓叫回饋（育種遊戲配種的叫聲，小森平）：接得好＝甜甜的叫；接得差（C、D）＝放慢壓低的哀叫
  if (SND.meow) { // 評分一出現就叫
    if (pct >= 0.8) play(Math.random() < 0.5 ? 'meow_sweet1' : 'meow_sweet3', 1, 1.08);
    else play('meow_sad', 1, 0.78);
  }
}
function newGame() {
  homeBowl();
  parts.length = 0; cup.visible = false; bowl.rotation.z = 0;
  ui.result.classList.add('hidden'); ui.title.classList.add('hidden'); ui.cupNum.classList.add('hidden');
  enter('idle');
}
// 官網後台記遊玩次數（只在正式網址 cankingstore.com 記，本機、預覽、Artifact 都不記，測試才不會灌數字）
function playLog(label) {
  if (!/(^|\.)cankingstore\.com$/.test(location.hostname)) return;
  try {
    const body = JSON.stringify({ kind: 'game', channel: 'catvomit', label, url: location.pathname, page: location.pathname });
    navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
  } catch (e) {}
}
$('start').addEventListener('click', () => {
  playLog('開始');
  initAudio();
  beep(0, 0.22, 0.14); beep(8, 0.22, 0.14, 0.11); beep(14, 0.22, 0.2, 0.22); // 確認有聲音
  newGame();
});
$('again').addEventListener('click', () => { initAudio(); newGame(); playLog('開始'); });

// ---------- 截圖分享：遊戲畫面＋評分疊成一張直式圖片，手機叫出分享選單，電腦直接下載 ----------
function shotCanvas() {
  const gl = renderer.domElement, W = gl.width, H = gl.height, k = W / SW; // k：CSS px → 實際像素
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#f4efe4'; g.fillRect(0, 0, W, H);
  g.drawImage(gl, 0, 0);
  g.fillStyle = 'rgba(244,239,228,0.72)'; g.fillRect(0, 0, W, H);
  g.fillStyle = STROKE; g.textAlign = 'center'; g.textBaseline = 'middle';
  const F = '"PingFang TC","Microsoft JhengHei",sans-serif';
  const cx = W / 2;
  g.font = `900 ${26 * k}px ${F}`; g.fillText('你能接住貓的吐嗎？', cx, H * 0.14);
  g.font = `900 ${110 * k}px "Arial Black",${F}`; g.fillText(ui.grade.textContent, cx, H * 0.34);
  g.font = `900 ${28 * k}px ${F}`;
  ui.desc.innerHTML.split(/<br\s*\/?>/).forEach((l, i) => g.fillText(l, cx, H * 0.5 + i * 38 * k));
  g.font = `700 ${21 * k}px ${F}`;
  ui.amt.innerHTML.split(/<br\s*\/?>/).forEach((l, i) => g.fillText(l, cx, H * 0.64 + i * 32 * k));
  g.font = `700 ${16 * k}px ${F}`; g.globalAlpha = 0.7; g.fillText('貓咪吐', cx, H * 0.95); g.globalAlpha = 1;
  return c;
}
// 分享截圖（2026-11-26 他選的做法）：跳出成績圖，只給「複製圖片」「存下圖片」，不叫系統分享選單
// 手機：長按圖片存到照片＋複製；電腦：存下圖片（下載）＋複製；Artifact 框架裡擋下載，就只留複製和長按／右鍵
function showShot(canvas, blob, name) {
  const touch = matchMedia('(pointer: coarse)').matches, inFrame = window.top !== window;
  const canSave = !touch && !inFrame;
  const canCopy = !!(navigator.clipboard && window.ClipboardItem);
  const o = document.createElement('div');
  o.style.cssText = 'position:fixed;inset:0;z-index:30;background:rgba(40,35,25,.82);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:20px;box-sizing:border-box;font:900 18px "PingFang TC","Microsoft JhengHei",sans-serif;color:#fff;text-align:center';
  o.innerHTML = `<img class="shotImg" src="${canvas.toDataURL('image/png')}" style="max-width:82vw;max-height:62vh;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.4);-webkit-touch-callout:default;-webkit-user-select:auto;user-select:auto;touch-action:auto">
    ${touch ? '<div>長按圖片可以存到照片</div>' : ''}
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
      ${canCopy ? '<button class="sub" data-a="copy">複製圖片</button>' : ''}
      ${canSave ? '<button class="sub" data-a="save">存下圖片</button>' : ''}
      <button class="sub" data-a="close">關閉</button>
    </div>
    <div class="msg" style="min-height:1.4em;font-size:16px"></div>`;
  const msg = o.querySelector('.msg');
  o.addEventListener('click', async e => {
    const a = e.target.dataset && e.target.dataset.a;
    if (a === 'close' || e.target === o) o.remove();
    else if (a === 'copy') {
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); msg.textContent = '已複製，可以直接貼給朋友'; }
      catch (err) { msg.textContent = touch ? '複製不了，請長按圖片存下來' : '複製不了，請在圖片上按右鍵另存'; }
    } else if (a === 'save') {
      const l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = name; l.click();
      setTimeout(() => URL.revokeObjectURL(l.href), 2000);
      msg.textContent = '已存下圖片';
    }
  });
  stage.parentNode.appendChild(o);
}
$('share').addEventListener('click', () => {
  const canvas = shotCanvas();
  canvas.toBlob(blob => { if (blob) showShot(canvas, blob, '貓咪吐_' + ui.grade.textContent + '.png'); }, 'image/png');
});
enter('title');

function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector2();
let sickShake = 0;
// 躲碗：平常照主要方向擺動；碗進到一個頭的距離內才發現，往反方向轉，並伸長或縮短身體閃開
// 躲碗：發現碗 → 頭上驚嘆號、愣一下 → 身體快速甩到另一側（箭頭跟著換邊）並停在那邊
function avoid(dt) {
  const pref = Math.max(-1, Math.min(1, S.aim + P.SWEEP_S * Math.sin(S.ph + S.t * S.w)));
  const b = bowlHist[0];
  mouth.updateWorldMatrix(true, false);
  const m = mouth.getWorldPosition(tmpV);
  const dist = Math.hypot(b.x - m.x, b.y - m.y);
  // 發現碗：碗在一個頭的距離內，或碗擋在預告的拋物線上
  let onPath = false;
  { const dir = dirOf(headAngle), vx = Math.cos(dir) * P.SPEED, vy = Math.sin(dir) * P.SPEED;
    const T = landT(m, vy);
    for (let t = 0.035; t <= T; t += 0.015) { // 跟畫出來的虛線一樣長（到落點為止）
      const x = m.x + vx * t, y = m.y + vy * t - 0.5 * P.G * t * t;
      if (Math.hypot(b.x - x, b.y - y) < P.PATH_SENSE) { onPath = true; break; }
    } }
  const detect = onPath; // 只有碗對到箭頭虛線才會被發現
  let goal = S.dodge != null ? S.dodge : pref, speed = P.SWAY_SPEED;
  if (S.notice) {
    goal = headAngle; // 愣住
    if (now - S.noticeT > P.NOTICE) { S.notice = false; S.dodge = S.noticeSide * 0.95; S.dodgeT = now; goal = S.dodge; }
  } else if (detect && now - S.dodgeT > P.REARM) {
    S.notice = true; S.noticeT = now; S.bangT = now; goal = headAngle;
    // 碗擋在要吐的路上：甩到另一側；只是靠近：往離碗遠的那側甩
    S.noticeSide = onPath ? (headAngle >= 0 ? -1 : 1) : (b.x < m.x ? 1 : -1);
    if (!onPath && Math.sign(S.noticeSide) === Math.sign(headAngle) && Math.abs(headAngle) > 0.6) S.noticeSide = -S.noticeSide;
    beep(34, 0.16, 0.09); beep(40, 0.14, 0.12, 0.07); // 「！」的提示音
  }
  if (now - S.dodgeT < 0.45) speed = P.SWAY_FAST;
  S.alert = S.notice || now - S.dodgeT < 0.4;
  const hgt = detect ? (b.y < m.y + 30 ? P.REACH_UP : -P.REACH_DOWN) * Math.min(1, Math.max(0, 0.35 + 1.3 * (1 - dist / P.HEAD_RANGE))) : 0;
  goal = Math.max(-1, Math.min(1, goal));
  const maxStep = speed * dt;
  headAngle += Math.max(-maxStep, Math.min(maxStep, goal - headAngle));
  S.hgt = hgt;
}

function update(dt) {
  now += dt; S.t += dt; uTime.value = now;
  const ox = bowl.position.x, oy = bowl.position.y, orot = bowl.rotation.z;
  // 先記下碗裡有哪些液體（用碗移動前的位置），碗動完再讓它們跟著碗一起移動，碗壁就不會把它們打飛
  const carried = [];
  { const rc = Math.cos(orot), rs = Math.sin(orot);
    for (const p of parts) {
      p.carried = false;
      if (p.stuck || p.floor || (S.name === 'pour' && S.t > 0.8)) continue; // 開始傾倒後不跟著碗，才倒得出來
      const dx = p.x - ox, dy = p.y - oy, lx = dx * rc + dy * rs, ly = -dx * rs + dy * rc;
      const x = lx / BOWL.rx, y = ly / BOWL.depth;
      const inside = S.name === 'pour' ? p.pour : (y < 0.15 && x * x + Math.min(y, 0) ** 2 < 1); // 搬去量杯的路上：做了記號的全部跟著碗
      if (inside) carried.push(p, lx, ly, p.px - p.x, p.py - p.y);
    } }
  if (S.name === 'pour') {
    // 手把碗拿到量杯上方，往左倒
    const tilt = 110 * Math.PI / 180;
    // 碗的左緣 (-110,0) 轉 tilt 之後落在 (-110cos, -110sin)，要剛好在量杯口正上方
    const B = { x: CUP.x + BOWL.rx * Math.cos(tilt) + P.POUR_DX, y: CUP.top + 22 + BOWL.rx * Math.sin(tilt) };
    // 碗比倒的位置低：先抬上去、再橫移過去，不會從量杯裡穿過、把碗裡的液體擠進杯子
    const u = S.t / 0.8;
    if (S.from.y < B.y) {
      const uy = ease(Math.min(1, u * 2)), ux = ease(Math.max(0, u * 2 - 1));
      bowl.position.y = S.from.y + (B.y - S.from.y) * uy;
      bowl.position.x = S.from.x + (B.x - S.from.x) * ux;
    } else {
      const e = ease(u);
      bowl.position.x = S.from.x + (B.x - S.from.x) * e;
      bowl.position.y = S.from.y + (B.y - S.from.y) * e;
    }
    bowl.rotation.z = tilt * ease((S.t - 0.8) / 3.4); // 慢慢傾，液體從碗口流下去
  } else if (S.name !== 'result') {
    // 碗跟著指標
    const k = 1 - Math.exp(-18 * dt);
    const tx = Math.max(cam.left + BOWL.rx, Math.min(cam.right - 70, target.x));
    const ty = Math.max(cam.bottom + 120, Math.min(P.MOUTH.y + 200, target.y));
    bowl.position.x += (tx - bowl.position.x) * k;
    bowl.position.y += (ty - bowl.position.y) * k;
    // 貓的私人空間：咳嗽、吐的時候碗太靠近嘴巴，就被頭頂開（頭會往碗那邊撞一下）
    if (S.name === 'sick' || S.name === 'vomit') { // 碗不能蓋在嘴上：咳嗽和吐的時候都會被頭頂開
      mouth.updateWorldMatrix(true, false);
      const m = mouth.getWorldPosition(tmpV);
      const dx = bowl.position.x - m.x, dy = bowl.position.y - m.y, dd = Math.hypot(dx, dy);
      if (dd < P.PERSONAL && dd > 1) {
        const push = P.PERSONAL - dd;
        bowl.position.x += dx / dd * push; bowl.position.y += dy / dd * push;
        catVH += 1.2 * push / P.PERSONAL; // 頂一下：身體彈一下
        if (!S.bonkT || now - S.bonkT > 0.35) { S.bonkT = now; beep(-14, 0.5, 0.08); }
      }
    }
  }
  bowlVel.x = (bowl.position.x - ox) / dt; bowlVel.y = (bowl.position.y - oy) / dt;
  {
    // 手的果凍彈簧：碗一加速，手腕那頭就往反方向甩，然後回彈
    const ax = (bowlVel.x - jl.pvx) / dt, ay = (bowlVel.y - jl.pvy) / dt; jl.pvx = bowlVel.x; jl.pvy = bowlVel.y;
    jl.vx += (-JELLY.k * jl.x - JELLY.c * jl.vx - ax * JELLY.m * JELLY.k / 60) * dt;
    jl.vy += (-JELLY.k * jl.y - JELLY.c * jl.vy - ay * JELLY.m * JELLY.k / 60) * dt;
    jl.x += jl.vx * dt; jl.y += jl.vy * dt;
    const l = Math.hypot(jl.x, jl.y); if (l > JELLY.max) { jl.x *= JELLY.max / l; jl.y *= JELLY.max / l; }
    const r = bowlRot(); // 換到碗的區域座標
    jelly.uLag.value.set(jl.x * r.c + jl.y * r.s, -jl.x * r.s + jl.y * r.c);
  }
  bowlHist.push({ t: now, x: bowl.position.x, y: bowl.position.y });
  while (bowlHist.length > 2 && bowlHist[1].t < now - P.REACT) bowlHist.shift();
  // 手臂固定長度，往左下伸出去
  const hf = handFrame();
  arm.position.set(hf.wx, hf.wy, 0);
  arm.rotation.z = Math.atan2(shoulder.y - hf.wy, shoulder.x - hf.wx);
  arm.scale.x = Math.hypot(shoulder.x - hf.wx, shoulder.y - hf.wy);

  // 貓
  // 平常的呼吸：身體慢慢一起一伏
  const br = Math.sin(now * 2.8);
  let sx = 1 - 0.01 * br, sy = 1 + 0.022 * br;
  if (S.name === 'idle' && S.t > S.dur) enter('sick');
  else if (S.name === 'sick') {
    let heave = 0;
    for (const h of S.heaves) { const u = (S.t - h) / 0.36; if (u >= 0 && u < 1) heave = Math.sin(u * Math.PI); }
    while (S.played < S.heaves.length && S.t >= S.heaves[S.played]) { if (S.played === 3) play('cough', 1); S.played++; }
    avoid(dt);
    setPose(heave > 0.05 ? 'sick' : 'normal');
    sy = 1 - 0.06 * heave; sx = 1 + 0.035 * heave;
    sickShake = heave * Math.sin(now * 40);
    if (S.t > S.dur) enter('vomit');
  } else if (S.name === 'vomit') {
    // 吐的時候吐很快、不躲：方向固定在開吐那一刻的 20° 扇形內小幅擺動
    S.alert = false; S.hgt = 0; S.juke = null; S.pt += dt;
    if (S.phase === 'spit') {
      headAngle = Math.max(-1, Math.min(1, S.fan0 + (P.FAN / 2 / P.SWAY_DIR) * Math.sin(S.ph + S.t * S.w * 1.6)));
      emit(dt, S);
      sy = 1 - 0.03 * Math.abs(Math.sin(now * 18)); sx = 1 + 0.02 * Math.abs(Math.sin(now * 18));
      if (S.emitted >= S.cap && S.pt >= P.BURST_TIME[S.bi]) {
        S.bi++; S.pt = 0;
        if (S.bi >= S.cuts.length) S.phase = 'end';
        else {
          // 空檔：乾嘔一下；一半機率甩到另一邊（快速、有殘影），不然原地小偏
          S.phase = 'gap'; setPose('sick');
          S.gapDur = P.GAP[0] + Math.random() * (P.GAP[1] - P.GAP[0]);
          // 三種：快速甩到另一邊／小幅轉頭／幾乎原地
          // 三坨一定吐在不同地方：新方向要離前面每一坨的中心至少 SPOT_SEP，不然重抽
          const far = g => Math.min(...S.fans.map(f => Math.abs(g - f)));
          let goal = null, fast = false;
          for (let i = 0; i < 30 && goal === null; i++) {
            const swing = Math.random() < P.SWING / (P.SWING + P.SMALL_TURN);
            const g = swing ? -Math.sign(S.fan0 || 1) * (0.55 + Math.random() * 0.4)
                            : S.fan0 + (P.SPOT_SEP + Math.random() * 0.25) * (Math.random() < 0.5 ? -1 : 1);
            if (Math.abs(g) <= 1 && far(g) >= P.SPOT_SEP) { goal = g; fast = swing; }
          }
          if (goal === null) { // 抽不到就挑離前面最遠的地方
            let best = -1; for (let g = -1; g <= 1.001; g += 0.05) if (far(g) > best) { best = far(g); goal = g; }
            fast = Math.abs(goal - S.fan0) > 0.7;
          }
          S.gapGoal = goal; S.gapSpeed = fast ? P.SWAY_FAST : P.SWAY_SPEED;
        }
      }
    } else if (S.phase === 'gap') {
      const u = Math.min(1, S.pt / S.gapDur), heave = Math.sin(u * Math.PI);
      sy = 1 - 0.05 * heave; sx = 1 + 0.03 * heave; sickShake = heave * Math.sin(now * 40);
      const st = (S.gapSpeed || P.SWAY_FAST) * dt;
      headAngle += Math.max(-st, Math.min(st, S.gapGoal - headAngle));
      if (S.pt > S.gapDur) startBurst();
    } else if (S.pt > 0.6) enter('settle');
  } else if (S.name === 'settle') {
    headAngle *= Math.exp(-3 * dt); S.hgt = 0;
    if (S.t > S.dur) { setPose('normal'); enter('pour'); }
  } else if (S.name === 'pour' || S.name === 'result' || S.name === 'title' || S.name === 'idle') {
    headAngle *= Math.exp(-3 * dt); S.hgt = 0;
  }
  if (S.name === 'pour') {
    // 黏液聲：碗傾到液體開始流出時開始，碗空了就停
    // 看實際在流的液體：已經離開碗、還沒進杯的有幾顆（液體一流出來就響，流完就停）
    let flow = 0;
    if (S.t > 0.8) for (const p of parts) if (p.pour && !inBowl(p) && !inCup(p) && p.vy < -60) flow++; // 正在往下掉的才算
    if (flow >= 2) pourStart(); else if (flow === 0) pourStop();
    // 碗傾到底一秒後，還卡在碗裡的最後幾滴抖出來，滴進杯口
    if (S.t > 0.8 + 3.4 + 0.8) for (const p of parts) if (p.pour && !p.shaken && !inCup(p)) { p.shaken = true; // 卡在碗裡、掛在杯緣的都抖進杯子（每滴只抖一次，讓它自己掉進去）
      p.x = p.px = CUP.x + (Math.random() - 0.5) * 30; p.y = p.py = CUP.top + 40 + Math.random() * 20; p.vx = 0; p.vy = -60;
    }
    // 倒進去一顆就一聲「啵」：進杯幾顆就響幾聲（一下子進很多就排隊，間隔很短地連響），越滿音越高
    // 這一格新進杯幾顆，就在這一格的時間裡平均排幾聲（不排隊，聲音和數字都跟倒進去同步）
    const n = cupCount();
    if (n > S.heard) {
      const k = n - S.heard;
      for (let i = 0; i < k; i++) bloop((S.heard + i + 1) / P.TOTAL, i * dt / k, k);
      S.heard = n;
      const m = Math.floor(n * P.ML);
      while (S.shown < m) { S.shown++; if (SND.mlBeep) beep(S.shown); }
      ui.cupNum.textContent = m + ' ml';
    }
    if (n === S.lastN) S.stableT += dt; else { S.stableT = 0; S.lastN = n; }
    const allIn = S.tagged && n >= S.pourN; // 碗裡倒出的都進杯了才結算
    if ((S.t > 0.8 + 3.4 + 1.0 && allIn && S.stableT > 0.5 && S.heard >= n) || S.t > 12) enter('result'); // 倒完、抖完才結算
  }
  // 果凍：顯示的轉角、身高用彈簧追目標，快速躲的時候會超過一點再晃回來
  catVA += (P.CAT_K * (headAngle - catA) - P.CAT_C * catVA) * dt; catA += catVA * dt;
  catVH += (P.CAT_K * ((S.hgt || 0) - catH) - P.CAT_C * catVH) * dt; catH += catVH * dt;
  // 身體像果凍左右扭：腳釘在地上，上半身斜過去、扭得越多拉得越長；頭跟著歪
  const leanW = -catA * P.SWAY_LEAN;
  sy *= 1 + P.STRETCH * Math.min(1, Math.abs(catA)) + catH;
  sx *= 1 - catH * 0.35; // 拉長時變瘦、縮短時變胖
  const k = -Math.tan(leanW) * sy;
  cat.matrix.set(sx, k, 0, P.FEET.x, 0, sy, 0, P.FEET.y, 0, 0, 1, 0, 0, 0, 0, 1);
  cat.matrixWorldNeedsUpdate = true;
  const px = P.PIVOT.x - P.FEET.x, py = P.PIVOT.y - P.FEET.y;
  headRoot.position.set(P.FEET.x + sx * px + k * py, P.FEET.y + sy * py, 0);
  headRoot.rotation.z = leanW * 1.3;
  for (const g of [headNormal, headSick, headVBack, headVFront]) g.rotation.z = -catVA * 0.025; // 扭得快時頭被甩一下
  if (S.name === 'sick' || (S.name === 'vomit' && S.phase === 'gap')) headSick.rotation.z += 0.05 * sickShake;

  updateAim(); updateBang(); updateGhosts(); updateBlink();
  // 碗裡的液體跟著碗平移＋旋轉
  { const rc = Math.cos(bowl.rotation.z), rs = Math.sin(bowl.rotation.z);
    for (let i = 0; i < carried.length; i += 5) {
      const p = carried[i], lx = carried[i + 1], ly = carried[i + 2]; p.carried = true;
      p.x = bowl.position.x + lx * rc - ly * rs; p.y = bowl.position.y + lx * rs + ly * rc;
      p.px = p.x + carried[i + 3]; p.py = p.y + carried[i + 4];
    } }
  // 液體
  const sub = P.SUB, h = Math.min(dt, 1 / 30) / sub;
  parts.forEach((p, i) => p._i = i);
  for (let i = 0; i < sub; i++) step(h);
  // 搬去量杯的路上：碗裡的液體整坨釘在碗上（不讓模擬把它甩出碗外、掉進量杯）
  if (S.name === 'pour') { const rc = Math.cos(bowl.rotation.z), rs = Math.sin(bowl.rotation.z);
    for (let i = 0; i < carried.length; i += 5) {
      const p = carried[i], lx = carried[i + 1], ly = carried[i + 2];
      p.x = p.px = bowl.position.x + lx * rc - ly * rs; p.y = p.py = bowl.position.y + lx * rs + ly * rc;
      p.vx = bowlVel.x; p.vy = bowlVel.y;
    } }
  updateStuck(dt);
  for (let i = parts.length - 1; i >= 0; i--) if ((!parts[i].pour && (parts[i].y < cam.bottom - 60 || parts[i].x < cam.left - 200 || parts[i].x > cam.right + 200)) || !isFinite(parts[i].x)) parts.splice(i, 1);
  if (parts.length > MAX) parts.splice(0, parts.length - MAX);
}

function placeCupNum() {
  if (ui.cupNum.classList.contains('hidden')) return;
  // 跟著量杯：放在杯底下方（鏡頭拉近後也對得上）
  const v = tmpV.set(CUP.x, CUP.y0, 0).project(cam);
  ui.cupNum.style.left = ((v.x + 1) / 2 * SW) + 'px';
  ui.cupNum.style.top = Math.max((1 - v.y) / 2 * SH + 20, SH * 0.8) + 'px'; // 拉近後放在下方空白處，不壓到手和地上的液體
}

// ---------- 主迴圈 ----------
let last = performance.now(), stepAcc = 0;
const STEP = 1 / 60;
const freeList = [], stuckList = [], floorList = [];
function frame(t) {
  const dt = Math.min(0.1, (t - last) / 1000); last = t;
  // 模擬固定每步 1/60 秒：手機 120Hz、電腦 60Hz、卡頓時算出來的液體都一樣（不然液體壓縮程度不同，量杯液面高度會跟刻度對不上）
  if (!game.paused) {
    stepAcc += dt; let n = 0;
    while (stepAcc >= STEP && n < 4) { update(STEP); stepAcc -= STEP; n++; }
    if (n === 4) stepAcc = 0;
  }
  draw(dt);
  requestAnimationFrame(frame);
}
// 畫一格（不推進模擬）；除錯時窗格看不到也能用 __game.draw() 手動畫
function draw(dt = 0) {
  freeList.length = stuckList.length = floorList.length = 0;
  let nb = 0;
  const showFill = Math.abs(bowl.rotation.z) < 0.15;
  for (const p of parts) {
    if (p.stuck) { stuckList.push(p); continue; }
    if (showFill && !p.floor && inBowl(p)) { nb++; continue; } // 碗裡的改用液面表示
    (p.floor ? floorList : freeList).push(p);
  }
  const fl = Math.min(1, nb / BOWL.cap);
  bowlFill.visible = showFill && nb > 3;
  const sc = 0.45 + 0.55 * Math.sqrt(fl);
  bowlFill.scale.set(sc, sc, 1);
  bowlFill.position.set(0, -(1 - fl) * BOWL.ry * 0.85, 0);
  bowlFill.material.uniforms.uTime.value = now;
  bowlFill.material.uniforms.uResY.value = renderer.getDrawingBufferSize(tmpV2).y;
  // 倒量杯和結算時鏡頭慢慢拉近到量杯；只改畫面，物理邊界（cam.left 等）不動
  {
    const zGoal = (S.name === 'pour' || S.name === 'result') ? P.POUR_ZOOM : 1;
    camZ += (zGoal - camZ) * (1 - Math.exp(-P.ZOOM_RATE * dt));
    const w = (camZ - 1) / (P.POUR_ZOOM - 1);
    const cx = (cam.left + cam.right) / 2, cy = (cam.top + cam.bottom) / 2;
    cam.zoom = camZ;
    cam.position.x = (CUP.x + P.ZOOM_DX - cx) * w;
    cam.position.y = (CUP.y0 + P.ZOOM_DY - cy) * w;
    cam.updateProjectionMatrix();
    for (const L of [liquidFree, liquidStuck, liquidFloor]) L.uSize.value = P.R * 9.5 * ppu * camZ;
  }
  liquidFree.fill(freeList); liquidStuck.fill(stuckList); liquidFloor.fill(floorList);
  liquidFree.draw(); liquidStuck.draw(); liquidFloor.draw();
  renderer.render(scene, cam);
  placeCupNum();
}
// 除錯用：__game.paused = true 後用 __game.tick(秒數) 固定 60 格推進
// ---------- 試聽面板：網址加 ?listen ----------
if (new URLSearchParams(location.search).has('listen')) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:12px;top:12px;z-index:20;background:#fff;border:3px solid #5a79a3;border-radius:12px;padding:12px 14px;font:700 15px/1.9 "Microsoft JhengHei",sans-serif;color:#5a79a3;width:230px';
  const items = [['pour', '黏液倒出聲（循環）'], ['bloop', '進杯「啵」聲（一顆一聲）'], ['mlBeep', '舊版：每 1 ml 嗶一聲'], ['jingle', '結算音階'], ['meow', '結算貓叫']];
  box.innerHTML = '<div style="font-size:17px">倒量杯試聽</div>' +
    items.map(([k, t]) => `<label style="display:block;cursor:pointer"><input type="checkbox" data-k="${k}" ${SND[k] ? 'checked' : ''}> ${t}</label>`).join('') +
    '<button id="lsReplay" style="font-size:16px;padding:8px 14px;border-width:3px;margin-top:6px">▶ 重播倒杯</button>' +
    '<div id="lsLog" style="font-size:13px;line-height:1.5;margin-top:8px;white-space:pre"></div>';
  document.body.appendChild(box);
  box.querySelectorAll('input').forEach(c => c.onchange = () => { SND[c.dataset.k] = c.checked; if (!SND.pour) pourStop(); });
  const log = box.querySelector('#lsLog');
  // 重播：靜音快轉一整局（機器人去接），到倒量杯那一刻才開聲音、恢復正常速度
  box.querySelector('#lsReplay').onclick = () => {
    initAudio(); pourStop(); SND.on = false; game.paused = true; newGame();
    let t = 0;
    while (S.name !== 'pour' && t < 30) {
      const m = game.mouthPos(), d = dirOf(catA);
      target.x = m.x + Math.cos(d) * 260; target.y = m.y + Math.sin(d) * 260;
      update(1 / 30); t += 1 / 30;
    }
    SND.on = true; game.paused = false; lsT0 = now; lsMarks = {}; log.textContent = '';
  };
  let lsT0 = 0, lsMarks = {};
  const mark = (k, txt) => { if (!lsMarks[k]) { lsMarks[k] = 1; log.textContent += `${(now - lsT0).toFixed(2)} 秒　${txt}\n`; } };
  setInterval(() => {
    if (S.name === 'pour') {
      if (S.t > 0.8 && bowl.rotation.z > 0.05) mark('tilt', '碗開始傾斜');
      if (pourSrc) mark('ps', '黏液聲開始'); else if (lsMarks.ps) mark('pe', '黏液聲停止');
      if (S.heard > 0) mark('b1', '第一顆進杯（啵）');
    }
    if (S.name === 'result') mark('r', `結算：${S.heard} 顆＝${(S.heard * P.ML).toFixed(1)} ml`);
  }, 20);
}

const game = window.__game = { S, parts, bowl, target, jelly, jl, get catA() { return catA; }, dir() { return dirOf(catA); }, mouthPos() { mouth.updateWorldMatrix(true, false); const v = mouth.getWorldPosition(new THREE.Vector3()); return { x: v.x, y: v.y }; }, cam, enter, newGame, eyesShut, shotCanvas, draw, cupCount, get headAngle() { return headAngle; }, setPose, P, paused: false,
  tick(sec) { for (let i = 0; i < Math.round(sec * 60); i++) update(1 / 60); } };
requestAnimationFrame(frame);

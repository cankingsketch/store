// 畫圖抉擇轉盤吊飾的「特效」（2026-10-04 他要的：像小瑪莉／拉霸機，有音效、跑燈；停下來有動漫風的演出）。
// charm3d.js 右上角的「特效」開關打開才載入這支（關著的時候一點都不載，打開商品的速度不變）。
//   ・音效：全部用 Web Audio 即時合成（方波、三角波、雜訊），不用下載任何音檔
//   ・轉動中：箭頭每經過一個選項「嗶」一聲（快就密、音高；越慢越稀＝小瑪莉跑燈），快的時候底下一層「嗡」；
//     箭頭指到的選項亮淡黃色，一格一格跟著跳
//   ・停下來：只有三個「中獎」有演出，有主次（他說的）：大獎＝畫、二獎＝好啦我畫、三獎＝畫一點——
//     效果字（JoJo／漫畫那種擬聲字，拆兩半放吊飾左上、右上，不擋中間）、集中線閃爍、震動、專屬音效；
//     大獎：雙層金框跑馬燈、星星最多、音效最長（他在試聽頁選的「拉霸機」：重擊＋旋律＋投幣 20 枚）
//     二獎：單層金框、星星少一半；三獎：沒有框、小閃光。不寫「大獎／二獎」字樣（他不要）
//   ・其他六個（含再轉一次）：選項亮起來＋一聲「沒中」音效就好，不要其他特效（他說的）
// 選項的位置、角度、文字形狀由 build_spinner.py 產生（charm-draw-fx.json、charm-draw-opt*.webp）。
// 介面：attach({ el, card, base, thick }) → Promise<{ frame(state), stop(rot), show(on), unlockAudio() }>

// 白字 → 各種顏色的發光字（sepia 先變成有色，再轉色相）
const TINT = {
  gold:   ['sepia(1) saturate(7) hue-rotate(5deg) brightness(1.15)', '#ffd23a', '#ff9d00'],
  orange: ['sepia(1) saturate(8) hue-rotate(-12deg) brightness(1.1)', '#ffb02e', '#ff6a00'],
  pink:   ['sepia(1) saturate(6) hue-rotate(-40deg) brightness(1.2)', '#ffb3d1', '#ff6fae'],
  red:    ['sepia(1) saturate(9) hue-rotate(-45deg) brightness(.95)', '#ff4b3a', '#c40000'],
  blue:   ['sepia(1) saturate(5) hue-rotate(185deg) brightness(1.05)', '#8fd3ff', '#2b7bff'],
  violet: ['sepia(1) saturate(5) hue-rotate(225deg) brightness(1.05)', '#c9a6ff', '#7b3fff'],
  grey:   ['grayscale(1) brightness(.62)', '#9a9a9a', '#3b3b3b']
};

// 每個選項的演出：色、效果字、集中線顏色、震動強度、小動作、音效
const SHOW = {
  '畫':       { tier: 1, tint: 'gold',   sfx: 'ドンッ！',   lines: '#ffcf33', shake: 11, extra: ['party'],          sound: 'don' },
  '好啦我畫': { tier: 2, tint: 'orange', sfx: 'ドドドド',   lines: '#ffae2e', shake: 5,  extra: ['party', 'menace'], sound: 'dododo' },
  '畫一點':   { tier: 3, tint: 'pink',   sfx: 'キラーン☆', lines: '#ffb3d1', shake: 0,  extra: ['sparkle'],        sound: 'kiran' },
  '再轉一次': { tint: 'gold' },
  '今日封筆': { tint: 'grey' },
  '不畫': { tint: 'red' },
  '等等再畫': { tint: 'violet' },
  '不會畫畫': { tint: 'blue' },
  '傻子才畫畫': { tint: 'violet' }
};

let styled = false;
function addStyle() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent =
    '.cfx-opts{position:absolute;inset:0;pointer-events:none}' +
    '.cfx-opts img{position:absolute;opacity:0;transition:opacity .12s;pointer-events:none;' +
      'filter:' + TINT.gold[0] + ' drop-shadow(0 0 4px ' + TINT.gold[1] + ') drop-shadow(0 0 10px ' + TINT.gold[2] + ')}' +
    '.cfx-opts img.on{opacity:.9}' +
    '.cfx-opts img.hit{opacity:1;animation:cfx-hit .42s ease-in-out 3}' +
    '@keyframes cfx-hit{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.6}}' +
    '.cfx-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3}' +
    // 效果字：粗、白邊、斜一點，跳出來之後一直小幅抖動（JoJo 那種）
    '.cfx-sfx{position:absolute;z-index:4;pointer-events:none;white-space:nowrap;font-weight:900;font-style:italic;letter-spacing:.02em;' +
      'font-family:"Hiragino Sans","Yu Gothic","Meiryo","Noto Sans JP",sans-serif;-webkit-text-stroke:5px #1d1d1d;paint-order:stroke fill;' +
      'transform:translate(-50%,-50%) rotate(var(--r,-8deg)) scale(0);animation:cfx-in .28s cubic-bezier(.2,1.6,.4,1) forwards,cfx-jit .07s steps(2) .28s infinite}' +
    '.cfx-sfx.out{animation:cfx-outa .35s ease-in forwards}' +
    '@keyframes cfx-in{to{transform:translate(-50%,-50%) rotate(var(--r,-8deg)) scale(1)}}' +
    '@keyframes cfx-jit{0%{transform:translate(-50%,-50%) rotate(var(--r,-8deg)) translate(1.5px,-1px)}100%{transform:translate(-50%,-50%) rotate(var(--r,-8deg)) translate(-1.5px,1px)}}' +
    '@keyframes cfx-outa{to{transform:translate(-50%,-50%) rotate(var(--r,-8deg)) scale(1.25);opacity:0}}' +
    // 「ゴ」「ド」這種一個字一個字飄上去的
    '.cfx-float{position:absolute;z-index:4;pointer-events:none;font-weight:900;font-style:italic;font-family:"Hiragino Sans","Yu Gothic","Meiryo",sans-serif;' +
      '-webkit-text-stroke:3px #1d1d1d;paint-order:stroke fill;animation:cfx-float 1.6s ease-out forwards}' +
    '@keyframes cfx-float{0%{transform:translate(-50%,0) scale(.4);opacity:0}15%{opacity:1;transform:translate(-50%,-6px) scale(1)}100%{transform:translate(-50%,-70px) scale(1.1);opacity:0}}' +
    '.cfx-shake{animation:cfx-shake .45s linear}' +
    '@keyframes cfx-shake{0%,100%{translate:0 0}10%{translate:calc(var(--s)*-1px) calc(var(--s)*.6px)}20%{translate:calc(var(--s)*1px) calc(var(--s)*-.8px)}' +
      '30%{translate:calc(var(--s)*-.8px) calc(var(--s)*-.4px)}40%{translate:calc(var(--s)*.7px) calc(var(--s)*.7px)}55%{translate:calc(var(--s)*-.4px) 0}70%{translate:calc(var(--s)*.3px) calc(var(--s)*-.3px)}}';
  document.head.appendChild(st);
}

// ---------------- 音效（合成） ----------------
let ac = null, whir = null, noiseBuf = null;
function audio() {
  if (!ac) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ac = new C();
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(type, f0, f1, len, vol, at, vib) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + (at || 0), o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + len);
  if (vib) {                                              // 抖音（悲傷喇叭那種）
    const l = a.createOscillator(), lg = a.createGain();
    l.frequency.value = vib; lg.gain.value = f0 * 0.03; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + len);
  }
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.setValueAtTime(vol, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + len + 0.02);
}
// 雜訊：撞擊（ドン）、地鳴（ゴゴゴ）用；cut＝低通頻率，wob＝音量起伏（每秒幾次）
function noise(len, vol, cut, at, wob) {
  const a = audio(); if (!a) return;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = a.currentTime + (at || 0), s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = cut;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  if (wob) { const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = wob; lg.gain.value = vol * 0.6; l.connect(lg).connect(g.gain); l.start(t); l.stop(t + len); }
  s.connect(f).connect(g).connect(a.destination); s.start(t); s.stop(t + len + 0.05);
}
// 開盒「啵」專用：起音更快、不撐住的短音，和每 step 個取樣才換值的 8-bit 雜訊（像紅白機的雜訊聲道）
function blip(type, f0, f1, len, vol, at) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + (at || 0), o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + len);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + len + 0.02);
}
const bitBuf = {};
function bitNoise(len, vol, cut, at, step) {
  const a = audio(); if (!a) return;
  if (!bitBuf[step]) {
    const b = a.createBuffer(1, a.sampleRate, a.sampleRate), d = b.getChannelData(0);
    let v = 0; for (let i = 0; i < d.length; i++) { if (i % step === 0) v = Math.random() < 0.5 ? -1 : 1; d[i] = v; }
    bitBuf[step] = b;
  }
  const t = a.currentTime + (at || 0), s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = bitBuf[step]; s.loop = true; f.type = 'lowpass'; f.frequency.value = cut;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  s.connect(f).connect(g).connect(a.destination); s.start(t); s.stop(t + len + 0.05);
}
const NOTE = { C5: 523, E5: 659, G5: 784, C6: 1047 };
const seq = (notes, at) => { let t = at; notes.forEach(([n, b]) => { tone('square', NOTE[n], NOTE[n], b * 0.09 * 0.92, 0.05, t); t += b * 0.09; }); };
const coin = at => { tone('square', 988, 988, 0.06, 0.045, at); tone('square', 1319, 1319, 0.16, 0.045, at + 0.06); };   // 投幣「叮鈴」
export const SFX = {          // 名店選轉盤（wheel-fx.js）也用這套
  tick(speed) { const f = 900 + Math.min(1, speed / 2500) * 900; tone('square', f, f, 0.035, 0.045); },
  whir(speed) {
    const a = audio(); if (!a) return;
    if (!whir) {
      const o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain();
      o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0;
      o.connect(f).connect(g).connect(a.destination); o.start();
      whir = { o, g };
    }
    const k = Math.max(0, Math.min(1, (speed - 900) / 3000));
    whir.g.gain.setTargetAtTime(k * 0.03, a.currentTime, 0.05);
    whir.o.frequency.setTargetAtTime(70 + k * 90, a.currentTime, 0.05);
  },
  // 中獎三個等級（試聽頁 sfx-pick.html 他選「1 拉霸機」）：大獎重擊＋旋律＋投幣 20 枚、二獎旋律＋7 枚、三獎兩個音＋1 枚
  don() {
    noise(0.3, 0.45, 260); tone('sine', 120, 45, 0.4, 0.45); seq([['C5', 1], ['E5', 1], ['G5', 1], ['C6', 3]], 0.2);
    tone('square', 1568, 1568, 0.6, 0.035, 0.75); for (let i = 0; i < 20; i++) coin(1.25 + i * 0.1);
  },
  dododo() { seq([['C5', 1], ['E5', 1], ['G5', 1], ['C6', 3]], 0); for (let i = 0; i < 7; i++) coin(0.6 + i * 0.12); },
  kiran() { seq([['E5', 1], ['C6', 2]], 0); coin(0.32); },
  // 拆盲盒（standee3d.js）：盒子抖的時候喀啦喀啦；盒蓋彈開那一下是 8-bit 拉炮（他說「啵」和最後的中獎音效都不要，換這個）
  rattle() { for (let i = 0; i < 6; i++) { noise(0.05, 0.3, 1600, i * 0.11); tone('triangle', 260 + Math.random() * 160, 200, 0.04, 0.05, i * 0.11); } },
  popper() {
    // 拉炮：一聲很短的「砰」（方波往下掃＋粗雜訊）→ 往上衝的方波掃音 → 一串亮晶晶的方波碎音（紙花撒下來）
    tone('square', 900, 90, 0.07, 0.12); noise(0.09, 0.4, 5000);
    tone('square', 300, 2400, 0.12, 0.06, 0.04);
    [2093, 2637, 3136, 2349, 2794, 3520, 2637, 3136].forEach((f, i) => tone('square', f, f, 0.035, 0.03, 0.16 + i * 0.045));
  },
  // 電影貼紙組開盒（shared.js）：拉炮太大聲，他說去 freesound 找真的開盒聲，挑了「Lid Flip/ Pop - 7」（#509505），
  // 再要我用 8-bit 模擬它（試聽頁 open-sfx-pick.html 選 3）：蓋子擦一下 → 低「啵」→ 清脆「嗒」→ 兩聲小「叮」
  lid() {
    bitNoise(0.025, 0.05, 2500, 0, 6);
    blip('square', 760, 260, 0.04, 0.09, 0.03);
    blip('square', 2940, 2800, 0.03, 0.03, 0.04); bitNoise(0.09, 0.05, 6000, 0.04, 2);
    blip('square', 1568, 1568, 0.06, 0.03, 0.14); blip('square', 2093, 2093, 0.12, 0.03, 0.2);
  },
  // 名店選轉盤用的（他在試聽頁 wheel-sfx-pick.html 選的）：轉過一格「啵」（H）、停下來只要一聲投幣（原本前面有段旋律，他說拿掉）
  pop() { tone('sine', 700, 1300, 0.05, 0.12); },
  short() { coin(0); },
  // 沒中（他選 F）：短短「喀」一聲機械聲，六個沒中的共用
  miss() { noise(0.05, 0.3, 1800); tone('square', 110, 90, 0.09, 0.07); }
};

export function unlock() { audio(); }        // iPhone：聲音要在使用者點的那一下開

export async function attach({ el, card, base, thick }) {
  addStyle();
  const data = await fetch(base + 'charm-draw-fx.json').then(r => r.json());
  const opts = data.options;

  const layer = document.createElement('div'); layer.className = 'cfx-opts';
  layer.style.transform = 'translateZ(' + (thick / 2 + 1) + 'px)';
  const imgs = opts.map(o => {
    const i = new Image(); i.src = base + o.img; i.alt = '';
    i.style.left = (o.x * 100) + '%'; i.style.top = (o.y * 100) + '%'; i.style.width = (o.w * 100) + '%'; i.style.height = (o.h * 100) + '%';
    layer.appendChild(i); return i;
  });
  card.appendChild(layer);
  const cv = document.createElement('canvas'); cv.className = 'cfx-canvas'; el.appendChild(cv);
  const g = cv.getContext('2d');
  const temps = [];                                        // 演出時加的 DOM（效果字、印章、Z…），下一次演出前清掉
  const addTemp = (parent, cls, html, css) => {
    const d = document.createElement('div'); d.className = cls; d.innerHTML = html; Object.assign(d.style, css || {});
    parent.appendChild(d); temps.push(d); return d;
  };

  const norm = a => ((a % 360) + 540) % 360 - 180;
  const which = rot => {
    const d = norm(data.arrow0 + rot);
    let best = 0, bd = 999;
    opts.forEach((o, i) => { const e = Math.abs(norm(d - o.angle)); if (e < bd) { bd = e; best = i; } });
    return best;
  };
  let cur = -1, lastLit = -1, fxUntil = 0, parts = [], t0 = 0, show = null, hitIdx = -1, raf = 0, visible = true, timers = [];

  function light(i) {
    if (i === lastLit) return;
    if (lastLit >= 0) imgs[lastLit].classList.remove('on');
    if (i >= 0) imgs[i].classList.add('on');
    lastLit = i;
  }
  function tint(i, name) {                                // 這個選項的字換成它的顏色
    const t = TINT[name];
    imgs[i].style.filter = t[0] + ' drop-shadow(0 0 4px ' + t[1] + ') drop-shadow(0 0 12px ' + t[2] + ')';
  }
  function reset() {
    timers.forEach(clearTimeout); timers = [];
    temps.splice(0).forEach(d => d.remove());
    imgs.forEach(im => { im.classList.remove('hit', 'on'); im.style.filter = ''; });
    el.classList.remove('cfx-shake');
    lastLit = -1; hitIdx = -1; show = null; fxUntil = 0; parts = [];
  }
  function size() {
    const r = el.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return r;
  }
  // 選項在預覽區裡的位置（px）
  function optBox(i) {
    const er = el.getBoundingClientRect(), cr = card.getBoundingClientRect(), o = opts[i];
    return { x: cr.left - er.left + (o.x + o.w / 2) * cr.width, y: cr.top - er.top + (o.y + o.h / 2) * cr.height,
      w: o.w * cr.width, h: o.h * cr.height, cw: cr.width };
  }

  // ---- 停下來的演出 ----
  function perform(i) {
    reset();
    const o = opts[i], S = SHOW[o.name] || SHOW['不畫'], b = optBox(i), er = el.getBoundingClientRect();
    hitIdx = i; tint(i, S.tint); imgs[i].classList.add('hit');
    if (!S.tier) { SFX.miss(); return; }                 // 沒中：亮一下＋一聲就好
    show = S; t0 = performance.now(); fxUntil = t0 + { 1: 3400, 2: 2700, 3: 2200 }[S.tier];
    SFX[S.sound]();
    // 震動
    if (S.shake) { el.style.setProperty('--s', S.shake); void el.offsetWidth; el.classList.add('cfx-shake'); timers.push(setTimeout(() => el.classList.remove('cfx-shake'), 500)); }
    // 效果字：拆成兩半，前半在吊飾左上角外、後半在右上角（特效鈕下面），不擋中間的畫面（他圈的位置）
    const big = Math.max(34, b.cw * 0.12), t = TINT[S.tint], cut = Math.ceil(S.sfx.length / 2);
    [[S.sfx.slice(0, cut), 0.11, 0.27, -10], [S.sfx.slice(cut), 0.87, 0.24, 9]].forEach(([txt, fx, fy, r], k) => {
      const w = addTemp(el, 'cfx-sfx', txt, { fontSize: big + 'px', color: t[1], textShadow: '0 0 14px ' + t[2] + ',4px 5px 0 ' + t[2] });
      const hw = w.offsetWidth / 2 + 6;                  // 別超出畫面
      w.style.left = Math.min(er.width - hw, Math.max(hw, fx * er.width)) + 'px';
      w.style.top = (fy * er.height) + 'px';
      w.style.setProperty('--r', r + 'deg');
      if (k) w.style.animationDelay = '.14s,.42s';      // 後半晚一拍跳出來
      timers.push(setTimeout(() => w.classList.add('out'), fxUntil - t0 - 500));
    });
    // 小動作
    if (S.extra.includes('party')) burst(b, S.tier === 1 ? 28 : 14);
    if (S.tier === 1) timers.push(setTimeout(() => { burst(optBox(i), 18); }, 900));   // 大獎：第二波星星
    if (S.extra.includes('sparkle')) burst(b, 10, true);
    if (S.extra.includes('menace')) {                    // ゴ／ド 一個一個飄上去（JoJo 那種）
      const ch = S.sfx[0];
      for (let k = 0; k < 7; k++) timers.push(setTimeout(() => {
        const x = (k % 2 ? 0.12 : 0.88) * er.width + (Math.random() - 0.5) * 40, y = er.height * (0.25 + Math.random() * 0.5);
        addTemp(el, 'cfx-float', ch, { left: x + 'px', top: y + 'px', fontSize: (big * (0.55 + Math.random() * 0.35)) + 'px', color: t[1] });
      }, k * 150));
    }
    loop();
  }
  function burst(b, n, small) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, v = (small ? 90 : 160) + Math.random() * (small ? 140 : 260);
      parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, r: (small ? 4 : 7) + Math.random() * (small ? 5 : 9), rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 10, life: 1.2 + Math.random() * 0.6, t: 0, c: Math.random() < 0.5 ? '#ffd23a' : '#fff7b0' });
    }
  }
  function star(x, y, r, rot, color, alpha) {
    g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = alpha;
    g.beginPath();
    for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * 0.42 : r, a = k * Math.PI / 5 - Math.PI / 2; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = color; g.shadowColor = '#ffd23a'; g.shadowBlur = r; g.fill(); g.restore();
  }
  function loop() {
    if (raf) return;
    let last = performance.now();
    const step = now => { raf = 0; draw(now, Math.min(0.05, (now - last) / 1000)); last = now;
      if (now < fxUntil && el.isConnected) raf = requestAnimationFrame(step); else clearCanvas(); };
    raf = requestAnimationFrame(step);
  }
  function clearCanvas() { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); }
  function draw(now, dt) {
    const er = size(), cr = card.getBoundingClientRect(), S = show; if (!S) return;
    g.clearRect(0, 0, er.width, er.height);
    const t = (now - t0) / 1000, fade = Math.min(1, (fxUntil - now) / 500);
    const x0 = cr.left - er.left, y0 = cr.top - er.top, w = cr.width, h = cr.height;
    const b = optBox(hitIdx);
    // 集中線：從畫面外往選項集中，前 0.5 秒閃三下（漫畫那種），之後淡淡留著
    if (S.lines) {
      const flick = t < 0.5 ? (Math.floor(t * 12) % 2 ? 0.25 : 0.9) : 0.45;
      g.save(); g.globalAlpha = flick * fade;
      const R1 = Math.hypot(er.width, er.height), R0 = w * 0.32;
      for (let k = 0; k < 70; k++) {
        const a = k / 70 * Math.PI * 2 + (k * 0.37 % 0.06), wd = 0.006 + (k * 7 % 5) * 0.003, r0 = R0 * (0.85 + (k * 13 % 10) / 25);
        g.beginPath(); g.moveTo(b.x + Math.cos(a) * r0, b.y + Math.sin(a) * r0);
        g.lineTo(b.x + Math.cos(a - wd) * R1, b.y + Math.sin(a - wd) * R1); g.lineTo(b.x + Math.cos(a + wd) * R1, b.y + Math.sin(a + wd) * R1);
        g.closePath(); g.fillStyle = S.lines; g.fill();
      }
      g.restore();
    }
    // 金框跑馬燈（慶祝的三個）
    if (S.extra.includes('party')) {
      const pad = 10, bx = x0 - pad, by = y0 - pad, bw = w + pad * 2, bh = h + pad * 2;
      g.save(); g.globalAlpha = fade;
      g.lineWidth = 6; g.strokeStyle = '#ffd23a'; g.shadowColor = '#ff9d00'; g.shadowBlur = 16;
      g.beginPath(); g.roundRect ? g.roundRect(bx, by, bw, bh, 18) : g.rect(bx, by, bw, bh); g.stroke();
      if (S.tier === 1) {                                  // 大獎：外面再一圈紅框，金紅交替閃
        g.lineWidth = 4; g.strokeStyle = Math.floor(t * 6) % 2 ? '#ff3b3b' : '#ffd23a';
        g.beginPath(); g.roundRect ? g.roundRect(bx - 9, by - 9, bw + 18, bh + 18, 24) : g.rect(bx - 9, by - 9, bw + 18, bh + 18); g.stroke();
      }
      g.shadowBlur = 0;
      const per = 2 * (bw + bh), n = Math.max(16, Math.round(per / 26)), ph = Math.floor(t * (S.tier === 1 ? 16 : 9));
      for (let k = 0; k < n; k++) {
        let d = k / n * per, px, py;
        if (d < bw) { px = bx + d; py = by; } else if ((d -= bw) < bh) { px = bx + bw; py = by + d; }
        else if ((d -= bh) < bw) { px = bx + bw - d; py = by + bh; } else { d -= bw; px = bx; py = by + bh - d; }
        const on = (k + ph) % 2 === 0;
        g.beginPath(); g.arc(px, py, 4.2, 0, Math.PI * 2);
        g.fillStyle = on ? (k % 4 < 2 ? '#fff6b0' : '#ff6a5a') : 'rgba(120,80,20,.5)';
        if (on) { g.shadowColor = k % 4 < 2 ? '#ffd23a' : '#ff3b3b'; g.shadowBlur = 10; } else g.shadowBlur = 0;
        g.fill();
      }
      g.restore();
      for (let k = 0; k < 10; k++) {
        const s = Math.sin(t * 7 + k * 1.7);
        if (s > 0.2) star(bx + ((k * 97) % 100) / 100 * bw, by + ((k * 61 + 13) % 100) / 100 * bh, 4 + s * 5, t + k, '#fffbe0', s * fade);
      }
    }
    parts.forEach(p => {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.vx *= 0.985; p.rot += p.vr * dt;
      const a = Math.max(0, 1 - p.t / p.life);
      if (a > 0) star(p.x, p.y, p.r, p.rot, p.c, a);
    });
  }

  return {
    frame(s) {
      if (!s.front) { if (visible) { layer.style.visibility = 'hidden'; visible = false; } SFX.whir(0); return; }
      if (!visible) { layer.style.visibility = ''; visible = true; }
      if (!s.active) { SFX.whir(0); return; }
      if (show) reset();                                   // 又開始轉了：上一次的演出收掉
      const i = which(s.rot);
      if (i !== cur) { cur = i; SFX.tick(Math.abs(s.vel)); }
      light(i);
      SFX.whir(Math.abs(s.vel));
    },
    stop(rot) { SFX.whir(0); cur = which(rot); perform(cur); },
    show(on) {
      layer.hidden = !on; cv.hidden = !on;
      if (!on) { reset(); SFX.whir(0); clearCanvas(); }
    },
    unlockAudio() { audio(); }
  };
}

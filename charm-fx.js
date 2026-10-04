// 畫圖抉擇轉盤吊飾的「特效」（2026-10-04 他要的：像小瑪莉／拉霸機那樣，有音效、跑燈、中獎演出）。
// charm3d.js 右上角的「特效」開關打開才載入這支（關著的時候一點都不載，打開商品的速度不變）。
//   ・音效：全部用 Web Audio 即時合成的 8-bit 音（方波、三角波），不用下載任何音檔
//   ・轉動中：箭頭每經過一個選項「嗶」一聲（轉得快就密、音高；越慢越稀＝小瑪莉跑燈那種緊張感），快的時候底下再一層「嗡」；
//     箭頭指到的那個選項的字亮淡黃色，一格一格跟著跳
//   ・停下來：畫／畫一點／好啦我畫＝中獎（勝利旋律＋叮叮叮投幣聲、字放大閃三下、跑馬燈框、星星爆開、背後放射集中線）；
//     再轉一次＝「再一次！」大字；其他＝字亮一下＋「噗」
// 選項的位置、角度、文字形狀由 build_spinner.py 產生（charm-draw-fx.json、charm-draw-opt*.webp）。
// 介面：attach({ el, card, base, thick }) → Promise<{ frame(state), stop(rot), show(on) }>

const GOLD = '#ffd23a', ORANGE = '#ff9d00', RED = '#ff3b3b';

let styled = false;
function addStyle() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent =
    '.cfx-opts{position:absolute;inset:0;pointer-events:none}' +
    '.cfx-opts img{position:absolute;opacity:0;transition:opacity .12s;pointer-events:none;' +
      // 白字 → 亮黃字＋外面一圈橘黃光
      'filter:sepia(1) saturate(7) hue-rotate(5deg) brightness(1.15) drop-shadow(0 0 4px ' + GOLD + ') drop-shadow(0 0 10px ' + ORANGE + ')}' +
    '.cfx-opts img.on{opacity:.9}' +
    '.cfx-opts img.win{opacity:1;animation:cfx-win .42s ease-in-out 3}' +
    '@keyframes cfx-win{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.55}}' +
    '.cfx-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3}' +
    '.cfx-banner{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%) scale(0);z-index:4;pointer-events:none;white-space:nowrap;' +
      'font-size:46px;font-weight:900;letter-spacing:.06em;color:' + RED + ';-webkit-text-stroke:3px #fff;paint-order:stroke fill;' +
      'text-shadow:0 0 12px ' + GOLD + ',0 4px 0 #b31b1b}' +
    '.cfx-banner.go{animation:cfx-pop 1.3s cubic-bezier(.2,1.5,.4,1) forwards}' +
    '@keyframes cfx-pop{0%{transform:translate(-50%,-50%) scale(0) rotate(-8deg)}25%{transform:translate(-50%,-50%) scale(1.15) rotate(3deg)}' +
      '40%{transform:translate(-50%,-50%) scale(1) rotate(0)}80%{opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:0}}';
  document.head.appendChild(st);
}

// ---------------- 音效（8-bit 合成） ----------------
let ac = null, whir = null;
function audio() {
  if (!ac) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ac = new C();
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
// 一個音：type 波形、f0→f1 頻率滑動、len 秒、vol 音量
function tone(type, f0, f1, len, vol, at) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + (at || 0), o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + len);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + len + 0.02);
}
const SFX = {
  // 跑燈「嗶」：越快越高
  tick(speed) { const f = 900 + Math.min(1, speed / 2500) * 900; tone('square', f, f, 0.035, 0.05); },
  // 轉很快時底下的「嗡」：一直開著，音量、音高跟著速度
  whir(speed) {
    const a = audio(); if (!a) return;
    if (!whir) {
      const o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain();
      o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0;
      o.connect(f).connect(g).connect(a.destination); o.start();
      whir = { o, g };
    }
    const k = Math.max(0, Math.min(1, (speed - 900) / 3000));
    whir.g.gain.setTargetAtTime(k * 0.035, a.currentTime, 0.05);
    whir.o.frequency.setTargetAtTime(70 + k * 90, a.currentTime, 0.05);
  },
  // 沒中：「噗」往下掉
  miss() { tone('triangle', 330, 110, 0.22, 0.12); },
  // 再轉一次：嗶嗶往上
  again() { tone('square', 660, 660, 0.08, 0.07); tone('square', 990, 990, 0.12, 0.07, 0.1); },
  // 中獎：Do Mi Sol 高Do 的勝利旋律，接一串叮叮叮投幣聲
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.11, 0.07, i * 0.09));
    tone('square', 1047, 1047, 0.38, 0.06, 0.38); tone('square', 1319, 1319, 0.38, 0.04, 0.38);
    for (let i = 0; i < 6; i++) { tone('square', 988, 988, 0.05, 0.05, 0.8 + i * 0.13); tone('square', 1319, 1319, 0.09, 0.05, 0.85 + i * 0.13); }
  }
};

export async function attach({ el, card, base, thick }) {
  addStyle();
  const data = await fetch(base + 'charm-draw-fx.json').then(r => r.json());
  const opts = data.options;

  // 選項發光層：放在吊飾正面上面一點（跟著吊飾一起傾斜）
  const layer = document.createElement('div'); layer.className = 'cfx-opts';
  layer.style.transform = 'translateZ(' + (thick / 2 + 1) + 'px)';
  const imgs = opts.map(o => {
    const i = new Image(); i.src = base + o.img; i.alt = '';
    i.style.left = (o.x * 100) + '%'; i.style.top = (o.y * 100) + '%'; i.style.width = (o.w * 100) + '%'; i.style.height = (o.h * 100) + '%';
    layer.appendChild(i); return i;
  });
  card.appendChild(layer);
  // 星星、框、集中線畫在整個預覽區上面一層畫布（可以超出吊飾範圍）
  const cv = document.createElement('canvas'); cv.className = 'cfx-canvas'; el.appendChild(cv);
  const g = cv.getContext('2d');
  const banner = document.createElement('div'); banner.className = 'cfx-banner'; banner.textContent = '再一次！'; el.appendChild(banner);

  const norm = a => ((a % 360) + 540) % 360 - 180;
  const which = rot => {                                  // 箭頭現在指著哪一個選項（角度最近的）
    const d = norm(data.arrow0 + rot);
    let best = 0, bd = 999;
    opts.forEach((o, i) => { const e = Math.abs(norm(d - o.angle)); if (e < bd) { bd = e; best = i; } });
    return best;
  };
  let cur = -1, lastLit = -1, fxUntil = 0, parts = [], winAt = 0, winIdx = -1, raf = 0, visible = true;

  function light(i) {
    if (i === lastLit) return;
    if (lastLit >= 0) imgs[lastLit].classList.remove('on');
    if (i >= 0) imgs[i].classList.add('on');
    lastLit = i;
  }
  function size() {
    const r = el.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return r;
  }
  // 中獎演出：星星從中獎的字爆出來、閃爍小星、跑馬燈框、放射集中線
  function startWin(i) {
    winIdx = i; winAt = performance.now(); fxUntil = winAt + 2800;
    imgs[i].classList.remove('win'); void imgs[i].offsetWidth; imgs[i].classList.add('win');
    const er = el.getBoundingClientRect(), cr = card.getBoundingClientRect(), o = opts[i];
    const cx = cr.left - er.left + (o.x + o.w / 2) * cr.width, cy = cr.top - er.top + (o.y + o.h / 2) * cr.height;
    for (let k = 0; k < 18; k++) {
      const a = Math.random() * Math.PI * 2, v = 160 + Math.random() * 260;
      parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, r: 7 + Math.random() * 9, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10,
        life: 1.3 + Math.random() * 0.6, t: 0, c: Math.random() < 0.5 ? GOLD : '#fff7b0' });
    }
    loop();
  }
  function star(x, y, r, rot, color, alpha) {
    g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = alpha;
    g.beginPath();
    for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * 0.42 : r, a = k * Math.PI / 5 - Math.PI / 2; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = color; g.shadowColor = GOLD; g.shadowBlur = r; g.fill(); g.restore();
  }
  function loop() { if (!raf) { let last = performance.now(); const step = now => { raf = 0; draw(now, Math.min(0.05, (now - last) / 1000)); last = now; if (now < fxUntil && el.isConnected) raf = requestAnimationFrame(step); else clear(); }; raf = requestAnimationFrame(step); } }
  function clear() { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); parts = []; }
  function draw(now, dt) {
    const er = size(), cr = card.getBoundingClientRect();
    g.clearRect(0, 0, er.width, er.height);
    const t = (now - winAt) / 1000, fade = Math.min(1, (fxUntil - now) / 500);
    const x0 = cr.left - er.left, y0 = cr.top - er.top, w = cr.width, h = cr.height, mx = x0 + w / 2, my = y0 + h / 2;
    // 放射集中線：吊飾外面一圈往外放射，慢慢轉
    g.save(); g.globalAlpha = 0.5 * fade * Math.min(1, t * 4);
    g.beginPath(); g.rect(0, 0, er.width, er.height); g.rect(x0 + w, y0, -w, h); g.clip('evenodd');   // 吊飾本身不蓋
    const R0 = Math.hypot(w, h) * 0.42, R1 = Math.hypot(er.width, er.height);
    for (let k = 0; k < 44; k++) {
      const a = k / 44 * Math.PI * 2 + t * 0.25, wd = (k % 3 ? 0.012 : 0.03);
      g.beginPath(); g.moveTo(mx + Math.cos(a) * R0, my + Math.sin(a) * R0);
      g.lineTo(mx + Math.cos(a - wd) * R1, my + Math.sin(a - wd) * R1); g.lineTo(mx + Math.cos(a + wd) * R1, my + Math.sin(a + wd) * R1);
      g.closePath(); g.fillStyle = k % 2 ? 'rgba(255,210,58,.75)' : 'rgba(255,255,255,.9)'; g.fill();
    }
    g.restore();
    // 跑馬燈框：吊飾外面一圈金框，框上一顆顆燈泡輪流亮（金、紅交替）
    const pad = 10, bx = x0 - pad, by = y0 - pad, bw = w + pad * 2, bh = h + pad * 2;
    g.save(); g.globalAlpha = fade;
    g.lineWidth = 6; g.strokeStyle = GOLD; g.shadowColor = ORANGE; g.shadowBlur = 16;
    g.beginPath(); g.roundRect ? g.roundRect(bx, by, bw, bh, 18) : g.rect(bx, by, bw, bh); g.stroke();
    g.shadowBlur = 0;
    const per = 2 * (bw + bh), n = Math.max(16, Math.round(per / 26)), phase = Math.floor(t * 10);
    for (let k = 0; k < n; k++) {
      let d = k / n * per, px, py;
      if (d < bw) { px = bx + d; py = by; } else if ((d -= bw) < bh) { px = bx + bw; py = by + d; }
      else if ((d -= bh) < bw) { px = bx + bw - d; py = by + bh; } else { d -= bw; px = bx; py = by + bh - d; }
      const on = (k + phase) % 2 === 0;
      g.beginPath(); g.arc(px, py, 4.2, 0, Math.PI * 2);
      g.fillStyle = on ? (k % 4 < 2 ? '#fff6b0' : '#ff6a5a') : 'rgba(120,80,20,.5)';
      if (on) { g.shadowColor = k % 4 < 2 ? GOLD : RED; g.shadowBlur = 10; } else g.shadowBlur = 0;
      g.fill();
    }
    g.restore();
    // 閃爍小星星：框裡框外隨機一閃一閃
    for (let k = 0; k < 10; k++) {
      const s = Math.sin(t * 7 + k * 1.7);
      if (s > 0.2) star(bx + ((k * 97) % 100) / 100 * bw, by + ((k * 61 + 13) % 100) / 100 * bh, 4 + s * 5, t + k, '#fffbe0', s * fade);
    }
    // 爆開的大星星
    parts.forEach(p => {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.vx *= 0.985; p.rot += p.vr * dt;
      const a = Math.max(0, 1 - p.t / p.life);
      if (a > 0) star(p.x, p.y, p.r, p.rot, p.c, a);
    });
  }

  function hideAll() { light(-1); imgs.forEach(i => i.classList.remove('win')); }

  return {
    // charm3d 每一格都呼叫：{ rot, vel, active（正在拖或轉）, front（正面朝外） }
    frame(s) {
      if (!s.front) { if (visible) { layer.style.visibility = 'hidden'; visible = false; } SFX.whir(0); return; }
      if (!visible) { layer.style.visibility = ''; visible = true; }
      if (!s.active) { SFX.whir(0); return; }
      const i = which(s.rot);
      if (i !== cur) { cur = i; SFX.tick(Math.abs(s.vel)); }
      if (winIdx >= 0) { imgs[winIdx].classList.remove('win'); winIdx = -1; }
      light(i);
      SFX.whir(Math.abs(s.vel));
    },
    // 停下來了：照停在哪個選項演
    stop(rot) {
      SFX.whir(0);
      const i = which(rot), o = opts[i];
      cur = i; light(-1);
      if (o.win) { SFX.win(); startWin(i); }
      else if (o.again) { SFX.again(); light(i); banner.classList.remove('go'); void banner.offsetWidth; banner.classList.add('go'); setTimeout(() => light(-1), 1300); }
      else { SFX.miss(); light(i); setTimeout(() => { if (lastLit === i) light(-1); }, 900); }
    },
    // 開關關掉：全部收起來（下次打開不用再載）
    show(on) {
      layer.hidden = !on; cv.hidden = !on; banner.hidden = !on;
      if (!on) { hideAll(); SFX.whir(0); fxUntil = 0; clear(); }
    },
    unlockAudio() { audio(); }
  };
}

// 電影貼紙組的開盒演出（2026-10-06 他要的：參考明日方舟那種手遊開禮物，特效多一點、配音效）。
// 打開電影貼紙組才載入（shared.js 用 CK_MOD 動態 import），其他頁面完全不受影響。
// 演成一場「首映」，總長約 4.4 秒，演出中點一下畫面直接跳到結果：
//   0.0  熄燈：畫面暗下來，一道投影機光打在盒子上，光裡飄著灰塵（投影機喀喀聲）
//   0.4  倒數：盒子前面浮出老電影的倒數圈 3 → 2 → 1，盒子跟著每個數字抖一下（嗶、嗶、高音嗶）
//   1.3  開盒：盒蓋炸開，盒口射出旋轉的放射光，噴火花和底片碎片（8-bit 拉炮聲）
//   1.45 登場：貼紙一張張從盒口飛出、拖著光，落定時閃一圈（每張一個音，音階往上爬）
//   ~3.5 壓軸：電影票根＋發票最後出場，金光、落地時一圈金色爆光（鏘）
//   ~4.4 亮相：燈亮回來、畫框淡入、彩帶飄下來（收尾和弦）
// 介面：play({ stage, box, els, items, itemTf, finals, z, frame, sfx }) → { skip() }

let styled = false;
function addStyle() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent =
    '.cn-dim{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 48%,rgba(20,16,30,.55),rgba(8,6,14,.9));opacity:0;transition:opacity .4s;pointer-events:none}' +
    '.cn-dim.on{opacity:1}' +
    '.cn-beam{position:absolute;left:-10%;top:-30%;width:80%;height:120%;pointer-events:none;opacity:0;transition:opacity .4s;' +
      'background:conic-gradient(from 128deg at 0% 0%,transparent 0deg,rgba(255,244,214,.0) 4deg,rgba(255,244,214,.22) 12deg,rgba(255,244,214,.07) 22deg,transparent 30deg);mix-blend-mode:screen}' +
    '.cn-beam.on{opacity:1}' +
    // 老電影倒數圈：白圈＋十字線＋掃過去的扇形＋大數字
    '.cn-count{position:absolute;left:50%;top:44%;width:min(36vw,190px);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;' +
      'border:3px solid rgba(255,255,255,.85);box-shadow:0 0 0 7px rgba(255,255,255,.18),0 0 30px rgba(0,0,0,.5);overflow:hidden;display:grid;place-items:center;' +
      'background:linear-gradient(rgba(255,255,255,.55),rgba(255,255,255,.55)) center/2px 100% no-repeat,linear-gradient(rgba(255,255,255,.55),rgba(255,255,255,.55)) center/100% 2px no-repeat,rgba(30,26,34,.55)}' +
    '.cn-count::before{content:"";position:absolute;inset:0;background:conic-gradient(rgba(255,255,255,.3) 0 100deg,transparent 0);animation:cn-sweep .3s linear infinite}' +
    '@keyframes cn-sweep{to{transform:rotate(360deg)}}' +
    '.cn-count b{position:relative;font:900 min(22vw,118px)/1 "Noto Sans TC",system-ui,sans-serif;color:#fff;text-shadow:0 0 18px rgba(255,255,255,.6);animation:cn-num .3s ease-out}' +
    '@keyframes cn-num{from{transform:scale(1.5);opacity:0}}' +
    '.cn-flash{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 44%,#fff 0,rgba(255,240,200,.85) 18%,rgba(255,220,140,0) 60%);opacity:0}' +
    '.cn-rays{position:absolute;left:50%;top:44%;width:150vmax;height:150vmax;pointer-events:none;transform:translate(-50%,-50%) scale(.2);opacity:0;mix-blend-mode:screen;' +
      'background:repeating-conic-gradient(rgba(255,236,170,.42) 0deg 5deg,transparent 5deg 17deg);' +
      '-webkit-mask:radial-gradient(circle,#000 0,rgba(0,0,0,.6) 18%,transparent 42%);mask:radial-gradient(circle,#000 0,rgba(0,0,0,.6) 18%,transparent 42%)}' +
    '.cn-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}' +
    '.cn-ring{position:absolute;width:10px;height:10px;border-radius:50%;pointer-events:none;transform:translate(-50%,-50%);border:3px solid rgba(255,244,200,.95);' +
      'box-shadow:0 0 12px rgba(255,220,120,.9);animation:cn-ring .5s ease-out forwards}' +
    '.cn-ring.gold{border-color:#ffd23a;box-shadow:0 0 22px #ffb300,inset 0 0 12px #ffd23a;animation-duration:.8s}' +
    '@keyframes cn-ring{to{width:150px;height:150px;opacity:0;border-width:1px}}' +
    '.sl-item.cn-rare{animation:cn-rare 1s ease-in-out 3}' +
    '@keyframes cn-rare{50%{filter:drop-shadow(0 0 14px #ffd23a) drop-shadow(0 0 4px #fff3b0) brightness(1.12)}}';
  document.head.appendChild(st);
}

export function play(o) {
  addStyle();
  const { stage, box, els, items, itemTf, finals, z, frame, sfx } = o;
  const W = z.w, H = z.h, mouth = { x: W / 2, y: H * 0.42, r: 0 };
  const timers = [], anims = [], added = [];
  let done = false, raf = 0;
  const at = (ms, fn) => timers.push(setTimeout(() => { if (!done) fn(); }, ms));
  const add = (cls, before, html) => {
    const d = document.createElement(cls === 'cn-fx' ? 'canvas' : 'div'); d.className = cls; if (html) d.innerHTML = html;
    if (before) stage.insertBefore(d, before); else stage.appendChild(d);
    added.push(d); return d;
  };
  // 圖層：暗幕、投影機光在盒子後面；放射光在盒子和貼紙中間；火花、閃光、倒數在最上面
  const dim = add('cn-dim', stage.firstChild), beam = add('cn-beam', dim.nextSibling);
  const itemsBox = stage.querySelector('.sl-items');
  const rays = add('cn-rays', itemsBox);
  const cv = add('cn-fx'), flash = add('cn-flash');
  const g = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; g.scale(dpr, dpr);
  const parts = [];
  if (frame) { frame.style.transition = 'none'; frame.style.opacity = 0; }

  // ---- 粒子：灰塵（投影機光裡）、火花、底片碎片、彩帶 ----
  for (let i = 0; i < 26; i++) parts.push({ k: 'dust', x: Math.random() * W * 0.75, y: Math.random() * H, vx: 4 + Math.random() * 8, vy: -2 + Math.random() * 4, r: 0.6 + Math.random() * 1.6, life: 99, t: 0 });
  function sparks(x, y, n, gold) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5, v = 180 + Math.random() * 420;
      parts.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.6, t: 0, c: gold ? (Math.random() < 0.5 ? '#ffd23a' : '#fff1b0') : (Math.random() < 0.6 ? '#fff6d8' : '#ffb84d') });
    }
  }
  function shards(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2, v = 160 + Math.random() * 300;
      parts.push({ k: 'film', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, w: 16 + Math.random() * 14, life: 1.4 + Math.random() * 0.6, t: 0 });
    }
  }
  function confetti(n) {
    const C = ['#ff5a4f', '#ffd23a', '#4fb3ff', '#7bd88f', '#ffffff', '#ff8fc7'];
    for (let i = 0; i < n; i++) parts.push({ k: 'conf', x: Math.random() * W, y: -10 - Math.random() * H * 0.4, vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 90, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, w: 6 + Math.random() * 5, c: C[i % C.length], life: 2.6 + Math.random(), t: 0 });
  }
  let last = performance.now(), beamOn = true;
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    g.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt;
      if (p.k === 'dust') {
        if (!beamOn) { parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; if (p.x > W * 0.8) p.x = 0;
        g.globalAlpha = 0.35 + 0.3 * Math.sin(p.t * 2 + i); g.fillStyle = '#fff4d6'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); continue;
      }
      if (p.t > p.life) { parts.splice(i, 1); continue; }
      const f = 1 - p.t / p.life;
      if (p.k === 'spark') {
        p.vy += 520 * dt; p.vx *= 0.985; const ox = p.x, oy = p.y; p.x += p.vx * dt; p.y += p.vy * dt;
        g.globalAlpha = f; g.strokeStyle = p.c; g.lineWidth = 2.2; g.beginPath(); g.moveTo(ox - p.vx * 0.03, oy - p.vy * 0.03); g.lineTo(p.x, p.y); g.stroke();
      } else if (p.k === 'film') {                       // 底片碎片：黑色長條＋兩排齒孔
        p.vy += 380 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.min(1, f * 1.5);
        const w = p.w, h = w * 0.62; g.fillStyle = '#1d1a20'; g.fillRect(-w / 2, -h / 2, w, h);
        g.fillStyle = '#f2e7d0'; for (let s = -w / 2 + 2; s < w / 2 - 2; s += 5) { g.fillRect(s, -h / 2 + 1.5, 2.4, 2.4); g.fillRect(s, h / 2 - 3.9, 2.4, 2.4); }
        g.fillStyle = 'rgba(120,170,220,.55)'; g.fillRect(-w / 2 + 2, -h / 2 + 5, w - 4, h - 10); g.restore();
      } else if (p.k === 'conf') {
        p.x += p.vx * dt + Math.sin(p.t * 3 + i) * 0.6; p.y += p.vy * dt; p.rot += p.vr * dt;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.min(1, f * 2); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.w * 0.3, p.w, p.w * 0.6); g.restore();
      }
    }
    g.globalAlpha = 1;
    if (!done || parts.length) raf = requestAnimationFrame(tick); else raf = 0;
  }
  raf = requestAnimationFrame(tick);

  // ---- 0.0 熄燈 ----
  at(30, () => { dim.classList.add('on'); beam.classList.add('on'); });   // 隔一下再加，淡入才會有動畫
  if (sfx) sfx.projector();
  // ---- 0.4～1.3 倒數 ----
  const count = add('cn-count');
  count.style.opacity = 0;
  [3, 2, 1].forEach((n, k) => at(400 + k * 300, () => {
    count.style.opacity = 1; count.innerHTML = '<b>' + n + '</b>';
    anims.push(box.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-5px,2px) rotate(-2deg)' }, { transform: 'translate(4px,-2px) rotate(1.5deg)' }, { transform: 'translate(0,0)' }], { duration: 220 }));
    if (sfx) sfx.beep(k === 2);
  }));
  // ---- 1.3 開盒 ----
  at(1300, () => {
    count.style.opacity = 0;
    box.classList.add('lid-open');
    anims.push(flash.animate([{ opacity: 0 }, { opacity: 0.95, offset: 0.15 }, { opacity: 0 }], { duration: 650, easing: 'ease-out' }));
    anims.push(rays.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.2) rotate(0deg)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1) rotate(25deg)', offset: 0.25 },
      { opacity: 0.85, transform: 'translate(-50%,-50%) scale(1.05) rotate(70deg)', offset: 0.8 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.1) rotate(90deg)' }], { duration: 2800, easing: 'linear' }));
    sparks(mouth.x, mouth.y, 60); shards(mouth.x, mouth.y, 14);
    if (sfx) sfx.SFX.popper();
  });
  at(2300, () => box.classList.add('gone'));
  // ---- 1.45～ 登場：一般的先、稀有（票根）最後 ----
  const order = els.map((el, i) => i).sort((a, b) => (items[a].rare ? 1 : 0) - (items[b].rare ? 1 : 0));
  let t0 = 1450, k = 0;
  order.forEach((i, n) => {
    const el = els[i], end = finals[i], rare = !!items[i].rare;
    const start = rare ? t0 + 150 : t0, dur = rare ? 800 : 620;
    const mid = { x: mouth.x + (end.x - mouth.x) * 0.45 + ((i * 29) % 60 - 30), y: Math.min(mouth.y, end.y) - 110 - (i * 17) % 60, r: (i * 61) % 50 - 25 };
    const glow = rare ? 'drop-shadow(0 0 16px #ffd23a) drop-shadow(0 0 6px #fff3b0)' : 'drop-shadow(0 0 10px rgba(255,236,170,.95))';
    anims.push(el.animate([
      { transform: itemTf(mouth, 0.1), opacity: 0, filter: glow },
      { transform: itemTf(mid, rare ? 1.25 : 0.85), opacity: 1, filter: glow, offset: 0.45 },
      { transform: itemTf(end, 1), opacity: 1, filter: 'none' }
    ], { duration: dur, delay: start, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' }));
    const landIdx = k++;
    at(start + dur, () => {
      const r = document.createElement('i'); r.className = 'cn-ring' + (rare ? ' gold' : '');
      r.style.left = end.x + 'px'; r.style.top = end.y + 'px'; stage.appendChild(r); added.push(r);
      if (rare) { sparks(end.x, end.y, 40, true); el.classList.add('cn-rare'); if (sfx) sfx.chime(); }
      else if (sfx) sfx.cineNote(landIdx);
    });
    if (!rare) t0 += 85; else t0 = start + dur;
  });
  const endT = t0 + 120;
  // ---- 亮相 ----
  at(endT, () => finale(false));
  function finale(skipped) {
    beamOn = false; dim.classList.remove('on'); beam.classList.remove('on');
    if (frame) { frame.style.transition = 'opacity .5s'; frame.style.opacity = 1; }
    if (!skipped) { confetti(70); if (sfx) sfx.chord(); anims.push(flash.animate([{ opacity: 0 }, { opacity: 0.35 }, { opacity: 0 }], { duration: 500 })); }
    done = true;
    timers.push(setTimeout(cleanup, 3200));
  }
  function cleanup() {
    added.forEach(d => d.remove());
    if (raf) cancelAnimationFrame(raf);
  }
  return {
    // 演出中點畫面：直接跳到結果
    skip() {
      if (done) return;
      timers.forEach(clearTimeout); timers.length = 0;
      anims.forEach(a => { try { a.finish(); } catch (e) {} });
      box.classList.add('lid-open', 'gone');
      count.style.opacity = 0;
      finale(true);
    },
    get running() { return !done; },
    // 收回盒子／換組合／關掉：全部清掉
    stop() { done = true; timers.forEach(clearTimeout); anims.forEach(a => { try { a.cancel(); } catch (e) {} }); cleanup(); }
  };
}

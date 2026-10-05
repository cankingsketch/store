// 電影貼紙組開盒的彩帶（2026-10-06）：打開電影貼紙組才載入（shared.js 用 CK_MOD 動態 import）。
// 原本做了一整套「首映」演出（熄燈、倒數、放射光、火花、底片碎片、一張張登場、金色票根…），
// 他看完說只留彩帶和拉炮聲、其他拿掉 → 開盒動畫照舊，盒子打開那一下從上面飄彩帶（拉炮聲在 shared.js 放）。
// 介面：confetti(stage) → { stop() }

export function confetti(stage) {
  const W = stage.clientWidth, H = stage.clientHeight;
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  stage.appendChild(cv);
  const g = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; g.scale(dpr, dpr);
  const C = ['#ff5a4f', '#ffd23a', '#4fb3ff', '#7bd88f', '#ffffff', '#ff8fc7'], parts = [];
  for (let i = 0; i < 70; i++) {
    parts.push({ x: Math.random() * W, y: -10 - Math.random() * H * 0.4, vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 90,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, w: 6 + Math.random() * 5, c: C[i % C.length], life: 2.6 + Math.random(), t: 0 });
  }
  let last = performance.now(), raf = 0;
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    g.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt;
      if (p.t > p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt + Math.sin(p.t * 3 + i) * 0.6; p.y += p.vy * dt; p.rot += p.vr * dt;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.min(1, (1 - p.t / p.life) * 2);
      g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.w * 0.3, p.w, p.w * 0.6); g.restore();
    }
    if (parts.length) raf = requestAnimationFrame(tick); else stop();
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; cv.remove(); }
  raf = requestAnimationFrame(tick);
  return { stop };
}

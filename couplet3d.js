// 龍會罐通燙金春聯的預覽（2026-10-05 他要的）：擺成斗方——龍頭那個角朝上（照實拍圖），燙金會發光、有一道光掃過，跟著滑鼠微微傾斜。
// 圖是 build_chunlian.py 從工廠的 .ai 做的：<art>（印刷＋金色燙金）、同名 -foil（燙金形狀，當 mask）、-glow（燙金外的金光）。
// 不是真的 3D，用 CSS 做；介面跟其他 3D 模組一樣：create(art) → { mount(host), pointer(x, y) }，商品視窗用 CK_MOD 載入。

let styled = false;
function addStyle() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent =
    '.cpl3d{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;perspective:1200px;--tx:0deg;--ty:0deg}' +
    // 斗方：先跟著滑鼠傾斜，再轉 -45 度（原圖右上角的龍頭朝上）；斜放後對角線＝框的高，所以邊長抓 0.62
    '.cpl3d .cd{position:relative;height:62%;aspect-ratio:1;transform:rotateY(var(--tx)) rotateX(var(--ty)) rotate(-45deg);transition:transform .25s ease-out}' +
    '.cpl3d .cd img,.cpl3d .cd i{position:absolute;inset:0;width:100%;height:100%;display:block}' +
    '.cpl3d .cd img.art{box-shadow:0 3px 6px rgba(0,0,0,.14),0 22px 40px rgba(0,0,0,.2)}' +
    '.cpl3d .cd img.glow{mix-blend-mode:screen;animation:cpl-glow 2.6s ease-in-out infinite alternate;pointer-events:none}' +
    '.cpl3d .cd i.shine{-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;pointer-events:none;' +
      'background:linear-gradient(120deg,rgba(255,255,255,0) 40%,rgba(255,252,225,.95) 50%,rgba(255,255,255,0) 60%) no-repeat;' +
      'background-size:250% 100%;mix-blend-mode:screen;animation:cpl-sweep 3.4s ease-in-out infinite}' +
    '@keyframes cpl-glow{from{opacity:.25}to{opacity:.85}}' +
    '@keyframes cpl-sweep{0%{background-position:130% 0}55%,100%{background-position:-30% 0}}';
  document.head.appendChild(st);
}

export function create(art) {
  addStyle();
  const base = art.replace(/-l\.webp$/, '');
  const el = document.createElement('div');
  el.className = 'cpl3d';
  el.innerHTML = '<div class="cd"><img class="art" src="' + art + '" alt="龍會罐通燙金春聯"><img class="glow" src="' + base + '-glow.webp" alt=""><i class="shine"></i></div>';
  const sh = el.querySelector('.shine'), m = 'url(' + base + '-foil.webp)';
  sh.style.webkitMaskImage = m; sh.style.maskImage = m;
  return {
    mount(host) { if (el.parentNode !== host) host.appendChild(el); },
    // 滑鼠位置 0～1：微微傾斜，看得出是一張紙
    pointer(x, y) { el.style.setProperty('--tx', ((x - 0.5) * 18).toFixed(1) + 'deg'); el.style.setProperty('--ty', (-(y - 0.5) * 14).toFixed(1) + 'deg'); }
  };
}

// 貼紙清單：3D 預覽頁和版面設計稿共用。
// 新增一款：跑 build_assets.py（有 .ai）或 build_from_png.py（只有去背 PNG）產生 assets/<id>-*，
// 把它印出的那行補進來，再填 name／added。
// 名稱和 price 是 2026-09-30 從賣貨便賣場頁面讀到的（賣貨便價）。蝦皮因為平台手續費，多數商品約貴一成。
// added 是上架日（決定「新款」標籤和排序）。目前的日期是示意，不是真的上架日。
// set 有值的是「組合裡的一張」，不單賣、不進貼紙牆，只在組合預覽裡出現。
window.CK_STICKERS = [
  { id: 'onigiri',       name: '飯糰',       wMm: 81.1,  hMm: 87.2, padMm: 5, holo: 0, added: '2026-08-30' },
  { id: 'breakfast',     name: '早餐',       wMm: 101.3, hMm: 75.4, padMm: 5, holo: 0, added: '2026-08-30' },
  { id: 'buhuihuahua',   name: '不會畫畫', wMm: 80,    hMm: 67,   padMm: 5, holo: 1, added: '2026-09-25' },   // 最新款，其他都是舊款
  { id: 'haohuihuahua',  name: '好會畫畫',   wMm: 82,    hMm: 55.6, padMm: 5, holo: 0, added: '2026-08-30' },
  { id: 'pofang',        name: '破防了',     wMm: 69,    hMm: 88,   padMm: 5, holo: 0, added: '2026-06-25' },
  { id: 'ramen',         name: '拉麵是健康食品', wMm: 72,    hMm: 77,   padMm: 5, holo: 0, added: '2026-06-25' },
  { id: 'forced-work',   name: '被迫工作中', wMm: 75,    hMm: 79,   padMm: 5, holo: 0, added: '2026-04-12' },
  { id: 'no-overtime',   name: '今天不加班', wMm: 75,    hMm: 79,   padMm: 5, holo: 0, added: '2026-04-12' },
  { id: 'diet-tomorrow', name: '明天再減肥', wMm: 75,    hMm: 79,   padMm: 5, holo: 0, added: '2026-04-12' },

  // 電影貼紙組（16 張貼紙＋1 張紙本電影票）。順序＝從盒子裡跳出來的順序
  // 送印檔為了省版面把幾張轉向排（牛妹、空罐、二姊、警察人、小偷人、聯名飲料、上映中），這裡的圖已經照實物照片擺正
  { id: 'mv-elder',      set: 'movie', name: '姐姐',     wMm: 54.5, hMm: 63.2, padMm: 5, holo: 0 },
  { id: 'mv-second',     set: 'movie', name: '二姊',     wMm: 53.2, hMm: 64.2, padMm: 5, holo: 0 },
  { id: 'mv-sister',     set: 'movie', name: '妹妹',     wMm: 52.7, hMm: 66.4, padMm: 5, holo: 0 },
  { id: 'mv-brother',    set: 'movie', name: '哥哥',     wMm: 52,   hMm: 62.8, padMm: 5, holo: 0 },
  { id: 'mv-maid',       set: 'movie', name: '女僕',     wMm: 48.5, hMm: 61.7, padMm: 5, holo: 0 },
  { id: 'mv-cow',        set: 'movie', name: '牛妹',     wMm: 63.1, hMm: 63.8, padMm: 5, holo: 0 },
  { id: 'mv-canking',    set: 'movie', name: '空罐',     wMm: 49.2, hMm: 56.5, padMm: 5, holo: 0 },
  { id: 'mv-seat',       set: 'movie', name: '椅子',     wMm: 50.4, hMm: 58.8, padMm: 5, holo: 0 },
  { id: 'mv-police',     set: 'movie', name: '警察人',   wMm: 32.7, hMm: 44.7, padMm: 5, holo: 0 },
  { id: 'mv-thief',      set: 'movie', name: '小偷人',   wMm: 31.8, hMm: 41,   padMm: 5, holo: 0 },
  { id: 'mv-drink',      set: 'movie', name: '聯名飲料', wMm: 19.4, hMm: 34.8, padMm: 5, holo: 0 },
  { id: 'mv-nocamera',   set: 'movie', name: '盜錄禁止', wMm: 59.9, hMm: 51,   padMm: 5, holo: 0 },
  { id: 'mv-nowshowing', set: 'movie', name: '上映中',   wMm: 54.9, hMm: 24.9, padMm: 5, holo: 0 },
  { id: 'mv-shot1',      set: 'movie', name: '劇照 1',   wMm: 78,   hMm: 38.7, padMm: 5, holo: 0 },
  { id: 'mv-shot2',      set: 'movie', name: '劇照 2',   wMm: 78,   hMm: 38.9, padMm: 5, holo: 0 },
  { id: 'mv-poster',     set: 'movie', name: '電影海報', wMm: 54,   hMm: 76.4, padMm: 5, holo: 0 },
  // 票根＋發票：不是貼紙（紙，不能撕），實物是票根疊在發票上、左上角用訂書針釘住，所以合成一件（不會被分開翻起或單獨點開）。
  // 發票沒有原稿，是 make_receipt.py 照實物照片排的；票根圖用 mv-ticket-art（單獨的 mv-ticket 已不放進組合）
  // stack＝兩層：下層發票不動（-under.webp），上層票根可以翻，但訂書針那角釘住：只能從右下角（grab）往左上翻，
  // 摺線不能越過訂書針兩端（pin）。數字是 make_receipt.py --stub 印出來的（mm，原點在中心、y 朝下）
  { id: 'mv-stub',       set: 'movie', name: '電影票根＋發票', wMm: 58, hMm: 84, padMm: 5, holo: 0, paper: 1,
    stack: { grab: [25.0, 4.4], pin: [[-23.8, -37.4], [-14.8, -37.4]] } },

  // 洗沐標籤貼（大 3 張 6cm、小 3 張 4cm）。圖是從商品圖切出來的暫代品，解析度低
  { id: 'lb-shampoo-l',     set: 'label', gloss: 1, name: '洗髮精（大）', wMm: 46.5, hMm: 60, padMm: 5, holo: 0 },
  { id: 'lb-conditioner-l', set: 'label', gloss: 1, name: '潤髮乳（大）', wMm: 46.3, hMm: 60, padMm: 5, holo: 0 },
  { id: 'lb-soap-l',        set: 'label', gloss: 1, name: '沐浴乳（大）', wMm: 46.5, hMm: 60, padMm: 5, holo: 0 },
  { id: 'lb-shampoo-s',     set: 'label', gloss: 1, name: '洗髮精（小）', wMm: 31,   hMm: 40, padMm: 5, holo: 0 },
  { id: 'lb-conditioner-s', set: 'label', gloss: 1, name: '潤髮乳（小）', wMm: 31.1, hMm: 40, padMm: 5, holo: 0 },
  { id: 'lb-soap-s',        set: 'label', gloss: 1, name: '沐浴乳（小）', wMm: 30.6, hMm: 40, padMm: 5, holo: 0 },

  // 透明貼紙板（100×124mm 半斷，裝在 100×150mm 紅色背卡上）。clear＝透明膜；sx／sy＝這一枚在板子上的中心（mm）
  { id: 'faces-01', set: 'faces', name: '表情 1', wMm: 31.6, hMm: 28.4, padMm: 5, holo: 0, clear: 1, sx: 21.7, sy: 17.4 },
  { id: 'faces-02', set: 'faces', name: '表情 2', wMm: 26.6, hMm: 27.6, padMm: 5, holo: 0, clear: 1, sx: 53.6, sy: 18.5 },
  { id: 'faces-03', set: 'faces', name: '表情 3', wMm: 26.2, hMm: 24.1, padMm: 5, holo: 0, clear: 1, sx: 82.8, sy: 14.9 },
  { id: 'faces-04', set: 'faces', name: '表情 4', wMm: 24.8, hMm: 26.2, padMm: 5, holo: 0, clear: 1, sx: 16.0, sy: 46.9 },
  { id: 'faces-05', set: 'faces', name: '表情 5', wMm: 39.6, hMm: 27.9, padMm: 5, holo: 0, clear: 1, sx: 50.6, sy: 48.1 },
  { id: 'faces-06', set: 'faces', name: '表情 6', wMm: 25.4, hMm: 23.9, padMm: 5, holo: 0, clear: 1, sx: 85.3, sy: 42.4 },
  { id: 'faces-07', set: 'faces', name: '表情 7', wMm: 26.5, hMm: 23.9, padMm: 5, holo: 0, clear: 1, sx: 16.0, sy: 75.0 },
  { id: 'faces-08', set: 'faces', name: '表情 8', wMm: 35.2, hMm: 24.9, padMm: 5, holo: 0, clear: 1, sx: 51.6, sy: 77.9 },
  { id: 'faces-09', set: 'faces', name: '表情 9', wMm: 23.6, hMm: 23.1, padMm: 5, holo: 0, clear: 1, sx: 83.8, sy: 68.5 },
  { id: 'faces-10', set: 'faces', name: '表情 10', wMm: 37.0, hMm: 32.1, padMm: 5, holo: 0, clear: 1, sx: 20.6, sy: 105.7 },
  { id: 'faces-11', set: 'faces', name: '表情 11', wMm: 28.4, hMm: 22.1, padMm: 5, holo: 0, clear: 1, sx: 83.8, sy: 93.3 },
  { id: 'faces-12', set: 'faces', name: '表情 12', wMm: 36.6, hMm: 26.1, padMm: 5, holo: 0, clear: 1, sx: 58.9, sy: 107.6 },
  { id: 'walk-01', set: 'walk', name: '散步 1', wMm: 43.2, hMm: 24.1, padMm: 5, holo: 0, clear: 1, sx: 24.1, sy: 14.9 },
  { id: 'walk-02', set: 'walk', name: '散步 2', wMm: 23.2, hMm: 19.9, padMm: 5, holo: 0, clear: 1, sx: 60.2, sy: 13.7 },
  { id: 'walk-03', set: 'walk', name: '散步 3', wMm: 8.3, hMm: 8.4, padMm: 5, holo: 0, clear: 1, sx: 93.6, sy: 7.4 },
  { id: 'walk-04', set: 'walk', name: '散步 4', wMm: 30.5, hMm: 42.6, padMm: 5, holo: 0, clear: 1, sx: 82.3, sy: 30.3 },
  { id: 'walk-05', set: 'walk', name: '散步 5', wMm: 33.6, hMm: 45.2, padMm: 5, holo: 0, clear: 1, sx: 18.4, sy: 52.3 },
  { id: 'walk-06', set: 'walk', name: '散步 6', wMm: 25.1, hMm: 46.0, padMm: 5, holo: 0, clear: 1, sx: 48.6, sy: 53.4 },
  { id: 'walk-07', set: 'walk', name: '散步 7', wMm: 19.6, hMm: 17.7, padMm: 5, holo: 0, clear: 1, sx: 67.9, sy: 61.0 },
  { id: 'walk-08', set: 'walk', name: '散步 8', wMm: 21.9, hMm: 17.8, padMm: 5, holo: 0, clear: 1, sx: 87.6, sy: 63.6 },
  { id: 'walk-09', set: 'walk', name: '散步 9', wMm: 9.8, hMm: 9.9, padMm: 5, holo: 0, clear: 1, sx: 30.6, sy: 75.7 },
  { id: 'walk-10', set: 'walk', name: '散步 10', wMm: 33.1, hMm: 41.6, padMm: 5, holo: 0, clear: 1, sx: 54.2, sy: 98.6 },
  { id: 'walk-11', set: 'walk', name: '散步 11', wMm: 27.6, hMm: 42.0, padMm: 5, holo: 0, clear: 1, sx: 84.0, sy: 94.7 },
  { id: 'walk-12', set: 'walk', name: '散步 12', wMm: 40.0, hMm: 39.8, padMm: 5, holo: 0, clear: 1, sx: 21.9, sy: 102.9 },
  { id: 'walk-13', set: 'walk', name: '散步 13', wMm: 6.0, hMm: 6.1, padMm: 5, holo: 0, clear: 1, sx: 68.6, sy: 118.2 }
];
window.CK_STICKERS.forEach(function (s) {
  if (!s.set) s.price = 50;      // 單張貼紙在賣貨便都是 50 元
  s.finish = s.paper ? '紙' : s.clear ? '透明' : s.holo ? '雷射' : s.gloss ? '亮面' : '霧面';
  s.note = (s.wMm / 10).toFixed(1).replace(/\.0$/, '') + ' × ' + (s.hMm / 10).toFixed(1).replace(/\.0$/, '') + ' cm・' + s.finish;
});

// 成組賣的貼紙。kind：box＝有盒子，先看到盒子、點了才跳出內容物；stack＝疊成一疊，點了攤開；
// sheet＝透明貼紙板：OPP 袋裡裝著紅色背卡＋一整張透明貼紙板，點了整張拿出來放大（貼紙還在板子上，不拆開）；
// bottles＝標籤貼，旁邊畫三個分裝瓶，點了小張的貼到瓶子上、大張的攤在旁邊
// photos＝原本排好的宣傳圖（路徑相對於 designs/），組合預覽上方可以切「3D 示意／商品圖」
// box 的尺寸是照展開圖量的（mm），六個面的圖在 assets/box-<id>-*.jpg
window.CK_SETS = [
  { id: 'movie', video: 'https://www.instagram.com/reel/DSSRR7fDFV7/', name: '空罐電影貼紙組', note: '16 張防水貼紙＋電影票根＋發票＋紙盒', unit: '件', price: 330, kind: 'box', box: { w: 94, h: 29, d: 60 }, closedHint: '點擊打開', resetLabel: '收回盒子',
    // 打開後照商品照的畫框擺：畫框內框在照片上是 830×590，每張＝[中心 x, 中心 y, 寬]（照片像素）
    layout: { w: 830, h: 590, items: {
      // 票根、發票照實物比例（他給的照片：票根跟椅子差不多寬，約 49.5mm；發票約 58mm）。以椅子 115 寬＝50.4mm 換算
      'mv-stub': [100, 172, 132], 'mv-seat': [302, 135, 115], 'mv-elder': [410, 128, 115], 'mv-brother': [515, 120, 120],
      'mv-maid': [630, 125, 120], 'mv-nowshowing': [748, 60, 145], 'mv-police': [752, 208, 75], 'mv-cow': [258, 290, 155],
      'mv-canking': [382, 280, 115], 'mv-second': [492, 282, 115], 'mv-sister': [592, 285, 120], 'mv-poster': [738, 390, 140],
      'mv-shot1': [435, 415, 200], 'mv-thief': [570, 405, 80], 'mv-drink': [118, 462, 55], 'mv-nocamera': [250, 490, 170],
      'mv-shot2': [460, 520, 200] } },
    photos: ['img/promo-movie.png'] },
  { id: 'faces', name: '空罐表情貼', note: '透明貼紙・一板 12 枚・10 × 12.4 cm', unit: '枚', price: 80, kind: 'sheet', closedHint: '點擊拿出來', resetLabel: '放回袋子' },
  { id: 'walk', name: '通學路散步組合貼', note: '透明貼紙・一板 13 枚・10 × 12.4 cm', unit: '枚', price: 80, kind: 'sheet', closedHint: '點擊拿出來', resetLabel: '放回袋子' },
  { id: 'label', name: '洗沐標籤貼', note: '大 3 張（6cm）＋小 3 張（4cm）・不含分裝瓶', unit: '張', price: 100, kind: 'bottles', closedHint: '點擊貼上', resetLabel: '撕下來',
    photos: ['img/promo-label.png'] }
];

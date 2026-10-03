// T 恤資料（周邊頁的 T 恤列、T 恤頁共用）。要在 shared.js 之後載入。
// 價格／尺寸：2026-10-01 賣貨便，四款都是預購 880、S～2XL；沒有蝦皮，另有海外預購表單。
// 尺寸表：四款同一種白胚（United Athle 5.6oz），他要統一用不想加班T那張尺寸表圖（04_orig.jpg），不用另外做文字版。
(function () {
  var IMG = '';
  var TPAGE = 't24676.html', FORM = 'https://forms.gle/zkzFUKQJnLB1xqSWA';
  var SIZE_IMG = 'img/opt/04_orig-l.webp';         // 瘦身過的 WebP（optimize_images.py）
  var sizeHtml = '<img class="sizeimg" src="' + SIZE_IMG + '" alt="空罐 T 尺寸表">';

  // series＝宣傳圖上的「空罐系列 T0x」；card＝周邊頁卡片用哪一面的去背圖
  // photos＝正式站 T 恤頁上這一款的圖，照原本頁面由上而下的順序；第一張是那一款的大圖。
  // 他喜歡原本頁面的圖片編排，不要另外拿 NAS 的圖（NAS 宣傳圖常帶舊日期、舊價格）。
  // 不放進來的：各款的尺寸表圖（t_orig.png、04_orig.jpg、editor_t.png，統一放在「尺寸表」分頁）、
  // 2_orig.png（「卡片背面」，是客製化信用卡的圖，放錯了）
  var RAW = [
    { id: 'tee-pofang', name: '破防T', series: 'T04', color: '白色', hex: '#f4f4f2', find: '破防T恤', card: 'front',
      // 破防襪是搭配破防T的（他要的）：點開破防T最後一張就是襪子那張宣傳圖
      photos: ['images/380636145_orig.png', 'images/socks_orig.png'], model: '模特兒 A 160cm／48kg 穿 S 合身', line: '兄弟買了吧，我朋友有點破防了' },
    { id: 'tee-ramen', name: '拉麵T', series: 'T03', color: '白色', hex: '#f4f4f2', find: '拉麵健康T恤', card: 'back',
      photos: ['images/1775592479_orig.png'], model: '模特兒 B 170cm／60kg 穿 L 合身', line: 'ラーメンは健康食品です' },
    { id: 'tee-noot', name: '不想加班T', series: 'T02', color: '黑色', hex: '#222', find: '不想加班T恤', card: 'front',
      photos: ['images/01_orig.jpg', 'images/editor_l.jpg?1748549184', 'images/editor_05.jpg?1748549147', 'images/1472244275_orig.png'],
      model: '模特兒穿 L', line: '今日は残業不要です' },
    { id: 'tee-nowork', name: '不想上班T', series: 'T01', color: '沙色', hex: '#d6c8b2', find: '不想工作T恤', card: 'back',
      photos: ['images/editor_2.jpg?1748556051', 'images/t_orig.jpg'], line: 'NO MORE WORK・沙色更新版本' }
  ];

  window.CK_TEES = RAW.map(function (t) {
    // 點開先看照片（分頁叫「實穿」）；圖都是正式站上的
    var a = 'assets/' + t.id, imgs = t.photos.map(function (p) { return 'img/opt/' + p.split('?')[0].replace(/^.*\//, '').replace(/\.(jpe?g|png)$/i, '') + '-l.webp'; });
    return { id: t.id, name: t.name, series: t.series, color: t.color, hex: t.hex, line: t.line, model: t.model || '',
      price: 880, note: '預購・' + t.color + '・S～2XL', findName: t.find, noShopee: 1,
      cut: a + (t.card === 'back' ? '-thumb-back.webp' : '-thumb.webp'),
      cut2: a + (t.card === 'back' ? '-thumb.webp' : '-thumb-back.webp'),
      img: imgs[0], more: imgs.slice(1), photoFirst: 1, photoLabel: '實穿',
      sizeHtml: sizeHtml,
      view3d: { module: 'tshirt3d.js', art: a + '-front.webp', uv: a + '-back.webp', hint: '點一下翻到背面' },
      links: [{ label: '海外預購', href: FORM }] };
  });
  window.CK_TEE_INFO = { TPAGE: TPAGE, FORM: FORM, SIZE_IMG: SIZE_IMG };
})();

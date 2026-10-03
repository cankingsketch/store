// 畫冊資料：畫冊頁（books）和周邊頁的「畫冊」一條共用（跟 tees-data.js 一樣的做法，改一處兩邊都跟著變）
// 圖片檔名是正式站 Weebly 時代的 uploads（CK_SHOP.opt 會換成 img/opt 的縮圖）
window.CK_BOOKS = {
  MYSHIP: 'https://myship.7-11.com.tw/general/detail/GM2308212736960',
  FORM: 'https://forms.gle/o2wVLt5KcqxdsSKd6',
  // 實體畫冊：[書名, 一行小字, 封面, [內頁…]]
  PRINT: [
    ['Canking 插畫設定集 6', '2022–2024 畫集', 'vol6_orig.png', ['vol6-1_orig.png', 'vol6-2_orig.png', 'vol6-3_orig.png']],
    ['Canking 完全設定集', '2022–2023 畫集', 'editor_ck.png?1714732171', ['2023-713-10_orig.jpg', '2023-713-13_orig.jpg', 'ck-1_orig.jpg', '2023-713-18_orig.jpg']],
    ['Canking Universe', '2020–2022 畫集', 'cu_orig.png', ['cu-0005-3031_orig.png', 'cu-0006-2829_orig.png', 'cu-0013-1415_orig.png', 'cu-0015-1011_orig.png']],
    ['Canking Sketch', '2019–2020 畫集', 'cover2020.jpg?1685349297', ['006_orig.jpg', '10_orig.jpg', '8_orig.jpg', '9_orig.jpg']],
    ['Secret Letter', '2015–2017 畫集', 'editor_85629136.jpg?1685348935', ['0203-orig_orig.jpg', '0607-orig_orig.jpg', '0809-orig_orig.jpg', '1415-orig_orig.jpg']],
    ['Remembrance', 'FGO 全彩插畫本', 'editor_remembrance.jpg?1685349224', ['fgo-11_orig.jpg', 'fgo-10_orig.jpg', 'fgo12_orig.jpg']],
    ['FGO 卡片組合', '五張一組', 'fgo_orig.png', []]
  ],
  // 電子版：[書名, 小字, 封面, [內頁…], Gumroad]
  DIGI: [
    ['DVA SKETCH', '鬥陣特攻 DVA 黑白插畫本', 'dva01_orig.jpg', ['dva02_orig.jpg', 'dva03_orig.jpg', 'dva04_orig.jpg', 'dva05_orig.jpg'], 'https://cankingsketch.gumroad.com/l/ExIhp?layout=profile'],
    ['ADDRESS', 'LOL 全彩插畫本 2', 'address01.jpg?1748535590', ['address-02_orig.jpg', 'address-03_orig.jpg', 'address-04_orig.jpg', 'address-05_orig.jpg'], 'https://cankingsketch.gumroad.com/l/znvg?layout=profile'],
    ['LOL 雜繪集', 'LOL 插畫', 'lol1.jpg?1748535972', ['lol2_orig.jpg', 'lol3_orig.jpg', 'lol4_orig.jpg', 'lol5_orig.jpg'], 'https://cankingsketch.gumroad.com/l/qKVfQ?layout=profile']
  ]
};
// 點開一本：大圖燈箱（封面＋內頁），下面放購買按鈕。d＝電子版
window.CK_BOOKS.open = function (b, d) {
  var B = window.CK_BOOKS;
  CK_SHOP.lightbox({ imgs: [b[2]].concat(b[3]).map(function (s) { return CK_SHOP.opt(s, 'l'); }), nm: b[0], sub: b[1],
    btns: d ? [['電子版賣場', b[4]]] : [['711賣貨便', B.MYSHIP], ['海外購買', B.FORM, 1]] });
};

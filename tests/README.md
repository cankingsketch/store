# 測試

不需要安裝任何套件，Node 22 以上直接跑（用內建的 `node:sqlite` 模擬 Cloudflare D1）。

```
node tests/products.test.mjs    # 商品後台：goods.html 的無損切割／重組
node tests/track.test.mjs       # 點擊追蹤：/api/track 寫入與 /api/stats 彙總
```

兩支都是「全綠才算過」，任何一項失敗會以非零狀態結束。
改過 `functions/api/*.js` 或 `goods.html` 的商品區結構後，請務必跑一次。

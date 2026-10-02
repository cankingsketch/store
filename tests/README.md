# 測試

不需要安裝任何套件，Node 22 以上直接跑（用內建的 `node:sqlite` 模擬 Cloudflare D1）。

```
node tests/products.test.mjs    # 商品資料：data/products.json 格式與後端的檢查規則
node tests/save.test.mjs        # 存檔流程：所有變更打包成單一 commit、只推一次
node tests/track.test.mjs       # 點擊追蹤：/api/track 寫入與 /api/stats 彙總
```

兩支都是「全綠才算過」，任何一項失敗會以非零狀態結束。
改過 `functions/api/*.js` 或手動改過 `data/products.json` 後，請務必跑一次。

見 [CLAUDE.md](CLAUDE.md)。

那份是這個網站的完整說明書：部署鏈、頁面對照、活動系統、商品結構、
商品後台、流量統計、測試、Weebly 殘留。動手前先看過。

（同一份說明給所有 AI 用：Claude 讀 CLAUDE.md、Codex 讀 AGENTS.md，
內容放在 CLAUDE.md 一份就好，免得改了一邊忘了另一邊。）

一句話版本：**改完 `git push origin main`，Cloudflare Pages 會自動部署，
約 1～2 分鐘上線。不用跑任何部署指令。**
動到 `functions/` 或商品結構時，push 前先跑 `node tests/*.test.mjs`。
**這個 repo 是公開的，金鑰、token、折價碼一律不能進來。**

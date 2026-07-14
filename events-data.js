/* =========================================================
   空罐商店 — 活動清單（單一資料來源 / Single Source of Truth）
   ---------------------------------------------------------
   ★ 要新增活動：在下面 CANKING_EVENTS 陣列裡「複製一行、改內容」即可。
     順序不用管，程式會自動依日期排序、自動分「預定 / 過往」。

   欄位說明：
     date  顯示用的日期文字（想怎麼寫都行，例：2026/8/6~8/12）
     end   活動「最後一天」，格式一定要 YYYY-MM-DD
           （程式靠這個判斷活動是否已結束，務必填正確！）
     name  活動名稱
     booth 攤位（沒有就留空字串 ""）

   規則：end 這天過了（< 今天）→ 自動歸到「過往參加活動」；
        否則放在「預定參加活動」。
   ========================================================= */
window.CANKING_EVENTS = [
  // ---------- 較新的活動放上面比較好找，但順序其實不影響顯示 ----------
  { date: "2026/9/5~9/6",   end: "2026-09-06", name: "CWT-K51 高雄場",   booth: "" },
  { date: "2026/8/29~8/30", end: "2026-08-30", name: "CWT-T36 台中場",   booth: "" },
  { date: "2026/8/6~8/12",  end: "2026-08-12", name: "臺灣文博會",       booth: "J1-039" },
  { date: "2026/7/3~7/6",   end: "2026-07-06", name: "台北世貿文具展",   booth: "C122" },
  { date: "2026/5/23~5/24", end: "2026-05-24", name: "CooMIC 二元創庫4", booth: "A47.48" },
  { date: "2026/5/16~5/17", end: "2026-05-17", name: "PF44",             booth: "C01.02" },
  { date: "2026/3/2~3/5",   end: "2026-03-05", name: "插畫博覽會(花博)", booth: "D-506" },
  { date: "2026/3/7~8",     end: "2026-03-08", name: "CWT-K50 高雄場",   booth: "D29.30" },
  { date: "2026/2/28",      end: "2026-02-28", name: "CWT-T35 台中場",   booth: "B19.20" },
  { date: "2026/2/21~2/22", end: "2026-02-22", name: "CWT72 台北場",     booth: "K61.62(台大體育館1樓)" },
  { date: "2025/12/20~12/21", end: "2025-12-21", name: "CWT-K49 高雄場", booth: "F41.42" },
  { date: "2025/12/19~12/21", end: "2025-12-21", name: "插畫博覽會 台中場", booth: "B406" },
  { date: "2025/12/13~12/14", end: "2025-12-14", name: "FFK 駁二場",     booth: "Y23.24(自行車倉庫)" },
  { date: "2025/12/13~12/14", end: "2025-12-14", name: "CWT71 台北場",   booth: "B19.20(台大體育館3樓)" },
  { date: "2025/10/25~10/26", end: "2025-10-26", name: "台創祭6",        booth: "G17.18" },
  { date: "2025/9/13~9/14", end: "2025-09-14", name: "CWT-T34 台中場",   booth: "A33.34" },
  { date: "2025/9/6~9/7",   end: "2025-09-07", name: "CWT-K48 高雄場",   booth: "F49.50" },
  { date: "2025/8/22~8/23", end: "2025-08-23", name: "FF45",             booth: "I07.08" },
  { date: "2025/8/16~8/17", end: "2025-08-17", name: "CWT70 台北場",     booth: "暫無資訊" },
  { date: "2025/8/16",      end: "2025-08-16", name: "Nice 南港展覽館",  booth: "W01" },
  { date: "2025/7/4~7/7",   end: "2025-07-07", name: "台灣國際創意禮品文具展", booth: "B342" },
  { date: "2025/4/3~4/6",   end: "2025-04-06", name: "插畫博覽會",       booth: "A313" },
  { date: "2025/2/8~2/9",   end: "2025-02-09", name: "馬來西亞 S4O",     booth: "" },
  { date: "2025/2/8~2/9",   end: "2025-02-09", name: "CWT69 台北場",     booth: "C03.04" },
  { date: "2025/2/7~2/8",   end: "2025-02-08", name: "FF44",             booth: "H15.16" },
  { date: "2024/10/5~10/6", end: "2024-10-06", name: "台創祭 5",         booth: "G21.22" },
  { date: "2024/8/26~9/1",  end: "2024-09-01", name: "文博會(大台南會展中心)", booth: "F62" },
  { date: "2024/8/24~8/25", end: "2024-08-25", name: "CWT-K45 高雄場",   booth: "G27.28" },
  { date: "2024/8/23~8/24", end: "2024-08-24", name: "FF43 (五六)",      booth: "I31.32" },
  { date: "2024/8/17~8/18", end: "2024-08-18", name: "CWT-T32 台中場",   booth: "C29.30" },
  { date: "2024/8/10~8/11", end: "2024-08-11", name: "CWT67 台北場",     booth: "M21" },
  { date: "2024/5/18",      end: "2024-05-18", name: "創集絆",           booth: "" },
  { date: "2024/5/11",      end: "2024-05-11", name: "開拓動漫祭 PF40",  booth: "" },
  { date: "2024/3/9~10",    end: "2024-03-10", name: "CWT-K44 高雄場",   booth: "" },
  { date: "2024/3/2~3",     end: "2024-03-03", name: "CWT-T31 台中場",   booth: "" },
  { date: "2024/2/23~24",   end: "2024-02-24", name: "Fancy Frontier 42", booth: "" },
  { date: "2024/2/25",      end: "2024-02-25", name: "CWT66 台北場",     booth: "" },
  { date: "2023/12/30",     end: "2023-12-30", name: "日本 Comic Market 103", booth: "" }
];

/* ---------------- 以下是顯示邏輯，一般不用改 ---------------- */
(function () {
  // 注入共用樣式：每個欄位內部不換行、欄位間留間距（首頁與 events.html 都適用）
  (function injectStyle() {
    if (document.getElementById("ck-events-style")) return;
    var css =
      ".ck-ev-date,.ck-ev-name,.ck-ev-booth{white-space:nowrap}" +
      ".ck-ev-date{margin-right:.7em}.ck-ev-name{margin-right:.7em}";
    var s = document.createElement("style");
    s.id = "ck-events-style";
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  })();

  function parseDate(s) {
    var p = String(s).split("-");
    return new Date(+p[0], (+p[1]) - 1, +p[2]);
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function lineHtml(e) {
    // 用 <wbr> 標記「可換行點」：太長時整段欄位換行，不會把「攤位」拆成兩半
    var h =
      '<span class="ck-ev-date">' + escapeHtml(e.date) + "</span><wbr>" +
      '<span class="ck-ev-name">' + escapeHtml(e.name) + "</span>";
    if (e.booth) {
      h += '<wbr><span class="ck-ev-booth">攤位：' + escapeHtml(e.booth) + "</span>";
    }
    return '<div class="ck-event-line">' + h + "</div>";
  }

  // opts: { upcomingEl, pastEl, upcomingLimit, upcomingEmpty }
  window.cankingRenderEvents = function (opts) {
    opts = opts || {};
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var list = (window.CANKING_EVENTS || []).slice();

    // ---- 合併「展覽規劃器」自動同步的清單 (events-live.js) ----
    // 規則：同一年、名稱相同或互相包含 → 視為同一活動。
    //       靜態清單有攤位而規劃器沒有 → 保留靜態；否則以規劃器為準。
    var live = (window.CANKING_EVENTS_LIVE || []).slice();
    function norm(s) { return String(s || "").replace(/\s+/g, ""); }
    function yearOf(e) { return String(e.end || "").slice(0, 4); }
    live.forEach(function (le) {
      list = list.filter(function (se) {
        if (yearOf(se) !== yearOf(le)) return true;
        var a = norm(se.name), b = norm(le.name);
        if (!a || !b || a.length < 3 || b.length < 3) return true;
        var same = (a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0);
        if (!same) return true;
        if (se.booth && !le.booth) { le.__drop = true; return true; }
        return false;
      });
    });
    list = list.concat(live.filter(function (e) { return !e.__drop; }));

    var upcoming = list
      .filter(function (e) { return parseDate(e.end) >= today; })
      .sort(function (a, b) { return parseDate(a.end) - parseDate(b.end); }); // 越近的越前面

    var past = list
      .filter(function (e) { return parseDate(e.end) < today; })
      .sort(function (a, b) { return parseDate(b.end) - parseDate(a.end); }); // 越新的越前面

    function render(el, items, emptyText) {
      if (!el) return;
      if (!items.length) {
        el.innerHTML = '<div class="ck-event-line ck-event-empty">' + escapeHtml(emptyText || "目前沒有資料") + "</div>";
        return;
      }
      el.innerHTML = items.map(lineHtml).join("");
    }

    if (opts.upcomingEl) {
      var up = opts.upcomingLimit ? upcoming.slice(0, opts.upcomingLimit) : upcoming;
      render(opts.upcomingEl, up, opts.upcomingEmpty || "近期暫無活動，敬請期待！");
    }
    if (opts.pastEl) {
      render(opts.pastEl, past, "");
    }
    return { upcoming: upcoming, past: past };
  };
})();

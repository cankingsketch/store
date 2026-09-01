/* 手動重抓 Gumroad 商品清單（Cloudflare Pages Function）
 * POST /api/gumroad-refresh   <- 只有通過 Cloudflare Access 才能用
 *
 * 為什麼要獨立一支：
 * Cloudflare Access 是綁在「路徑」上的，同一個路徑沒辦法既公開又要求登入。
 * /api/gumroad 必須公開（賣場頁面要抓），所以重抓只能另開一條受保護的路徑。
 *
 * 做的事只有一件：把 D1 裡的快取清掉。下一次有人打開賣場頁面就會重抓。
 * 這樣這支不必碰 GUMROAD_TOKEN，也不會回傳任何商品資料。
 */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

async function clear(env) {
  if (!env.STATS) return { ok: false, error: '沒有 D1 綁定' };
  try {
    await env.STATS.prepare('DELETE FROM gumroad_cache WHERE id = 1').run();
    return { ok: true };
  } catch (e) {
    // 表還沒建過就等於已經是空的
    return { ok: true, note: '快取本來就是空的' };
  }
}

export async function onRequestPost({ request, env }) {
  if (!request.headers.get('Cf-Access-Authenticated-User-Email')) {
    return json({ error: '需要登入後台' }, 403);
  }
  const r = await clear(env);
  return json(Object.assign({ cleared: r.ok }, r.note ? { note: r.note } : {},
    r.error ? { error: r.error } : {}), r.ok ? 200 : 500);
}

// 用瀏覽器直接開網址也能清，方便臨時處理
export async function onRequestGet(ctx) {
  return onRequestPost(ctx);
}
